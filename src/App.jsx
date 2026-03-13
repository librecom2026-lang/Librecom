import { useState, useRef, useEffect } from "react";

const MERCADOPAGO_LINK = "https://link.mercadopago.com.ar/douglascalle";
const PRECIO_APP = 5;
const API_URL = "https://librecom-production.up.railway.app";
const WS_URL = "wss://librecom-production.up.railway.app";

const MOCK_NEARBY = [
  { id: 1, name: "Vale", age: 24, frase: "Amo el café y los atardeceres 🌅", distance: 80, angle: 45, premium: true, photo: "https://i.pravatar.cc/150?img=1", busca: "hombres" },
  { id: 2, name: "Sofi", age: 22, frase: "Música y buena onda ✨", distance: 150, angle: 130, premium: false, photo: "https://i.pravatar.cc/150?img=5", busca: "hombres" },
  { id: 3, name: "Cami", age: 26, frase: "Diseñadora. Gatos 🐱", distance: 220, angle: 200, premium: true, photo: "https://i.pravatar.cc/150?img=9", busca: "todos" },
  { id: 4, name: "Marcos", age: 25, frase: "Músico y viajero 🎸", distance: 300, angle: 300, premium: false, photo: "https://i.pravatar.cc/150?img=11", busca: "mujeres" },
  { id: 5, name: "Maia", age: 25, frase: "Runner y foodie 🍕", distance: 420, angle: 70, premium: true, photo: "https://i.pravatar.cc/150?img=20", busca: "todos" },
];

const MAX_RADIUS = 500;

const BUSCA_OPTS = [
  { value: "mujeres", label: "Mujeres" },
  { value: "hombres", label: "Hombres" },
  { value: "todos", label: "Todos" },
];

