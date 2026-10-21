import { useState, useEffect } from "react";
import { LANGUAGES, translations } from "./i18n.js";

// English names are what we save in the database. They are translated only for display.
const COMMON_PROBLEMS = [
  "Water leakage", "No water", "Power cut", "Lift not working",
  "Drainage blocked", "Garbage not cleared", "Streetlight off", "Security issue",
];

export default function App() {
  // Chosen language is remembered in this browser
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("lang");
      return translations[saved] ? saved : "en";
    } catch {
      return "en";
    }
  });
  const t = translations[lang];
  const locale = LANGUAGES.find((l) => l.code === lang).locale;

  function changeLang(code) {
    setLang(code);
    try { localStorage.setItem("lang", code); } catch { /* ignore */ }
  }

  // staff = { username, password } when logged in, otherwise null
  const [staff, setStaff] = useState(() => JSON.parse(sessionStorage.getItem("staff") || "null"));
  const [showLogin, setShowLogin] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [listError, setListError] = useState(false);
  const [trackFlat, setTrackFlat] = useState("");

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.appTitle;
  }, [lang, t.appTitle]);

  async function loadComplaints() {
    try {
      const res = await fetch("/api/complaints");
      setComplaints(await res.json());
      setListError(false);
    } catch {
      setListError(true);
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
        <h1>{t.appTitle}</h1>
        <div id="staffBox">
          <select
            className="lang-select"
            aria-label={t.language}
            value={lang}
            onChange={(e) => changeLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {!staff && <button onClick={() => setShowLogin(!showLogin)}>{t.staffLogin}</button>}
          {staff && <span>{t.loggedIn} {staff.username}</span>}
          {staff && <button onClick={logout}>{t.logout}</button>}
        </div>
      </header>

      {showLogin && !staff && (
        <LoginForm
          t={t}
          onLogin={(s) => {
            setStaff(s);
            sessionStorage.setItem("staff", JSON.stringify(s));
            setShowLogin(false);
          }}
        />
      )}

      <main>
        <ReportForm t={t} onSent={loadComplaints} />
        <h2>{t.trackTitle}</h2>
        <div className="card">
          <input
            placeholder={t.trackPh}
            value={trackFlat}
            onChange={(e) => setTrackFlat(e.target.value)}
          />
          <p className="label">
            {trackFlat.trim()
              ? t.showingFlat.replace("{flat}", trackFlat.trim())
              : t.showingAll}
          </p>
        </div>
        {listError && <p className="empty">{t.serverDown}</p>}
        {!listError && shown.length === 0 && (
          <p className="empty">{trackFlat.trim() ? t.noneForFlat : t.noneYet}</p>
        )}
        {shown.map((c) => (
          <ComplaintCard key={c._id} c={c} t={t} locale={locale} staff={staff} onChange={loadComplaints} />
        ))}
      </main>
    </>
  );
}

// ---------- Staff login ----------
function LoginForm({ t, onLogin }) {
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
      if (!res.ok) return setMsg(t.wrongLogin);
      onLogin({ username, password });
    } catch {
      setMsg(t.serverDown);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <input placeholder={t.username} value={username} onChange={(e) => setUsername(e.target.value)} required />
      <input type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit">{t.login}</button>
      <p className="msg">{msg}</p>
    </form>
  );
}

// ---------- Resident complaint form ----------
function ReportForm({ t, onSent }) {
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
      // The server sends English error text; show the translated version if we have one
      if (!res.ok) return setMsg(t.errors[data.error] || data.error);
      setMsg("");
      setFlat(""); setFloor(""); setChosen([]); setOther("");
      onSent();
    } catch {
      setMsg(t.serverDown);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{t.reportTitle}</h2>
      <div className="row">
        <input placeholder={t.flatPh} value={flat} onChange={(e) => setFlat(e.target.value)} required />
        <input placeholder={t.floorPh} value={floor} onChange={(e) => setFloor(e.target.value)} required />
      </div>
      <p className="label">{t.tapProblems}</p>
      <div className="chips">
        {COMMON_PROBLEMS.map((p) => (
          <button type="button" key={p} className={"chip" + (chosen.includes(p) ? " on" : "")} onClick={() => toggle(p)}>
            {t.problems[p]}
          </button>
        ))}
      </div>
      <textarea placeholder={t.otherPh} value={other} onChange={(e) => setOther(e.target.value)} />
      <button type="submit">{t.send}</button>
      <p className="msg">{msg}</p>
    </form>
  );
}

// ---------- One complaint (staff form shows only when logged in) ----------
function ComplaintCard({ c, t, locale, staff, onChange }) {
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
    if (!confirm(t.confirmDelete)) return;
    await fetch("/api/complaints/" + c._id, { method: "DELETE", headers });
    onChange();
  }

  return (
    <div className="item">
      <div className="top">
        <h3>{t.flat} {c.flat}, {t.floor} {c.floor}</h3>
        <span className={"badge " + c.status}>{t.status[c.status] || c.status}</span>
      </div>
      <div className="meta">{t.reportedOn} {new Date(c.createdAt).toLocaleDateString(locale)}</div>
      <Progress t={t} status={c.status} />
      <div className="tags">
        {c.problems.map((p) => <span className="tag" key={p}>{t.problems[p] || p}</span>)}
      </div>
      {c.other && <p>{c.other}</p>}
      {c.repairName && (
        <div className="repair">
          {t.repairPerson}: <b>{c.repairName}</b>, {t.phone}: <b>{c.repairPhone}</b>
        </div>
      )}

      {staff && (
        <form className="staff-form" onSubmit={save}>
          <input placeholder={t.repairNamePh} value={repairName} onChange={(e) => setRepairName(e.target.value)} />
          <input placeholder={t.phonePh} value={repairPhone} onChange={(e) => setRepairPhone(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">{t.status.open}</option>
            <option value="in-repair">{t.status["in-repair"]}</option>
            <option value="fixed">{t.status.fixed}</option>
          </select>
          <button type="submit">{t.save}</button>
          <button type="button" className="del" onClick={remove}>{t.del}</button>
        </form>
      )}
    </div>
  );
}

// ---------- Progress steps: Reported -> In Repair -> Fixed ----------
function Progress({ t, status }) {
  const steps = [t.steps.reported, t.steps.inRepair, t.steps.fixed];
  const current = status === "fixed" ? 2 : status === "in-repair" ? 1 : 0;
  return (
    <div className="progress">
      {steps.map((s, i) => (
        <div key={i} className={"step" + (i <= current ? " done" : "")}>
          <span className="dot">{i <= current ? "✓" : i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}