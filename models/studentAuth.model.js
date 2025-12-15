const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const studentAuthSchema = new mongoose.Schema(
  {
    // LOGIN USERNAME (default = admissionNo)
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // permanent student identifier
    admissionNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
  },
  { timestamps: true }
);

// hash password
studentAuthSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// compare password
studentAuthSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("StudentAuth", studentAuthSchema);
