const mongoose = require("mongoose");
const Counter = require("./counter.model");

const staffSchema = new mongoose.Schema(
  {
    // Auto-generated code
    staffCode: { type: String, unique: true },

    // Basic info
    staffId: { type: String, unique: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },

    // Job details
    designation: { type: String, default: "" },
    role: {
      type: String,
      enum: ["Staff", "Admin", "staff"],
      default: "Staff",
    },
    employmentStatus: { type: String, default: "" }, // Active / Inactive / Contract
    experienceYears: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    previousInstitution: { type: String, default: "" },
    dateOfJoining: { type: Date },

    // Contact info
    email: {
      type: String,
      unique: true,
      trim: true,
      required: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please fill a valid email address"],
    },
    mobile: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },

    emergencyContact: { type: String, default: "" },

    // Education
    degree: { type: String, default: "" },
    major: { type: String, default: "" },

    // Bank details
    accountName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    bankName: { type: String, default: "" },
    branch: { type: String, default: "" },

    // Family details
    fatherName: { type: String, default: "" },
    fatherMobile: { type: String, default: "" },
    spouseName: { type: String, default: "" },
    spouseMobile: { type: String, default: "" },

    // Address
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pin: { type: String, default: "" },
    country: { type: String, default: "" },

    // Files
    documents: [
      {
        originalName: { type: String },
        path: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Photo
    photo: {
      originalName: { type: String, default: "" },
      path: { type: String, default: "" },
      uploadedAt: { type: Date, default: Date.now },
    },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// Auto-generate STAFF0001
staffSchema.pre("save", async function (next) {
  if (!this.isNew || this.staffCode) return next();

  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: "staffCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seqNumber = counter.seq;
    const padded = String(seqNumber).padStart(4, "0");
    this.staffCode = `STAFF${padded}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Staff", staffSchema);
