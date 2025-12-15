// controllers/class.controller.js
const mongoose = require("mongoose");
const path = require("path");
const Class = require("../models/class.model");
const Staff = require("../models/staff.model");

function isObjectIdString(s) {
  return mongoose.Types.ObjectId.isValid(String(s));
}

/**
 * Resolve staff input into staff document (selected fields).
 * Accepts ObjectId string, staffCode, staffId (identifier), or email.
 * Returns staff doc { _id, staffCode, staffId, fullName, email } or null.
 */
async function resolveStaffDoc(input) {
  if (!input) return null;
  const candidate = String(input).trim();
  if (!candidate) return null;

  if (isObjectIdString(candidate)) {
    const s = await Staff.findById(candidate).select(
      "_id staffCode staffId fullName email"
    );
    if (s) return s;
    // fallthrough to try other lookups if not found
  }

  const s = await Staff.findOne({
    $or: [
      { staffCode: candidate },
      { staffId: candidate },
      { email: candidate },
    ],
  }).select("_id staffCode staffId fullName email");

  return s || null;
}

/**
 * Normalize incoming sections array (string or array). Each section becomes:
 * { name, staff (ObjectId|null), staffCode (string|null), staffIdentifier (string|null) }
 * If s.staff is provided but cannot be resolved -> throws Error (caller should return 400).
 */
async function normalizeSections(inputSections = []) {
  const secArr = Array.isArray(inputSections)
    ? inputSections
    : inputSections
    ? JSON.parse(inputSections)
    : [];
  const out = [];

  for (const s of secArr) {
    const name = s.name || s.section || s.sectionName;
    if (!name) throw new Error("Each section must have a name");

    // If s.staff explicitly provided as empty/null -> clear staff fields
    if (
      Object.prototype.hasOwnProperty.call(s, "staff") &&
      (s.staff === null || String(s.staff).trim() === "")
    ) {
      out.push({
        name,
        staff: null,
        staffCode: null,
        staffIdentifier: null,
      });
      continue;
    }

    if (s.staff) {
      const staffDoc = await resolveStaffDoc(s.staff);
      if (!staffDoc) {
        // pass candidate so caller can include it in message if desired
        throw new Error(`Staff not found for: ${String(s.staff)}`);
      }

      out.push({
        name,
        staff: staffDoc._id,
        staffCode: staffDoc.staffCode || null,
        staffIdentifier: staffDoc.staffId || null,
      });
    } else {
      // no staff provided -> keep nulls
      out.push({
        name,
        staff: null,
        staffCode: null,
        staffIdentifier: null,
      });
    }
  }

  return out;
}

/**
 * POST /class
 * body: { className: string, sections: [{ name, staff? }] }
 */
exports.createClass = async (req, res, next) => {
  try {
    const { className, sections } = req.body;
    if (!className)
      return res.status(400).json({ message: "Missing className" });

    let normalizedSections;
    try {
      normalizedSections = await normalizeSections(sections);
    } catch (err) {
      return res
        .status(400)
        .json({ message: err.message || "Invalid sections" });
    }

    const creatorUserId = req.user
      ? req.user.userCode || req.user.userId || req.user.id
      : null;

    const cls = new Class({
      className,
      sections: normalizedSections,
      createdBy: creatorUserId,
    });

    await cls.save();

    const populated = await Class.findById(cls._id)
      .populate("sections.staff", "staffCode fullName email staffId")
      .lean();
    return res.status(201).json({ message: "Class created", class: populated });
  } catch (err) {
    console.error("createClass error", err);
    if (err.code === 11000)
      return res
        .status(400)
        .json({ message: "Duplicate key", error: err.keyValue });
    next(err);
  }
};

/**
 * PUT /class/:id
 * body: { className?, sections? } -- sections replaces existing sections array
 */
exports.updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cls = await Class.findById(id);
    if (!cls) return res.status(404).json({ message: "Class not found" });

    if (req.body.className) cls.className = req.body.className;

    if (Object.prototype.hasOwnProperty.call(req.body, "sections")) {
      // Replace sections (parse and normalize)
      let normalizedSections;
      try {
        normalizedSections = await normalizeSections(req.body.sections);
      } catch (err) {
        return res
          .status(400)
          .json({ message: err.message || "Invalid sections" });
      }
      cls.sections = normalizedSections;
    }

    cls.updatedBy = req.user
      ? req.user.userCode || req.user.userId || req.user.id
      : null;
    await cls.save();

    const populated = await Class.findById(cls._id)
      .populate("sections.staff", "staffCode fullName email staffId")
      .lean();
    return res.json({ message: "Class updated", class: populated });
  } catch (err) {
    console.error("updateClass error", err);
    if (err.name === "CastError")
      return res.status(400).json({ message: "Invalid class id" });
    next(err);
  }
};

// controllers/class.controller.js

/**
 * GET /class/:id
 */
exports.getClassById = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("sections.staff", "fullName staffId staffCode email")
      .lean();
    if (!cls) return res.status(404).json({ message: "Class not found" });

    // Ensure each section has _id
    cls.sections = cls.sections.map((section) => ({
      _id: section._id || new mongoose.Types.ObjectId().toString(), // Generate if missing
      ...section,
    }));

    return res.json(cls);
  } catch (err) {
    console.error("getClassById error", err);
    next(err);
  }
};

/**
 * GET /class
 */
exports.getAllClasses = async (req, res, next) => {
  try {
    const classes = await Class.find()
      .populate("sections.staff", "fullName staffId staffCode email")
      .lean();

    // Ensure each section has _id
    const classesWithSectionIds = classes.map((cls) => ({
      ...cls,
      sections: cls.sections.map((section) => ({
        _id: section._id || new mongoose.Types.ObjectId().toString(),
        ...section,
      })),
    }));

    return res.json(classesWithSectionIds);
  } catch (err) {
    console.error("getAllClasses error", err);
    next(err);
  }
};
/**
 * DELETE /class/:id
 */
exports.deleteClass = async (req, res, next) => {
  try {
    const deleted = await Class.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Class not found" });
    return res.json({ message: "Class deleted" });
  } catch (err) {
    console.error("deleteClass error", err);
    next(err);
  }
};
