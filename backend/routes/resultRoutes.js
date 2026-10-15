
const express = require("express");
const mongoose = require("mongoose");

const Result = require("../models/Result");
const Student = require("../models/Student");
const Exam = require("../models/Exam");

const { allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

const populateResult = (query) =>
  query
    .populate("student", "name email course")
    .populate(
      "exam",
      "title course semester totalMarks passingMarks examDate"
    );

const formatResult = (result) => {
  const totalMarks = result.exam?.totalMarks || 0;
  const passingMarks = result.exam?.passingMarks || 0;
  const marksObtained = result.marksObtained;

  return {
    ...result.toObject(),
    percentage:
      totalMarks > 0
        ? Number(((marksObtained / totalMarks) * 100).toFixed(2))
        : 0,
    status: marksObtained >= passingMarks ? "Pass" : "Fail",
  };
};

const getOwnStudentId = (req) =>
  req.user?.studentId ? String(req.user.studentId) : null;

// GET: Fetch results
// Admin and Faculty can view all results.
// Students can view only results linked to their own Student record.
router.get("/", async (req, res) => {
  try {
    let query = {};

    if (req.user?.role === "Student") {
      const studentId = getOwnStudentId(req);

      if (!studentId || !mongoose.isValidObjectId(studentId)) {
        return res.status(200).json([]);
      }

      query.student = studentId;
    } else if (
      !["Admin", "Faculty"].includes(req.user?.role)
    ) {
      return res.status(403).json({
        message: "You do not have permission to view results.",
      });
    }

    const results = await populateResult(
      Result.find(query).sort({ createdAt: -1 })
    );

    return res.status(200).json(results.map(formatResult));
  } catch (error) {
    console.error("Fetch results error:", error);

    return res.status(500).json({
      message: "Failed to fetch results.",
    });
  }
});

// GET: Fetch one result
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid result ID.",
      });
    }

    const result = await populateResult(Result.findById(id));

    if (!result) {
      return res.status(404).json({
        message: "Result not found.",
      });
    }

    if (req.user?.role === "Student") {
      const ownStudentId = getOwnStudentId(req);
      const resultStudentId = result.student?._id
        ? String(result.student._id)
        : "";

      if (!ownStudentId || ownStudentId !== resultStudentId) {
        return res.status(403).json({
          message: "You can only view your own results.",
        });
      }
    } else if (
      !["Admin", "Faculty"].includes(req.user?.role)
    ) {
      return res.status(403).json({
        message: "You do not have permission to view this result.",
      });
    }

    return res.status(200).json(formatResult(result));
  } catch (error) {
    console.error("Fetch result error:", error);

    return res.status(500).json({
      message: "Failed to fetch result.",
    });
  }
});

// POST: Create a result — Admin and Faculty
router.post(
  "/",
  allowRoles("Admin", "Faculty"),
  async (req, res) => {
    try {
      const { student, exam, marksObtained } = req.body;

      if (
        !mongoose.isValidObjectId(student) ||
        !mongoose.isValidObjectId(exam)
      ) {
        return res.status(400).json({
          message: "Please select a valid student and exam.",
        });
      }

      if (
        marksObtained === "" ||
        marksObtained === undefined ||
        !Number.isFinite(Number(marksObtained)) ||
        Number(marksObtained) < 0
      ) {
        return res.status(400).json({
          message:
            "Marks obtained must be a valid non-negative number.",
        });
      }

      const [studentExists, examExists] = await Promise.all([
        Student.findById(student),
        Exam.findById(exam),
      ]);

      if (!studentExists) {
        return res.status(404).json({
          message: "Student not found.",
        });
      }

      if (!examExists) {
        return res.status(404).json({
          message: "Exam not found.",
        });
      }

      const marks = Number(marksObtained);

      if (marks > examExists.totalMarks) {
        return res.status(400).json({
          message: `Marks obtained cannot exceed ${examExists.totalMarks}.`,
        });
      }

      const result = await Result.create({
        student,
        exam,
        marksObtained: marks,
      });

      const populatedResult = await populateResult(
        Result.findById(result._id)
      );

      return res.status(201).json({
        message: "Result added successfully.",
        result: formatResult(populatedResult),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message:
            "A result already exists for this student and exam.",
        });
      }

      if (
        error.name === "ValidationError" ||
        error.name === "CastError"
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      console.error("Create result error:", error);

      return res.status(500).json({
        message: "Failed to create result.",
      });
    }
  }
);

// PUT: Update a result — Admin and Faculty
router.put(
  "/:id",
  allowRoles("Admin", "Faculty"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid result ID.",
        });
      }

      const result = await Result.findById(id);

      if (!result) {
        return res.status(404).json({
          message: "Result not found.",
        });
      }

      const marksObtained = Number(req.body.marksObtained);

      if (
        req.body.marksObtained === "" ||
        req.body.marksObtained === undefined ||
        !Number.isFinite(marksObtained) ||
        marksObtained < 0
      ) {
        return res.status(400).json({
          message:
            "Marks obtained must be a valid non-negative number.",
        });
      }

      const studentId = req.body.student || String(result.student);
      const examId = req.body.exam || String(result.exam);

      if (
        !mongoose.isValidObjectId(studentId) ||
        !mongoose.isValidObjectId(examId)
      ) {
        return res.status(400).json({
          message: "Please select a valid student and exam.",
        });
      }

      const [studentExists, examExists] = await Promise.all([
        Student.findById(studentId),
        Exam.findById(examId),
      ]);

      if (!studentExists) {
        return res.status(404).json({
          message: "Student not found.",
        });
      }

      if (!examExists) {
        return res.status(404).json({
          message: "Exam not found.",
        });
      }

      if (marksObtained > examExists.totalMarks) {
        return res.status(400).json({
          message: `Marks obtained cannot exceed ${examExists.totalMarks}.`,
        });
      }

      result.student = studentId;
      result.exam = examId;
      result.marksObtained = marksObtained;

      await result.save();

      const populatedResult = await populateResult(
        Result.findById(result._id)
      );

      return res.status(200).json({
        message: "Result updated successfully.",
        result: formatResult(populatedResult),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message:
            "A result already exists for this student and exam.",
        });
      }

      if (
        error.name === "ValidationError" ||
        error.name === "CastError"
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      console.error("Update result error:", error);

      return res.status(500).json({
        message: "Failed to update result.",
      });
    }
  }
);

// DELETE: Delete a result — Admin only
router.delete(
  "/:id",
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid result ID.",
        });
      }

      const result = await Result.findByIdAndDelete(id);

      if (!result) {
        return res.status(404).json({
          message: "Result not found.",
        });
      }

      return res.status(200).json({
        message: "Result deleted successfully.",
      });
    } catch (error) {
      console.error("Delete result error:", error);

      return res.status(500).json({
        message: "Failed to delete result.",
      });
    }
  }
);

module.exports = router;
