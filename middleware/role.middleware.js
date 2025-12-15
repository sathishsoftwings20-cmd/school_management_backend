// middleware/role.middleware.js

/**
 * authorize(...allowedRoles)
 * - Usage: authorize("Admin", "SuperAdmin")
 * - Checks req.user (should be set by protect) and ensures user.role is one of allowed.
 */
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // If allowedRoles empty, allow any authenticated user
      if (!allowedRoles || allowedRoles.length === 0) {
        return next();
      }

      const userRole = req.user.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    } catch (err) {
      console.error("Role middleware error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  };
};
