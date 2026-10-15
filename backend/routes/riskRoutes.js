
const express = require("express");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Result = require("../models/Result");

const router = express.Router();

// Initial configurable thresholds (not official academic rules).
const ATTENDANCE_THRESHOLD = 75;
const MARKS_THRESHOLD = 50;

// GET /api/risk-alerts
router.get("/", async (req, res) => {
  try {
    const isStudent = req.user.role === "Student";

    // Students can access only their own academic risk information.
    if (isStudent && !req.user.studentId) {
      return res.json({
        thresholds: {
          attendancePercentage: ATTENDANCE_THRESHOLD,
          averageMarksPercentage: MARKS_THRESHOLD,
        },
        summary: {
          totalStudents: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          insufficientData: 0,
        },
        alerts: [],
      });
    }

    const studentFilter = isStudent
      ? { _id: req.user.studentId }
      : {};

    const attendanceFilter = isStudent
      ? { studentId: req.user.studentId }
      : {};

    const resultFilter = isStudent
      ? { student: req.user.studentId }
      : {};

    const [students, attendanceRecords, results] =
      await Promise.all([
        Student.find(studentFilter).lean(),
        Attendance.find(attendanceFilter).lean(),
        Result.find(resultFilter)
          .populate("exam", "title totalMarks passingMarks")
          .lean(),
      ]);

    const attendanceByStudent = new Map();
    const resultsByStudent = new Map();

    // Group attendance records by student.
    for (const record of attendanceRecords) {
      const studentId = String(record.studentId);

      if (!attendanceByStudent.has(studentId)) {
        attendanceByStudent.set(studentId, []);
      }

      attendanceByStudent.get(studentId).push(record);
    }

    // Group exam results by student.
    for (const result of results) {
      const studentId = String(result.student);

      if (!resultsByStudent.has(studentId)) {
        resultsByStudent.set(studentId, []);
      }

      resultsByStudent.get(studentId).push(result);
    }

    const alerts = students.map((student) => {
      const studentId = String(student._id);

      const allAttendance =
        attendanceByStudent.get(studentId) || [];

      // Excused records are excluded from the attendance calculation.
      const eligibleAttendance = allAttendance.filter(
        (record) => record.status !== "Excused"
      );

      const attendedCount = eligibleAttendance.filter(
        (record) =>
          record.status === "Present" ||
          record.status === "Late"
      ).length;

      const attendancePercentage =
        eligibleAttendance.length > 0
          ? Number(
              (
                (attendedCount / eligibleAttendance.length) *
                100
              ).toFixed(2)
            )
          : null;

      const studentResults =
        resultsByStudent.get(studentId) || [];

      // Ignore results where exam or total marks are unavailable.
      const validResults = studentResults.filter(
        (result) =>
          result.exam &&
          Number(result.exam.totalMarks) > 0 &&
          Number.isFinite(Number(result.marksObtained))
      );

      const percentages = validResults.map(
        (result) =>
          (Number(result.marksObtained) /
            Number(result.exam.totalMarks)) *
          100
      );

      const averageMarks =
        percentages.length > 0
          ? Number(
              (
                percentages.reduce(
                  (sum, value) => sum + value,
                  0
                ) / percentages.length
              ).toFixed(2)
            )
          : null;

      const failedExams = validResults.filter(
        (result) =>
          Number(result.marksObtained) <
          Number(result.exam.passingMarks ?? 0)
      ).length;

      const reasons = [];
      const recommendations = [];

      if (
        attendancePercentage !== null &&
        attendancePercentage < ATTENDANCE_THRESHOLD
      ) {
        reasons.push(
          `Attendance is below ${ATTENDANCE_THRESHOLD}%.`
        );

        recommendations.push(
          "Discuss attendance barriers and create an attendance improvement plan."
        );
      }

      if (
        averageMarks !== null &&
        averageMarks < MARKS_THRESHOLD
      ) {
        reasons.push(
          `Average exam score is below ${MARKS_THRESHOLD}%.`
        );

        recommendations.push(
          "Offer subject revision, practice questions, and faculty support."
        );
      }

      if (failedExams > 0) {
        reasons.push(
          `${failedExams} exam result(s) are below the recorded passing marks.`
        );

        recommendations.push(
          "Review failed subjects and plan targeted remedial sessions."
        );
      }

      const hasAttendanceData = eligibleAttendance.length > 0;
      const hasResultData = validResults.length > 0;

      let riskLevel;

      if (!hasAttendanceData && !hasResultData) {
        riskLevel = "Insufficient data";

        recommendations.push(
          "Record attendance and exam results before assessing academic risk."
        );
      } else {
        const warningCount = [
          attendancePercentage !== null &&
            attendancePercentage < ATTENDANCE_THRESHOLD,
          averageMarks !== null &&
            averageMarks < MARKS_THRESHOLD,
          failedExams > 0,
        ].filter(Boolean).length;

        if (warningCount >= 2 || failedExams >= 2) {
          riskLevel = "High";
        } else if (warningCount === 1) {
          riskLevel = "Medium";
        } else {
          riskLevel = "Low";

          recommendations.push(
            "Continue regular monitoring and academic support."
          );
        }
      }

      return {
        studentId,
        name: student.name,
        email: student.email,
        course: student.course,
        attendancePercentage,
        attendanceRecords: eligibleAttendance.length,
        averageMarks,
        examsAttempted: validResults.length,
        failedExams,
        riskLevel,
        reasons,
        recommendations,
      };
    });

    const riskOrder = {
      High: 0,
      Medium: 1,
      "Insufficient data": 2,
      Low: 3,
    };

    alerts.sort(
      (a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
    );

    res.json({
      thresholds: {
        attendancePercentage: ATTENDANCE_THRESHOLD,
        averageMarksPercentage: MARKS_THRESHOLD,
      },
      summary: {
        totalStudents: alerts.length,
        highRisk: alerts.filter(
          (a) => a.riskLevel === "High"
        ).length,
        mediumRisk: alerts.filter(
          (a) => a.riskLevel === "Medium"
        ).length,
        lowRisk: alerts.filter(
          (a) => a.riskLevel === "Low"
        ).length,
        insufficientData: alerts.filter(
          (a) => a.riskLevel === "Insufficient data"
        ).length,
      },
      alerts,
    });
  } catch (error) {
    console.error("Risk alerts error:", error);

    res.status(500).json({
      message: "Unable to calculate student risk alerts.",
    });
  }
});

module.exports = router;
