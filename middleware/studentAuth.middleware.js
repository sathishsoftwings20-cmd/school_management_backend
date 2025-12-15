// middleware/studentAuth.middleware.js
const jwt = require("jsonwebtoken");
const StudentAuth = require("../models/studentAuth.model");
const Student = require("../models/student.model");

exports.protectStudent = async (req, res, next) => {
  let token;

  // Expect token in Authorization header: "Bearer <token>"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.STUDENT_JWT_SECRET);

    // decoded contains { studentAuthId: ... }
    const auth = await StudentAuth.findById(decoded.studentAuthId).populate(
      "studentId"
    );
    if (!auth) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // attach student to request
    req.student = auth.studentId;

    next();
  } catch (err) {
    console.error("protectStudent error:", err);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};
