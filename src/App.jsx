import { useState, useRef, useEffect, useCallback } from "react";

const MERCADOPAGO_LINK = "https://link.mercadopago.com.ar/douglascalle";
const PRECIO_APP = 5;
const API_URL = "https://librecom-production.up.railway.app";
const WS_URL = "wss://librecom-production.up.railway.app";
const MAX_RADIUS = 500;
const RADAR_SIZE = 300;

const BUSCA_OPTS = [
  { value:"mujeres", label:"Mujeres", icon:"👩" },
  { value:"hombres", label:"Hombres", icon:"👨" },
  { value:"todos",   label:"Todos",   icon:"🌈" },
];

const S = {
  page:       { minHeight:"100vh", background:"#080c10", display:"flex", flexDirection:"column", alignItems:"center", fontFamily:"'Courier New',monospace", color:"#e0f7f0", boxSizing:"border-box", width:"100%" },
  btn:        { background:"#4ecda4", border:"none", borderRadius:12, padding:"14px 0", fontSize:13, fontWeight:800, letterSpacing:2, color:"#080c10", cursor:"pointer", width:"100%", marginTop:10, boxSizing:"border-box" },
  btnOutline: { background:"none", border:"1px solid #4ecda4", borderRadius:12, padding:"12px 0", fontSize:12, fontWeight:700, letterSpacing:1, color:"#4ecda4", cursor:"pointer", width:"100%", marginTop:8, boxSizing:"border-box" },
  input:      { width:"100%", background:"#0d1a14", border:"1px solid #1a3a2a", borderRadius:10, padding:"12px 14px", color:"#e0f7f0", fontSize:14, fontFamily:"sans-serif", outline:"none", boxSizing:"border-box" },
  label:      { fontSize:10, letterSpacing:3, color:"#4ecda4", marginBottom:8, display:"block" },
};

