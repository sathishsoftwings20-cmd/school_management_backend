// controllers/student.controller.js
const path = require("path");
const fs = require("fs");
const Student = require("../models/student.model");
const User = require("../models/user.model");
const Class = require("../models/class.model");
const StudentAuth = require("../models/studentAuth.model");

/**
 * Helpers (assume your existing helpers remain unchanged)
 */
const PROJECT_ROOT = path.join(__dirname, "..");

function normalizeRelPath(p) {
  if (!p) return "";
  return String(p).replace(/\\/g, "/").replace(/\/+/g, "/");
}

function toAbsolutePath(storedPath) {
  if (!storedPath) return null;
  const candidate = path.isAbsolute(storedPath)
    ? storedPath
    : path.join(PROJECT_ROOT, storedPath);
  const resolved = path.resolve(candidate);
  const rootResolved = path.resolve(PROJECT_ROOT);
  if (
    resolved === rootResolved ||
    resolved.startsWith(rootResolved + path.sep)
  ) {
    return resolved;
  }
  console.warn("toAbsolutePath blocked path traversal attempt:", storedPath);
  return null;
}

async function ensureDir(dir) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

// storeFileFromTemp expects full destRelPath including filename
async function storeFileFromTemp(tempPath, destRelPath) {
  const destAbs = toAbsolutePath(destRelPath);
  if (!destAbs) throw new Error("Invalid destination path");

  try {
    if (fs.existsSync(destAbs) && fs.statSync(destAbs).isDirectory()) {
      throw new Error(
        `Destination path is a directory (expected file path): ${destAbs}`
      );
    }
  } catch (err) {
    if (err && err.code === "EPERM") {
      throw new Error(`Permission error checking destination: ${destAbs}`);
    }
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

function parseDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d;
}

function parseNumber(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Controllers
 */

// CREATE student
exports.createStudent = async (req, res, next) => {
  try {
    // Check if body is empty
    if (Object.keys(req.body).length === 0) {
      console.log("WARNING: Request body is empty!");
    }

    // required fields
    const { fullName, admissionNo, email } = req.body;
    console.log("Extracted fields:", { fullName, admissionNo, email });

    if (!fullName || !admissionNo || !email) {
      return res.status(400).json({
        message: "Missing required fields: fullName, admissionNo, email",
      });
    }
    // uniqueness checks - match model field names (AdmissionNo)
    const existingAdmissionNo = await Student.findOne({
      admissionNo: admissionNo,
    });
    if (existingAdmissionNo)
      return res.status(400).json({ message: "Admission Number already used" });

    const existingEmail = await Student.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ message: "Email already used" });

    const creatorUserId = req.user
      ? req.user.userCode || req.user.userId || req.user.id
      : null;

    // Build payload
    const studentPayload = {
      studentCode: req.body.studentCode || undefined,
      admissionNo: admissionNo,
      rollNumber: req.body.rollNumber || req.body.rollNo || undefined,
      fullName: fullName,
      enrolementStatus:
        req.body.enrolementStatus || req.body.enrollmentStatus || "",
      dateOfBirth: parseDate(req.body.dateOfBirth) || null,
      gender: req.body.gender || undefined,
      email: email,
      mobile: req.body.mobile || "",
      aadhaarNumber: req.body.aadhaarNumber || req.body.aadhaar || "",
      birthPlace: req.body.birthPlace || "",
      nationality: req.body.nationality || "",
      bloodGroup: req.body.bloodGroup || "",
      caste: req.body.caste || "",
      subCaste: req.body.subCaste || "",
      disability_Allergy:
        req.body.disability_Allergy || req.body.allergies || "",
      fatherName: req.body.fatherName || "",
      fatherMobile: req.body.fatherMobile || "",
      fatherOccupation: req.body.fatherOccupation || "",
      fatherWorkspace: req.body.fatherWorkspace || "",
      fatherAnnualIncome:
        parseNumber(req.body.fatherAnnualIncome) || req.body.fatherIncome || "",
      motherName: req.body.motherName || "",
      motherMobile: req.body.motherMobile || "",
      motherOccupation: req.body.motherOccupation || "",
      motherWorkspace: req.body.motherWorkspace || "",
      motherAnnualIncome:
        parseNumber(req.body.motherAnnualIncome) || req.body.motherIncome || "",
      guardianName: req.body.guardianName || "",
      guardianMobile: req.body.guardianMobile || "",
      alternateMobile: req.body.alternateMobile || "",
      homeMobile: req.body.homeMobile || "",
      role: "Student",
      currentStreet: req.body.currentStreet || req.body.street || "",
      currentCity: req.body.currentCity || req.body.city || "",
      currentState: req.body.currentState || req.body.state || "",
      currentPin: req.body.currentPin || req.body.pin || req.body.pinCode || "",
      currentCountry: req.body.currentCountry || req.body.country || "",
      permanentStreet: req.body.permanentStreet || req.body.permStreet || "",
      permanentCity: req.body.permanentCity || req.body.permCity || "",
      permanentState: req.body.permanentState || req.body.permState || "",
      permanentPin: req.body.permanentPin || req.body.permPin || "",
      permanentCountry: req.body.permanentCountry || req.body.permCountry || "",
      class: req.body.classId || req.body.class || null,
      className: req.body.className || req.body.classTitle || "",
      section: req.body.sectionId || req.body.section || null,
      sectionName: req.body.sectionName || req.body.sectionTitle || "",
      documents: [],
      studentPhoto: { originalName: "", path: "", uploadedAt: null },
      fatherPhoto: { originalName: "", path: "", uploadedAt: null },
      motherPhoto: { originalName: "", path: "", uploadedAt: null },
      createdBy: creatorUserId || req.user?.id || null,
      updatedBy: creatorUserId || req.user?.id || null,
    };

    const student = new Student(studentPayload);
    // Save once to get _id and allow pre-save hooks (like studentCode generation)
    await student.save();
    // ---------- CREATE STUDENT AUTH ----------
    if (req.body.password) {
      const username =
        req.body.username?.trim().toLowerCase() || admissionNo.toLowerCase(); // default username

      const auth = await StudentAuth.create({
        username,
        admissionNo,
        password: req.body.password,
        studentId: student._id,
      });

      student.studentAuthId = auth._id;
      await student.save();
    }

    const studentKey = student.studentCode
      ? student.studentCode.toString()
      : student._id.toString();

    // ---------- Documents upload ----------
    let filesArray = null;
    if (req.files && Array.isArray(req.files)) {
      filesArray = req.files; // upload.array('documents')
    } else if (
      req.files &&
      req.files.documents &&
      Array.isArray(req.files.documents)
    ) {
      filesArray = req.files.documents; // upload.fields(...)
    }

    if (Array.isArray(filesArray) && filesArray.length > 0) {
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
            "students",
            studentKey,
            student._id.toString(),
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

      student.documents = (student.documents || []).concat(savedDocs);
      await student.save();
    }

    // ---------- Student photo ----------
    // ---------- Photos (create) ----------
    // Support: upload.fields([{ name: 'studentPhoto' }, { name: 'fatherPhoto' }, { name: 'motherPhoto' }])
    // Support fallback: req.file with fieldname 'photo' -> treated as studentPhoto
    const photoFields = ["studentPhoto", "fatherPhoto", "motherPhoto", "photo"];
    for (const field of photoFields) {
      // find file: req.files[field] (array) or req.file when fieldname matches
      let file =
        req.files && req.files[field] && Array.isArray(req.files[field])
          ? req.files[field][0]
          : req.file && req.file.fieldname === field
          ? req.file
          : null;

      // fallback: if client used 'photo' but you want it as studentPhoto
      if (!file && field === "photo" && req.file && !req.files) {
        file = req.file;
      }

      if (!file) continue;

      // Choose subfolder name based on field
      const subFolder =
        field === "fatherPhoto"
          ? "father"
          : field === "motherPhoto"
          ? "mother"
          : "student";

      const ext = path.extname(file.originalname) || "";
      const filename = `${subFolder}-photo-${Date.now()}${ext}`;

      const destRel = normalizeRelPath(
        path.join(
          "uploads",
          "students",
          studentKey,
          student._id.toString(),
          "photo",
          subFolder,
          filename
        )
      );

      await storeFileFromTemp(file.path, destRel);

      const photoObj = {
        originalName: file.originalname,
        path: destRel,
        uploadedAt: new Date(),
      };

      if (field === "fatherPhoto") student.fatherPhoto = photoObj;
      else if (field === "motherPhoto") student.motherPhoto = photoObj;
      else student.studentPhoto = photoObj;
    }

    // save once after photos
    await student.save();

    return res.status(201).json({ message: "Student created", student });
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

    console.error("createStudent error:", err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "Duplicate key error", error: err.keyValue });
    }
    next(err);
  }
};

