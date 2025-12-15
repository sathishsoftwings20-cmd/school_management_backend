// routes/attendance.routes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware"); // authentication
const { authorize } = require("../middleware/role.middleware"); // role-based access

const attendanceController = require("../controllers/attendance.controller");

// all routes require authentication
router.use(protect);

/**
 * MARK attendance (bulk)
 * POST /attendance/mark
 * body: { classId, section, date, records: [{ studentId, status }] }
 */
router.post(
    "/mark",
    authorize("Staff", "Admin", "SuperAdmin"), // staff can mark attendance
    attendanceController.markAttendance
);

/**
 * GET attendance for a class-section on a date
 * GET /attendance/class/:classId/section/:section?date=YYYY-MM-DD
 */
router.get(
    "/class/:classId/section/:section",
    authorize("Staff", "Admin", "SuperAdmin"),
    attendanceController.getAttendanceByClassSection
);

/**
 * UPDATE a single attendance record
 * PUT /attendance/:id
 */
router.put(
    "/:id",
    authorize("Staff", "Admin", "SuperAdmin"),
    attendanceController.updateAttendance
);

/**
 * GET student attendance history
 * GET /attendance/student/:studentId
 */
router.get(
    "/student/:studentId",
    authorize("Staff", "Admin", "SuperAdmin"),
    attendanceController.getAttendanceByStudent
);

module.exports = router;