export default function COCerca() {
  const [screen, setScreen] = useState("splash");
  const [splashStep, setSplashStep] = useState(0);
  const [myProfile, setMyProfile] = useState(null);

  // Registro
  const [regStep, setRegStep] = useState(1); // 1=nombre/edad, 2=busca, 3=presentacion
  const [regName, setRegName] = useState("");
  const [regAge, setRegAge] = useState("");
  const [regFrase, setRegFrase] = useState("");
  const [regBusca, setRegBusca] = useState("");
  const [regPresType, setRegPresType] = useState(""); // "foto" | "video"
  const [regPhoto, setRegPhoto] = useState(null);
  const [regPhotoURL, setRegPhotoURL] = useState("");
  const [regMensaje, setRegMensaje] = useState("");

  // Radar
  const [users, setUsers] = useState(MOCK_NEARBY);
  const [maxDist, setMaxDist] = useState(500);
  const [visible, setVisible] = useState(true);
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [videoSent, setVideoSent] = useState([]);
  const [esperando, setEsperando] = useState([]);
  const [showMatchAnim, setShowMatchAnim] = useState(null);
  const [showPresMode, setShowPresMode] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  // Splash
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

  // Radar animation
  useEffect(() => {
    if (screen !== "radar") return;
    const t = setInterval(() => {
      setUsers(prev => prev.map(u => ({
        ...u,
        distance: Math.max(30, u.distance + (Math.random() - 0.5) * 15),
        angle: (u.angle + (Math.random() - 0.5) * 4 + 360) % 360,
      })));
    }, 2500);
    return () => clearInterval(t);
  }, [screen]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, activeChat]);

  const radarSize = 300;
  const getXY = (distance, angle) => {
    const r = (Math.min(distance, MAX_RADIUS) / MAX_RADIUS) * (radarSize / 2 - 28);
    const rad = (angle - 90) * Math.PI / 180;
    return { x: radarSize / 2 + r * Math.cos(rad), y: radarSize / 2 + r * Math.sin(rad) };
  };

  // Filtrar según lo que busca el usuario
  const visibleUsers = users.filter(u => {
    if (u.distance > maxDist) return false;
    if (!myProfile) return true;
    if (myProfile.busca === "todos") return true;
    if (myProfile.busca === "mujeres" && ["Vale","Sofi","Cami","Maia"].includes(u.name)) return true;
    if (myProfile.busca === "hombres" && ["Marcos"].includes(u.name)) return true;
    return u.busca === "todos" || u.busca === (myProfile?.busca === "mujeres" ? "hombres" : "mujeres");
  });

  const handleConnect = (user) => {
    if (!isPremium) { setShowPaywall(true); return; }
    setVideoSent(prev => [...prev, user.id]);
    setEsperando(prev => [...prev, user.id]);
    setSelected(null);
    // Simular que ella acepta después de unos segundos
    const delay = 4000 + Math.random() * 4000;
    setTimeout(() => {
      setEsperando(prev => prev.filter(id => id !== user.id));
      if (!matches.find(m => m.id === user.id)) {
        setMatches(m => [...m, user]);
        setChatMessages(prev => ({ ...prev, [user.id]: [] }));
        setShowMatchAnim(user);
        setTimeout(() => setShowMatchAnim(null), 4000);
      }
    }, delay);
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !activeChat) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    setChatMessages(prev => ({ ...prev, [activeChat.id]: [...(prev[activeChat.id]||[]), { from:"me", text:chatInput.trim(), time }] }));
    setChatInput("");
    setTimeout(() => {
      const replies = ["Jaja sí! 😄","Qué bueno 💚","Contame más!","Estás cerca todavía?","Me alegra que hayas conectado 🌿"];
      const t2 = new Date();
      setChatMessages(prev => ({ ...prev, [activeChat.id]: [...(prev[activeChat.id]||[]), { from:"them", text:replies[Math.floor(Math.random()*replies.length)], time:`${t2.getHours()}:${String(t2.getMinutes()).padStart(2,'0')}` }] }));
    }, 1200);
  };

  const S = {
    page: { minHeight:"100vh", background:"#080c10", display:"flex", flexDirection:"column", alignItems:"center", fontFamily:"'Courier New', monospace", color:"#e0f7f0" },
    btn: { background:"#4ecda4", border:"none", borderRadius:12, padding:"14px 0", fontSize:13, fontWeight:800, letterSpacing:2, color:"#080c10", cursor:"pointer", width:"100%", marginTop:10 },
    btnOutline: { background:"none", border:"1px solid #4ecda4", borderRadius:12, padding:"12px 0", fontSize:12, fontWeight:700, letterSpacing:1, color:"#4ecda4", cursor:"pointer", width:"100%", marginTop:8 },
    input: { width:"100%", background:"#0d1a14", border:"1px solid #1a3a2a", borderRadius:10, padding:"12px 14px", color:"#e0f7f0", fontSize:14, fontFamily:"sans-serif", outline:"none", boxSizing:"border-box" },
    card: { background:"#0d1a14", border:"1px solid #1a4a2a", borderRadius:16, padding:"20px", width:"100%", maxWidth:360 },
    label: { fontSize:10, letterSpacing:3, color:"#4ecda4", marginBottom:8, display:"block" },
  };

  // ─── SPLASH ───────────────────────────────────
  if (screen === "splash") return (
    <div style={{ ...S.page, justifyContent:"center" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .fi{animation:fadeIn 0.8s ease forwards}
        .pu{animation:pulse 2s infinite}
      `}</style>
      <div style={{ position:"relative", marginBottom:28 }}>
        <div style={{ width:80,height:80,borderRadius:"50%",border:"2px solid #4ecda4",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 30px #4ecda420",fontSize:32 }}>📡</div>
        <div className="pu" style={{ position:"absolute",inset:-8,borderRadius:"50%",border:"1px solid #4ecda440" }}/>
      </div>
      {splashStep>=0 && <div className="fi" style={{ fontSize:10,letterSpacing:5,color:"#4ecda4",opacity:0.7,marginBottom:6 }}>RED CO</div>}
      {splashStep>=1 && <div className="fi" style={{ fontSize:26,fontWeight:900,letterSpacing:4,color:"#7fffd4",marginBottom:20 }}>CO·CERCA</div>}
      {splashStep>=2 && <div className="fi" style={{ fontSize:10,color:"#4ecda4",opacity:0.5,letterSpacing:2 }}>CÓDIGO ORIGEN</div>}
      {splashStep>=3 && <div className="fi pu" style={{ marginTop:28,fontSize:9,color:"#2a6a4a",letterSpacing:3 }}>INICIANDO...</div>}
    </div>
  );

  // ─── INTRO ────────────────────────────────────
  if (screen === "intro") return (
    <div style={{ ...S.page, justifyContent:"center", padding:28, textAlign:"center" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp 0.9s ease forwards}`}</style>
      <div className="fu" style={{ marginBottom:24 }}>
        <div style={{ width:70,height:70,borderRadius:"50%",border:"2px solid #4ecda4",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:"0 0 40px #4ecda430",fontSize:28 }}>📡</div>
        <div style={{ fontSize:9,letterSpacing:5,color:"#4ecda4",opacity:0.7,marginBottom:6 }}>RED CO — CÓDIGO ORIGEN</div>
        <div style={{ fontSize:24,fontWeight:900,letterSpacing:3,color:"#7fffd4" }}>BIENVENIDO/A<br/>A CO·CERCA</div>
      </div>
      <div className="fu" style={{ animationDelay:"0.3s", opacity:0, width:"100%", maxWidth:340 }}>
        <div style={{ ...S.card, marginBottom:20, textAlign:"left" }}>
          <div style={{ fontSize:13,color:"#7fffd4",lineHeight:1.8,fontFamily:"sans-serif",fontWeight:300,textAlign:"center" }}>
            Muy pronto:<br/>
            <span style={{ color:"#4ecda4",fontWeight:700,fontFamily:"'Courier New',monospace",letterSpacing:1 }}>LA INTERNET DE LA REBELIÓN</span>
          </div>
          <div style={{ width:"100%",height:1,background:"#1a4a2a",margin:"12px 0" }}/>
          <div style={{ fontSize:11,color:"#4ecda4",opacity:0.6,lineHeight:1.7,fontFamily:"sans-serif",textAlign:"center" }}>
            Una probada de las apps del nuevo sistema de comunicación que <strong style={{ color:"#7fffd4" }}>no depende de internet</strong>.
          </div>
        </div>
        <div style={{ fontSize:9,color:"#2a5a3a",letterSpacing:2,marginBottom:24 }}>DESCENTRALIZADO · ENCRIPTADO · LIBRE</div>
        <button style={{ ...S.btn }} onClick={() => setScreen("registro")}>ENTRAR</button>
      </div>
    </div>
  );

  // ─── REGISTRO ─────────────────────────────────
  if (screen === "registro") return (
    <div style={{ ...S.page, justifyContent:"center", padding:24 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp 0.4s ease}`}</style>

      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ fontSize:9,letterSpacing:4,color:"#4ecda4",marginBottom:4 }}>CO·CERCA</div>
        <div style={{ fontSize:18,fontWeight:700,color:"#7fffd4",marginBottom:24,letterSpacing:2 }}>
          {regStep===1?"QUIÉN SOS":regStep===2?"QUÉ BUSCÁS":"TU PRESENTACIÓN"}
        </div>

        {/* Paso 1 — Nombre, edad, frase */}
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

        {/* Paso 2 — Qué buscás */}
        {regStep===2 && (
          <div className="fu">
            <label style={S.label}>MOSTRARME EN EL RADAR DE</label>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
              {BUSCA_OPTS.map(o => (
                <button key={o.value} onClick={()=>setRegBusca(o.value)} style={{ padding:"14px", borderRadius:12, border:`1px solid ${regBusca===o.value?"#4ecda4":"#1a3a2a"}`, background:regBusca===o.value?"#0d2a1a":"#0a0f0d", color:regBusca===o.value?"#7fffd4":"#4ecda4", fontSize:13, cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1, textAlign:"left", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16 }}>{o.value==="mujeres"?"👩":o.value==="hombres"?"👨":"🌈"}</span>
                  {o.label}
                  {regBusca===o.value && <span style={{ marginLeft:"auto" }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={{ ...S.btnOutline, width:"auto", padding:"12px 20px" }} onClick={()=>setRegStep(1)}>← ATRÁS</button>
              <button style={{ ...S.btn, marginTop:0, opacity:regBusca?1:0.4 }} disabled={!regBusca} onClick={()=>setRegStep(3)}>SIGUIENTE →</button>
            </div>
          </div>
        )}

        {/* Paso 3 — Presentación */}
        {regStep===3 && (
          <div className="fu">
            <label style={S.label}>¿CÓMO TE PRESENTÁS?</label>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              <button onClick={()=>setRegPresType("foto")} style={{ flex:1, padding:"16px 10px", borderRadius:12, border:`1px solid ${regPresType==="foto"?"#4ecda4":"#1a3a2a"}`, background:regPresType==="foto"?"#0d2a1a":"#0a0f0d", color:regPresType==="foto"?"#7fffd4":"#4ecda4", cursor:"pointer", fontFamily:"'Courier New',monospace", fontSize:12, letterSpacing:1 }}>
                📸<br/>FOTO +<br/>MENSAJE
              </button>
              <button onClick={()=>setRegPresType("video")} style={{ flex:1, padding:"16px 10px", borderRadius:12, border:`1px solid ${regPresType==="video"?"#4ecda4":"#1a3a2a"}`, background:regPresType==="video"?"#0d2a1a":"#0a0f0d", color:regPresType==="video"?"#7fffd4":"#4ecda4", cursor:"pointer", fontFamily:"'Courier New',monospace", fontSize:12, letterSpacing:1 }}>
                📹<br/>VIDEO DE<br/>PRESENTACIÓN
              </button>
            </div>

            {regPresType==="foto" && (
              <div style={{ marginBottom:16 }}>
                <label style={{ ...S.label, marginBottom:6 }}>TU FOTO</label>
                <div style={{ border:"1px dashed #1a4a2a", borderRadius:12, padding:"20px", textAlign:"center", marginBottom:12, cursor:"pointer" }}
                  onClick={()=>document.getElementById("photoInput").click()}>
                  {regPhotoURL
                    ? <img src={regPhotoURL} alt="" style={{ width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"2px solid #4ecda4" }}/>
                    : <div style={{ color:"#2a6a4a", fontSize:12, letterSpacing:1 }}>📸 SUBIR FOTO<br/><span style={{ fontSize:10, opacity:0.6 }}>tocá para elegir</span></div>
                  }
                </div>
                <input id="photoInput" type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{const f=e.target.files[0];if(f){setRegPhoto(f);setRegPhotoURL(URL.createObjectURL(f))}}}/>
                <label style={S.label}>TU MENSAJE</label>
                <textarea style={{ ...S.input, minHeight:70, resize:"none" }} placeholder="Ej: Hola! Soy Matías, te vi y me animé 😊" value={regMensaje} onChange={e=>setRegMensaje(e.target.value)} maxLength={120}/>
              </div>
            )}

            {regPresType==="video" && (
              <div style={{ border:"1px dashed #1a4a2a", borderRadius:12, padding:"24px", textAlign:"center", marginBottom:16 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📹</div>
                <div style={{ color:"#4ecda4", fontSize:12, letterSpacing:1, marginBottom:4 }}>VIDEO DE PRESENTACIÓN</div>
                <div style={{ color:"#2a6a4a", fontSize:10, lineHeight:1.6 }}>Grabá un video corto presentándote.<br/>Se muestra cuando alguien te ve en el radar.</div>
                <button style={{ ...S.btn, marginTop:16 }} onClick={()=>{}}>🎥 GRABAR VIDEO</button>
              </div>
            )}

            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <button style={{ ...S.btnOutline, width:"auto", padding:"12px 20px", marginTop:0 }} onClick={()=>setRegStep(2)}>← ATRÁS</button>
              <button
                style={{ ...S.btn, marginTop:0, opacity:regPresType?1:0.4 }}
                disabled={!regPresType}
                onClick={()=>{
                  setMyProfile({ name:regName, age:parseInt(regAge), frase:regFrase, busca:regBusca, presType:regPresType, photo:regPhotoURL||"https://i.pravatar.cc/150?img=33", mensaje:regMensaje });
                  setScreen("radar");
                }}>
                ENTRAR AL RADAR ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── MODO PRESENTACIÓN ────────────────────────
  if (showPresMode) return (
    <div style={{ ...S.page, justifyContent:"center", padding:24, background:"#050810" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp 0.5s ease}`}</style>
      <div className="fu" style={{ width:"100%", maxWidth:340, textAlign:"center" }}>
        <div style={{ fontSize:9,letterSpacing:4,color:"#4ecda4",marginBottom:20,opacity:0.6 }}>MOSTRÁ ESTA PANTALLA</div>

        {myProfile?.presType==="video" ? (
          <div style={{ background:"#0d1a14", border:"1px solid #1a4a2a", borderRadius:20, padding:28, marginBottom:16 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📹</div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>{myProfile?.name}</div>
            <div style={{ fontSize:13, color:"#4ecda4", marginBottom:8 }}>{myProfile?.age} años</div>
            {myProfile?.frase && <div style={{ fontSize:12, color:"#7fffd4", opacity:0.7, fontFamily:"sans-serif" }}>{myProfile?.frase}</div>}
            <div style={{ marginTop:16, fontSize:10, color:"#2a6a4a", letterSpacing:1 }}>VIDEO DE PRESENTACIÓN</div>
            <div style={{ marginTop:8, background:"#080c10", borderRadius:10, padding:"12px", fontSize:11, color:"#4ecda4", opacity:0.6 }}>📱 grabá tu video en el perfil</div>
          </div>
        ) : (
          <div style={{ background:"#0d1a14", border:"1px solid #1a4a2a", borderRadius:20, padding:28, marginBottom:16 }}>
            <img src={myProfile?.photo} alt="" style={{ width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid #4ecda4",marginBottom:14 }}/>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>{myProfile?.name}</div>
            <div style={{ fontSize:13, color:"#4ecda4", marginBottom:12 }}>{myProfile?.age} años</div>
            {myProfile?.mensaje && (
              <div style={{ background:"#080c10", borderRadius:10, padding:"12px 16px", fontSize:13, color:"#7fffd4", fontFamily:"sans-serif", lineHeight:1.6, textAlign:"left" }}>
                "{myProfile?.mensaje}"
              </div>
            )}
          </div>
        )}

        {/* Botón que ella toca */}
        <button style={{ ...S.btn, fontSize:14, padding:"16px", borderRadius:14, boxShadow:"0 0 20px #4ecda440" }}>
          💚 CONECTAR CON {myProfile?.name?.toUpperCase()}
        </button>
        <div style={{ fontSize:9, color:"#2a5a3a", letterSpacing:1, marginTop:10, lineHeight:1.6 }}>
          Al tocar se descarga CO·CERCA<br/>y quedan conectados
        </div>

        <button onClick={()=>setShowPresMode(false)} style={{ marginTop:20, background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:11, letterSpacing:1 }}>← VOLVER AL RADAR</button>
      </div>
    </div>
  );

  // ─── CHAT ─────────────────────────────────────
  if (screen==="chat" && activeChat) {
    const msgs = chatMessages[activeChat.id]||[];
    return (
      <div style={{ minHeight:"100vh", background:"#080c10", display:"flex", flexDirection:"column", fontFamily:"'Courier New',monospace", color:"#e0f7f0" }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .msg{animation:fadeUp 0.2s ease}`}</style>
        <div style={{ background:"#0d1a14", borderBottom:"1px solid #1a3a2a", padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>setScreen("radar")} style={{ background:"none",border:"none",color:"#4ecda4",cursor:"pointer",fontSize:18,padding:0 }}>←</button>
          <img src={activeChat.photo} alt="" style={{ width:38,height:38,borderRadius:"50%",border:"2px solid #4ecda4",objectFit:"cover" }}/>
          <div>
            <div style={{ fontWeight:700,fontSize:14 }}>{activeChat.name}</div>
            <div style={{ fontSize:9,color:"#4ecda4",letterSpacing:2,opacity:0.7 }}>● EN LÍNEA · {Math.round(activeChat.distance)}m</div>
          </div>
          <div style={{ marginLeft:"auto",fontSize:9,color:"#2a6a4a",letterSpacing:2 }}>CO·CHAT</div>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"14px 14px 8px",display:"flex",flexDirection:"column",gap:10 }}>
          <div style={{ textAlign:"center",margin:"6px 0" }}>
            <span style={{ fontSize:9,color:"#2a6a4a",letterSpacing:2,background:"#0d1a14",padding:"4px 12px",borderRadius:20,border:"1px solid #1a3a2a" }}>💚 MATCH CON {activeChat.name.toUpperCase()}</span>
          </div>
          {msgs.length===0 && <div style={{ textAlign:"center",color:"#2a5a3a",fontSize:11,letterSpacing:1,marginTop:20 }}>Sé el primero en escribir 👋</div>}
          {msgs.map((msg,i)=>(
            <div key={i} className="msg" style={{ display:"flex",justifyContent:msg.from==="me"?"flex-end":"flex-start" }}>
              {msg.from==="them" && <img src={activeChat.photo} alt="" style={{ width:26,height:26,borderRadius:"50%",objectFit:"cover",marginRight:8,alignSelf:"flex-end",border:"1px solid #1a3a2a" }}/>}
              <div style={{ maxWidth:"70%",background:msg.from==="me"?"#4ecda4":"#0d1a14",color:msg.from==="me"?"#080c10":"#e0f7f0",border:msg.from==="me"?"none":"1px solid #1a3a2a",borderRadius:msg.from==="me"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"10px 14px",fontFamily:"sans-serif",fontSize:13 }}>
                {msg.text}
                <div style={{ fontSize:9,opacity:0.5,marginTop:4,textAlign:"right",fontFamily:"'Courier New',monospace" }}>{msg.time}</div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        <div style={{ padding:"10px 14px",background:"#0d1a14",borderTop:"1px solid #1a3a2a",display:"flex",gap:10,alignItems:"center" }}>
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Escribí algo..." style={{ flex:1,background:"#080c10",border:"1px solid #1a3a2a",borderRadius:24,padding:"10px 16px",color:"#e0f7f0",fontSize:13,fontFamily:"sans-serif",outline:"none" }}/>
          <button onClick={sendMessage} style={{ width:40,height:40,borderRadius:"50%",background:"#4ecda4",border:"none",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center" }}>➤</button>
        </div>
      </div>
    );
  }

  // ─── RADAR PRINCIPAL ──────────────────────────
  return (
    <div style={{ ...S.page }}>
      <style>{`
        @keyframes radarSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes matchBoom{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
        @keyframes goldShine{0%{background-position:-200% center}100%{background-position:200% center}}
        .panel{animation:fadeUp 0.3s ease}
        .match-boom{animation:matchBoom 0.6s cubic-bezier(0.34,1.56,0.64,1)}
        .gold-btn{background:linear-gradient(90deg,#b8860b,#ffd700,#daa520,#ffd700,#b8860b);background-size:200% auto;animation:goldShine 2s linear infinite;border:none;color:#1a0a00;font-weight:800;cursor:pointer}
        .dot-ping{animation:ping 2s ease-out infinite}
        .udot{cursor:pointer;transition:all 0.3s}
        .udot:hover{filter:brightness(1.4)}
      `}</style>

      {/* Header */}
      <div style={{ width:"100%",maxWidth:390,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 8px" }}>
        <div style={{ cursor:"pointer" }} onClick={()=>setScreen("intro")}>
          <div style={{ fontSize:9,letterSpacing:4,color:"#4ecda4",opacity:0.6 }}>RED CO</div>
          <div style={{ fontSize:19,fontWeight:700,letterSpacing:2,color:"#7fffd4" }}>CO·CERCA</div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {/* Botón modo presentación */}
          <button onClick={()=>setShowPresMode(true)} style={{ background:"#0d2a1a",border:"1px solid #4ecda4",borderRadius:20,padding:"5px 12px",color:"#4ecda4",cursor:"pointer",fontSize:9,letterSpacing:1 }}>
            {myProfile?.presType==="video"?"📹":"📸"} MOSTRAR
          </button>
          {!isPremium && <button onClick={()=>setShowPaywall(true)} className="gold-btn" style={{ borderRadius:20,padding:"5px 12px",fontSize:9,letterSpacing:1 }}>⭐ PREMIUM</button>}
          {isPremium && <span style={{ fontSize:9,color:"#ffd700",letterSpacing:2,border:"1px solid #ffd700",borderRadius:20,padding:"4px 10px" }}>⭐ PRO</span>}
          {matches.length>0 && (
            <button onClick={()=>setShowMatches(true)} style={{ background:"none",border:"none",cursor:"pointer",position:"relative",padding:0 }}>
              <span style={{ fontSize:20 }}>💚</span>
              <span style={{ position:"absolute",top:-4,right:-4,background:"#4ecda4",color:"#080c10",borderRadius:"50%",fontSize:9,width:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>{matches.length}</span>
            </button>
          )}
          <button onClick={()=>setShowSettings(!showSettings)} style={{ background:"none",border:"1px solid #1a3a2a",borderRadius:8,padding:"5px 9px",color:"#4ecda4",cursor:"pointer",fontSize:12 }}>⚙</button>
        </div>
      </div>

      {/* Visible toggle */}
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"0 18px",width:"100%",maxWidth:390 }}>
        <div style={{ width:7,height:7,borderRadius:"50%",background:visible?"#4ecda4":"#333",boxShadow:visible?"0 0 8px #4ecda4":"none",transition:"all 0.3s" }}/>
        <span style={{ fontSize:9,letterSpacing:2,color:visible?"#4ecda4":"#444" }}>{visible?"VISIBLE EN RADAR":"MODO OCULTO"}</span>
        <button onClick={()=>setVisible(!visible)} style={{ marginLeft:"auto",background:visible?"#0a2a1a":"#111",border:`1px solid ${visible?"#4ecda4":"#333"}`,borderRadius:20,padding:"3px 12px",color:visible?"#4ecda4":"#555",cursor:"pointer",fontSize:9,letterSpacing:1,transition:"all 0.3s" }}>
          {visible?"ON":"OFF"}
        </button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="panel" style={{ width:"100%",maxWidth:390,background:"#0d1a14",border:"1px solid #1a3a2a",borderRadius:12,padding:"12px 18px",marginBottom:8 }}>
          <div style={{ fontSize:9,letterSpacing:3,color:"#4ecda4",marginBottom:8 }}>RADIO DE BÚSQUEDA</div>
          <input type="range" min={50} max={500} step={50} value={maxDist} onChange={e=>setMaxDist(Number(e.target.value))} style={{ width:"100%",accentColor:"#4ecda4" }}/>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#4ecda4",marginTop:4 }}>
            <span>50m</span><span style={{ fontWeight:700 }}>{maxDist}m</span><span>500m</span>
          </div>
        </div>
      )}

      {/* RADAR HTML — fotos reales */}
      <div style={{ position:"relative", width:radarSize, height:radarSize, margin:"4px 0" }}>

        {/* Círculos de fondo SVG */}
        <svg width={radarSize} height={radarSize} style={{ position:"absolute", top:0, left:0 }}>
          {[1,0.75,0.5,0.25].map((r,i)=>(
            <circle key={i} cx={radarSize/2} cy={radarSize/2} r={(radarSize/2-8)*r} fill="none" stroke={i===0?"#1a3a2a":"#0f2218"} strokeWidth={i===0?1.5:1} strokeDasharray={i>0?"4 6":"none"}/>
          ))}
          <line x1={radarSize/2} y1={8} x2={radarSize/2} y2={radarSize-8} stroke="#0f2218" strokeWidth={1}/>
          <line x1={8} y1={radarSize/2} x2={radarSize-8} y2={radarSize/2} stroke="#0f2218" strokeWidth={1}/>
          <defs>
            <radialGradient id="sw" cx="0%" cy="0%" r="100%">
              <stop offset="0%" stopColor="#4ecda4" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#4ecda4" stopOpacity="0"/>
            </radialGradient>
          </defs>
          {/* Sweep animado */}
          <g style={{ transformOrigin:`${radarSize/2}px ${radarSize/2}px`, animation:"radarSweep 4s linear infinite" }}>
            <path d={`M ${radarSize/2} ${radarSize/2} L ${radarSize/2} 8 A ${radarSize/2-8} ${radarSize/2-8} 0 0 1 ${radarSize/2+(radarSize/2-8)*Math.sin(Math.PI/3)} ${radarSize/2-(radarSize/2-8)*Math.cos(Math.PI/3)} Z`} fill="url(#sw)"/>
            <line x1={radarSize/2} y1={radarSize/2} x2={radarSize/2} y2={8} stroke="#4ecda4" strokeWidth={1.5} strokeOpacity={0.8}/>
          </g>
          {/* Anillo de radio configurable */}
          <circle cx={radarSize/2} cy={radarSize/2} r={(maxDist/MAX_RADIUS)*(radarSize/2-24)} fill="none" stroke="#4ecda4" strokeWidth={1} strokeDasharray="3 5" strokeOpacity={0.35}/>
        </svg>

        {/* Punto central — YO */}
        <div style={{ position:"absolute", left:radarSize/2-10, top:radarSize/2-10, width:20, height:20, borderRadius:"50%", background:"#4ecda4", boxShadow:"0 0 12px #4ecda4", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#080c10" }}>
          {myProfile?.name?.[0]||"●"}
        </div>
        <div className="dot-ping" style={{ position:"absolute", left:radarSize/2-10, top:radarSize/2-10, width:20, height:20, borderRadius:"50%", border:"2px solid #4ecda4", zIndex:9 }}/>

        {/* Usuarios como divs con foto real */}
        {visibleUsers.map(user => {
          const {x,y} = getXY(user.distance, user.angle);
          const isSel = selected?.id === user.id;
          const isMatch = matches.find(m => m.id === user.id);
          const size = isSel ? 44 : 36;
          return (
            <div
              key={user.id}
              className="udot"
              onClick={() => setSelected(isSel ? null : user)}
              style={{
                position:"absolute",
                left: x - size/2,
                top: y - size/2,
                width: size,
                height: size,
                borderRadius:"50%",
                border: `2px solid ${isSel?"#7fffd4":isMatch?"#4ecda4":user.premium?"#ffd700":"#4ecda4"}`,
                boxShadow: isSel ? "0 0 14px #4ecda480" : isMatch ? "0 0 10px #4ecda440" : "none",
                overflow:"hidden",
                zIndex: isSel ? 20 : 5,
                background:"#0d2a1a",
                transition:"all 0.3s",
              }}
            >
              {/* Foto */}
              <img
                src={user.photo}
                alt={user.name}
                style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
              />
              {/* Fallback inicial si foto no carga */}
              <div style={{ display:"none", width:"100%", height:"100%", alignItems:"center", justifyContent:"center", fontSize:size>38?14:11, fontWeight:700, color:"#4ecda4", background:"#0d2a1a" }}>
                {user.name[0]}
              </div>
              {/* Badge match */}
              {isMatch && (
                <div style={{ position:"absolute", top:-4, right:-4, fontSize:10, lineHeight:1 }}>💚</div>
              )}
              {/* Badge premium */}
              {!isMatch && user.premium && (
                <div style={{ position:"absolute", top:-4, right:-4, width:12, height:12, borderRadius:"50%", background:"#ffd700", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, fontWeight:700, color:"#1a0a00" }}>★</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:9,letterSpacing:3,color:"#2a6a4a",marginBottom:8 }}>
        {visibleUsers.length} SEÑAL{visibleUsers.length!==1?"ES":""} DETECTADA{visibleUsers.length!==1?"S":""}
      </div>

      {/* Panel usuario seleccionado */}
      {selected && (
        <div className="panel" style={{ ...S.card, margin:"0 12px 10px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <img src={selected.photo} alt="" style={{ width:52,height:52,borderRadius:"50%",border:`2px solid ${selected.premium?"#ffd700":"#4ecda4"}`,objectFit:"cover" }}/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ fontSize:16,fontWeight:700 }}>{selected.name}</span>
                {selected.premium&&<span style={{ fontSize:10,color:"#ffd700" }}>⭐</span>}
                {matches.find(m=>m.id===selected.id)&&<span style={{ fontSize:12 }}>💚</span>}
              </div>
              <div style={{ fontSize:10,color:"#4ecda4",opacity:0.7 }}>{selected.age} años</div>
              <div style={{ fontSize:9,color:"#2a6a4a",marginTop:2 }}>📍 {Math.round(selected.distance)}m</div>
            </div>
          </div>
          <div style={{ fontSize:12,color:"#7fffd4",opacity:0.7,margin:"10px 0 12px",fontFamily:"sans-serif" }}>{selected.frase}</div>
          {matches.find(m=>m.id===selected.id) ? (
            <button onClick={()=>{setActiveChat(selected);setScreen("chat");}} style={{ ...S.btn, marginTop:0 }}>💬 ABRIR CHAT</button>
          ) : esperando.includes(selected.id) ? (
            // Pantalla de espera — señal enviada, esperando que ella acepte
            <div style={{ background:"#0a1f14", border:"1px solid #1a4a2a", borderRadius:12, padding:"14px 16px", textAlign:"center" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>📹</div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"#4ecda4", marginBottom:6 }}>PRESENTACIÓN ENVIADA</div>
              <div style={{ fontSize:11, color:"#7fffd4", opacity:0.7, fontFamily:"sans-serif", marginBottom:12, lineHeight:1.6 }}>
                {selected.name} está viendo tu presentación...<br/>el match aparece si ella también acepta
              </div>
              {/* Puntos animados de espera */}
              <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#4ecda4", animation:`waitDot 1.2s ease-in-out ${i*0.3}s infinite` }}/>
                ))}
              </div>
              <style>{`@keyframes waitDot{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
            </div>
          ) : (
            <button onClick={()=>handleConnect(selected)} style={{ width:"100%",padding:"12px",borderRadius:10,background:isPremium?"#4ecda4":"#1a1a0a",border:isPremium?"none":"1px solid #ffd700",color:isPremium?"#080c10":"#ffd700",fontSize:11,fontWeight:700,letterSpacing:2,cursor:"pointer" }}>
              {isPremium?"📹 ENVIAR PRESENTACIÓN":"🔒 ENVIAR PRESENTACIÓN (PREMIUM)"}
            </button>
          )}
          {!isPremium&&!matches.find(m=>m.id===selected.id)&&!esperando.includes(selected.id)&&(
            <div style={{ fontSize:9,color:"#555",textAlign:"center",marginTop:6,letterSpacing:1 }}>Único pago de ${PRECIO_APP} — tuyo para siempre</div>
          )}
        </div>
      )}

      {/* PAYWALL */}
      {showPaywall&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20 }} onClick={()=>setShowPaywall(false)}>
          <div onClick={e=>e.stopPropagation()} className="panel" style={{ background:"#0d1a14",border:"1px solid #ffd700",borderRadius:20,padding:26,width:"100%",maxWidth:330,textAlign:"center" }}>
            <div style={{ fontSize:34,marginBottom:8 }}>⭐</div>
            <div style={{ fontSize:16,fontWeight:700,letterSpacing:2,color:"#ffd700",marginBottom:4 }}>CO·CERCA PREMIUM</div>
            <div style={{ fontSize:9,color:"#4ecda4",letterSpacing:1,marginBottom:16 }}>PAGO ÚNICO — TUYO PARA SIEMPRE</div>
            {["📹 Enviar tu presentación","👁 Ver quién te dio like","📍 Radio hasta 2km","💬 Chat ilimitado","⭐ Badge verificado"].map((f,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8,textAlign:"left",fontSize:12,fontFamily:"sans-serif" }}>{f}</div>
            ))}
            <div style={{ margin:"16px 0 6px",fontSize:28,fontWeight:900,color:"#ffd700" }}>${PRECIO_APP} <span style={{ fontSize:11,fontWeight:400,color:"#888" }}>USD único</span></div>
            <div style={{ fontSize:8,color:"#444",marginBottom:14,letterSpacing:1 }}>PRECIO ATADO AL VALOR DEL ORO</div>
            <a href={MERCADOPAGO_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
              <button className="gold-btn" style={{ width:"100%",padding:"14px",borderRadius:12,fontSize:13,letterSpacing:2 }} onClick={()=>{setIsPremium(true);setShowPaywall(false);}}>
                💳 PAGAR CON MERCADO PAGO
              </button>
            </a>
            <button onClick={()=>setShowPaywall(false)} style={{ marginTop:10,background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:10,letterSpacing:1 }}>ahora no</button>
          </div>
        </div>
      )}

      {/* MATCH ANIMATION */}
      {showMatchAnim&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(4,10,8,0.96)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,flexDirection:"column" }}>
          <style>{`
            @keyframes matchBoom{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
            @keyframes heartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
            @keyframes glow{0%,100%{box-shadow:0 0 20px #4ecda440}50%{box-shadow:0 0 40px #4ecda4}}
            .match-boom{animation:matchBoom 0.7s cubic-bezier(0.34,1.56,0.64,1)}
            .heart-pulse{animation:heartPulse 1s ease infinite}
            .glow-anim{animation:glow 1.5s ease infinite}
          `}</style>
          <div className="match-boom" style={{ textAlign:"center", padding:24 }}>
            {/* Fotos de los dos */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:20 }}>
              {/* Mi foto */}
              <div className="glow-anim" style={{ width:70,height:70,borderRadius:"50%",border:"3px solid #4ecda4",overflow:"hidden",zIndex:2 }}>
                <img src={myProfile?.photo||"https://i.pravatar.cc/150?img=33"} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
              </div>
              {/* Corazón del medio */}
              <div className="heart-pulse" style={{ fontSize:28,margin:"0 -8px",zIndex:3 }}>💚</div>
              {/* Foto de ella */}
              <div className="glow-anim" style={{ width:70,height:70,borderRadius:"50%",border:"3px solid #4ecda4",overflow:"hidden",zIndex:2 }}>
                <img src={showMatchAnim.photo} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
              </div>
            </div>

            <div style={{ fontSize:28,fontWeight:900,letterSpacing:6,color:"#4ecda4",marginBottom:6 }}>MATCH</div>
            <div style={{ fontSize:14,color:"#7fffd4",fontFamily:"sans-serif",lineHeight:1.7,marginBottom:6 }}>
              {myProfile?.name||"Vos"} y {showMatchAnim.name}
            </div>
            <div style={{ fontSize:11,color:"#4ecda4",opacity:0.6,letterSpacing:2,marginBottom:24 }}>
              LOS DOS ACEPTARON CONECTAR
            </div>

            <button
              onClick={()=>{setShowMatchAnim(null);setActiveChat(showMatchAnim);setScreen("chat");}}
              style={{ background:"#4ecda4",border:"none",borderRadius:12,padding:"14px 36px",fontSize:13,fontWeight:800,letterSpacing:2,color:"#080c10",cursor:"pointer",boxShadow:"0 0 20px #4ecda450",display:"block",width:"100%",marginBottom:10 }}>
              💬 EMPEZAR A CHATEAR
            </button>
            <button onClick={()=>setShowMatchAnim(null)} style={{ background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:10,letterSpacing:1 }}>
              volver al radar
            </button>
          </div>
        </div>
      )}

      {/* MATCHES LIST */}
      {showMatches&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24 }} onClick={()=>setShowMatches(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#0d1a14",border:"1px solid #4ecda4",borderRadius:20,padding:22,width:"100%",maxWidth:320 }}>
            <div style={{ fontSize:10,letterSpacing:4,color:"#4ecda4",marginBottom:14 }}>TUS MATCHES</div>
            {matches.map(m=>(
              <div key={m.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #0f2218" }}>
                <img src={m.photo} alt="" style={{ width:40,height:40,borderRadius:"50%",border:"2px solid #4ecda4",objectFit:"cover" }}/>
                <div>
                  <div style={{ fontWeight:700 }}>{m.name}</div>
                  <div style={{ fontSize:9,color:"#4ecda4",opacity:0.6 }}>{m.age} años</div>
                </div>
                <button onClick={()=>{setActiveChat(m);setShowMatches(false);setScreen("chat");}} style={{ marginLeft:"auto",background:"#0a2a1a",border:"1px solid #4ecda4",borderRadius:8,padding:"6px 12px",color:"#4ecda4",fontSize:9,cursor:"pointer",letterSpacing:1 }}>CHAT</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
