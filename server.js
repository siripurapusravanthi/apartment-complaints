const express = require("express");
const mongoose = require("mongoose");
const path = require("path");


if (!process.env.RENDER) require("dns").setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
app.use(express.json());

// Serves the React app (built into client/dist). Falls back to the old "public" folder.
const fs = require("fs");
const reactBuild = path.join(__dirname, "client", "dist");
app.use(express.static(fs.existsSync(reactBuild) ? reactBuild : path.join(__dirname, "public")));

// ---- Database model ----
const Complaint = mongoose.model(
  "Complaint",
  new mongoose.Schema({
    flat: String,
    floor: String,
    problems: [String],
    other: String,
    status: { type: String, default: "open" },
    repairName: { type: String, default: "" },
    repairPhone: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  })
);

// ---- Staff logins (change these!) ----
const STAFF = [
  { username: "admin", password: "admin123" },
  { username: "maintenance", password: "maint123" },
];

// Only staff can update or delete
function staffOnly(req, res, next) {
  const ok = STAFF.some(
    (u) => u.username === req.headers["x-user"] && u.password === req.headers["x-pass"]
  );
  if (!ok) return res.status(401).json({ error: "Staff login required" });
  next();
}

// ---- Routes ----

// Staff login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const ok = STAFF.some((u) => u.username === username && u.password === password);
  if (!ok) return res.status(401).json({ error: "Wrong username or password" });
  res.json({ ok: true });
});

// Get all complaints (anyone)
app.get("/api/complaints", async (req, res) => {
  const list = await Complaint.find().sort({ createdAt: -1 });
  res.json(list);
});

// Submit a complaint (anyone, no login)
app.post("/api/complaints", async (req, res) => {
  const flat = String(req.body.flat || "").trim().slice(0, 20);
  const floor = String(req.body.floor || "").trim().slice(0, 10);
  const other = String(req.body.other || "").trim().slice(0, 300);
  const problems = Array.isArray(req.body.problems)
    ? req.body.problems.map((p) => String(p).slice(0, 50)).slice(0, 10)
    : [];

  if (!flat || !floor) return res.status(400).json({ error: "Flat number and floor are required" });
  if (problems.length === 0 && !other) return res.status(400).json({ error: "Choose or type a problem" });

  // Duplicate check: same flat already has an unfixed complaint with the same problem
  const duplicate = await Complaint.findOne({
    flat: new RegExp("^" + flat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"),
    status: { $ne: "fixed" },
    $or: [
      ...(problems.length ? [{ problems: { $in: problems } }] : []),
      ...(other ? [{ other: new RegExp("^" + other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") }] : []),
    ],
  });
  if (duplicate) {
    return res.status(409).json({ error: "This problem is already reported for this flat and not fixed yet" });
  }

  const c = await Complaint.create({ flat, floor, problems, other });
  res.json(c);
});

// Update status and repair person (staff only)
app.put("/api/complaints/:id", staffOnly, async (req, res) => {
  const status = ["open", "in-repair", "fixed"].includes(req.body.status) ? req.body.status : "open";
  const c = await Complaint.findByIdAndUpdate(
    req.params.id,
    {
      status,
      repairName: String(req.body.repairName || "").trim().slice(0, 60),
      repairPhone: String(req.body.repairPhone || "").trim().slice(0, 15),
    },
    { new: true }
  );
  res.json(c);
});

// Delete a complaint (staff only)
app.delete("/api/complaints/:id", staffOnly, async (req, res) => {
  await Complaint.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ---- Start server only after MongoDB connects ----
// On Render these come from Environment Variables; locally the defaults are used
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/apartment";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log("Open http://localhost:" + PORT));
  })
  .catch((err) => console.log("MongoDB error (is MongoDB running?):", err.message));