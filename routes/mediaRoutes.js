import express from "express";
import multer from "multer";
import path from "path";
import db from "../db/connection.js";

const router = express.Router();

// ✅ Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.mimetype.startsWith("video") ? "uploads/videos" : "uploads/photos";
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ✅ Upload single file
router.post("/upload", upload.single("file"), (req, res) => {
  const { title, category } = req.body;
  const filePath = `/uploads/${req.file.mimetype.startsWith("video") ? "videos" : "photos"}/${req.file.filename}`;
  const type = req.file.mimetype.startsWith("video") ? "video" : "photo";

  const sql = "INSERT INTO media (title, category, type, filePath) VALUES (?, ?, ?, ?)";
  db.query(sql, [title, category, type, filePath], (err, result) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ success: false });
    }
    res.json({ success: true, filePath });
  });
});

// ✅ Fetch all media
router.get("/", (req, res) => {
  db.query("SELECT * FROM media ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false });
    res.json(rows);
  });
});

export default router;
