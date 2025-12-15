// utils/multer.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer storage for temp uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, "..", "uploads", "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

// Multer filter (optional: restrict file types)
const fileFilter = (req, file, cb) => {
  cb(null, true); // accept all files; add checks if needed
};

const upload = multer({ storage, fileFilter });

// For multiple fields
const staffUpload = upload.fields([
  { name: "documents", maxCount: 10 }, // array of documents
  { name: "photo", maxCount: 1 }, // single photo
]);

module.exports = { upload, staffUpload };
