
const express = require("express");
const mongoose = require("mongoose");
const AcademicEvent = require("../models/AcademicEvent");
const Student = require("../models/Student");
const { allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

const CATEGORIES = [
  "Holiday",
  "Examination",
  "Assignment Deadline",
  "College Event",
  "Academic",
  "Other",
];

function isRealDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validateEvent(body) {
  if (typeof body.title !== "string" || !body.title.trim()) {
    return "Event title is required.";
  }

  if (!CATEGORIES.includes(body.category)) {
    return "Invalid event category.";
  }

  if (!isRealDate(body.startDate) || !isRealDate(body.endDate)) {
    return "Start and end dates must be valid YYYY-MM-DD dates.";
  }

  if (body.endDate < body.startDate) {
    return "End date cannot be before the start date.";
  }

  const allDay = body.allDay !== false;
  const startTime = body.startTime || "";
  const endTime = body.endTime || "";
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!allDay) {
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      return "Timed events require valid startTime and endTime values.";
    }

    if (body.startDate === body.endDate && startTime >= endTime) {
      return "End time must be later than start time for a one-day event.";
    }
  }

  return null;
}

// GET /api/calendar?startDate=2026-10-01&endDate=2026-10-31
router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    if (req.user.role === "Student") {
      if (!req.user.studentId ||
          !mongoose.isValidObjectId(req.user.studentId)) {
        return res.status(403).json({
          message: "Your account is not linked to a student record.",
        });
      }

      const student = await Student.findById(req.user.studentId)
        .select("course")
        .lean();

      if (!student?.course) {
        return res.status(403).json({
          message: "Your student course could not be determined.",
        });
      }

      filter.$or = [
        { course: "" },
        { course: student.course },
      ];
    } else if (req.query.course) {
      filter.course = req.query.course;
    }

    if (req.query.startDate || req.query.endDate) {
      if (
        (req.query.startDate && !isRealDate(req.query.startDate)) ||
        (req.query.endDate && !isRealDate(req.query.endDate))
      ) {
        return res.status(400).json({
          message: "Date filters must use valid YYYY-MM-DD dates.",
        });
      }

      const range = {};
      if (req.query.endDate) range.$lte = req.query.endDate;
      if (req.query.startDate) range.$gte = req.query.startDate;

      // Include events that overlap the requested date range.
      filter.startDate = {};
      if (req.query.endDate) {
        filter.startDate.$lte = req.query.endDate;
      }

      filter.endDate = {};
      if (req.query.startDate) {
        filter.endDate.$gte = req.query.startDate;
      }
    }

    const events = await AcademicEvent.find(filter)
      .sort({ startDate: 1, startTime: 1 })
      .lean();

    res.json(events);
  } catch (error) {
    next(error);
  }
});

// Admin-only creation
router.post("/", allowRoles("Admin"), async (req, res, next) => {
  try {
    const validationError = validateEvent(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = {
      title: req.body.title,
      description: req.body.description || "",
      category: req.body.category,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      allDay: req.body.allDay !== false,
      startTime: req.body.allDay === false ? req.body.startTime : "",
      endTime: req.body.allDay === false ? req.body.endTime : "",
      location: req.body.location || "",
      course: req.body.course || "",
    };

    const event = await AcademicEvent.create(payload);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// Admin-only update
router.put("/:id", allowRoles("Admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const existing = await AcademicEvent.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Academic event not found." });
    }

    const merged = { ...existing.toObject(), ...req.body };
    const validationError = validateEvent(merged);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const allowedFields = [
      "title", "description", "category", "startDate", "endDate",
      "allDay", "startTime", "endTime", "location", "course",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        existing[field] = req.body[field];
      }
    }

    if (existing.allDay) {
      existing.startTime = "";
      existing.endTime = "";
    }

    await existing.save();
    res.json(existing);
  } catch (error) {
    next(error);
  }
});

// Admin-only deletion
router.delete("/:id", allowRoles("Admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const deleted = await AcademicEvent.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Academic event not found." });
    }

    res.json({ message: "Academic event deleted successfully." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
