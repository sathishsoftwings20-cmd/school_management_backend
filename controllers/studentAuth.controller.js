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
    });

    if (!auth) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await auth.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { studentAuthId: auth._id },
      process.env.STUDENT_JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Respond only with token
    res.json({ token });
  } catch (err) {
    console.error("studentLogin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get logged-in student (full document)
exports.getMe = async (req, res) => {
  try {
    // req.student is set by protectStudent middleware
    if (!req.student) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Optionally populate references if needed
    const student = await req.student.populate([
      "class",
      "section",
      "documents",
    ]);

    res.json(student); // returns the full student document
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
