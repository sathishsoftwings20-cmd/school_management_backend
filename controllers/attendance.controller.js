// controllers/attendance.controller.js
const mongoose = require("mongoose");
const Attendance = require("../models/attendance.model");
const Student = require("../models/student.model");
const Class = require("../models/class.model");

/**
 * Helpers
 */
function isObjectIdString(s) {
    return mongoose.Types.ObjectId.isValid(String(s));
}

/**
 * POST /attendance/mark
 * Body: { classId, section, date, records: [{ studentId, status }] }
 * Allows bulk marking of attendance
 */
exports.markAttendance = async (req, res, next) => {
    try {
        const { classId, section, date, records } = req.body;
        const staffUser = req.user;

        if (!classId || !section || !date || !Array.isArray(records)) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // verify staff assigned to class-section
        const cls = await Class.findById(classId).lean();
        if (!cls) return res.status(404).json({ message: "Class not found" });

        const assignedSection = cls.sections.find(s => s.name === section);
        if (!assignedSection) return res.status(400).json({ message: "Section not found" });

        if (String(assignedSection.staff) !== String(staffUser._id)) {
            return res.status(403).json({ message: "You are not assigned to this section" });
        }

        const attendanceDate = new Date(date);
        const createdBy = staffUser.userCode || staffUser.userId || staffUser.id;

        const markedRecords = [];

        for (const r of records) {
            if (!r.studentId || !isObjectIdString(r.studentId)) continue;

            // check student exists and belongs to this class & section
            const student = await Student.findById(r.studentId).lean();
            if (!student) continue;
            if (student.className !== cls.className || student.section !== section) continue;

            // upsert attendance (update if already exists for this student/date)
            const attendance = await Attendance.findOneAndUpdate(
                { studentId: r.studentId, date: attendanceDate },
                {
                    $set: {
                        status: r.status || "Present",
                        classId,
                        section,
                        updatedBy: createdBy,
                        markedBy: staffUser._id,
                    },
                    $setOnInsert: { createdBy },
                },
                { upsert: true, new: true }
            );

            markedRecords.push(attendance);
        }

        return res.status(201).json({ message: "Attendance marked", records: markedRecords });
    } catch (err) {
        console.error("markAttendance error:", err);
        next(err);
    }
};

/**
 * GET /attendance/class/:classId/section/:section?date=YYYY-MM-DD
 * Get attendance for a class-section on a specific date
 */
exports.getAttendanceByClassSection = async (req, res, next) => {
    try {
        const { classId, section } = req.params;
        const { date } = req.query;

        if (!classId || !section) return res.status(400).json({ message: "Missing classId or section" });

        const query = { classId, section };
        if (date) {
            const attendanceDate = new Date(date);
            query.date = attendanceDate;
        }

        const records = await Attendance.find(query)
            .populate("studentId", "studentCode fullName className section")
            .populate("markedBy", "staffCode fullName")
            .lean();

        return res.json(records);
    } catch (err) {
        console.error("getAttendanceByClassSection error:", err);
        next(err);
    }
};

/**
 * PUT /attendance/:id
 * Update a single attendance record
 */
exports.updateAttendance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const staffUser = req.user;

        if (!status) return res.status(400).json({ message: "Missing status" });

        const attendance = await Attendance.findById(id);
        if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

        attendance.status = status;
        attendance.updatedBy = staffUser.userCode || staffUser.userId || staffUser.id;
        await attendance.save();

        return res.json({ message: "Attendance updated", attendance });
    } catch (err) {
        console.error("updateAttendance error:", err);
        next(err);
    }
};

/**
 * GET /attendance/student/:studentId
 * Get attendance history for a student
 */
exports.getAttendanceByStudent = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (!studentId || !isObjectIdString(studentId)) return res.status(400).json({ message: "Invalid studentId" });

        const records = await Attendance.find({ studentId })
            .populate("classId", "className sections")
            .populate("markedBy", "staffCode fullName")
            .lean();

        return res.json(records);
    } catch (err) {
        console.error("getAttendanceByStudent error:", err);
        next(err);
    }
};
