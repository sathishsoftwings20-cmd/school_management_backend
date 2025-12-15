// models/class.model.js
const mongoose = require("mongoose");
const Counter = require("./counter.model");

const ClassSchema = new mongoose.Schema(
  {
    classCode: { type: String, unique: true }, // CLASS0001
    className: { type: String, required: true }, // e.g., "5" or "Grade 5"
    sections: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Add this line
        name: { type: String, required: true }, // "A"
        // staff should be stored as Staff _id (ObjectId)
        staff: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff",
          default: null,
        },
        staffCode: { type: String, trim: true, default: null },
        staffIdentifier: { type: String, trim: true, default: null },
      },
    ],
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

ClassSchema.pre("save", async function (next) {
  if (!this.isNew || this.classCode) return next();
  const counter = await Counter.findOneAndUpdate(
    { _id: "classCode" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  this.classCode = `CLASS${String(counter.seq).padStart(4, "0")}`;
  next();
});

module.exports = mongoose.model("Class", ClassSchema);
