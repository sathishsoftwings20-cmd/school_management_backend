// controllers/staff.controller.js
const path = require("path");
const fs = require("fs");
const Staff = require("../models/staff.model");
const User = require("../models/user.model");

/**
 * Helpers
 */
const PROJECT_ROOT = path.join(__dirname, "..");

// Normalize saved DB path to use forward slashes (always store relative paths)
function normalizeRelPath(p) {
  if (!p) return "";
  return String(p).replace(/\\/g, "/").replace(/\/+/g, "/");
}

// Convert stored DB path (relative or absolute) to absolute filesystem path
// Convert stored DB path (relative or absolute) to absolute filesystem path
function toAbsolutePath(storedPath) {
  if (!storedPath) return null;
  const candidate = path.isAbsolute(storedPath)
    ? storedPath
    : path.join(PROJECT_ROOT, storedPath);
  const resolved = path.resolve(candidate);
  const rootResolved = path.resolve(PROJECT_ROOT);
  // ensure the resolved path is inside project root
  if (
    resolved === rootResolved ||
    resolved.startsWith(rootResolved + path.sep)
  ) {
    return resolved;
  }
  // suspicious path; do not return a path we can't trust
  console.warn("toAbsolutePath blocked path traversal attempt:", storedPath);
  return null;
}

// ensure directory exists
async function ensureDir(dir) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

// move file from multer temp path to dest and fazreturn normalized relative path
async function storeFileFromTemp(tempPath, destRelPath) {
  const destAbs = toAbsolutePath(destRelPath);
  if (!destAbs) throw new Error("Invalid destination path");

  // If destAbs resolves to an existing directory -> this is likely a caller bug (missing filename)
  try {
    if (fs.existsSync(destAbs) && fs.statSync(destAbs).isDirectory()) {
      throw new Error(
        `Destination path is a directory (expected file path): ${destAbs}`
      );
    }
  } catch (err) {
    // If statSync throws for permission reasons, bubble a clear error
    if (err && err.code === "EPERM") {
      throw new Error(`Permission error checking destination: ${destAbs}`);
    }
    // rethrow other errors
    if (
      err.message &&
      err.message.startsWith("Destination path is a directory")
    ) {
      throw err;
    }
  }

  await ensureDir(path.dirname(destAbs));
  await fs.promises.rename(tempPath, destAbs);
  return normalizeRelPath(destRelPath);
}

// remove file if exists (accepts stored path or absolute path)
async function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    const abs = toAbsolutePath(filePath);
    if (abs && fs.existsSync(abs)) {
      await fs.promises.unlink(abs);
    }
  } catch (err) {
    console.warn("Failed to remove file:", filePath, err.message);
  }
}

