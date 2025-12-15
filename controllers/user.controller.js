// controllers/user.controller.js
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Staff = require("../models/staff.model");

/* ---------------------- Helpers ---------------------- */

// remove single file (relative or absolute)
async function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(__dirname, "..", filePath);
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (err) {
    console.warn("Failed to remove file:", filePath, err.message);
  }
}

// remove folder recursively (relative or absolute)
async function removeFolderIfExists(folderPath) {
  if (!folderPath) return;
  try {
    const absolute = path.isAbsolute(folderPath)
      ? folderPath
      : path.join(__dirname, "..", folderPath);
    if (fs.existsSync(absolute)) {
      fs.rmSync(absolute, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("Failed to remove folder:", folderPath, err.message);
  }
}

// sanitize user object before returning
const safeUser = (userDoc) => {
  if (!userDoc) return null;
  const u = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete u.password;
  return u;
};

/**
 * Resolve staff input into a staff document.
 * Accepts:
 *  - Mongo ObjectId string (will find by _id)
 *  - staffCode (e.g. STAFF0001)
 *  - staffId (custom string on staff doc)
 *  - email
 *
 * Returns staff document (selected fields) or null.
 */
async function resolveStaffDoc(input) {
  if (!input) return null;
  // try as ObjectId first
  if (mongoose.Types.ObjectId.isValid(String(input))) {
    const s = await Staff.findById(input).select(
      "_id staffCode staffId fullName email"
    );
    if (s) return s;
    // if not found, continue to search by other fields
  }

  const staff = await Staff.findOne({
    $or: [{ staffCode: input }, { staffId: input }, { email: input }],
  }).select("_id staffCode staffId fullName email");

  return staff || null;
}

/* ---------------------- CREATE ---------------------- */
exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;
    let staffInput = req.body.staffId ?? null;

    // If creating a Staff user, require valid staff selection
    let staffDoc = null;
    if (role === "Staff") {
      staffDoc = await resolveStaffDoc(staffInput);
      if (!staffDoc) {
        return res
          .status(400)
          .json({ message: "Invalid or missing staffId for Staff role" });
      }
    }

    // Basic validation
    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({
          message: "Missing required fields: fullName, email, password",
        });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing)
      return res.status(400).json({ message: "Email already used" });

    // who is creating this user? store their userId string (if available)
    const creatorUserId = req.user
      ? req.user.userCode || req.user.userId || req.user.id || null
      : null;

    // build new user; if staffDoc exists, copy all three staff fields
    const user = new User({
      fullName,
      email: email.toLowerCase().trim(),
      password,
      role: role || "Staff",
      staffId: staffDoc ? staffDoc._id : null,
      staffCode: staffDoc ? staffDoc.staffCode : null,
      staffIdentifier: staffDoc ? staffDoc.staffId : null,
      createdBy: creatorUserId,
    });

    await user.save(); // triggers pre-save (hash + userId generation)

    // Avatar handling (multer): move temp file to uploads/users/<user._id>/avatar.ext
    if (req.file && req.file.path) {
      try {
        const uploadsRoot = path.join("uploads", "users", user._id.toString());
        await fs.promises.mkdir(uploadsRoot, { recursive: true });

        const ext =
          path.extname(req.file.originalname) ||
          path.extname(req.file.path) ||
          ".jpg";
        const destRelative = path.join(uploadsRoot, "avatar" + ext);
        const destAbsolute = path.join(__dirname, "..", destRelative);

        if (fs.existsSync(destAbsolute)) {
          await fs.promises.unlink(destAbsolute);
        }

        await fs.promises.rename(req.file.path, destAbsolute);

        user.avatar = destRelative;
        await user.save();
      } catch (fileErr) {
        // cleanup user and temp file
        try {
          await User.findByIdAndDelete(user._id);
        } catch (cleanupErr) {
          console.warn("Cleanup failed:", cleanupErr);
        }
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {}
        }
        console.error("Avatar storing error:", fileErr);
        return res
          .status(500)
          .json({ message: "Failed to store avatar", error: fileErr.message });
      }
    }

    // prepare response (populated staff info)
    const populated = await User.findById(user._id)
      .populate("staffId", "fullName staffCode staffId email")
      .lean();

    return res.status(201).json({
      message: "User created",
      user: {
        _id: populated._id,
        userId: populated.userId,
        fullName: populated.fullName,
        email: populated.email,
        role: populated.role,
        staff: populated.staffId || null, // populated staff doc or null
        staffCode: populated.staffCode || null,
        staffIdentifier: populated.staffIdentifier || null,
        avatar: populated.avatar || null,
        createdAt: populated.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    // remove temp file if exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "Duplicate key error", error: err.keyValue });
    }
    next(err);
  }
};

