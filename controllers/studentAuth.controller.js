const jwt = require("jsonwebtoken");
const StudentAuth = require("../models/studentAuth.model");

exports.studentLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password required" });
    }

    const auth = await StudentAuth.findOne({
      username: username.toLowerCase(),
    }).populate("studentId");

    if (!auth) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await auth.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { studentAuthId: auth._id },
      process.env.STUDENT_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      student: auth.studentId,
    });
  } catch (err) {
    console.error("studentLogin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