// remove folder recursively if exists
async function removeFolderIfExists(folderPath) {
  if (!folderPath) return;
  try {
    const abs = toAbsolutePath(folderPath);
    if (abs && fs.existsSync(abs)) {
      await fs.promises.rm(abs, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("Failed to remove folder:", folderPath, err.message);
  }
}

/**
 * Utility: safely parse date or return undefined
 */
function parseDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d;
}

/**
 * Utility: parse number (float) or undefined
 */
function parseNumber(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Controllers
 */

// CREATE staff (handles documents & photo from multer temp storage)
exports.createStaff = async (req, res, next) => {
  try {
    // required fields
    const { fullName, staffId, email } = req.body;
    if (!fullName || !staffId || !email) {
      return res
        .status(400)
        .json({ message: "Missing required fields: fullName, staffId, email" });
    }

    // uniqueness checks
    const existingStaffId = await Staff.findOne({ staffId });
    if (existingStaffId)
      return res.status(400).json({ message: "Staff ID already used" });

    const existingEmail = await Staff.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ message: "Email already used" });

    const creatorUserId = req.user
      ? req.user.userCode || req.user.userId || req.user.id
      : null;

    // Build staff payload from req.body (map all supported fields)
    const staffPayload = {
      staffId,
      fullName,
      email,
      role: req.body.role || "Staff",
      designation: req.body.designation || "",
      employmentStatus: req.body.employmentStatus || "",
      experienceYears: parseNumber(req.body.experienceYears) || 0,
      salary: parseNumber(req.body.salary) || 0,
      previousInstitution: req.body.previousInstitution || "",
      dateOfJoining: parseDate(req.body.dateOfJoining),
      dateOfBirth: parseDate(req.body.dateOfBirth),
      gender: req.body.gender || undefined,
      mobile: req.body.mobile || "",
      aadhaarNumber: req.body.aadhaarNumber || "",
      emergencyContact: req.body.emergencyContact || "",
      degree: req.body.degree || "",
      major: req.body.major || "",
      accountName: req.body.accountName || "",
      accountNumber: req.body.accountNumber || "",
      ifsc: req.body.ifsc || "",
      bankName: req.body.bankName || "",
      branch: req.body.branch || "",
      fatherName: req.body.fatherName || "",
      fatherMobile: req.body.fatherMobile || "",
      spouseName:
        req.body.spouseName ||
        req.body.spouseName ||
        req.body.husbandSpouseName ||
        "",
      spouseMobile: req.body.spouseMobile || req.body.husbandSpouseMobile || "",
      street: req.body.street || "",
      city: req.body.city || "",
      state: req.body.state || "",
      pin: req.body.pin || req.body.pinCode || "",
      country: req.body.country || "",
      createdBy: creatorUserId,
      documents: [], // will populate below if files present
      photo: { originalName: "", path: "", uploadedAt: null }, // may be replaced below
    };

    const staff = new Staff(staffPayload);
    const staffKey = staff.staffCode
      ? staff.staffCode.toString()
      : staff._id.toString();
    await staff.save();

    // Process uploaded documents (req.files.documents or req.files array)
    // Support: upload.array('documents') => req.files (array)
    // Support: upload.fields([{ name: 'documents' }, { name: 'photo' }]) => req.files.documents (array), req.files.photo (array)
    // Support single photo via req.file
    // 1) Documents
    let filesArray = null;
    if (req.files && Array.isArray(req.files)) {
      // earlier code: entire req.files is documents array
      filesArray = req.files;
    } else if (
      req.files &&
      req.files.documents &&
      Array.isArray(req.files.documents)
    ) {
      filesArray = req.files.documents;
    }

    if (Array.isArray(filesArray) && filesArray.length > 0) {
      const staffDocsFolderRel = normalizeRelPath(
        path.join(
          "uploads",
          "staff",
          staffKey,
          staff._id.toString(),
          "documents"
        )
      );
      const staffDocsFolderAbs = toAbsolutePath(staffDocsFolderRel);
      await ensureDir(staffDocsFolderAbs);

      const savedDocs = [];
      for (let i = 0; i < filesArray.length; i++) {
        const f = filesArray[i];
        const ext = path.extname(f.originalname) || "";
        const filename = `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${ext}`;
        const destRel = normalizeRelPath(
          path.join(
            "uploads",
            "staff",
            staffKey,
            staff._id.toString(),
            "documents",
            filename
          )
        );

        await storeFileFromTemp(f.path, destRel);

        savedDocs.push({
          originalName: f.originalname,
          path: destRel,
          uploadedAt: new Date(),
        });
      }

      staff.documents = (staff.documents || []).concat(savedDocs);
      await staff.save();
    }

    // 2) Photo handling: support req.file || req.files.photo[0]
    // 2) Photo handling: support req.file || req.files.photo[0]
    const photoFile =
      req.file && req.file.fieldname === "photo"
        ? req.file
        : req.files && req.files.photo && Array.isArray(req.files.photo)
        ? req.files.photo[0]
        : null;

    if (photoFile) {
      const ext = path.extname(photoFile.originalname) || "";
      const filename = `photo-${Date.now()}${ext}`;
      // put photo into the "photo" folder and include filename
      const destRel = normalizeRelPath(
        path.join(
          "uploads",
          "staff",
          staffKey,
          staff._id.toString(),
          "photo",
          filename
        )
      );
      await storeFileFromTemp(photoFile.path, destRel);
      staff.photo = {
        originalName: photoFile.originalname,
        path: destRel,
        uploadedAt: new Date(),
      };
      await staff.save();
    }

    return res.status(201).json({ message: "Staff created", staff });
  } catch (err) {
    // cleanup any temp files left by multer
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        try {
          if (f && f.path && fs.existsSync(f.path)) {
            await fs.promises.unlink(f.path).catch(() => {});
          }
        } catch (e) {}
      }
    }
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        await fs.promises.unlink(req.file.path).catch(() => {});
      } catch (e) {}
    }

    console.error("createStaff error:", err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "Duplicate key error", error: err.keyValue });
    }
    next(err);
  }
};

