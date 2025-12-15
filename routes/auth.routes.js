const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller"); // must exist
// NOTE: protect/authorize not needed here for public auth routes
const { protect } = require("../middleware/auth.middleware"); // adjust path

// Public auth routes
router.post("/login", authController.login);

router.get("/me", protect, authController.getMe);

module.exports = router;
