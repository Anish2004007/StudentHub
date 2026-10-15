
const express = require("express");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");

const { allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

const VALID_STATUSES = ["Present", "Absent", "Late", "Excused"];

const isValidDate = (date) => {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const getOwnStudentId = (req) =>
  req.user?.studentId ? String(req.user.studentId) : null;

// GET /api/attendance?date=YYYY-MM-DD&studentId=...&status=Present
// Admin and Faculty can view all records.
// Students can view only their own records.
router.get("/", async (req, res) => {
  try {
    const { date, studentId, status } = req.query;
    const filter = {};

    if (date) {
      if (!isValidDate(date)) {
        return res.status(400).json({
          message: "Invalid date.",
        });
      }

      filter.date = date;
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid attendance status.",
        });
      }

      filter.status = status;
    }

    if (req.user?.role === "Student") {
      const ownStudentId = getOwnStudentId(req);

      if (!ownStudentId || !mongoose.isValidObjectId(ownStudentId)) {
        return res.status(200).json([]);
      }

      // Never trust the studentId supplied by the client.
      if (studentId && String(studentId) !== ownStudentId) {
        return res.status(403).json({
          message: "You can only view your own attendance.",
        });
      }

      filter.studentId = ownStudentId;
    } else if (["Admin", "Faculty"].includes(req.user?.role)) {
      if (studentId) {
        if (!mongoose.isValidObjectId(studentId)) {
          return res.status(400).json({
            message: "Invalid student ID.",
          });
        }

        filter.studentId = studentId;
      }
    } else {
      return res.status(403).json({
        message: "You do not have permission to view attendance.",
      });
    }

    const records = await Attendance.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(records);
  } catch (error) {
    console.error("Fetch attendance error:", error);

    return res.status(500).json({
      message: "Unable to fetch attendance.",
    });
  }
});

// POST /api/attendance/bulk
// Admin and Faculty can mark or update attendance in bulk.
router.post(
  "/bulk",
  allowRoles("Admin", "Faculty"),
  async (req, res) => {
    try {
      const { date, records } = req.body;

      if (!isValidDate(date)) {
        return res.status(400).json({
          message: "A valid date is required.",
        });
      }

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          message: "Provide at least one attendance record.",
        });
      }

      const seenStudentIds = new Set();
      const validatedRecords = [];

      for (const record of records) {
        if (!mongoose.isValidObjectId(record.studentId)) {
          return res.status(400).json({
            message: "One or more student IDs are invalid.",
          });
        }

        if (!VALID_STATUSES.includes(record.status)) {
          return res.status(400).json({
            message: "One or more attendance statuses are invalid.",
          });
        }

        const normalizedStudentId = String(record.studentId);

        if (seenStudentIds.has(normalizedStudentId)) {
          return res.status(400).json({
            message: "A student appears more than once in this request.",
          });
        }

        seenStudentIds.add(normalizedStudentId);

        if (
          record.remarks != null &&
          (typeof record.remarks !== "string" ||
            record.remarks.length > 300)
        ) {
          return res.status(400).json({
            message: "Remarks must be 300 characters or fewer.",
          });
        }

        validatedRecords.push({
          studentId: normalizedStudentId,
          status: record.status,
          remarks: (record.remarks || "").trim(),
        });
      }

      // Verify that every referenced student exists.
      const existingStudents = await Student.find({
        _id: {
          $in: validatedRecords.map((record) => record.studentId),
        },
      }).select("_id");

      const existingIds = new Set(
        existingStudents.map((student) => String(student._id))
      );

      if (validatedRecords.some((record) => !existingIds.has(record.studentId))) {
        return res.status(400).json({
          message: "One or more students do not exist.",
        });
      }

      const operations = validatedRecords.map((record) => ({
        updateOne: {
          filter: {
            studentId: record.studentId,
            date,
          },
          update: {
            $set: {
              status: record.status,
              remarks: record.remarks,
            },
          },
          upsert: true,
        },
      }));

      await Attendance.bulkWrite(operations, { ordered: true });

      const savedRecords = await Attendance.find({
        date,
        studentId: {
          $in: validatedRecords.map((record) => record.studentId),
        },
      })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        message: "Attendance saved successfully.",
        records: savedRecords,
      });
    } catch (error) {
      console.error("Save attendance error:", error);

      return res.status(500).json({
        message: "Unable to save attendance.",
      });
    }
  }
);

// PUT /api/attendance/:id
// Admin and Faculty can update attendance.
router.put(
  "/:id",
  allowRoles("Admin", "Faculty"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, remarks, date } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid attendance ID.",
        });
      }

      if (
        status !== undefined &&
        !VALID_STATUSES.includes(status)
      ) {
        return res.status(400).json({
          message: "Invalid attendance status.",
        });
      }

      if (date !== undefined && !isValidDate(date)) {
        return res.status(400).json({
          message: "Invalid date.",
        });
      }

      if (
        remarks !== undefined &&
        (typeof remarks !== "string" || remarks.length > 300)
      ) {
        return res.status(400).json({
          message: "Invalid remarks.",
        });
      }

      const update = {};

      if (status !== undefined) update.status = status;
      if (date !== undefined) update.date = date;

      if (remarks !== undefined) {
        update.remarks = remarks.trim();
      }

      const record = await Attendance.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true }
      );

      if (!record) {
        return res.status(404).json({
          message: "Attendance record not found.",
        });
      }

      return res.status(200).json({
        message: "Attendance updated successfully.",
        record,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "This student already has a record for that date.",
        });
      }

      console.error("Update attendance error:", error);

      return res.status(500).json({
        message: "Unable to update attendance.",
      });
    }
  }
);

// DELETE /api/attendance/:id
// Admin only
router.delete(
  "/:id",
  allowRoles("Admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid attendance ID.",
        });
      }

      const record = await Attendance.findByIdAndDelete(
        req.params.id
      );

      if (!record) {
        return res.status(404).json({
          message: "Attendance record not found.",
        });
      }

      return res.status(200).json({
        message: "Attendance record deleted successfully.",
      });
    } catch (error) {
      console.error("Delete attendance error:", error);

      return res.status(500).json({
        message: "Unable to delete attendance.",
      });
    }
  }
);

module.exports = router;
