const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Temporary storage before user is created
const tempStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = "uploads/temp/";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique name
  },
});

const upload = multer({ storage: tempStorage });

module.exports = upload;