/* ---------------------- UPDATE ---------------------- */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params; // user _id
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    // allow only self or admins
    if (
      requester._id.toString() !== id &&
      !["Admin", "SuperAdmin"].includes(requester.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Handle staff fields:
    // - If role is Staff: if staffId provided in body, resolve it and set all three fields.
    // - If role is Staff and no staff provided but user currently has none -> require staffId.
    // - If role changes to non-Staff, clear all staff fields.
    if (req.body.role === "Staff") {
      if (Object.prototype.hasOwnProperty.call(req.body, "staffId")) {
        const provided = req.body.staffId ?? null;
        const staffDoc = await resolveStaffDoc(provided);
        if (!staffDoc)
          return res
            .status(400)
            .json({ message: "Invalid staffId for Staff role" });
        user.staffId = staffDoc._id;
        user.staffCode = staffDoc.staffCode;
        user.staffIdentifier = staffDoc.staffId;
      } else if (!user.staffId) {
        return res
          .status(400)
          .json({ message: "staffId is required for Staff role" });
      }
    } else {
      // clearing staff when role changed off Staff
      if (req.body.role && req.body.role !== "Staff") {
        user.staffId = null;
        user.staffCode = null;
        user.staffIdentifier = null;
      }
    }

    // prevent email conflict
    if (req.body.email && req.body.email.toLowerCase().trim() !== user.email) {
      const conflict = await User.findOne({
        email: req.body.email.toLowerCase().trim(),
      });
      if (conflict)
        return res.status(400).json({ message: "Email already in use" });
    }

    // Allowed updates (do NOT include staff fields here to avoid accidental overwrite)
    const allowed = ["fullName", "email", "role", "password"];
    for (const field of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        if (field === "password") {
          user.password = req.body.password; // pre('save') will hash
        } else if (field === "email") {
          user.email = req.body.email.toLowerCase().trim();
        } else {
          user[field] = req.body[field];
        }
      }
    }

    user.updatedBy =
      requester.userId || requester.userCode || requester.id || null;

    // Avatar handling (multer)
    if (req.file) {
      // delete old avatar file if exists
      if (user.avatar) {
        const oldAbs = path.isAbsolute(user.avatar)
          ? user.avatar
          : path.join(__dirname, "..", user.avatar);
        if (fs.existsSync(oldAbs)) {
          try {
            fs.unlinkSync(oldAbs);
          } catch (e) {
            console.warn("Failed to remove old avatar:", e.message);
          }
        }
      }

      const userFolder = path.join("uploads", "users", user._id.toString());
      const userFolderAbs = path.join(__dirname, "..", userFolder);
      if (!fs.existsSync(userFolderAbs))
        fs.mkdirSync(userFolderAbs, { recursive: true });

      const newPathRel = path.join(
        userFolder,
        "avatar" +
          path.extname(req.file.originalname || req.file.path || ".jpg")
      );
      const newPathAbs = path.join(__dirname, "..", newPathRel);

      try {
        await fs.promises.rename(req.file.path, newPathAbs);
        user.avatar = newPathRel;
      } catch (e) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
        }
        console.error("Failed move avatar during update:", e);
        return res
          .status(500)
          .json({ message: "Failed to store avatar", error: e.message });
      }
    }

    await user.save();

    // return sanitized & populated user
    const result = await User.findById(user._id)
      .populate("staffId", "fullName staffCode staffId email")
      .lean();

    return res.json({ message: "User updated", user: safeUser(result) });
  } catch (err) {
    console.error(err);
    if (err.code === 11000)
      return res
        .status(400)
        .json({ message: "Duplicate key", error: err.keyValue });
    next(err);
  }
};

