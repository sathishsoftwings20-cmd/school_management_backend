const mongoose = require("mongoose");
const Counter = require("./counter.model");

const attendanceSchema = new mongoose.Schema(
    {
        attendanceCode: { type: String, unique: true }, // e.g., ATTEND0001

        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
        classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
        section: { type: String, required: true },

        date: { type: Date, required: true },

        status: {
            type: String,
            enum: ["Present", "Absent", "Late", "Excused", "Half Day"],
            default: "Present",
        },

        createdBy: { type: String, default: null },
        updatedBy: { type: String, default: null },
    },
    { timestamps: true }
);

// Ensure one attendance record per student per day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Auto-generate attendanceCode (like STAFF0001/STUD0001)
attendanceSchema.pre("save", async function (next) {
    if (!this.isNew || this.attendanceCode) return next();

    try {
        const counter = await Counter.findOneAndUpdate(
            { _id: "attendanceCode" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const seqNumber = counter.seq;
        const padded = String(seqNumber).padStart(4, "0"); // ATTEND0001 style
        this.attendanceCode = `ATTEND${padded}`;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
