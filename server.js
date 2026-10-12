const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

mongoose
  .connect("mongodb://127.0.0.1:27017/CollegeEventDB")
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.log("MongoDB Error:", err.message));

const registrationSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    registerNo: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: String, required: true },
    eventName: { type: String, required: true },
    eventType: { type: String, required: true },
    idCard: { type: String, required: true },
  },
  { timestamps: true },
);

registrationSchema.index({ registerNo: 1, eventName: 1 }, { unique: true });

const Registration = mongoose.model("Registration", registrationSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeRegNo = (req.body.registerNo || "student").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );
    cb(null, `${safeRegNo}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only JPG, JPEG, PNG and PDF files are allowed"));
  },
});

const events = [
  {
    eventName: "Web Design Contest",
    eventType: "Technical",
    eventDate: "2026-10-15",
    venue: "Seminar Hall",
    maxParticipants: 50,
  },
  {
    eventName: "Quiz Competition",
    eventType: "Technical",
    eventDate: "2026-10-18",
    venue: "Lab 2",
    maxParticipants: 40,
  },
  {
    eventName: "Dance Competition",
    eventType: "Cultural",
    eventDate: "2026-10-20",
    venue: "Auditorium",
    maxParticipants: 60,
  },
];

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

app.get("/api/events", async (req, res) => {
  try {
    const counts = await Registration.aggregate([
      { $group: { _id: "$eventName", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((x) => [x._id, x.count]));
    res.json(
      events.map((e) => ({
        ...e,
        registered: countMap[e.eventName] || 0,
      })),
    );
  } catch {
    res.status(500).json({ message: "Unable to load events" });
  }
});

app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html")),
);

app.post("/register", (req, res, next) => {
  upload.single("idCard")(req, res, async (err) => {
    if (err) return res.status(400).send(err.message);

    try {
      const {
        studentName,
        registerNo,
        email,
        department,
        year,
        eventName,
        eventType,
      } = req.body;
      if (!req.file)
        return res.status(400).send("Please upload your Student ID Card.");

      const event = events.find((e) => e.eventName === eventName);
      if (!event) return res.status(400).send("Invalid event selected.");

      const count = await Registration.countDocuments({ eventName });
      if (count >= event.maxParticipants) {
        fs.unlinkSync(req.file.path);
        return res.status(400).send("This event is full.");
      }

      await Registration.create({
        studentName,
        registerNo,
        email,
        department,
        year,
        eventName,
        eventType,
        idCard: req.file.filename,
      });

      res.send(
        `<h2>Registration successful!</h2><p>Your registration has been saved.</p><a href="/">Back to Events</a>`,
      );
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      if (err.code === 11000)
        return res
          .status(409)
          .send("You have already registered for this event.");
      next(err);
    }
  });
});

app.get("/api/registrations", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const filter = {};
    if (search) filter.registerNo = { $regex: search, $options: "i" };
    if (req.query.event) filter.eventName = req.query.event;
    const rows = await Registration.find(filter).sort({ createdAt: -1 });
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Unable to load registrations" });
  }
});

app.get("/uploads/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  res.sendFile(path.join(__dirname, "uploads", filename));
});

app.delete("/api/registrations/:id", async (req, res) => {
  try {
    const record = await Registration.findByIdAndDelete(req.params.id);
    if (!record)
      return res.status(404).json({ message: "Registration not found" });
    const filePath = path.join(
      __dirname,
      "uploads",
      path.basename(record.idCard),
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ message: "Registration deleted" });
  } catch {
    res.status(400).json({ message: "Unable to delete registration" });
  }
});

app.get("/api/admin-events", (req, res) => res.json(events));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Server error. Check the terminal.");
});

app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`),
);