// UPDATE student
exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    if (
      requester._id?.toString &&
      requester._id.toString() !== id &&
      !["Admin", "SuperAdmin"].includes(requester.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const studentKey = student.studentCode
      ? student.studentCode.toString()
      : student._id.toString();

    // prevent email conflict
    if (req.body.email && req.body.email !== student.email) {
      const conflict = await Student.findOne({ email: req.body.email });
      if (conflict)
        return res.status(400).json({ message: "Email already in use" });
    }
    // In updateStudent, add this check:
    if (req.body.admissionNo && req.body.admissionNo !== student.admissionNo) {
      const existingAuth = await StudentAuth.findOne({
        admissionNo: req.body.admissionNo,
      });
      if (existingAuth) {
        return res.status(400).json({
          message: "Admission Number already used in authentication system",
        });
      }

      // Update StudentAuth record if it exists
      if (student.studentAuthId) {
        await StudentAuth.findByIdAndUpdate(student.studentAuthId, {
          admissionNo: req.body.admissionNo,
          username: req.body.admissionNo.toLowerCase(), // Update username too
        });
      }
    }

    // Allowed updates
    const allowedStudent = [
      "rollNumber",
      "fullName",
      "enrolementStatus",
      "dateOfBirth",
      "gender",
      "email",
      "mobile",
      "aadhaarNumber",
      "birthPlace",
      "nationality",
      "bloodGroup",
      "caste",
      "subCaste",
      "disability_Allergy",
      "fatherName",
      "fatherMobile",
      "fatherOccupation",
      "fatherWorkspace",
      "fatherAnnualIncome",
      "motherName",
      "motherMobile",
      "motherOccupation",
      "motherWorkspace",
      "motherAnnualIncome",
      "guardianName",
      "guardianMobile",
      "alternateMobile",
      "homeMobile",
      "class",
      "className",
      "section",
      "sectionName",
      "currentStreet",
      "currentCity",
      "currentState",
      "currentPin",
      "currentCountry",
      "permanentStreet",
      "permanentCity",
      "permanentState",
      "permanentPin",
      "permanentCountry",
      "documents",
      "studentPhoto",
      "fatherPhoto",
      "motherPhoto",
      "role",
      "createdBy",
      "updatedBy",
      "scholarshipAmount",
      "isBoarder",
      "notes",
    ];

    for (const field of allowedStudent) {
      if (req.body[field] !== undefined) {
        if (field === "dateOfBirth") {
          const d = parseDate(req.body[field]);
          if (d !== undefined) student[field] = d;
        } else if (
          field === "fatherAnnualIncome" ||
          field === "motherAnnualIncome" ||
          field === "scholarshipAmount"
        ) {
          const n = parseNumber(req.body[field]);
          if (n !== undefined) student[field] = n;
        } else {
          student[field] = req.body[field];
        }
      }
    }

    student.updatedBy =
      requester.userCode || requester.userId || requester.id || null;

    // ----- handle removed remote files -----
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
        if (Array.isArray(student.documents)) {
          student.documents = student.documents.filter((doc) => {
            const docPath = typeof doc === "string" ? doc : doc.path;
            return String(docPath).replace(/\\/g, "/") !== rem;
          });
        }
        if (
          student.studentPhoto &&
          student.studentPhoto.path &&
          String(student.studentPhoto.path).replace(/\\/g, "/") === rem
        ) {
          student.studentPhoto = {
            originalName: "",
            path: "",
            uploadedAt: null,
          };
        }
        if (
          student.fatherPhoto &&
          student.fatherPhoto.path &&
          String(student.fatherPhoto.path).replace(/\\/g, "/") === rem
        ) {
          student.fatherPhoto = {
            originalName: "",
            path: "",
            uploadedAt: null,
          };
        }
        if (
          student.motherPhoto &&
          student.motherPhoto.path &&
          String(student.motherPhoto.path).replace(/\\/g, "/") === rem
        ) {
          student.motherPhoto = {
            originalName: "",
            path: "",
            uploadedAt: null,
          };
        }
      }
    }

    // If new document files are uploaded, append them
    let docsArray = null;
    if (req.files && Array.isArray(req.files)) {
      docsArray = req.files;
    } else if (
      req.files &&
      req.files.documents &&
      Array.isArray(req.files.documents)
    ) {
      docsArray = req.files.documents;
    }

    if (Array.isArray(docsArray) && docsArray.length > 0) {
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
            "students",
            studentKey,
            student._id.toString(),
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

      student.documents = (student.documents || []).concat(savedDocs);
    }

    // Photo: support single photo via upload.fields or req.file
    // ---------- Photos (update) ----------
    // same field names supported as in create
    const photoFields = ["studentPhoto", "fatherPhoto", "motherPhoto", "photo"];
    for (const field of photoFields) {
      let file =
        req.files && req.files[field] && Array.isArray(req.files[field])
          ? req.files[field][0]
          : req.file && req.file.fieldname === field
          ? req.file
          : null;

      // fallback: if client posted single file as req.file.fieldname === 'photo', treat as studentPhoto
      if (!file && field === "photo" && req.file && !req.files) {
        file = req.file;
      }

      if (!file) continue;

      // before saving new file, remove an old one (if present)
      if (
        field === "fatherPhoto" &&
        student.fatherPhoto &&
        student.fatherPhoto.path
      ) {
        await removeFileIfExists(student.fatherPhoto.path);
      } else if (
        field === "motherPhoto" &&
        student.motherPhoto &&
        student.motherPhoto.path
      ) {
        await removeFileIfExists(student.motherPhoto.path);
      } else if (field === "photo" || field === "studentPhoto") {
        if (student.studentPhoto && student.studentPhoto.path) {
          await removeFileIfExists(student.studentPhoto.path);
        }
      }

      const subFolder =
        field === "fatherPhoto"
          ? "father"
          : field === "motherPhoto"
          ? "mother"
          : "student";
      const ext = path.extname(file.originalname) || "";
      const filename = `${subFolder}-photo-${Date.now()}${ext}`;

      const destRel = normalizeRelPath(
        path.join(
          "uploads",
          "students",
          studentKey,
          student._id.toString(),
          "photo",
          subFolder,
          filename
        )
      );

      await storeFileFromTemp(file.path, destRel);

      const photoObj = {
        originalName: file.originalname,
        path: destRel,
        uploadedAt: new Date(),
      };

      if (field === "fatherPhoto") student.fatherPhoto = photoObj;
      else if (field === "motherPhoto") student.motherPhoto = photoObj;
      else student.studentPhoto = photoObj;
    }

    await student.save();
    return res.json({ message: "Student updated", student });
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

    console.error("updateStudent error:", err);
    if (err.code === 11000)
      return res
        .status(400)
        .json({ message: "Duplicate key", error: err.keyValue });
    next(err);
  }
};

