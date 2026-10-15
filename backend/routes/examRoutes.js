
const express = require("express");
const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const { allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// GET: Fetch all exams — Admin, Faculty, Student
router.get("/", async (req, res) => {
  try {
    const exams = await Exam.find().sort({ examDate: 1 });

    return res.status(200).json(exams);
  } catch (error) {
    console.error("Fetch exams error:", error);

    return res.status(500).json({
      message: "Failed to fetch exams.",
    });
  }
});

// GET: Fetch a single exam — Admin, Faculty, Student
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid exam ID.",
      });
    }

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({
        message: "Exam not found.",
      });
    }

    return res.status(200).json(exam);
  } catch (error) {
    console.error("Fetch exam error:", error);

    return res.status(500).json({
      message: "Failed to fetch exam.",
    });
  }
});

// POST: Create an exam — Admin and Faculty
router.post(
  "/",
  allowRoles("Admin", "Faculty"),
  async (req, res) => {
    try {
      const totalMarks = Number(req.body.totalMarks);
      const passingMarks = Number(req.body.passingMarks);

      if (
        req.body.totalMarks === "" ||
        req.body.passingMarks === "" ||
        !Number.isFinite(totalMarks) ||
        !Number.isFinite(passingMarks) ||
        totalMarks < 1 ||
        passingMarks < 0 ||
        passingMarks > totalMarks
      ) {
        return res.status(400).json({
          message:
            "Passing marks must be between 0 and total marks.",
        });
      }

      const {
        title,
        course,
        semester,
        examType,
        examDate,
        duration,
        description,
      } = req.body;

      const exam = await Exam.create({
        title,
        course,
        semester,
        examType,
        examDate,
        duration,
        totalMarks,
        passingMarks,
        description,
      });

      return res.status(201).json({
        message: "Exam created successfully.",
        exam,
      });
    } catch (error) {
      if (
        error.name === "ValidationError" ||
        error.name === "CastError"
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      console.error("Create exam error:", error);

      return res.status(500).json({
        message: "Failed to create exam.",
      });
    }
  }
);

// PUT: Update an exam — Admin and Faculty
router.put(
  "/:id",
  allowRoles("Admin", "Faculty"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid exam ID.",
        });
      }

      const existingExam = await Exam.findById(id);

      if (!existingExam) {
        return res.status(404).json({
          message: "Exam not found.",
        });
      }

      // Combine existing exam data with submitted changes.
      const updatedData = {
        title: req.body.title ?? existingExam.title,
        course: req.body.course ?? existingExam.course,
        semester: req.body.semester ?? existingExam.semester,
        examType: req.body.examType ?? existingExam.examType,
        examDate: req.body.examDate ?? existingExam.examDate,
        duration: req.body.duration ?? existingExam.duration,
        totalMarks:
          req.body.totalMarks ?? existingExam.totalMarks,
        passingMarks:
          req.body.passingMarks ?? existingExam.passingMarks,
        description:
          req.body.description ?? existingExam.description,
      };

      const totalMarks = Number(updatedData.totalMarks);
      const passingMarks = Number(updatedData.passingMarks);

      if (
        updatedData.totalMarks === "" ||
        updatedData.passingMarks === "" ||
        !Number.isFinite(totalMarks) ||
        !Number.isFinite(passingMarks) ||
        totalMarks < 1 ||
        passingMarks < 0 ||
        passingMarks > totalMarks
      ) {
        return res.status(400).json({
          message:
            "Passing marks must be between 0 and total marks.",
        });
      }

      updatedData.totalMarks = totalMarks;
      updatedData.passingMarks = passingMarks;

      // Validate the complete updated document.
      const validationExam = new Exam({
        ...existingExam.toObject(),
        ...updatedData,
      });

      await validationExam.validate();

      const updatedExam = await Exam.findByIdAndUpdate(
        id,
        { $set: updatedData },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!updatedExam) {
        return res.status(404).json({
          message: "Exam not found.",
        });
      }

      return res.status(200).json({
        message: "Exam updated successfully.",
        exam: updatedExam,
      });
    } catch (error) {
      console.error("Update exam error:", error);

      if (
        error.name === "ValidationError" ||
        error.name === "CastError"
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.status(500).json({
        message: "Failed to update exam.",
      });
    }
  }
);

// DELETE: Delete an exam — Admin only
router.delete(
  "/:id",
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid exam ID.",
        });
      }

      const exam = await Exam.findByIdAndDelete(id);

      if (!exam) {
        return res.status(404).json({
          message: "Exam not found.",
        });
      }

      return res.status(200).json({
        message: "Exam deleted successfully.",
      });
    } catch (error) {
      console.error("Delete exam error:", error);

      return res.status(500).json({
        message: "Failed to delete exam.",
      });
    }
  }
);

module.exports = router;
