import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

// ─── Utility ────────────────────────────────────────────────────────────────
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const isPast  = (iso) => new Date(iso) < new Date();
const isNear  = (iso) => { const diff = new Date(iso) - new Date(); return diff > 0 && diff < 10 * 60 * 1000; };

const PRIORITIES = { 
  high: { label: "High",   color: "#ff4d6d", bg: "#ff4d6d22" },
  med:  { label: "Medium", color: "#ffd166", bg: "#ffd16622" },
  low:  { label: "Low",    color: "#06d6a0", bg: "#06d6a022" } 
};
const CATEGORIES  = ["Work 💼", "Personal 🏠", "Health 💪", "Study 📚", "Shopping 🛒", "Other 🗂️"];

// ─── Sound ──────────────────────────────────────────────────────────────────
function playAlarm() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  [0, 0.3, 0.6, 0.9].forEach((t) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.setValueAtTime(880, ctx.currentTime + t);
    g.gain.setValueAtTime(0.4, ctx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
    o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
  });
}

// ─── Components ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 38 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="avatar bg-gradient" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

function Badge({ color, bg, children }) {
  return (
    <span className="badge" style={{ background: bg, color, border: `1px solid ${color}40` }}>
      {children}
    </span>
  );
}

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div className="clock-container">
      <div className="text-gradient" style={{ fontSize: 42, fontWeight: 800, letterSpacing: -2 }}>
        {t.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
      </div>
      <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
        {t.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
      </div>
    </div>
  );
}