// GET student by _id
exports.getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ message: "Student not found" });

    const createdByUser = student.createdBy
      ? await User.findOne({ userCode: student.createdBy }).select(
          "userCode fullName"
        )
      : null;
    const updatedByUser = student.updatedBy
      ? await User.findOne({ userCode: student.updatedBy }).select(
          "userCode fullName"
        )
      : null;

    return res.json({
      ...student,
      createdByInfo: createdByUser || null,
      updatedByInfo: updatedByUser || null,
    });
  } catch (err) {
    next(err);
  }
};

// GET all students
exports.getAllStudent = async (req, res, next) => {
  try {
    const studentList = await Student.find().lean();

    const userIds = new Set();
    studentList.forEach((s) => {
      if (s.createdBy) userIds.add(s.createdBy);
      if (s.updatedBy) userIds.add(s.updatedBy);
    });

    const lookup = userIds.size
      ? await User.find({ userCode: { $in: Array.from(userIds) } })
          .select("userCode fullName")
          .lean()
      : [];
    const map = Object.fromEntries(lookup.map((x) => [x.userCode, x]));

    const out = studentList.map((s) => ({
      ...s,
      createdByInfo: s.createdBy ? map[s.createdBy] || null : null,
      updatedByInfo: s.updatedBy ? map[s.updatedBy] || null : null,
    }));

    return res.json(out);
  } catch (err) {
    next(err);
  }
};

// DELETE student
exports.deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    if (requester.id === id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }

    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const studentKey = student.studentCode
      ? student.studentCode.toString()
      : student._id.toString();

    const deleted = await Student.findByIdAndDelete(id);
    if (!deleted)
      return res.status(500).json({ message: "Failed to delete student" });

    // remove documents
    if (student.documents && student.documents.length) {
      for (const doc of student.documents) {
        const docPath = typeof doc === "string" ? doc : doc.path;
        await removeFileIfExists(docPath);
      }
    }

    // remove photos
    if (student.studentPhoto && student.studentPhoto.path) {
      await removeFileIfExists(student.studentPhoto.path);
    }
    if (student.fatherPhoto && student.fatherPhoto.path) {
      await removeFileIfExists(student.fatherPhoto.path);
    }
    if (student.motherPhoto && student.motherPhoto.path) {
      await removeFileIfExists(student.motherPhoto.path);
    }

    const studentFolderRel = normalizeRelPath(
      path.join("uploads", "students", studentKey, student._id.toString())
    );
    await removeFolderIfExists(studentFolderRel);
    await StudentAuth.deleteOne({ studentId: student._id });
    return res.json({
      message: "Student deleted along with documents and folder",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};