/* ---------------------- GET BY ID ---------------------- */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // createdBy / updatedBy info
    const createdByUser = user.createdBy
      ? await User.findOne({ userId: user.createdBy })
          .select("userId fullName")
          .lean()
      : null;
    const updatedByUser = user.updatedBy
      ? await User.findOne({ userId: user.updatedBy })
          .select("userId fullName")
          .lean()
      : null;

    // staff info
    let staffInfo = null;
    if (user.staffId) {
      const staffDoc = await Staff.findById(user.staffId)
        .select("-documents -photo")
        .lean();
      if (staffDoc) staffInfo = staffDoc;
    }

    return res.json({
      ...user,
      staff: staffInfo,
      staffCode: user.staffCode || null,
      staffIdentifier: user.staffIdentifier || null,
      createdByInfo: createdByUser || null,
      updatedByInfo: updatedByUser || null,
    });
  } catch (err) {
    next(err);
  }
};

/* ---------------------- GET ALL ---------------------- */
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password").lean();

    // resolve createdBy/updatedBy map
    const userIds = new Set();
    users.forEach((u) => {
      if (u.createdBy) userIds.add(u.createdBy);
      if (u.updatedBy) userIds.add(u.updatedBy);
    });
    const lookup = userIds.size
      ? await User.find({ userId: { $in: Array.from(userIds) } })
          .select("userId fullName")
          .lean()
      : [];
    const map = Object.fromEntries(lookup.map((x) => [x.userId, x]));

    // lookup staff docs in batch
    const staffIds = Array.from(
      new Set(users.filter((u) => u.staffId).map((u) => String(u.staffId)))
    );
    let staffLookup = {};
    if (staffIds.length) {
      const staffDocs = await Staff.find({ _id: { $in: staffIds } })
        .select("fullName staffCode staffId email")
        .lean();
      staffLookup = Object.fromEntries(
        staffDocs.map((s) => [String(s._id), s])
      );
    }

    const out = users.map((u) => ({
      ...u,
      staff: u.staffId ? staffLookup[String(u.staffId)] || null : null,
      staffCode: u.staffCode || null,
      staffIdentifier: u.staffIdentifier || null,
      createdByInfo: u.createdBy ? map[u.createdBy] || null : null,
      updatedByInfo: u.updatedBy ? map[u.updatedBy] || null : null,
    }));

    return res.json(out);
  } catch (err) {
    next(err);
  }
};

/* ---------------------- DELETE ---------------------- */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    if (requester._id.toString() === id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "SuperAdmin" && requester.role !== "SuperAdmin") {
      return res
        .status(403)
        .json({ message: "Only SuperAdmin can delete another SuperAdmin" });
    }

    if (user.role === "SuperAdmin") {
      const superCount = await User.countDocuments({ role: "SuperAdmin" });
      if (superCount <= 1)
        return res
          .status(400)
          .json({ message: "Cannot delete the last SuperAdmin" });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted)
      return res.status(500).json({ message: "Failed to delete user" });

    // Remove avatar and folder
    if (user.avatar) await removeFileIfExists(user.avatar);
    const userFolder = path.join("uploads", "users", user._id.toString());
    await removeFolderIfExists(userFolder);

    return res.json({ message: "User deleted along with avatar and folder" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};
