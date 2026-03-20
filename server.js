const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const connectedUsers = new Map();

// ─── WEBSOCKETS ───────────────────────────────
wss.on("connection", (ws) => {
  let userId = null;

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "auth") {
        userId = msg.userId;
        connectedUsers.set(userId, ws);
        ws.send(JSON.stringify({ type: "auth_ok" }));
      }

      if (msg.type === "message") {
        const { toUserId, text, matchId } = msg;
        await supabase.from("messages").insert({
          match_id: matchId,
          from_user: userId,
          to_user: toUserId,
          text,
          created_at: new Date().toISOString(),
        });
        const recipientWs = connectedUsers.get(toUserId);
        if (recipientWs && recipientWs.readyState === 1) {
          recipientWs.send(JSON.stringify({
            type: "message",
            from: userId,
            text,
            matchId,
            time: new Date().toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" }),
          }));
        }
      }

      if (msg.type === "location") {
        if (userId) {
          await supabase.from("users").update({
            lat: msg.lat,
            lng: msg.lng,
            last_seen: new Date().toISOString(),
          }).eq("id", userId);
        }
      }
    } catch(e) {
      console.error("WS error:", e);
    }
  });

  ws.on("close", () => {
    if (userId) connectedUsers.delete(userId);
  });
});

// ─── REGISTRO SIN EMAIL ───────────────────────
app.post("/auth/register", async (req, res) => {
  try {
    const { name, age, bio, photo_url, lat, lng } = req.body;

    if (!name || !age) return res.status(400).json({ error: "Nombre y edad requeridos" });

    const { data, error } = await supabase.from("users").insert({
      name,
      age: parseInt(age),
      bio: bio || "",
      photo_url: photo_url || "",
      lat: lat || 0,
      lng: lng || 0,
      visible: true,
      premium: false,
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, id: data.id, ...data });
  } catch(e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── USUARIOS CERCANOS ────────────────────────
app.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 500, userId } = req.query;
    if (!lat || !lng) return res.json([]);

    const { data: users } = await supabase
      .from("users")
      .select("id, name, age, bio, photo_url, lat, lng, premium")
      .eq("visible", true)
      .neq("id", userId);

    if (!users) return res.json([]);

    const nearby = users
      .map(u => {
        const dist = calcDistance(parseFloat(lat), parseFloat(lng), u.lat, u.lng);
        const angle = calcAngle(parseFloat(lat), parseFloat(lng), u.lat, u.lng);
        return { ...u, distance: Math.round(dist), angle };
      })
      .filter(u => u.distance <= parseInt(radius))
      .sort((a, b) => a.distance - b.distance);

    res.json(nearby);
  } catch(e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── LIKE / MATCH ─────────────────────────────
app.post("/like", async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;

    await supabase.from("likes").upsert({
      from_user: fromUserId,
      to_user: toUserId,
      created_at: new Date().toISOString(),
    });

    const { data: mutualLike } = await supabase
      .from("likes")
      .select("*")
      .eq("from_user", toUserId)
      .eq("to_user", fromUserId)
      .single();

    if (mutualLike) {
      const { data: match } = await supabase.from("matches").insert({
        user1: fromUserId,
        user2: toUserId,
        created_at: new Date().toISOString(),
      }).select().single();

      const { data: user1 } = await supabase.from("users").select("*").eq("id", fromUserId).single();
      const { data: user2 } = await supabase.from("users").select("*").eq("id", toUserId).single();

      const notify = (wsUserId, otherUser) => {
        const ws = connectedUsers.get(wsUserId);
        if (ws && ws.readyState === 1) {
          ws.send(JSON.stringify({ type:"match", matchId:match.id, withUser:otherUser }));
        }
      };
      notify(fromUserId, user2);
      notify(toUserId, user1);

      return res.json({ ok:true, match:true, matchId:match.id });
    }

    res.json({ ok:true, match:false });
  } catch(e) {
    res.status(500).json({ error:"Error interno" });
  }
});

// ─── MIS MATCHES ──────────────────────────────
app.get("/matches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .or(`user1.eq.${userId},user2.eq.${userId}`);

    if (!matches) return res.json([]);

    const enriched = await Promise.all(matches.map(async m => {
      const otherId = m.user1 === userId ? m.user2 : m.user1;
      const { data: other } = await supabase.from("users").select("id,name,age,photo_url").eq("id", otherId).single();
      return { ...m, otherUser: other };
    }));

    res.json(enriched);
  } catch(e) {
    res.status(500).json({ error:"Error interno" });
  }
});

// ─── MENSAJES DE UN MATCH ─────────────────────
app.get("/messages/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending:true });
    res.json(messages || []);
  } catch(e) {
    res.status(500).json({ error:"Error interno" });
  }
});

// ─── ACTUALIZAR USUARIO ───────────────────────
app.patch("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    await supabase.from("users").update(req.body).eq("id", userId);
    res.json({ ok:true });
  } catch(e) {
    res.status(500).json({ error:"Error interno" });
  }
});

// ─── ACTIVAR PREMIUM ──────────────────────────
app.post("/premium/activate", async (req, res) => {
  try {
    const { userId } = req.body;
    await supabase.from("users").update({ premium:true }).eq("id", userId);
    res.json({ ok:true });
  } catch(e) {
    res.status(500).json({ error:"Error interno" });
  }
});

// ─── UTILIDADES ───────────────────────────────
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcAngle(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── ARRANCAR ─────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`CO·CERCA backend corriendo en puerto ${PORT}`));
