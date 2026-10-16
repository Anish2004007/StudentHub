
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const studentRoutes = require("./routes/studentRoutes");
const examRoutes = require("./routes/examRoutes");
const resultRoutes = require("./routes/resultRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const riskRoutes = require("./routes/riskRoutes");
const authRoutes = require("./routes/authRoutes");
const timetableRoutes = require("./routes/timetableRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Public home route
app.get("/", (req, res) => {
  res.json({
    message: "StudentHub API is running",
  });
});

// Authentication routes remain public so users can log in.
app.use("/api/auth", authRoutes);

// Protect all academic management routes.
// A valid JWT is required for every request to these endpoints.
app.use("/students", authenticateToken, studentRoutes);

app.use("/api/exams", authenticateToken, examRoutes);

app.use("/api/results", authenticateToken, resultRoutes);

app.use("/api/attendance", authenticateToken, attendanceRoutes);

app.use("/api/risk-alerts", authenticateToken, riskRoutes);

app.use("/api/timetable", authenticateToken, timetableRoutes);

app.use("/api/calendar", authenticateToken, calendarRoutes);

app.use("/api/analytics", authenticateToken, analyticsRoutes);

// Protected attendance route test
app.get("/api/attendance-test", authenticateToken, (req, res) => {
  res.json({
    message: "Attendance route registration test passed",
  });
});

// Handle unknown endpoints once, after registering all routes.
app.use((req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "Internal server error",
  });
});

// Connect to MongoDB and start the server.
async function startServer() {
  try {
    console.log("Checking application configuration...");

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error(
        "JWT_SECRET must be configured with at least 32 characters."
      );
    }

    const mongoURI =
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/collegeDB";

    console.log("Connecting to MongoDB...");

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  }
}

startServer();