// UPDATE staff (append new documents; handle removed files; update many fields)
exports.updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params; // mongodb _id
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    // allow only self or admins (adjust as needed)
    if (
      requester._id?.toString &&
      requester._id.toString() !== id &&
      !["Admin", "SuperAdmin"].includes(requester.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    const staffKey = staff.staffCode
      ? staff.staffCode.toString()
      : staff._id.toString();

    // prevent email conflict
    if (req.body.email && req.body.email !== staff.email) {
      const conflict = await Staff.findOne({ email: req.body.email });
      if (conflict)
        return res.status(400).json({ message: "Email already in use" });
    }

    // prevent staffId conflict
    if (req.body.staffId && req.body.staffId !== staff.staffId) {
      const conflict = await Staff.findOne({ staffId: req.body.staffId });
      if (conflict)
        return res.status(400).json({ message: "Staff Id already in use" });
    }

    // Allowed updates (expand to all model fields you added)
    const allowed = [
      "fullName",
      "email",
      "role",
      "staffId",
      "designation",
      "employmentStatus",
      "experienceYears",
      "salary",
      "previousInstitution",
      "dateOfJoining",
      "dateOfBirth",
      "gender",
      "mobile",
      "aadhaarNumber",
      "emergencyContact",
      "degree",
      "major",
      "accountName",
      "accountNumber",
      "ifsc",
      "bankName",
      "branch",
      "fatherName",
      "fatherMobile",
      "spouseName",
      "spouseMobile",
      "street",
      "city",
      "state",
      "pin",
      "country",
    ];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        // parse numeric/date where appropriate
        if (["experienceYears", "salary"].includes(field)) {
          const n = parseNumber(req.body[field]);
          if (n !== undefined) staff[field] = n;
        } else if (["dateOfJoining", "dateOfBirth"].includes(field)) {
          const d = parseDate(req.body[field]);
          if (d !== undefined) staff[field] = d;
        } else {
          staff[field] = req.body[field];
        }
      }
    }

    // set updatedBy as userCode or user id string of requester
    staff.updatedBy =
      requester.userCode || requester.userId || requester.id || null;

    // ----- handle removed remote files (client indicates which server paths to delete) -----
    const removedRaw =
      req.body["removedFiles[]"] ||
      req.body.removedFiles ||
      req.body.removedFilesJson;
    let removedFiles = [];
    if (removedRaw) {
      if (Array.isArray(removedRaw)) removedFiles = removedRaw;
      else {
        try {
          const parsed = JSON.parse(removedRaw);
          if (Array.isArray(parsed)) removedFiles = parsed;
          else removedFiles = [String(removedRaw)];
        } catch {
          if (String(removedRaw).includes(",")) {
            removedFiles = String(removedRaw)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          } else {
            removedFiles = [String(removedRaw)];
          }
        }
      }
    }

    if (removedFiles.length > 0) {
      removedFiles = removedFiles.map((p) => String(p).replace(/\\/g, "/"));
      for (const rem of removedFiles) {
        await removeFileIfExists(rem);
        if (Array.isArray(staff.documents)) {
          staff.documents = staff.documents.filter((doc) => {
            const docPath = typeof doc === "string" ? doc : doc.path;
            return String(docPath).replace(/\\/g, "/") !== rem;
          });
        }
        // if photo path matched, clear photo
        if (
          staff.photo &&
          staff.photo.path &&
          String(staff.photo.path).replace(/\\/g, "/") === rem
        ) {
          staff.photo = { originalName: "", path: "", uploadedAt: null };
        }
      }
    }

    // If new document files are uploaded, append them (do not replace existing by default)
    let docsArray = null;
    if (req.files && Array.isArray(req.files)) {
      // if you used upload.array('documents')
      docsArray = req.files;
    } else if (
      req.files &&
      req.files.documents &&
      Array.isArray(req.files.documents)
    ) {
      docsArray = req.files.documents;
    }

    if (Array.isArray(docsArray) && docsArray.length > 0) {
      const staffDocsFolderRel = normalizeRelPath(
        path.join(
          "uploads",
          "staff",
          staffKey,
          staff._id.toString(),
          "documents"
        )
      );
      const staffDocsFolderAbs = toAbsolutePath(staffDocsFolderRel);
      await ensureDir(staffDocsFolderAbs);

      const savedDocs = [];
      for (let i = 0; i < docsArray.length; i++) {
        const f = docsArray[i];
        const ext = path.extname(f.originalname) || "";
        const filename = `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${ext}`;
        const destRel = normalizeRelPath(
          path.join(
            "uploads",
            "staff",
            staffKey,
            staff._id.toString(),
            "documents",
            filename
          )
        );

        await storeFileFromTemp(f.path, destRel);

        savedDocs.push({
          originalName: f.originalname,
          path: destRel,
          uploadedAt: new Date(),
        });
      }

      staff.documents = (staff.documents || []).concat(savedDocs);
    }

    // Photo: support single photo via upload.fields or req.file
    const photoFile =
      req.file && req.file.fieldname === "photo"
        ? req.file
        : req.files && req.files.photo && Array.isArray(req.files.photo)
        ? req.files.photo[0]
        : null;

    if (photoFile) {
      // remove old photo file if exists
      if (staff.photo && staff.photo.path) {
        await removeFileIfExists(staff.photo.path);
      }

      const ext = path.extname(photoFile.originalname) || "";
      const filename = `photo-${Date.now()}${ext}`;
      const destRel = normalizeRelPath(
        path.join(
          "uploads",
          "staff",
          staffKey,
          staff._id.toString(),
          "photo",
          filename
        )
      );
      await storeFileFromTemp(photoFile.path, destRel);
      staff.photo = {
        originalName: photoFile.originalname,
        path: destRel,
        uploadedAt: new Date(),
      };
    }

    await staff.save();
    return res.json({ message: "Staff updated", staff });
  } catch (err) {
    // cleanup temp files left by multer
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        try {
          if (f && f.path && fs.existsSync(f.path)) {
            await fs.promises.unlink(f.path).catch(() => {});
          }
        } catch (e) {}
      }
    }
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        await fs.promises.unlink(req.file.path).catch(() => {});
      } catch (e) {}
    }

    console.error("updateStaff error:", err);
    if (err.code === 11000)
      return res
        .status(400)
        .json({ message: "Duplicate key", error: err.keyValue });
    next(err);
  }
};

