// routes/user.routes.js
const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/role.middleware");
const upload = require("../utils/user.multer");


router.use(protect);

// Admin/SuperAdmin only for listing and create
router.post(
    "/",
    authorize("Admin", "SuperAdmin"),
    upload.single("avatar"),  // <-- attach multer here
    userController.createUser
);
// Single user endpoints (admins or self — controller checks permissions)
router.get("/:id", userController.getUserById);
router.get("/", userController.getAllUsers);
router.put("/:id", upload.single("avatar"), userController.updateUser);

router.delete("/:id", userController.deleteUser);

module.exports = router;
