// routes/studentAuth.routes.js
const express = require("express");
const router = express.Router();
const { studentLogin } = require("../controllers/studentAuth.controller");
const { protectStudent } = require("../middleware/studentAuth.middleware");

router.post("/login", studentLogin);

// Student can access their own details using JWT
router.get("/me", protectStudent, (req, res) => {
  res.json(req.student);
});

module.exports = router;