function ProgressRing({ done, total }) {
  const pct = total ? Math.round((done/total)*100) : 0;
  const r = 36; const circ = 2 * Math.PI * r;
  return (
    <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
      <svg width={90} height={90} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke="#ffffff15" strokeWidth={7}/>
        <circle cx={45} cy={45} r={r} fill="none" stroke="url(#grad)" strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={circ - (circ * pct)/100}
          strokeLinecap="round" style={{ transition:"stroke-dashoffset .6s ease" }}/>
        <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7b2ff7"/><stop offset="100%" stopColor="#f107a3"/>
        </linearGradient></defs>
      </svg>
      <div style={{ position:"absolute", textAlign:"center" }}>
        <div style={{ fontSize:20, fontWeight:800, color:"#fff" }}>{pct}%</div>
      </div>
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────
function Login({ onLoginSuccess }) {
  const [tab, setTab]   = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [msg, setMsg]     = useState(""); 

  const handle = async () => {
    // 1. Clear previous messages
    setErr("");
    setMsg("");
    
    // 2. Check for empty fields
    if (!email || !pass) return setErr("Please fill all fields");
    if (tab === "register" && !name) return setErr("Please enter your name");
    
    // 3. Name Validation (Only alphabets and spaces allowed)
    if (tab === "register") {
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(name)) {
        return setErr("Name must contain only alphabets.");
      }
    }

    // 4. Email Validation (Must be a valid email format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return setErr("Please enter a valid email address.");
    }

    // 5. Password Validation (6-12 chars, 1 upper, 1 lower, 1 number, 1 special)
    // Note: Applying this strictly to registration so we don't accidentally lock out old users, 
    // but you can move this outside the `if` block to enforce it on login too.
    if (tab === "register") {
      const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{6,12}$/;
      if (!passRegex.test(pass)) {
        return setErr("Password must be 6-12 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.");
      }
    }
    
    try {
      if (tab === "register") {
        // --- REGISTRATION FLOW ---
        const res = await fetch(`${API_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password: pass })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Registration failed");
        
        // On success: Switch to login tab and show a success message
        setTab("login");
        setMsg("Registration successful! Please sign in.");
        setPass(""); // Clear password so they have to type it to log in

      } else {
        // --- LOGIN FLOW ---
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", pass);
        
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          body: formData
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Authentication failed");
        
        // On success: Log the user into the app
        onLoginSuccess(data.user, data.access_token);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:6 }}>⚡</div>
          <div className="text-gradient" style={{ fontSize:26, fontWeight:800 }}>TaskWave</div>
          <div style={{ color:"#666", fontSize:13, marginTop:4 }}>Your smart task manager</div>
        </div>

        <div className="login-tabs">
          {["login","register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(""); setMsg(""); }} 
              className={`btn-hover login-tab-btn ${tab === t ? "active" : ""}`}>
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {tab==="register" && <input className="input-field" placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)}/>}
          <input className="input-field" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input className="input-field" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
          
          {/* Error and Success Messages */}
          {err && <div style={{ color:"#ff4d6d", fontSize:12, textAlign:"center", fontWeight:600 }}>{err}</div>}
          {msg && <div style={{ color:"#06d6a0", fontSize:12, textAlign:"center", fontWeight:600 }}>{msg}</div>}
          
          <button onClick={handle} className="btn-hover bg-gradient primary-btn" style={{ marginTop: 4 }}>
            {tab==="login" ? "Sign In →" : "Create Account →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({ task, onSave, onClose }) {
  const [form, setForm] = useState(task || { title:"", cat: CATEGORIES[0], priority:"med", due:"", note:"", tags:"", done:false });
  const set = (k,v) => setForm(f => ({...f, [k]:v}));

  const handleSave = () => {
    if (!form.title.trim()) return;
    const tags = form.tags && typeof form.tags === 'string' 
      ? form.tags.split(",").map(t=>t.trim()).filter(Boolean) 
      : (form.tags || []);
      
    onSave({ ...form, tags });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontWeight:800, fontSize:18, color:"#fff" }}>{task?"Edit Task":"New Task"}</div>
          <button onClick={onClose} className="btn-hover" style={{ background:"none", border:"none", color:"#666", fontSize:20 }}>✕</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input className="input-field" placeholder="Task title *" value={form.title} onChange={e=>set("title",e.target.value)}/>
          <textarea className="input-field" style={{ minHeight:72, resize:"vertical" }} placeholder="Notes (optional)" value={form.note || ""} onChange={e=>set("note",e.target.value)}/>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <select className="input-field" style={{ appearance: "none" }} value={form.category || form.cat} onChange={e=>set("category",e.target.value)}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input-field" style={{ appearance: "none" }} value={form.priority} onChange={e=>set("priority",e.target.value)}>
              {Object.entries(PRIORITIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ color:"#888", fontSize:12, marginBottom:4, display:"block" }}>Due Date & Time (for alarm)</label>
            <input className="input-field" type="datetime-local" value={form.due || ""} onChange={e=>set("due",e.target.value)}/>
          </div>

          <input className="input-field" placeholder="Tags (comma-separated): react, urgent" value={Array.isArray(form.tags)?form.tags.join(", "):form.tags} onChange={e=>set("tags",e.target.value)}/>

          <label style={{ display:"flex", alignItems:"center", gap:10, color:"#aaa", fontSize:13, cursor:"pointer" }}>
            <input type="checkbox" checked={form.done} onChange={e=>set("done",e.target.checked)} style={{ width:16, height:16, cursor:"pointer" }}/>
            Mark as completed
          </label>

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={onClose} className="btn-hover" style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1px solid #ffffff18", background:"transparent", color:"#888", fontWeight:600 }}>Cancel</button>
            <button onClick={handleSave} className="btn-hover bg-gradient" style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", color:"#fff", fontWeight:700 }}>
              {task?"Save Changes":"Add Task ⚡"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const p = PRIORITIES[task.priority] || PRIORITIES.med;
  const overdue = !task.done && task.due && isPast(task.due);
  const near    = !task.done && task.due && isNear(task.due);

  const cardClasses = `task-card ${task.done ? "done" : ""} ${overdue ? "overdue" : ""} ${near ? "near" : ""}`;

  return (
    <div className={cardClasses}>
      <button onClick={()=>onToggle(task)} className={`btn-hover task-checkbox ${task.done ? "checked" : ""}`}>
        {task.done && <span style={{ color:"#fff", fontSize:12, fontWeight:900 }}>✓</span>}
      </button>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:14, color: task.done?"#666":"#fff", textDecoration: task.done?"line-through":"none", marginBottom:4 }}>{task.title}</div>
        {task.note && <div style={{ color:"#666", fontSize:12, marginBottom:6 }}>{task.note}</div>}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <Badge color={p.color} bg={p.bg}>{p.label}</Badge>
          <span style={{ color:"#555", fontSize:11 }}>{task.category || task.cat}</span>
          {task.due && <span style={{ color: overdue?"#ff4d6d": near?"#ffd166":"#666", fontSize:11, fontWeight:600 }}>
            {overdue?"⚠ ":"near"? "🔔" :"📅 "}{fmtDate(task.due)} {fmtTime(task.due)}
          </span>}
          {task.tags?.map(tag=><span key={tag} className="task-tag">#{tag}</span>)}
        </div>
      </div>

      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
        <button onClick={()=>onEdit(task)} className="btn-hover action-btn edit">✏️</button>
        <button onClick={()=>onDelete(task.id)} className="btn-hover action-btn delete">🗑</button>
      </div>
    </div>
  );
}

// ─── Alarm Banner ─────────────────────────────────────────────────────────────
function AlarmBanner({ task, onDismiss }) {
  return (
    <div className="alarm-banner bg-gradient">
      <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>⏰ Task Alarm!</div>
      <div style={{ fontSize:13, opacity:0.9, marginBottom:12 }}>{task.title}</div>
      <button onClick={onDismiss} className="btn-hover" style={{ background:"#ffffff25", border:"none", color:"#fff", borderRadius:8, padding:"6px 16px", fontWeight:700 }}>Dismiss</button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(localStorage.getItem("token") || null);
  const [tasks, setTasks]     = useState([]);
  const [modal, setModal]     = useState(null);
  const [search, setSearch]   = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy]   = useState("due");
  const [alarm, setAlarm]     = useState(null);
  const [view, setView]       = useState("tasks");
  const alarmFired            = useRef(new Set());

  // Restore user session on mount if token exists
  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject("Invalid token"))
      .then(userData => setUser(userData))
      .catch(() => handleLogout()); // Token expired or invalid
    }
  }, [token]);

  // Fetch tasks when user logs in
  useEffect(() => {
    if (user && token) {
      fetch(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(err => console.error("Failed to fetch tasks", err));
    }
  }, [user, token]);

  // Alarm checker
  useEffect(() => {
    const check = () => {
      tasks.forEach(t => {
        if (!t.done && t.due) {
          const diff = new Date(t.due) - new Date();
          if (diff <= 0 && diff > -60000 && !alarmFired.current.has(t.id)) {
            alarmFired.current.add(t.id);
            setAlarm(t); playAlarm();
          }
        }
      });
    };
    const i = setInterval(check, 5000);
    return () => clearInterval(i);
  }, [tasks]);

  const handleLoginSuccess = (userData, accessToken) => {
    localStorage.setItem("token", accessToken);
    setToken(accessToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setTasks([]);
  };

  // API Actions
  const saveTask = async (taskData) => {
    const isEdit = !!taskData.id;
    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `${API_URL}/tasks/${taskData.id}` : `${API_URL}/tasks`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      const savedTask = await res.json();
      
      if (isEdit) {
        setTasks(ts => ts.map(t => t.id === savedTask.id ? savedTask : t));
      } else {
        setTasks(ts => [savedTask, ...ts]);
      }
      setModal(null);
    } catch (e) {
      console.error("Failed to save task", e);
    }
  };

  const toggleTask = async (task) => {
    try {
      // Optimistic update
      setTasks(ts => ts.map(t => t.id === task.id ? {...t, done: !t.done} : t));
      
      const res = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...task, done: !task.done })
      });
      
      if (!res.ok) throw new Error("Update failed");
    } catch (e) {
      console.error("Failed to toggle task", e);
      // Revert on error
      setTasks(ts => ts.map(t => t.id === task.id ? {...t, done: task.done} : t));
    }
  };

  const deleteTask = async (id) => {
    try {
      await fetch(`${API_URL}/tasks/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setTasks(ts => ts.filter(t => t.id !== id));
    } catch (e) {
      console.error("Failed to delete task", e);
    }
  };

  // Processing data for UI
  const filtered = tasks
    .filter(t => search ? t.title.toLowerCase().includes(search.toLowerCase()) || t.tags?.some(g=>g.includes(search.toLowerCase())) : true)
    .filter(t => filterCat==="All" || (t.category || t.cat) === filterCat)
    .filter(t => {
      if (filterStatus==="Pending") return !t.done;
      if (filterStatus==="Done") return t.done;
      if (filterStatus==="Overdue") return !t.done && t.due && isPast(t.due);
      return true;
    })
    .sort((a,b) => {
      if (sortBy==="due") return new Date(a.due||"9999")-new Date(b.due||"9999");
      if (sortBy==="priority") { const o={high:0,med:1,low:2}; return o[a.priority]-o[b.priority]; }
      return new Date(b.created)-new Date(a.created);
    });

  const done  = tasks.filter(t=>t.done).length;
  const total = tasks.length;
  const overdue = tasks.filter(t=>!t.done&&t.due&&isPast(t.due)).length;

  if (!user) return <Login onLoginSuccess={handleLoginSuccess}/>;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo-container">
          <span style={{ fontSize:22 }}>⚡</span>
          <span className="text-gradient" style={{ fontWeight:800, fontSize:18 }}>TaskWave</span>
        </div>

        <div className="user-profile">
          <Avatar name={user.name} size={36}/>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontWeight:700, fontSize:13, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{user.name}</div>
            <div style={{ color:"#666", fontSize:11, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{user.email}</div>
          </div>
        </div>

        {[["tasks","📋","Tasks"],["analytics","📊","Analytics"]].map(([v,ic,lb])=>(
          <button key={v} onClick={()=>setView(v)} className={`btn-hover nav-btn ${view === v ? "active" : ""}`}>
            <span>{ic}</span>{lb}
          </button>
        ))}

        <div style={{ marginTop:16, padding:"0 4px" }}>
          <div className="category-label">CATEGORIES</div>
          {["All",...CATEGORIES].map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)} className={`btn-hover category-btn ${filterCat === c ? "active" : ""}`}>
              {c==="All"?"🗂 All":c}
            </button>
          ))}
        </div>

        <div style={{ marginTop:"auto" }}>
          <button onClick={handleLogout} className="btn-hover sign-out-btn">
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main-content">
        <Clock/>

        {/* Stats row */}
        <div className="stats-grid">
          {[
            { label:"Total Tasks", val:total, icon:"📋", color:"#7b2ff7", borderColor: "#7b2ff720" },
            { label:"Completed",   val:done,  icon:"✅", color:"#06d6a0", borderColor: "#06d6a020" },
            { label:"Pending",     val:total-done, icon:"⏳", color:"#ffd166", borderColor: "#ffd16620" },
            { label:"Overdue",     val:overdue, icon:"🚨", color:"#ff4d6d", borderColor: "#ff4d6d20" },
          ].map(s=>(
            <div key={s.label} className="stat-card" style={{ border: `1px solid ${s.borderColor}` }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ color:"#666", fontSize:12 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {view === "analytics" ? (
          <div className="analytics-card">
            <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>📊 Analytics Overview</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ marginBottom:8, color:"#888", fontWeight:600 }}>Completion Rate</div>
                <ProgressRing done={done} total={total}/>
              </div>
              <div>
                <div style={{ marginBottom:12, color:"#888", fontWeight:600 }}>By Priority</div>
                {Object.entries(PRIORITIES).map(([k,v])=>{
                  const cnt = tasks.filter(t=>t.priority===k).length;
                  const pct = total ? Math.round(cnt/total*100) : 0;
                  return (
                    <div key={k} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                        <span style={{ color:v.color, fontWeight:700 }}>{v.label}</span>
                        <span style={{ color:"#666" }}>{cnt} tasks</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div style={{ height:"100%", width:`${pct}%`, background:v.color, borderRadius:4, transition:"width .6s" }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop:24 }}>
              <div style={{ marginBottom:12, color:"#888", fontWeight:600 }}>Tasks by Category</div>
              {CATEGORIES.map(c=>{
                const cnt = tasks.filter(t=>(t.category || t.cat)===c).length;
                return cnt>0 && (
                  <div key={c} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <div style={{ width:100, fontSize:12, color:"#aaa" }}>{c}</div>
                    <div className="progress-bar-bg" style={{ flex: 1 }}>
                      <div style={{ height:"100%", width:`${(cnt/total)*100}%`, background:"linear-gradient(90deg,#7b2ff7,#f107a3)", borderRadius:4 }}/>
                    </div>
                    <div style={{ fontSize:12, color:"#666", width:20 }}>{cnt}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="controls-row">
              <input className="input-field" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search tasks or tags..."
                style={{ flex:1, minWidth:200, padding:"10px 14px" }}/>
              <select className="input-field" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                style={{ padding:"10px 14px", width: "auto" }}>
                {["All","Pending","Done","Overdue"].map(s=><option key={s}>{s}</option>)}
              </select>
              <select className="input-field" value={sortBy} onChange={e=>setSortBy(e.target.value)}
                style={{ padding:"10px 14px", width: "auto" }}>
                <option value="due">Sort: Due Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="created">Sort: Newest</option>
              </select>
              <button onClick={()=>setModal("new")} className="btn-hover bg-gradient" style={{ padding:"10px 20px", borderRadius:10, border:"none", color:"#fff", fontWeight:700, fontSize:13, boxShadow:"0 4px 20px #7b2ff750", whiteSpace:"nowrap" }}>
                + New Task
              </button>
            </div>

            <div style={{ color:"#555", fontSize:12, marginBottom:12 }}>
              Showing {filtered.length} of {total} tasks
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 20px", color:"#444" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🎯</div>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>No tasks found</div>
                  <div style={{ fontSize:13 }}>Add a new task to get started!</div>
                </div>
              ) : filtered.map(t=>(
                <TaskCard key={t.id} task={t} onToggle={toggleTask} onEdit={t=>setModal(t)} onDelete={deleteTask}/>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Task Modal */}
      {modal && <TaskModal task={modal==="new"?null:modal} onSave={saveTask} onClose={()=>setModal(null)}/>}

      {/* Alarm */}
      {alarm && <AlarmBanner task={alarm} onDismiss={()=>setAlarm(null)}/>}
    </div>
  );
}
