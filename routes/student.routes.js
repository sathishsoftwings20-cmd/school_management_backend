const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware"); // <-- add this
const { authorize } = require("../middleware/role.middleware");
const studentController = require("../controllers/student.controller");
const { studentUpload } = require("../utils/student.multer");

router.use(protect);

router.post(
  "/",
  authorize("Admin", "SuperAdmin"),
  studentUpload, // <-- use the fields middleware
  studentController.createStudent
);

router.put(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  studentUpload, // <-- use the fields middleware
  studentController.updateStudent
);

router.get("/:id", studentController.getStudentById);
router.get("/", studentController.getAllStudent);
router.delete("/:id", studentController.deleteStudent);

module.exports = router;
