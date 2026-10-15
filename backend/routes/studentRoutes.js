
const express = require("express");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const upload = require("../middleware/uploadProfile");
const fs = require("fs");
const path = require("path");

const { allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Helpers
const isAdmin = (req) => req.user?.role === "Admin";

const getOwnStudentId = (req) => {
  return req.user?.studentId ? String(req.user.studentId) : null;
};

const canAccessStudent = (req, studentId) => {
  if (isAdmin(req) || req.user?.role === "Faculty") {
    return true;
  }

  return (
    req.user?.role === "Student" &&
    getOwnStudentId(req) === String(studentId)
  );
};

// GET: Fetch students
router.get("/", async (req, res) => {
  try {
    let students;

    if (isAdmin(req) || req.user?.role === "Faculty") {
      students = await Student.find().sort({ name: 1 });
    } else if (req.user?.role === "Student" && getOwnStudentId(req)) {
      const student = await Student.findById(getOwnStudentId(req));
      students = student ? [student] : [];
    } else if (req.user?.role === "Student") {
      students = [];
    } else {
      return res.status(403).json({
        message: "You do not have permission to view student records.",
      });
    }

    return res.status(200).json(students);
  } catch (error) {
    console.error("Fetch students error:", error);

    return res.status(500).json({
      message: "Failed to fetch students",
    });
  }
});

// GET: Fetch one student
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    if (!canAccessStudent(req, req.params.id)) {
      return res.status(403).json({
        message: "You do not have permission to access this student.",
      });
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json(student);
  } catch (error) {
    console.error("Fetch student error:", error);

    return res.status(500).json({
      message: "Failed to fetch student",
    });
  }
});

// POST: Create a student — Admin only
router.post("/", allowRoles("Admin"), async (req, res) => {
  try {
    const { name, email, course, age } = req.body;

    const student = await Student.create({
      name,
      email,
      course,
      age,
    });

    return res.status(201).json({
      message: "Student added successfully",
      student,
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

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A student with this information already exists.",
      });
    }

    console.error("Create student error:", error);

    return res.status(500).json({
      message: "Failed to create student",
    });
  }
});

// PUT: Update a student — Admin only
router.put("/:id", allowRoles("Admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    const { name, email, course, age } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (course !== undefined) updates.course = course;
    if (age !== undefined) updates.age = age;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student updated successfully",
      student,
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

    console.error("Update student error:", error);

    return res.status(500).json({
      message: "Failed to update student",
    });
  }
});

// DELETE: Delete a student — Admin only
router.delete("/:id", allowRoles("Admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    // Remove the associated profile picture, if present.
    if (student.profilePicture) {
      const filename = path.basename(student.profilePicture);
      const picturePath = path.join(
        __dirname,
        "..",
        "uploads",
        "profiles",
        filename
      );

      if (fs.existsSync(picturePath)) {
        try {
          fs.unlinkSync(picturePath);
        } catch (fileError) {
          console.error("Profile picture cleanup error:", fileError);
        }
      }
    }

    return res.status(200).json({
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return res.status(500).json({
      message: "Failed to delete student",
    });
  }
});

// Upload profile picture
// Admin can upload for any student; a student can upload only their own.
router.post(
  "/:id/profile-picture",
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid student ID",
        });
      }

      if (!canAccessStudent(req, req.params.id)) {
        return res.status(403).json({
          message: "You do not have permission to change this profile picture.",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select a profile picture",
        });
      }

      const student = await Student.findById(req.params.id);

      if (!student) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          message: "Student not found",
        });
      }

      if (student.profilePicture) {
        const oldFilename = path.basename(student.profilePicture);
        const oldPath = path.join(
          __dirname,
          "..",
          "uploads",
          "profiles",
          oldFilename
        );

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      student.profilePicture = `/uploads/profiles/${req.file.filename}`;

      await student.save();

      return res.status(200).json({
        message: "Profile picture uploaded successfully",
        student,
      });
    } catch (error) {
      console.error("Profile picture upload error:", error);

      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (fileError) {
          console.error("Uploaded file cleanup error:", fileError);
        }
      }

      return res.status(500).json({
        message: "Failed to upload profile picture",
      });
    }
  }
);

module.exports = router;
