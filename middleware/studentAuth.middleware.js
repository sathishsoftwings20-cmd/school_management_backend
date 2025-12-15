const jwt = require("jsonwebtoken");
const StudentAuth = require("../models/studentAuth.model");

exports.protectStudent = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.STUDENT_JWT_SECRET);

    const auth = await StudentAuth.findById(decoded.studentAuthId).populate(
      "studentId"
    );

    if (!auth) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.student = auth.studentId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
