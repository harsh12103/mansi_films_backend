// import cors from "cors";
// import dotenv from "dotenv";
// import express from "express";
// import db from "./db/connection.js"; // ✅ fixed

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// // ✅ Routes
// app.get("/", (req, res) => {
//   res.send("Mansi Films Backend Running ✅");
// });

// app.post("/api/bookings", (req, res) => {
//   const { name, phone, date, time, venue, packageName, message } = req.body;

//   const sql =
//     "INSERT INTO bookings (name, phone, date, time, venue, packageName, message) VALUES (?, ?, ?, ?, ?, ?, ?)";
//   db.query(sql, [name, phone, date, time, venue, packageName, message], (err) => {
//     if (err) {
//       console.error("❌ Error inserting booking:", err);
//       return res.status(500).json({ success: false, message: "Database error" });
//     }
//     res.json({ success: true, message: "Booking saved successfully!" });
//   });
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import multer from "multer";
import mysql from "mysql2";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "admin",
  database: "mansi_films",
});

db.connect((err) => {
  if (err) console.error("❌ MySQL Error:", err);
  else console.log("✅ MySQL connected");
});

// ✅ Multer setup with dynamic album folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderName = req.body.folderName?.trim() || "default";
    const baseDir = path.join(process.cwd(), "uploads", "albums", folderName);

    // Ensure folder exists
    fs.mkdirSync(baseDir, { recursive: true });

    cb(null, baseDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.post("/api/media/upload", upload.array("files", 1000), (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ success: false, message: "Unauthorized" });
  console.log("📂 Folder received:", req.body.folderName);
console.log("📁 Files uploaded:", req.files?.length || 0);


  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err)
      return res.status(403).json({ success: false, message: "Invalid token" });

    const { title, category, folderName } = req.body;
    const files = req.files;

    if (!files || files.length === 0)
      return res.status(400).json({ success: false, message: "No files uploaded" });

    const values = files.map((file) => {
      const type = file.mimetype.startsWith("video") ? "video" : "photo";
      const relativePath = `/uploads/albums/${folderName}/${file.filename}`;
    

      return [title, category, type, relativePath, folderName];
    });
 
    const sql = `INSERT INTO media (title, category, type, filePath, folder) VALUES ?`;
    db.query(sql, [values], (err) => {
      if (err) {
        console.error("❌ DB error:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }
      res.json({ success: true, message: `${files.length} files uploaded successfully` });
    });
  });
});

// ✅ Admin Login Route
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;

  console.log("🔍 Login attempt:", username, password);
  console.log("🧠 Expected:", process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// ✅ Fetch all media
app.get("/api/media", (req, res) => {
  db.query("SELECT * FROM media ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false });
    res.json(rows);
  });
});




// ✅ DELETE media (requires admin token)
app.delete("/api/media/:id", (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ success: false, message: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err)
      return res.status(403).json({ success: false, message: "Invalid token" });

    // Find file path in DB
    const findSql = "SELECT filePath FROM media WHERE id = ?";
    db.query(findSql, [id], (err, results) => {
      if (err || results.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "Media not found" });

      const filePath = results[0].filePath;
      const absolutePath = path.join(process.cwd(), filePath.replace("/uploads", "uploads"));

      // Delete the file from filesystem
      fs.unlink(absolutePath, (fsErr) => {
        if (fsErr)
          console.warn("⚠️ File missing on disk, skipping:", fsErr.message);

        // Delete from DB
        const deleteSql = "DELETE FROM media WHERE id = ?";
        db.query(deleteSql, [id], (delErr) => {
          if (delErr)
            return res
              .status(500)
              .json({ success: false, message: "Database error" });

          res.json({ success: true, message: "Media deleted successfully" });
        });
      });
    });
  });
});






app.get("/", (req, res) => {
  res.send("Mansi Films Backend Running ✅");
});

app.post("/api/bookings", (req, res) => {
  const { name, phone, date, time, venue, packageName, message } = req.body;

  const sql =
    "INSERT INTO bookings (name, phone, date, time, venue, packageName, message) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(sql, [name, phone, date, time, venue, packageName, message], (err) => {
    if (err) {
      console.error("❌ Error inserting booking:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json({ success: true, message: "Booking saved successfully!" });
  });
});






const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
























// import cors from "cors";
// import dotenv from "dotenv";
// import express from "express";
// import fs from "fs";
// import jwt from "jsonwebtoken";
// import multer from "multer";
// import mysql from "mysql2";
// import path from "path";

// dotenv.config();
// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// // 🗂️ Ensure upload folders exist
// ["uploads/photos", "uploads/videos"].forEach((dir) => {
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
// });

// // ✅ MySQL connection
// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
// });
// db.connect((err) => {
//   if (err) console.error("❌ MySQL Error:", err);
//   else console.log("✅ MySQL connected");
// });

// // ✅ Multer setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const folder = file.mimetype.startsWith("video")
//       ? "uploads/videos"
//       : "uploads/photos";
//     cb(null, folder);
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname));
//   },
// });
// const upload = multer({ storage });

// // ✅ Admin login
// app.post("/api/admin/login", (req, res) => {
//   const { username, password } = req.body;
//   if (
//     username === process.env.ADMIN_USERNAME &&
//     password === process.env.ADMIN_PASSWORD
//   ) {
//     const token = jwt.sign({ username }, process.env.JWT_SECRET, {
//       expiresIn: "2h",
//     });
//     res.json({ success: true, token });
//   } else {
//     res.status(401).json({ success: false, message: "Invalid credentials" });
//   }
// });

// // ✅ Upload API (protected)
// app.post("/api/media/upload", upload.single("file"), (req, res) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader)
//     return res.status(401).json({ success: false, message: "Unauthorized" });

//   const token = authHeader.split(" ")[1];
//   jwt.verify(token, process.env.JWT_SECRET, (err) => {
//     if (err)
//       return res.status(403).json({ success: false, message: "Invalid token" });

//     const { title, category } = req.body;
//     const filePath = `/uploads/${
//       req.file.mimetype.startsWith("video") ? "videos" : "photos"
//     }/${req.file.filename}`;
//     const type = req.file.mimetype.startsWith("video") ? "video" : "photo";

//     const sql =
//       "INSERT INTO media (title, category, type, filePath) VALUES (?, ?, ?, ?)";
//     db.query(sql, [title, category, type, filePath], (err, result) => {
//       if (err) return res.status(500).json({ success: false, message: "DB error" });
//       res.json({ success: true, filePath });
//     });
//   });
// });

// // ✅ Get all media
// app.get("/api/media", (req, res) => {
//   db.query("SELECT * FROM media ORDER BY created_at DESC", (err, rows) => {
//     if (err) return res.status(500).json({ success: false });
//     res.json(rows);
//   });
// });

// // 🚀 Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
