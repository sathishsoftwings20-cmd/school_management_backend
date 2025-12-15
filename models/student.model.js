const mongoose = require("mongoose");
const Counter = require("./counter.model");

const studentSchema = new mongoose.Schema(
  {
    studentCode: { type: String, unique: true, sparse: true },
    admissionNo: { type: String, unique: true, sparse: true, required: true },
    rollNumber: { type: String, unique: true, sparse: true },
    fullName: { type: String, required: true },
    enrollmentStatus: { type: String, default: "Active" },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      required: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please fill a valid email address"],
    },
    mobile: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },
    birthPlace: { type: String, default: "" },
    nationality: { type: String, default: "Indian" },
    bloodGroup: { type: String, default: "" },
    caste: { type: String, default: "" },
    subCaste: { type: String, default: "" },
    disability_Allergy: { type: String, default: "" },
    fatherName: { type: String, default: "" },
    fatherMobile: { type: String, default: "" },
    fatherOccupation: { type: String, default: "" },
    fatherWorkspace: { type: String, default: "" },
    fatherAnnualIncome: { type: Number, default: 0 },
    motherName: { type: String, default: "" },
    motherMobile: { type: String, default: "" },
    motherOccupation: { type: String, default: "" },
    motherWorkspace: { type: String, default: "" },
    motherAnnualIncome: { type: Number, default: 0 },
    guardianName: { type: String, default: "" },
    guardianMobile: { type: String, default: "" },
    alternateMobile: { type: String, default: "" },
    homeMobile: { type: String, default: "" },
    role: { type: String, enum: ["Student"], default: "Student" },

    // Address
    currentStreet: { type: String, default: "" },
    currentCity: { type: String, default: "" },
    currentState: { type: String, default: "" },
    currentPin: { type: String, default: "" },
    currentCountry: { type: String, default: "India" },
    permanentStreet: { type: String, default: "" },
    permanentCity: { type: String, default: "" },
    permanentState: { type: String, default: "" },
    permanentPin: { type: String, default: "" },
    permanentCountry: { type: String, default: "India" },

    // Academic
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    className: { type: String, default: "" },
    classCode: { type: String, default: "" },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },
    sectionName: { type: String, default: "" },

    // Files
    documents: [
      {
        originalName: { type: String },
        path: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Photos
    studentPhoto: {
      originalName: { type: String, default: "" },
      path: { type: String, default: "" },
      uploadedAt: { type: Date, default: null },
    },
    fatherPhoto: {
      originalName: { type: String, default: "" },
      path: { type: String, default: "" },
      uploadedAt: { type: Date, default: null },
    },
    motherPhoto: {
      originalName: { type: String, default: "" },
      path: { type: String, default: "" },
      uploadedAt: { type: Date, default: null },
    },

    // link auth record
    studentAuthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentAuth",
      default: null,
    },

    // Login credentials for Flutter
    loginUsername: { type: String, default: "" }, // For easy reference
    hasLogin: { type: Boolean, default: false }, // Quick check

    // Audit
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// Auto-generate STUD0001
studentSchema.pre("save", async function (next) {
  if (!this.isNew || this.studentCode) return next();
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: "studentCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seqNumber = counter.seq || 1;
    const padded = String(seqNumber).padStart(4, "0");
    this.studentCode = `STUD${padded}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Student", studentSchema);
