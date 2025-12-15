// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

/**
 * protect
 * - Verifies JWT from Authorization header (Bearer ...)
 * - Attaches the user document (without password) to req.user
 * - Returns 401 when token missing/invalid
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // 1) Authorization header: "Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2) optionally you might store token in cookie named 'token'
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    // verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }

    // decoded is usually { id: ..., iat: ..., exp: ... }
    if (!decoded || !decoded.id) {
      return res
        .status(401)
        .json({ message: "Not authorized, token payload invalid" });
    }

    // fetch user and attach to req (omit password)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found" });
    }

    req.user = user; // controllers expect req.user
    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
