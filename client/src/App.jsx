import { useState, useEffect } from "react";

const COMMON_PROBLEMS = [
  "Water leakage", "No water", "Power cut", "Lift not working",
  "Drainage blocked", "Garbage not cleared", "Streetlight off", "Security issue",
];

export default function App() {
  // staff = { username, password } when logged in, otherwise null
  const [staff, setStaff] = useState(() => JSON.parse(sessionStorage.getItem("staff") || "null"));
  const [showLogin, setShowLogin] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [listError, setListError] = useState("");
  const [trackFlat, setTrackFlat] = useState("");

  async function loadComplaints() {
    try {
      const res = await fetch("/api/complaints");
      setComplaints(await res.json());
      setListError("");
    } catch {
      setListError("Server not reachable. Start the server (node server.js).");
    }
  }

  // Load once, then refresh every 10 seconds so residents see status changes live
  useEffect(() => {
    loadComplaints();
    const timer = setInterval(loadComplaints, 10000);
    return () => clearInterval(timer);
  }, []);

  // Resident tracking: show only the complaints of the flat typed in the box
  const shown = trackFlat.trim()
    ? complaints.filter((c) => c.flat.toLowerCase() === trackFlat.trim().toLowerCase())
    : complaints;

  function logout() {
    setStaff(null);
    sessionStorage.removeItem("staff");
  }

  return (
    <>
      <header>
        <h1>Smart Complaint and Repair Management System for Gated Communities</h1>
        <div id="staffBox">
          {!staff && <button onClick={() => setShowLogin(!showLogin)}>Staff login</button>}
          {staff && <span>Logged in: {staff.username}</span>}
          {staff && <button onClick={logout}>Logout</button>}
        </div>
      </header>

      {showLogin && !staff && (
        <LoginForm
          onLogin={(s) => {
            setStaff(s);
            sessionStorage.setItem("staff", JSON.stringify(s));
            setShowLogin(false);
          }}
        />
      )}

      <main>
        <ReportForm onSent={loadComplaints} />
        <h2>Track your complaint</h2>
        <div className="card">
          <input
            placeholder="Enter your flat no. to see only your complaints"
            value={trackFlat}
            onChange={(e) => setTrackFlat(e.target.value)}
          />
          <p className="label">
            {trackFlat.trim() ? `Showing complaints for flat ${trackFlat.trim()}` : "Showing all complaints. This list refreshes automatically."}
          </p>
        </div>
        {listError && <p className="empty">{listError}</p>}
        {!listError && shown.length === 0 && (
          <p className="empty">{trackFlat.trim() ? "No complaints found for this flat." : "No complaints yet."}</p>
        )}
        {shown.map((c) => (
          <ComplaintCard key={c._id} c={c} staff={staff} onChange={loadComplaints} />
        ))}
      </main>
    </>
  );
}

// ---------- Staff login ----------
function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return setMsg("Wrong username or password");
      onLogin({ username, password });
    } catch {
      setMsg("Server not reachable");
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit">Login</button>
      <p className="msg">{msg}</p>
    </form>
  );
}

// ---------- Resident complaint form ----------
function ReportForm({ onSent }) {
  const [flat, setFlat] = useState("");
  const [floor, setFloor] = useState("");
  const [chosen, setChosen] = useState([]);
  const [other, setOther] = useState("");
  const [msg, setMsg] = useState("");

  function toggle(p) {
    setChosen(chosen.includes(p) ? chosen.filter((x) => x !== p) : [...chosen, p]);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flat, floor, problems: chosen, other }),
      });
      const data = await res.json();
      if (!res.ok) return setMsg(data.error);
      setMsg("");
      setFlat(""); setFloor(""); setChosen([]); setOther("");
      onSent();
    } catch {
      setMsg("Server not reachable. Start the server (node server.js).");
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Report a problem</h2>
      <div className="row">
        <input placeholder="Flat no. (e.g. 204)" value={flat} onChange={(e) => setFlat(e.target.value)} required />
        <input placeholder="Floor (e.g. 2)" value={floor} onChange={(e) => setFloor(e.target.value)} required />
      </div>
      <p className="label">Tap the problems you are facing:</p>
      <div className="chips">
        {COMMON_PROBLEMS.map((p) => (
          <button type="button" key={p} className={"chip" + (chosen.includes(p) ? " on" : "")} onClick={() => toggle(p)}>
            {p}
          </button>
        ))}
      </div>
      <textarea placeholder="Something else? Type it here" value={other} onChange={(e) => setOther(e.target.value)} />
      <button type="submit">Send complaint</button>
      <p className="msg">{msg}</p>
    </form>
  );
}

// ---------- One complaint (staff form shows only when logged in) ----------
function ComplaintCard({ c, staff, onChange }) {
  const [repairName, setRepairName] = useState(c.repairName || "");
  const [repairPhone, setRepairPhone] = useState(c.repairPhone || "");
  const [status, setStatus] = useState(c.status);

  const headers = staff
    ? { "Content-Type": "application/json", "x-user": staff.username, "x-pass": staff.password }
    : {};

  async function save(e) {
    e.preventDefault();
    await fetch("/api/complaints/" + c._id, {
      method: "PUT",
      headers,
      body: JSON.stringify({ repairName, repairPhone, status }),
    });
    onChange();
  }

  async function remove() {
    if (!confirm("Delete this complaint?")) return;
    await fetch("/api/complaints/" + c._id, { method: "DELETE", headers });
    onChange();
  }

  return (
    <div className="item">
      <div className="top">
        <h3>Flat {c.flat}, Floor {c.floor}</h3>
        <span className={"badge " + c.status}>{c.status}</span>
      </div>
      <div className="meta">Reported on {new Date(c.createdAt).toLocaleDateString()}</div>
      <Progress status={c.status} />
      <div className="tags">
        {c.problems.map((p) => <span className="tag" key={p}>{p}</span>)}
      </div>
      {c.other && <p>{c.other}</p>}
      {c.repairName && (
        <div className="repair">
          Repair person: <b>{c.repairName}</b>, Phone: <b>{c.repairPhone}</b>
        </div>
      )}

      {staff && (
        <form className="staff-form" onSubmit={save}>
          <input placeholder="Repair person name" value={repairName} onChange={(e) => setRepairName(e.target.value)} />
          <input placeholder="Phone no." value={repairPhone} onChange={(e) => setRepairPhone(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>open</option>
            <option>in-repair</option>
            <option>fixed</option>
          </select>
          <button type="submit">Save</button>
          <button type="button" className="del" onClick={remove}>Delete</button>
        </form>
      )}
    </div>
  );
}

// ---------- Progress steps: Reported -> In Repair -> Fixed ----------
function Progress({ status }) {
  const steps = ["Reported", "In Repair", "Fixed"];
  const current = status === "fixed" ? 2 : status === "in-repair" ? 1 : 0;
  return (
    <div className="progress">
      {steps.map((s, i) => (
        <div key={s} className={"step" + (i <= current ? " done" : "")}>
          <span className="dot">{i <= current ? "✓" : i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}