// Calcular ángulo entre dos puntos GPS
function calcAngle(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Calcular posición XY en el radar
function getXY(distance, angle) {
  const r = (Math.min(distance, MAX_RADIUS) / MAX_RADIUS) * (RADAR_SIZE / 2 - 28);
  const rad = (angle - 90) * Math.PI / 180;
  return { x: RADAR_SIZE/2 + r * Math.cos(rad), y: RADAR_SIZE/2 + r * Math.sin(rad) };
}

export default function COCerca() {
  const [screen, setScreen]         = useState("splash");
  const [splashStep, setSplashStep] = useState(0);
  const [myProfile, setMyProfile]   = useState(null);
  const [myId, setMyId]             = useState(null);
  const [myLat, setMyLat]           = useState(null);
  const [myLng, setMyLng]           = useState(null);
  const [gpsError, setGpsError]     = useState(null);

  // Registro
  const [regStep, setRegStep]       = useState(1);
  const [regName, setRegName]       = useState("");
  const [regAge, setRegAge]         = useState("");
  const [regFrase, setRegFrase]     = useState("");
  const [regBusca, setRegBusca]     = useState("");
  const [regPresType, setRegPresType] = useState("");
  const [regPhotoURL, setRegPhotoURL] = useState("");
  const [regMensaje, setRegMensaje] = useState("");

  // Radar
  const [users, setUsers]           = useState([]);
  const [maxDist, setMaxDist]       = useState(500);
  const [visible, setVisible]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [matches, setMatches]       = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMatches, setShowMatches]   = useState(false);
  const [showPaywall, setShowPaywall]   = useState(false);
  const [isPremium, setIsPremium]       = useState(false);
  const [esperando, setEsperando]       = useState([]);
  const [showMatchAnim, setShowMatchAnim] = useState(null);
  const [showPresMode, setShowPresMode]   = useState(false);

  // Chat
  const [activeChat, setActiveChat]     = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput]       = useState("");
  const chatEndRef = useRef(null);

  // Video
  const [recording, setRecording]     = useState(false);
  const [videoURL, setVideoURL]       = useState("");
  const mediaRecorderRef = useRef(null);
  const videoPreviewRef  = useRef(null);
  const streamRef        = useRef(null);

  // Misc
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const wsRef = useRef(null);

  // ─── SPLASH ─────────────────────────────────
  useEffect(() => {
    if (screen !== "splash") return;
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i < 4) setSplashStep(i);
      else { clearInterval(t); setTimeout(() => setScreen("intro"), 500); }
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  // ─── GPS ────────────────────────────────────
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsError("GPS no disponible"); return; }
    navigator.geolocation.watchPosition(
      pos => { setMyLat(pos.coords.latitude); setMyLng(pos.coords.longitude); setGpsError(null); },
      ()  => setGpsError("No se pudo obtener ubicación"),
      { enableHighAccuracy:true, maximumAge:10000, timeout:15000 }
    );
  }, []);

  // ─── WEBSOCKET ──────────────────────────────
  const connectWS = useCallback((userId) => {
    try {
      if (wsRef.current) wsRef.current.close();
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen    = () => ws.send(JSON.stringify({ type:"auth", userId }));
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "message") {
          const time = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
          setChatMessages(prev => ({
            ...prev,
            [msg.from]: [...(prev[msg.from]||[]), { from:"them", text:msg.text, time }]
          }));
        }
        if (msg.type === "match") {
          fetchMatches(userId);
          if (msg.withUser) {
            setShowMatchAnim(msg.withUser);
            setTimeout(() => setShowMatchAnim(null), 5000);
          }
        }
      };
      ws.onclose = () => setTimeout(() => connectWS(userId), 3000);
    } catch(e) { /* silencioso */ }
  }, []);

  // ─── FETCH NEARBY ───────────────────────────
  const fetchNearby = useCallback(async (lat, lng, userId) => {
    if (!lat || !lng || !userId) return;
    try {
      const res  = await fetch(`${API_URL}/nearby?lat=${lat}&lng=${lng}&radius=${maxDist}&userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch(e) { /* silencioso */ }
  }, [maxDist]);

  // ─── FETCH MATCHES ──────────────────────────
  const fetchMatches = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res  = await fetch(`${API_URL}/matches/${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setMatches(data);
    } catch(e) { /* silencioso */ }
  }, []);

  // ─── UPDATE LOCATION ────────────────────────
  useEffect(() => {
    if (!myId || !myLat || !myLng) return;
    fetch(`${API_URL}/users/${myId}`, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ lat:myLat, lng:myLng, visible })
    }).catch(() => {});
  }, [myLat, myLng, myId, visible]);

  // ─── RADAR POLLING ──────────────────────────
  useEffect(() => {
    if (screen !== "radar" || !myId || !myLat || !myLng) return;
    fetchNearby(myLat, myLng, myId);
    const t = setInterval(() => fetchNearby(myLat, myLng, myId), 5000);
    return () => clearInterval(t);
  }, [screen, myId, myLat, myLng, fetchNearby]);

  // ─── SCROLL CHAT ────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMessages, activeChat]);

  // ─── REGISTRO ───────────────────────────────
  const handleRegister = async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/auth/register`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          name: regName,
          age:  parseInt(regAge),
          bio:  regFrase,
          photo_url: regPhotoURL || `https://i.pravatar.cc/150?u=${regName}${Date.now()}`,
          lat: myLat || 0,
          lng: myLng || 0,
        })
      });
      const data = await res.json();
      if (data.id) {
        setMyId(data.id);
        setMyProfile({ ...data, busca:regBusca, presType:regPresType, mensaje:regMensaje });
        connectWS(data.id);
        fetchMatches(data.id);
        startGPS();
        setScreen("radar");
      } else {
        setError(data.error || "Error al registrarse.");
      }
    } catch(e) {
      setError("No se pudo conectar al servidor.");
    }
    setLoading(false);
  };

  // ─── CONNECT / LIKE ─────────────────────────
  const handleConnect = async (user) => {
    if (!isPremium) { setShowPaywall(true); return; }
    setEsperando(prev => [...prev, user.id]);
    setSelected(null);
    try {
      const res  = await fetch(`${API_URL}/like`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ fromUserId:myId, toUserId:user.id })
      });
      const data = await res.json();
      if (data.match) {
        setEsperando(prev => prev.filter(id => id !== user.id));
        setMatches(m => [...m, { otherUser:user }]);
        setChatMessages(prev => ({ ...prev, [user.id]:[] }));
        setShowMatchAnim(user);
        setTimeout(() => setShowMatchAnim(null), 5000);
      }
    } catch(e) {
      setEsperando(prev => prev.filter(id => id !== user.id));
    }
  };

  // ─── ENVIAR MENSAJE ─────────────────────────
  const sendMessage = () => {
    if (!chatInput.trim() || !activeChat || !myId) return;
    const text = chatInput.trim();
    const time = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    setChatMessages(prev => ({ ...prev, [activeChat.id]:[...(prev[activeChat.id]||[]), { from:"me", text, time }] }));
    setChatInput("");
    if (wsRef.current?.readyState === 1) {
      const match = matches.find(m => m.otherUser?.id === activeChat.id);
      wsRef.current.send(JSON.stringify({ type:"message", toUserId:activeChat.id, text, matchId:match?.id }));
    }
  };

  // ─── CÁMARA FOTO ────────────────────────────
  const openCamera = () => document.getElementById("photoInput").click();

  // ─── GRABAR VIDEO ───────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }, audio:true });
      streamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type:"video/mp4" });
        setVideoURL(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setRecording(true);
    } catch(e) { setError("No se pudo acceder a la cámara."); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // ════════════════════════════════════════════
  //  PANTALLAS
  // ════════════════════════════════════════════

  // ─── SPLASH ─────────────────────────────────
  if (screen === "splash") return (
    <div style={{ ...S.page, justifyContent:"center" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .fi{animation:fadeIn 0.8s ease forwards} .pu{animation:pulse 2s infinite}
      `}</style>
      <div style={{ position:"relative", marginBottom:28 }}>
        <div style={{ width:80,height:80,borderRadius:"50%",border:"2px solid #4ecda4",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 30px #4ecda420",fontSize:32 }}>📡</div>
        <div className="pu" style={{ position:"absolute",inset:-8,borderRadius:"50%",border:"1px solid #4ecda440" }}/>
      </div>
      {splashStep>=0&&<div className="fi" style={{ fontSize:10,letterSpacing:5,color:"#4ecda4",opacity:0.7,marginBottom:6 }}>RED CO</div>}
      {splashStep>=1&&<div className="fi" style={{ fontSize:26,fontWeight:900,letterSpacing:4,color:"#7fffd4",marginBottom:20 }}>CO·CERCA</div>}
      {splashStep>=2&&<div className="fi" style={{ fontSize:10,color:"#4ecda4",opacity:0.5,letterSpacing:2 }}>CÓDIGO ORIGEN</div>}
      {splashStep>=3&&<div className="fi pu" style={{ marginTop:28,fontSize:9,color:"#2a6a4a",letterSpacing:3 }}>INICIANDO...</div>}
    </div>
  );

  // ─── INTRO ──────────────────────────────────
  if (screen === "intro") return (
    <div style={{ ...S.page, justifyContent:"center", padding:"40px 24px", textAlign:"center" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp 0.9s ease forwards}`}</style>
      <div className="fu">
        <div style={{ width:80,height:80,borderRadius:"50%",border:"2px solid #4ecda4",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:"0 0 40px #4ecda430",fontSize:32 }}>📡</div>
        <div style={{ fontSize:9,letterSpacing:5,color:"#4ecda4",opacity:0.7,marginBottom:8 }}>RED CO — CÓDIGO ORIGEN</div>
        <div style={{ fontSize:26,fontWeight:900,letterSpacing:3,color:"#7fffd4",marginBottom:24 }}>BIENVENIDO/A<br/>A CO·CERCA</div>
        <div style={{ fontSize:11,color:"#4ecda4",opacity:0.5,letterSpacing:1,marginBottom:6 }}>Muy pronto:</div>
        <div style={{ fontSize:13,fontWeight:700,color:"#4ecda4",letterSpacing:2,marginBottom:8 }}>LA INTERNET DE LA REBELIÓN</div>
        <div style={{ fontSize:11,color:"#7fffd4",opacity:0.5,lineHeight:1.8,fontFamily:"sans-serif",maxWidth:280,margin:"0 auto 32px" }}>
          Una probada de las apps del nuevo sistema de comunicación que{" "}
          <strong style={{ color:"#7fffd4",opacity:1 }}>no depende de internet</strong>.
        </div>
        <div style={{ fontSize:9,color:"#2a5a3a",letterSpacing:3,marginBottom:32 }}>DESCENTRALIZADO · ENCRIPTADO · LIBRE</div>
        <button style={{ ...S.btn, maxWidth:320, margin:"0 auto" }} onClick={()=>{ startGPS(); setScreen("registro"); }}>ENTRAR</button>
      </div>
    </div>
  );

  // ─── REGISTRO ───────────────────────────────
  if (screen === "registro") return (
    <div style={{ ...S.page, justifyContent:"center", padding:"24px 20px" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp 0.4s ease}`}</style>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ fontSize:9,letterSpacing:4,color:"#4ecda4",marginBottom:4 }}>CO·CERCA</div>
        <div style={{ fontSize:18,fontWeight:700,color:"#7fffd4",marginBottom:24,letterSpacing:2 }}>
          {regStep===1?"QUIÉN SOS":regStep===2?"QUÉ BUSCÁS":"TU PRESENTACIÓN"}
        </div>
        {error && <div style={{ background:"#2a0a0a",border:"1px solid #aa4444",borderRadius:10,padding:"10px 14px",fontSize:11,color:"#ff8888",marginBottom:14 }}>{error}</div>}

        {regStep===1 && (
          <div className="fu">
            <label style={S.label}>TU NOMBRE</label>
            <input style={{ ...S.input, marginBottom:14 }} placeholder="Ej: Matías" value={regName} onChange={e=>setRegName(e.target.value)} maxLength={20}/>
            <label style={S.label}>TU EDAD</label>
            <input style={{ ...S.input, marginBottom:14 }} placeholder="Ej: 24" type="number" value={regAge} onChange={e=>setRegAge(e.target.value)} min={18} max={99}/>
            <label style={S.label}>UNA FRASE TUYA (opcional)</label>
            <input style={{ ...S.input, marginBottom:24 }} placeholder="Ej: Músico y viajero 🎸" value={regFrase} onChange={e=>setRegFrase(e.target.value)} maxLength={40}/>
            <button style={{ ...S.btn, opacity:regName&&regAge?1:0.4 }} disabled={!regName||!regAge} onClick={()=>setRegStep(2)}>SIGUIENTE →</button>
          </div>
        )}

        {regStep===2 && (
          <div className="fu">
            <label style={S.label}>MOSTRARME EN EL RADAR DE</label>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
              {BUSCA_OPTS.map(o=>(
                <button key={o.value} onClick={()=>setRegBusca(o.value)} style={{ padding:"14px 16px", borderRadius:12, border:`1px solid ${regBusca===o.value?"#4ecda4":"#1a3a2a"}`, background:regBusca===o.value?"#0d2a1a":"#0a0f0d", color:regBusca===o.value?"#7fffd4":"#4ecda4", fontSize:13, cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1, textAlign:"left", display:"flex", alignItems:"center", gap:10, width:"100%", boxSizing:"border-box" }}>
                  <span style={{ fontSize:16 }}>{o.icon}</span>{o.label}
                  {regBusca===o.value&&<span style={{ marginLeft:"auto" }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btnOutline, width:"auto", padding:"12px 20px" }} onClick={()=>setRegStep(1)}>← ATRÁS</button>
              <button style={{ ...S.btn, marginTop:0, opacity:regBusca?1:0.4 }} disabled={!regBusca} onClick={()=>setRegStep(3)}>SIGUIENTE →</button>
            </div>
          </div>
        )}

        {regStep===3 && (
          <div className="fu">
            <label style={S.label}>¿CÓMO TE PRESENTÁS?</label>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <button onClick={()=>setRegPresType("foto")} style={{ flex:1, padding:"16px 10px", borderRadius:12, border:`1px solid ${regPresType==="foto"?"#4ecda4":"#1a3a2a"}`, background:regPresType==="foto"?"#0d2a1a":"#0a0f0d", color:regPresType==="foto"?"#7fffd4":"#4ecda4", cursor:"pointer", fontFamily:"'Courier New',monospace", fontSize:12, letterSpacing:1, boxSizing:"border-box" }}>
                📸<br/>FOTO +<br/>MENSAJE
              </button>
              <button onClick={()=>setRegPresType("video")} style={{ flex:1, padding:"16px 10px", borderRadius:12, border:`1px solid ${regPresType==="video"?"#4ecda4":"#1a3a2a"}`, background:regPresType==="video"?"#0d2a1a":"#0a0f0d", color:regPresType==="video"?"#7fffd4":"#4ecda4", cursor:"pointer", fontFamily:"'Courier New',monospace", fontSize:12, letterSpacing:1, boxSizing:"border-box" }}>
                📹<br/>VIDEO DE<br/>PRESENTACIÓN
              </button>
            </div>

            {regPresType==="foto" && (
              <div style={{ marginBottom:16 }}>
                <label style={{ ...S.label, marginBottom:6 }}>TU FOTO</label>
                <div style={{ border:"1px dashed #1a4a2a", borderRadius:12, padding:"20px", textAlign:"center", marginBottom:12, cursor:"pointer" }} onClick={openCamera}>
                  {regPhotoURL
                    ? <img src={regPhotoURL} alt="" style={{ width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"2px solid #4ecda4" }}/>
                    : <div style={{ color:"#2a6a4a",fontSize:12,letterSpacing:1 }}>📸 SACAR FOTO<br/><span style={{ fontSize:10,opacity:0.6 }}>tocá para abrir cámara</span></div>
                  }
                </div>
                <input id="photoInput" type="file" accept="image/*" capture="user" style={{ display:"none" }}
                  onChange={e=>{ const f=e.target.files[0]; if(f) setRegPhotoURL(URL.createObjectURL(f)); }}/>
                <label style={S.label}>TU MENSAJE</label>
                <textarea style={{ ...S.input, minHeight:70, resize:"none" }} placeholder="Ej: Hola! Te vi y me animé 😊" value={regMensaje} onChange={e=>setRegMensaje(e.target.value)} maxLength={120}/>
              </div>
            )}

            {regPresType==="video" && (
              <div style={{ marginBottom:16 }}>
                <label style={{ ...S.label, marginBottom:6 }}>TU VIDEO</label>
                {!videoURL ? (
                  <div style={{ border:"1px dashed #1a4a2a", borderRadius:12, overflow:"hidden", marginBottom:12 }}>
                    <video ref={videoPreviewRef} autoPlay muted playsInline style={{ width:"100%", display:"block", background:"#000", minHeight:180 }}/>
                    {!recording
                      ? <button style={{ ...S.btn, borderRadius:0, marginTop:0 }} onClick={startRecording}>🎥 INICIAR GRABACIÓN</button>
                      : <button style={{ ...S.btn, borderRadius:0, marginTop:0, background:"#e05555" }} onClick={stopRecording}>⏹ DETENER</button>
                    }
                  </div>
                ) : (
                  <div style={{ marginBottom:12 }}>
                    <video src={videoURL} controls playsInline style={{ width:"100%", borderRadius:12, border:"1px solid #1a4a2a" }}/>
                    <button style={{ ...S.btnOutline, marginTop:8 }} onClick={()=>setVideoURL("")}>🔄 GRABAR DE NUEVO</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button style={{ ...S.btnOutline, width:"auto", padding:"12px 20px", marginTop:0 }} onClick={()=>setRegStep(2)}>← ATRÁS</button>
              <button style={{ ...S.btn, marginTop:0, opacity:(regPresType&&!loading)?1:0.4 }} disabled={!regPresType||loading} onClick={handleRegister}>
                {loading?"CONECTANDO...":"ENTRAR AL RADAR ✓"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── MODO PRESENTACIÓN ──────────────────────
  if (showPresMode) return (
    <div style={{ ...S.page, justifyContent:"center", padding:"24px 20px", background:"#050810" }}>
      <div style={{ width:"100%", maxWidth:380, textAlign:"center" }}>
        <div style={{ fontSize:9,letterSpacing:4,color:"#4ecda4",marginBottom:20,opacity:0.6 }}>MOSTRÁ ESTA PANTALLA</div>
        <div style={{ background:"#0d1a14", border:"1px solid #1a4a2a", borderRadius:20, padding:28, marginBottom:16, boxSizing:"border-box" }}>
          {myProfile?.presType==="video"&&videoURL
            ? <video src={videoURL} controls playsInline style={{ width:"100%", borderRadius:12, marginBottom:14 }}/>
            : <img src={myProfile?.photo_url||`https://i.pravatar.cc/150?u=${myProfile?.name}`} alt="" style={{ width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid #4ecda4",marginBottom:14 }}/>
          }
          <div style={{ fontSize:20,fontWeight:700,marginBottom:4 }}>{myProfile?.name}</div>
          <div style={{ fontSize:13,color:"#4ecda4",marginBottom:12 }}>{myProfile?.age} años</div>
          {myProfile?.mensaje && (
            <div style={{ background:"#080c10",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#7fffd4",fontFamily:"sans-serif",lineHeight:1.6,textAlign:"left" }}>
              "{myProfile.mensaje}"
            </div>
          )}
        </div>
        <button style={{ ...S.btn, fontSize:14, padding:"16px", borderRadius:14 }}>
          💚 CONECTAR CON {myProfile?.name?.toUpperCase()}
        </button>
        <button onClick={()=>setShowPresMode(false)} style={{ marginTop:20,background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:11,letterSpacing:1 }}>← VOLVER AL RADAR</button>
      </div>
    </div>
  );

  // ─── CHAT ───────────────────────────────────
  if (screen==="chat"&&activeChat) {
    const msgs = chatMessages[activeChat.id]||[];
    return (
      <div style={{ minHeight:"100vh",background:"#080c10",display:"flex",flexDirection:"column",fontFamily:"'Courier New',monospace",color:"#e0f7f0" }}>
        <div style={{ background:"#0d1a14",borderBottom:"1px solid #1a3a2a",padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
          <button onClick={()=>setScreen("radar")} style={{ background:"none",border:"none",color:"#4ecda4",cursor:"pointer",fontSize:18,padding:0 }}>←</button>
          <img src={activeChat.photo_url||`https://i.pravatar.cc/150?u=${activeChat.name}`} alt="" style={{ width:38,height:38,borderRadius:"50%",border:"2px solid #4ecda4",objectFit:"cover" }}/>
          <div>
            <div style={{ fontWeight:700,fontSize:14 }}>{activeChat.name}</div>
            <div style={{ fontSize:9,color:"#4ecda4",letterSpacing:2,opacity:0.7 }}>● EN LÍNEA</div>
          </div>
          <div style={{ marginLeft:"auto",fontSize:9,color:"#2a6a4a",letterSpacing:2 }}>CO·CHAT</div>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10 }}>
          <div style={{ textAlign:"center",margin:"6px 0" }}>
            <span style={{ fontSize:9,color:"#2a6a4a",letterSpacing:2,background:"#0d1a14",padding:"4px 12px",borderRadius:20,border:"1px solid #1a3a2a" }}>💚 MATCH CON {activeChat.name?.toUpperCase()}</span>
          </div>
          {msgs.length===0&&<div style={{ textAlign:"center",color:"#2a5a3a",fontSize:11,marginTop:20 }}>Sé el primero en escribir 👋</div>}
          {msgs.map((msg,i)=>(
            <div key={i} style={{ display:"flex",justifyContent:msg.from==="me"?"flex-end":"flex-start" }}>
              {msg.from==="them"&&<img src={activeChat.photo_url||`https://i.pravatar.cc/150?u=${activeChat.name}`} alt="" style={{ width:26,height:26,borderRadius:"50%",objectFit:"cover",marginRight:8,alignSelf:"flex-end",border:"1px solid #1a3a2a" }}/>}
              <div style={{ maxWidth:"70%",background:msg.from==="me"?"#4ecda4":"#0d1a14",color:msg.from==="me"?"#080c10":"#e0f7f0",border:msg.from==="me"?"none":"1px solid #1a3a2a",borderRadius:msg.from==="me"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"10px 14px",fontFamily:"sans-serif",fontSize:13 }}>
                {msg.text}
                <div style={{ fontSize:9,opacity:0.5,marginTop:4,textAlign:"right" }}>{msg.time}</div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        <div style={{ padding:"10px 14px",background:"#0d1a14",borderTop:"1px solid #1a3a2a",display:"flex",gap:10,alignItems:"center" }}>
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Escribí algo..." style={{ flex:1,background:"#080c10",border:"1px solid #1a3a2a",borderRadius:24,padding:"10px 16px",color:"#e0f7f0",fontSize:13,fontFamily:"sans-serif",outline:"none" }}/>
          <button onClick={sendMessage} style={{ width:40,height:40,borderRadius:"50%",background:"#4ecda4",border:"none",cursor:"pointer",fontSize:15 }}>➤</button>
        </div>
      </div>
    );
  }

  // ─── RADAR PRINCIPAL ────────────────────────
  return (
    <div style={{ ...S.page }}>
      <style>{`
        @keyframes radarSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes matchBoom{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
        @keyframes goldShine{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes waitDot{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
        .panel{animation:fadeUp 0.3s ease}
        .match-boom{animation:matchBoom 0.6s cubic-bezier(0.34,1.56,0.64,1)}
        .gold-btn{background:linear-gradient(90deg,#b8860b,#ffd700,#daa520,#ffd700,#b8860b);background-size:200% auto;animation:goldShine 2s linear infinite;border:none;color:#1a0a00;font-weight:800;cursor:pointer}
        .dot-ping{animation:ping 2s ease-out infinite}
        .udot{cursor:pointer;transition:all 0.3s}
      `}</style>

      {/* Header */}
      <div style={{ width:"100%",padding:"16px 18px 8px",display:"flex",justifyContent:"space-between",alignItems:"center",boxSizing:"border-box" }}>
        <div style={{ cursor:"pointer" }} onClick={()=>setScreen("intro")}>
          <div style={{ fontSize:9,letterSpacing:4,color:"#4ecda4",opacity:0.6 }}>RED CO</div>
          <div style={{ fontSize:19,fontWeight:700,letterSpacing:2,color:"#7fffd4" }}>CO·CERCA</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={()=>setShowPresMode(true)} style={{ background:"#0d2a1a",border:"1px solid #4ecda4",borderRadius:20,padding:"5px 12px",color:"#4ecda4",cursor:"pointer",fontSize:9,letterSpacing:1 }}>
            {myProfile?.presType==="video"?"📹":"📸"} MOSTRAR
          </button>
          {!isPremium&&<button onClick={()=>setShowPaywall(true)} className="gold-btn" style={{ borderRadius:20,padding:"5px 12px",fontSize:9,letterSpacing:1 }}>⭐ PREMIUM</button>}
          {isPremium&&<span style={{ fontSize:9,color:"#ffd700",letterSpacing:2,border:"1px solid #ffd700",borderRadius:20,padding:"4px 10px" }}>⭐ PRO</span>}
          {matches.length>0&&(
            <button onClick={()=>setShowMatches(true)} style={{ background:"none",border:"none",cursor:"pointer",position:"relative",padding:0 }}>
              <span style={{ fontSize:20 }}>💚</span>
              <span style={{ position:"absolute",top:-4,right:-4,background:"#4ecda4",color:"#080c10",borderRadius:"50%",fontSize:9,width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>{matches.length}</span>
            </button>
          )}
          <button onClick={()=>setShowSettings(!showSettings)} style={{ background:"none",border:"1px solid #1a3a2a",borderRadius:8,padding:"5px 9px",color:"#4ecda4",cursor:"pointer",fontSize:12 }}>⚙</button>
        </div>
      </div>

      {gpsError&&<div style={{ fontSize:9,color:"#ff8888",padding:"4px 18px",letterSpacing:1 }}>⚠ {gpsError} — activá el GPS del celu</div>}

      {/* Toggle visible */}
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"0 18px",width:"100%",boxSizing:"border-box" }}>
        <div style={{ width:7,height:7,borderRadius:"50%",background:visible?"#4ecda4":"#333",boxShadow:visible?"0 0 8px #4ecda4":"none" }}/>
        <span style={{ fontSize:9,letterSpacing:2,color:visible?"#4ecda4":"#444" }}>{visible?"VISIBLE EN RADAR":"MODO OCULTO"}</span>
        <button onClick={()=>setVisible(!visible)} style={{ marginLeft:"auto",background:visible?"#0a2a1a":"#111",border:`1px solid ${visible?"#4ecda4":"#333"}`,borderRadius:20,padding:"3px 12px",color:visible?"#4ecda4":"#555",cursor:"pointer",fontSize:9,letterSpacing:1 }}>
          {visible?"ON":"OFF"}
        </button>
      </div>

      {/* Settings */}
      {showSettings&&(
        <div className="panel" style={{ width:"100%",background:"#0d1a14",border:"1px solid #1a3a2a",borderRadius:12,padding:"12px 18px",marginBottom:8,boxSizing:"border-box" }}>
          <div style={{ fontSize:9,letterSpacing:3,color:"#4ecda4",marginBottom:8 }}>RADIO DE BÚSQUEDA</div>
          <input type="range" min={50} max={500} step={50} value={maxDist} onChange={e=>setMaxDist(Number(e.target.value))} style={{ width:"100%",accentColor:"#4ecda4" }}/>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#4ecda4",marginTop:4 }}>
            <span>50m</span><span style={{ fontWeight:700 }}>{maxDist}m</span><span>500m</span>
          </div>
        </div>
      )}

      {/* RADAR */}
      <div style={{ position:"relative", width:RADAR_SIZE, height:RADAR_SIZE, margin:"4px 0" }}>
        <svg width={RADAR_SIZE} height={RADAR_SIZE} style={{ position:"absolute",top:0,left:0 }}>
          {[1,0.75,0.5,0.25].map((r,i)=>(
            <circle key={i} cx={RADAR_SIZE/2} cy={RADAR_SIZE/2} r={(RADAR_SIZE/2-8)*r} fill="none" stroke={i===0?"#1a3a2a":"#0f2218"} strokeWidth={i===0?1.5:1} strokeDasharray={i>0?"4 6":"none"}/>
          ))}
          <line x1={RADAR_SIZE/2} y1={8} x2={RADAR_SIZE/2} y2={RADAR_SIZE-8} stroke="#0f2218" strokeWidth={1}/>
          <line x1={8} y1={RADAR_SIZE/2} x2={RADAR_SIZE-8} y2={RADAR_SIZE/2} stroke="#0f2218" strokeWidth={1}/>
          <defs>
            <radialGradient id="sw" cx="0%" cy="0%" r="100%">
              <stop offset="0%" stopColor="#4ecda4" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#4ecda4" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <g style={{ transformOrigin:`${RADAR_SIZE/2}px ${RADAR_SIZE/2}px`, animation:"radarSweep 4s linear infinite" }}>
            <path d={`M ${RADAR_SIZE/2} ${RADAR_SIZE/2} L ${RADAR_SIZE/2} 8 A ${RADAR_SIZE/2-8} ${RADAR_SIZE/2-8} 0 0 1 ${RADAR_SIZE/2+(RADAR_SIZE/2-8)*Math.sin(Math.PI/3)} ${RADAR_SIZE/2-(RADAR_SIZE/2-8)*Math.cos(Math.PI/3)} Z`} fill="url(#sw)"/>
            <line x1={RADAR_SIZE/2} y1={RADAR_SIZE/2} x2={RADAR_SIZE/2} y2={8} stroke="#4ecda4" strokeWidth={1.5} strokeOpacity={0.8}/>
          </g>
          <circle cx={RADAR_SIZE/2} cy={RADAR_SIZE/2} r={(maxDist/MAX_RADIUS)*(RADAR_SIZE/2-24)} fill="none" stroke="#4ecda4" strokeWidth={1} strokeDasharray="3 5" strokeOpacity={0.35}/>
        </svg>

        {/* Yo */}
        <div style={{ position:"absolute",left:RADAR_SIZE/2-10,top:RADAR_SIZE/2-10,width:20,height:20,borderRadius:"50%",background:"#4ecda4",boxShadow:"0 0 12px #4ecda4",zIndex:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#080c10" }}>
          {myProfile?.name?.[0]||"●"}
        </div>
        <div className="dot-ping" style={{ position:"absolute",left:RADAR_SIZE/2-10,top:RADAR_SIZE/2-10,width:20,height:20,borderRadius:"50%",border:"2px solid #4ecda4",zIndex:9 }}/>

        {/* Usuarios reales con ángulo calculado desde GPS */}
        {users.map(user => {
          const angle = (myLat&&myLng&&user.lat&&user.lng)
            ? calcAngle(myLat, myLng, user.lat, user.lng)
            : (user.angle || 0);
          const {x,y} = getXY(user.distance || 100, angle);
          const isSel  = selected?.id === user.id;
          const isMatch = matches.find(m=>m.otherUser?.id===user.id);
          const size   = isSel ? 44 : 36;
          return (
            <div key={user.id} className="udot" onClick={()=>setSelected(isSel?null:user)}
              style={{ position:"absolute",left:x-size/2,top:y-size/2,width:size,height:size,borderRadius:"50%",border:`2px solid ${isSel?"#7fffd4":isMatch?"#4ecda4":user.premium?"#ffd700":"#4ecda4"}`,boxShadow:isSel?"0 0 14px #4ecda480":"none",overflow:"hidden",zIndex:isSel?20:5,background:"#0d2a1a",transition:"all 0.3s" }}>
              <img src={user.photo_url||`https://i.pravatar.cc/150?u=${user.name}`} alt={user.name} style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }}
                onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}/>
              <div style={{ display:"none",width:"100%",height:"100%",alignItems:"center",justifyContent:"center",fontSize:size>38?14:11,fontWeight:700,color:"#4ecda4",background:"#0d2a1a" }}>{user.name?.[0]}</div>
              {isMatch&&<div style={{ position:"absolute",top:-4,right:-4,fontSize:10 }}>💚</div>}
              {!isMatch&&user.premium&&<div style={{ position:"absolute",top:-4,right:-4,width:12,height:12,borderRadius:"50%",background:"#ffd700",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"#1a0a00" }}>★</div>}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:9,letterSpacing:3,color:"#2a6a4a",marginBottom:8 }}>
        {users.length} SEÑAL{users.length!==1?"ES":""} DETECTADA{users.length!==1?"S":""}
      </div>

      {/* Panel usuario seleccionado */}
      {selected&&(
        <div className="panel" style={{ background:"#0d1a14",border:"1px solid #1a4a2a",borderRadius:16,padding:"16px 18px",width:"100%",boxSizing:"border-box" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <img src={selected.photo_url||`https://i.pravatar.cc/150?u=${selected.name}`} alt="" style={{ width:52,height:52,borderRadius:"50%",border:`2px solid ${selected.premium?"#ffd700":"#4ecda4"}`,objectFit:"cover" }}/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:16,fontWeight:700 }}>{selected.name}</span>
                {selected.premium&&<span style={{ fontSize:10,color:"#ffd700" }}>⭐</span>}
                {matches.find(m=>m.otherUser?.id===selected.id)&&<span style={{ fontSize:12 }}>💚</span>}
              </div>
              <div style={{ fontSize:10,color:"#4ecda4",opacity:0.7 }}>{selected.age} años</div>
              <div style={{ fontSize:9,color:"#2a6a4a",marginTop:2 }}>📍 {Math.round(selected.distance||0)}m</div>
            </div>
          </div>
          <div style={{ fontSize:12,color:"#7fffd4",opacity:0.7,margin:"10px 0 12px",fontFamily:"sans-serif" }}>{selected.bio}</div>
          {matches.find(m=>m.otherUser?.id===selected.id) ? (
            <button onClick={()=>{setActiveChat(selected);setScreen("chat");}} style={{ ...S.btn,marginTop:0 }}>💬 ABRIR CHAT</button>
          ) : esperando.includes(selected.id) ? (
            <div style={{ background:"#0a1f14",border:"1px solid #1a4a2a",borderRadius:12,padding:"14px 16px",textAlign:"center" }}>
              <div style={{ fontSize:22,marginBottom:8 }}>📡</div>
              <div style={{ fontSize:11,fontWeight:700,letterSpacing:2,color:"#4ecda4",marginBottom:6 }}>SEÑAL ENVIADA</div>
              <div style={{ fontSize:11,color:"#7fffd4",opacity:0.7,fontFamily:"sans-serif",marginBottom:12,lineHeight:1.6 }}>
                {selected.name} está viendo tu presentación...
              </div>
              <div style={{ display:"flex",justifyContent:"center",gap:6 }}>
                {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:"50%",background:"#4ecda4",animation:`waitDot 1.2s ease-in-out ${i*0.3}s infinite` }}/>)}
              </div>
            </div>
          ) : (
            <button onClick={()=>handleConnect(selected)} style={{ width:"100%",padding:"12px",borderRadius:10,background:isPremium?"#4ecda4":"#1a1a0a",border:isPremium?"none":"1px solid #ffd700",color:isPremium?"#080c10":"#ffd700",fontSize:11,fontWeight:700,letterSpacing:2,cursor:"pointer",boxSizing:"border-box" }}>
              {isPremium?"📹 ENVIAR PRESENTACIÓN":"🔒 ENVIAR PRESENTACIÓN (PREMIUM)"}
            </button>
          )}
          {!isPremium&&!matches.find(m=>m.otherUser?.id===selected.id)&&!esperando.includes(selected.id)&&(
            <div style={{ fontSize:9,color:"#555",textAlign:"center",marginTop:6,letterSpacing:1 }}>Único pago de ${PRECIO_APP} — tuyo para siempre</div>
          )}
        </div>
      )}

      {/* PAYWALL */}
      {showPaywall&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20,boxSizing:"border-box" }} onClick={()=>setShowPaywall(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#0d1a14",border:"1px solid #ffd700",borderRadius:20,padding:26,width:"100%",maxWidth:340,textAlign:"center",boxSizing:"border-box" }}>
            <div style={{ fontSize:34,marginBottom:8 }}>⭐</div>
            <div style={{ fontSize:16,fontWeight:700,letterSpacing:2,color:"#ffd700",marginBottom:4 }}>CO·CERCA PREMIUM</div>
            <div style={{ fontSize:9,color:"#4ecda4",letterSpacing:1,marginBottom:16 }}>PAGO ÚNICO — TUYO PARA SIEMPRE</div>
            {["📹 Enviar tu presentación","👁 Ver quién te dio like","📍 Radio hasta 2km","💬 Chat ilimitado","⭐ Badge verificado"].map((f,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8,textAlign:"left",fontSize:12,fontFamily:"sans-serif" }}>{f}</div>
            ))}
            <div style={{ margin:"16px 0 6px",fontSize:28,fontWeight:900,color:"#ffd700" }}>${PRECIO_APP} <span style={{ fontSize:11,fontWeight:400,color:"#888" }}>USD único</span></div>
            <a href={MERCADOPAGO_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <button className="gold-btn" style={{ width:"100%",padding:"14px",borderRadius:12,fontSize:13,letterSpacing:2,boxSizing:"border-box" }} onClick={()=>{setIsPremium(true);setShowPaywall(false);}}>
                💳 PAGAR CON MERCADO PAGO
              </button>
            </a>
            <button onClick={()=>setShowPaywall(false)} style={{ marginTop:10,background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:10,letterSpacing:1 }}>ahora no</button>
          </div>
        </div>
      )}

      {/* MATCH ANIMATION */}
      {showMatchAnim&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(4,10,8,0.96)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300 }}>
          <style>{`@keyframes heartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}} .heart-pulse{animation:heartPulse 1s ease infinite}`}</style>
          <div className="match-boom" style={{ textAlign:"center",padding:24,width:"100%",boxSizing:"border-box" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20 }}>
              <div style={{ width:70,height:70,borderRadius:"50%",border:"3px solid #4ecda4",overflow:"hidden" }}>
                <img src={myProfile?.photo_url||`https://i.pravatar.cc/150?u=${myProfile?.name}`} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
              </div>
              <div className="heart-pulse" style={{ fontSize:28,margin:"0 8px" }}>💚</div>
              <div style={{ width:70,height:70,borderRadius:"50%",border:"3px solid #4ecda4",overflow:"hidden" }}>
                <img src={showMatchAnim.photo_url||`https://i.pravatar.cc/150?u=${showMatchAnim.name}`} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
              </div>
            </div>
            <div style={{ fontSize:28,fontWeight:900,letterSpacing:6,color:"#4ecda4",marginBottom:6 }}>MATCH</div>
            <div style={{ fontSize:14,color:"#7fffd4",fontFamily:"sans-serif",lineHeight:1.7,marginBottom:24 }}>
              {myProfile?.name||"Vos"} y {showMatchAnim.name}<br/>
              <span style={{ fontSize:11,color:"#4ecda4",opacity:0.6,letterSpacing:2 }}>LOS DOS ACEPTARON CONECTAR</span>
            </div>
            <button onClick={()=>{setShowMatchAnim(null);setActiveChat(showMatchAnim);setScreen("chat");}}
              style={{ background:"#4ecda4",border:"none",borderRadius:12,padding:"14px",fontSize:13,fontWeight:800,letterSpacing:2,color:"#080c10",cursor:"pointer",display:"block",width:"100%",marginBottom:10,boxSizing:"border-box" }}>
              💬 EMPEZAR A CHATEAR
            </button>
            <button onClick={()=>setShowMatchAnim(null)} style={{ background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:10,letterSpacing:1 }}>volver al radar</button>
          </div>
        </div>
      )}

      {/* LISTA MATCHES */}
      {showMatches&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24,boxSizing:"border-box" }} onClick={()=>setShowMatches(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#0d1a14",border:"1px solid #4ecda4",borderRadius:20,padding:22,width:"100%",maxWidth:360,boxSizing:"border-box" }}>
            <div style={{ fontSize:10,letterSpacing:4,color:"#4ecda4",marginBottom:14 }}>TUS MATCHES</div>
            {matches.length===0&&<div style={{ fontSize:11,color:"#2a5a3a",textAlign:"center",padding:"20px 0" }}>Todavía no tenés matches 💚</div>}
            {matches.map((m,i)=>{
              const other = m.otherUser;
              if (!other) return null;
              return (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #0f2218" }}>
                  <img src={other.photo_url||`https://i.pravatar.cc/150?u=${other.name}`} alt="" style={{ width:40,height:40,borderRadius:"50%",border:"2px solid #4ecda4",objectFit:"cover" }}/>
                  <div>
                    <div style={{ fontWeight:700 }}>{other.name}</div>
                    <div style={{ fontSize:9,color:"#4ecda4",opacity:0.6 }}>{other.age} años</div>
                  </div>
                  <button onClick={()=>{setActiveChat(other);setShowMatches(false);setScreen("chat");}} style={{ marginLeft:"auto",background:"#0a2a1a",border:"1px solid #4ecda4",borderRadius:8,padding:"6px 12px",color:"#4ecda4",fontSize:9,cursor:"pointer",letterSpacing:1 }}>CHAT</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
