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

wss.on("connection", (ws) => {
  let userId = null;
  ws.on("message", async (data) => {
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
        }));
      }
    }
  });
  ws.on("close", () => {
    if (userId) connectedUsers.delete(userId);
  });
});

app.get("/nearby", async (req, res) => {
  const { lat, lng, radius = 500, userId } = req.query;
  const { data: users } = await supabase
    .from("users").select("*")
    .eq("visible", true).neq("id", userId);
  if (!users) return res.json([]);
  const nearby = users.map(u => ({
    ...u,
    distance: Math.round(calcDistance(
      parseFloat(lat), parseFloat(lng), u.lat, u.lng
    ))
  })).filter(u => u.distance <= parseInt(radius));
  res.json(nearby);
});

app.post("/like", async (req, res) => {
  const { fromUserId, toUserId } = req.body;
  await supabase.from("likes").upsert({
    from_user: fromUserId,
    to_user: toUserId,
    created_at: new Date().toISOString(),
  });
  const { data: mutual } = await supabase.from("likes")
    .select("*").eq("from_user", toUserId)
    .eq("to_user", fromUserId).single();
  if (mutual) {
    const { data: match } = await supabase.from("matches")
      .insert({ user1: fromUserId, user2: toUserId,
        created_at: new Date().toISOString() })
      .select().single();
    [fromUserId, toUserId].forEach(id => {
      const ws = connectedUsers.get(id);
      if (ws && ws.readyState === 1)
        ws.send(JSON.stringify({ type: "match", matchId: match.id }));
    });
    return res.json({ ok: true, match: true });
  }
  res.json({ ok: true, match: false });
});

app.get("/matches/:userId", async (req, res) => {
  const { userId } = req.params;
  const { data } = await supabase.from("matches")
    .select("*").or(`user1.eq.${userId},user2.eq.${userId}`);
  res.json(data || []);
});

app.get("/messages/:matchId", async (req, res) => {
  const { matchId } = req.params;
  const { data } = await supabase.from("messages")
    .select("*").eq("match_id", matchId)
    .order("created_at", { ascending: true });
  res.json(data || []);
});

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`CO·CERCA corriendo en puerto ${PORT}`));
