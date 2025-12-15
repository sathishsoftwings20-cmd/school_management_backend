// models/user.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Counter = require("./counter.model");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true }, // will be set in pre('save')
    fullName: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      trim: true,
      required: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please fill a valid email address"],
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["SuperAdmin", "Admin", "Staff"],
      default: "Staff",
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },
    staffCode: { type: String, trim: true, default: null },
    staffIdentifier: { type: String, trim: true, default: null },
    avatar: { type: String, trim: true },

    // store creator/modifier as the string userId (e.g. "USER0001")
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Hash password when creating or updating password
userSchema.pre("save", async function (next) {
  try {
    // Hash password if modified
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, 10);
    }

    // Assign userId only for new documents
    if (this.isNew && !this.userId) {
      const counter = await Counter.findOneAndUpdate(
        { _id: "userId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const seqNumber = counter.seq;
      const padded = String(seqNumber).padStart(4, "0"); // USER0001 style
      this.userId = `USER${padded}`;
    }

    next();
  } catch (err) {
    next(err);
  }
});

// instance method to compare password
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
