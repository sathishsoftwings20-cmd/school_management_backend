const path = require("path");
const fs = require("fs");
const multer = require("multer");

const tmpDir = path.join(__dirname, "..", "uploads", "tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmpDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

function fileFilter(req, file, cb) {
    const allowed = /png|jpe?g|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only image files (png, jpg, jpeg, webp) are allowed"));
}

module.exports = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
