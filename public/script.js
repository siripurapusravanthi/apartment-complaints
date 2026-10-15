const COMMON_PROBLEMS = [
  "Water leakage", "No water", "Power cut", "Lift not working",
  "Drainage blocked", "Garbage not cleared", "Streetlight off", "Security issue",
];

const $ = (id) => document.getElementById(id);

// Makes text safe to show in HTML
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

// Remember staff login for this browser tab
let staff = JSON.parse(sessionStorage.getItem("staff") || "null");

function authHeaders() {
  return { "Content-Type": "application/json", "x-user": staff.username, "x-pass": staff.password };
}

function updateStaffUI() {
  $("loginToggle").classList.toggle("hidden", !!staff);
  $("logoutBtn").classList.toggle("hidden", !staff);
  $("staffName").classList.toggle("hidden", !staff);
  $("staffName").textContent = staff ? "Logged in: " + staff.username : "";
  loadComplaints();
}

// ---- Staff login / logout ----
$("loginToggle").onclick = () => $("loginForm").classList.toggle("hidden");

$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const username = $("username").value.trim();
  const password = $("password").value;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) { $("loginMsg").textContent = "Wrong username or password"; return; }
    staff = { username, password };
    sessionStorage.setItem("staff", JSON.stringify(staff));
    $("loginMsg").textContent = "";
    e.target.reset();
    $("loginForm").classList.add("hidden");
    updateStaffUI();
  } catch (err) {
    $("loginMsg").textContent = "Server not reachable. Open http://localhost:3000";
  }
};

$("logoutBtn").onclick = () => {
  staff = null;
  sessionStorage.removeItem("staff");
  updateStaffUI();
};

// ---- Problem chips ----
const chosen = new Set();
$("chips").innerHTML = COMMON_PROBLEMS
  .map((p) => `<button type="button" class="chip" data-p="${esc(p)}">${esc(p)}</button>`)
  .join("");

$("chips").onclick = (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const p = btn.dataset.p;
  chosen.has(p) ? chosen.delete(p) : chosen.add(p);
  btn.classList.toggle("on");
};

// ---- Submit complaint ----
$("reportForm").onsubmit = async (e) => {
  e.preventDefault();
  const body = {
    flat: $("flat").value,
    floor: $("floor").value,
    problems: [...chosen],
    other: $("other").value,
  };
  try {
    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { $("reportMsg").textContent = data.error; return; }
    $("reportMsg").textContent = "";
    chosen.clear();
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
    e.target.reset();
    loadComplaints();
  } catch (err) {
    $("reportMsg").textContent = "Server not reachable. Open http://localhost:3000";
  }
};

// ---- Show all complaints ----
async function loadComplaints() {
  try {
    const res = await fetch("/api/complaints");
    const list = await res.json();
    $("list").innerHTML = list.length
      ? list.map(card).join("")
      : `<p class="empty">No complaints yet.</p>`;
  } catch (err) {
    $("list").innerHTML = `<p class="empty">Server not reachable. Open http://localhost:3000</p>`;
  }
}

function card(c) {
  const tags = c.problems.map((p) => `<span class="tag">${esc(p)}</span>`).join("");
  const other = c.other ? `<p>${esc(c.other)}</p>` : "";
  const repair = c.repairName
    ? `<div class="repair">Repair person: <b>${esc(c.repairName)}</b>, Phone: <b>${esc(c.repairPhone)}</b></div>`
    : "";

  // This form shows only when staff is logged in
  const staffForm = staff
    ? `<form class="staff-form" onsubmit="saveRepair(event,'${c._id}')">
         <input name="repairName" placeholder="Repair person name" value="${esc(c.repairName)}">
         <input name="repairPhone" placeholder="Phone no." value="${esc(c.repairPhone)}">
         <select name="status">
           ${["open", "in-repair", "fixed"].map((s) => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}
         </select>
         <button type="submit">Save</button>
         <button type="button" class="del" onclick="removeComplaint('${c._id}')">Delete</button>
       </form>`
    : "";

  return `<div class="item">
    <div class="top">
      <h3>Flat ${esc(c.flat)}, Floor ${esc(c.floor)}</h3>
      <span class="badge ${c.status}">${c.status}</span>
    </div>
    <div class="meta">${new Date(c.createdAt).toLocaleDateString()}</div>
    <div class="tags">${tags}</div>${other}${repair}${staffForm}
  </div>`;
}

// ---- Staff actions ----
window.saveRepair = async (e, id) => {
  e.preventDefault();
  const f = e.target;
  await fetch("/api/complaints/" + id, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      repairName: f.repairName.value,
      repairPhone: f.repairPhone.value,
      status: f.status.value,
    }),
  });
  loadComplaints();
};

window.removeComplaint = async (id) => {
  if (!confirm("Delete this complaint?")) return;
  await fetch("/api/complaints/" + id, { method: "DELETE", headers: authHeaders() });
  loadComplaints();
};

updateStaffUI();