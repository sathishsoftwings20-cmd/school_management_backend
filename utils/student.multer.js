// utils/multer.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Temp folder for uploads (you later move files from here to their final place)
const TEMP_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "temp");

// ensure temp dir exists
fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

// Multer storage for temp uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

// Helper: allowed mime types
const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const DOC_MIMES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
  // allow images in documents too
  ...IMAGE_MIMES,
];

// Multer file filter: validate by fieldname
const fileFilter = (req, file, cb) => {
  const field = file.fieldname;

  // Photo fields must be images
  if (
    field === "studentPhoto" ||
    field === "fatherPhoto" ||
    field === "motherPhoto" ||
    field === "photo"
  ) {
    if (IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Invalid file type for ${field}. Only images are allowed.`
      ),
      false
    );
  }

  // Documents: allow PDF/DOC/DOCX/TXT and images
  if (field === "documents" || field === "document") {
    if (DOC_MIMES.includes(file.mimetype)) return cb(null, true);
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Invalid file type for ${field}. Allowed: pdf, doc, docx, txt, images.`
      ),
      false
    );
  }

  // Default: accept (use carefully)
  cb(null, true);
};

// Global upload limits
const limits = {
  fileSize: 5 * 1024 * 1024, // 5 MB per file (adjust as needed)
  files: 20, // total files allowed in one request (adjust)
};

// export basic upload (in case you need raw access)
const upload = multer({ storage, fileFilter, limits });

// Student-specific middleware (fields)
const studentUpload = upload.fields([
  { name: "documents", maxCount: 10 },
  { name: "studentPhoto", maxCount: 1 },
  { name: "fatherPhoto", maxCount: 1 },
  { name: "motherPhoto", maxCount: 1 },
]);

// For backward compatibility: accept older 'photo' name as studentPhoto
const studentUploadWithPhotoFallback = (req, res, next) => {
  // call the multer middleware
  studentUpload(req, res, (err) => {
    if (err) return next(err);

    // If client sent req.file (single file, e.g., upload.single('photo')) multer won't have populated req.files
    // but in our usage we call upload.fields so req.files will be present. However for safety:
    if (
      req.file &&
      req.file.fieldname === "photo" &&
      !req.files?.studentPhoto
    ) {
      req.files = req.files || {};
      req.files.studentPhoto = [req.file];
    }
    next();
  });
};

module.exports = {
  upload,
  studentUpload,
  studentUploadWithPhotoFallback,
};
