const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware"); // <-- add this
const { authorize } = require("../middleware/role.middleware");
const staffController = require("../controllers/staff.controller");
const { staffUpload } = require("../utils/staff.multer");

// require authentication for all staff routes
router.use(protect);

router.post(
  "/",
  authorize("Admin", "SuperAdmin"),
  staffUpload, // <-- use the fields middleware
  staffController.createStaff
);

router.put(
  "/:id",
  authorize("Admin", "SuperAdmin"),
  staffUpload, // <-- use the fields middleware
  staffController.updateStaff
);

router.get("/:id", staffController.getStaffById);
router.get("/", staffController.getAllStaff);
router.delete("/:id", staffController.deleteStaff);

module.exports = router;
