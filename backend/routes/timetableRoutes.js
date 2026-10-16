
const express = require("express");
const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");
const Student = require("../models/Student");
const { allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday",
];

const validTime = (value) =>
  typeof value === "string" &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function validateEntry(body) {
  const required = [
    "subject", "course", "dayOfWeek",
    "startTime", "endTime", "faculty", "room",
  ];

  for (const field of required) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return `${field} is required.`;
    }
  }

  if (!DAYS.includes(body.dayOfWeek)) {
    return "Invalid dayOfWeek.";
  }

  if (!validTime(body.startTime) || !validTime(body.endTime)) {
    return "Times must use HH:mm format.";
  }

  if (body.startTime >= body.endTime) {
    return "End time must be later than start time.";
  }

  return null;
}

async function getStudentCourse(req) {
  if (req.user.role !== "Student") return null;
  if (!req.user.studentId ||
      !mongoose.isValidObjectId(req.user.studentId)) {
    return "";
  }

  const student = await Student.findById(req.user.studentId)
    .select("course")
    .lean();

  return student?.course || "";
}

// GET /api/timetable?course=MCA&dayOfWeek=Monday
router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    if (req.user.role === "Student") {
      const course = await getStudentCourse(req);

      if (!course) {
        return res.status(403).json({
          message: "Your account is not linked to a valid student course.",
        });
      }

      // Students cannot override their course with a query parameter.
      filter.course = course;
    } else {
      if (req.query.course) filter.course = req.query.course;
      if (req.query.dayOfWeek) {
        if (!DAYS.includes(req.query.dayOfWeek)) {
          return res.status(400).json({ message: "Invalid dayOfWeek." });
        }
        filter.dayOfWeek = req.query.dayOfWeek;
      }
    }

    const entries = await Timetable.find(filter)
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    res.json(entries);
  } catch (error) {
    next(error);
  }
});

// Admin-only creation
router.post("/", allowRoles("Admin"), async (req, res, next) => {
  try {
    const validationError = validateEntry(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { dayOfWeek, startTime, endTime, room, faculty } = req.body;

    // Prevent overlapping classes in the same room or for the same faculty.
    const conflict = await Timetable.findOne({
      dayOfWeek,
      $or: [
        { room: { $regex: `^${room.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        { faculty: { $regex: `^${faculty.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      ],
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).lean();

    if (conflict) {
      return res.status(409).json({
        message: `Schedule conflict with "${conflict.subject}" (${conflict.startTime}-${conflict.endTime}), room ${conflict.room}.`,
      });
    }

    const entry = await Timetable.create(req.body);
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// Admin-only update
router.put("/:id", allowRoles("Admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid timetable ID." });
    }

    const existing = await Timetable.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Timetable entry not found." });
    }

    const merged = { ...existing.toObject(), ...req.body };
    const validationError = validateEntry(merged);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { dayOfWeek, startTime, endTime, room, faculty } = merged;
    const escapedRoom = room.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedFaculty = faculty.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const conflict = await Timetable.findOne({
      _id: { $ne: existing._id },
      dayOfWeek,
      $or: [
        { room: { $regex: `^${escapedRoom}$`, $options: "i" } },
        { faculty: { $regex: `^${escapedFaculty}$`, $options: "i" } },
      ],
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).lean();

    if (conflict) {
      return res.status(409).json({
        message: `Schedule conflict with "${conflict.subject}" (${conflict.startTime}-${conflict.endTime}).`,
      });
    }

    const allowedFields = [
      "subject", "course", "dayOfWeek", "startTime", "endTime",
      "faculty", "room", "semester", "academicYear", "notes",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) existing[field] = req.body[field];
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
      return res.status(400).json({ message: "Invalid timetable ID." });
    }

    const deleted = await Timetable.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Timetable entry not found." });
    }

    res.json({ message: "Timetable entry deleted successfully." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
