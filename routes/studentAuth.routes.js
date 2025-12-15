const express = require("express");
const router = express.Router();
const { studentLogin } = require("../controllers/studentAuth.controller");
const { protectStudent } = require("../middleware/studentAuth.middleware");

router.post("/login", studentLogin);

// Flutter app: get logged-in student
router.get("/me", protectStudent, (req, res) => {
  res.json(req.student);
});

module.exports = router;