// GET staff by _id
exports.getStaffById = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id).lean();
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const createdByUser = staff.createdBy
      ? await User.findOne({ userCode: staff.createdBy }).select(
          "userCode fullName"
        )
      : null;
    const updatedByUser = staff.updatedBy
      ? await User.findOne({ userCode: staff.updatedBy }).select(
          "userCode fullName"
        )
      : null;

    return res.json({
      ...staff,
      createdByInfo: createdByUser || null,
      updatedByInfo: updatedByUser || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET all staff
exports.getAllStaff = async (req, res, next) => {
  try {
    const staffList = await Staff.find().lean();

    const userIds = new Set();
    staffList.forEach((s) => {
      if (s.createdBy) userIds.add(s.createdBy);
      if (s.updatedBy) userIds.add(s.updatedBy);
    });

    const lookup = userIds.size
      ? await User.find({ userCode: { $in: Array.from(userIds) } })
          .select("userCode fullName")
          .lean()
      : [];
    const map = Object.fromEntries(lookup.map((x) => [x.userCode, x]));

    const out = staffList.map((s) => ({
      ...s,
      createdByInfo: s.createdBy ? map[s.createdBy] || null : null,
      updatedByInfo: s.updatedBy ? map[s.updatedBy] || null : null,
    }));

    return res.json(out);
  } catch (err) {
    next(err);
  }
};

// Delete staff (similar to your user delete)
exports.deleteStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    if (requester.id === id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }

    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    const staffKey = staff.staffCode
      ? staff.staffCode.toString()
      : staff._id.toString();

    if (staff.role === "SuperAdmin" && requester.role !== "SuperAdmin") {
      return res
        .status(403)
        .json({ message: "Only SuperAdmin can delete another SuperAdmin" });
    }

    const deleted = await Staff.findByIdAndDelete(id);
    if (!deleted)
      return res.status(500).json({ message: "Failed to delete staff" });

    // remove files and folder
    if (staff.documents && staff.documents.length) {
      for (const doc of staff.documents) {
        const docPath = typeof doc === "string" ? doc : doc.path;
        await removeFileIfExists(docPath);
      }
    }

    // remove photo if exists
    if (staff.photo && staff.photo.path) {
      await removeFileIfExists(staff.photo.path);
    }

    const staffFolderRel = normalizeRelPath(
      path.join("uploads", "staff", staffKey, staff._id.toString())
    );
    await removeFolderIfExists(staffFolderRel);

    return res.json({
      message: "Staff deleted along with documents and folder",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};
