const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign({ id: user._id.toString() }, secret, { expiresIn });
}

exports.login = async (req, res, next) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = (req.body.password || "").trim();

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    // after fetching user with password:
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // use the model-provided method (which uses bcryptjs)
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Role check after verifying password
    if (!["SuperAdmin", "Admin", "Staff"].includes(user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied: insufficient role" });
    }

    const token = signToken(user);
    const safeUser = user.toObject();
    delete safeUser.password;

    return res.json({ token, user: safeUser });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware
    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
