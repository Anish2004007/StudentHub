
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required. Please log in.",
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.sub).select(
      "_id name email role studentId isActive"
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Account is unavailable. Please contact an administrator.",
      });
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId ? String(user.studentId) : null,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired authentication token.",
      });
    }

    console.error("Authentication error:", error);

    return res.status(500).json({
      message: "Unable to authenticate request.",
    });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  allowRoles,
};
