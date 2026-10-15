
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  authenticateToken,
} = require("../middleware/authMiddleware");

const router = express.Router();

const VALID_ROLES = ["Admin", "Faculty", "Student"];

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    const role =
      typeof req.body.role === "string"
        ? req.body.role
        : "";

    if (!email || !password || !role) {
      return res.status(400).json({
        message: "Role, email, and password are required.",
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: "Please select a valid login role.",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "This account is disabled. Contact an administrator.",
      });
    }

    // Never trust the role selected in the frontend.
    if (user.role !== role) {
      return res.status(403).json({
        message:
          `This account is not registered as ${role}. ` +
          "Please select the correct role.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        message: "Authentication is not configured correctly.",
      });
    }

    const token = jwt.sign(
      { sub: String(user._id) },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      }
    );

    return res.json({
      message: "Login successful.",
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId
          ? String(user.studentId)
          : null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in.",
    });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
