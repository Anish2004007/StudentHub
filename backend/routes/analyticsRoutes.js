
const express = require("express");
const mongoose = require("mongoose");

const Student = require("../models/Student");
const Result = require("../models/Result");
const Attendance = require("../models/Attendance");

const router = express.Router();

const getOwnStudentId = (req) =>
  req.user?.studentId ? String(req.user.studentId) : null;

router.get("/", async (req, res) => {
  try {
    const role = req.user?.role;

    if (!["Admin", "Faculty", "Student"].includes(role)) {
      return res.status(403).json({
        message: "You do not have permission to view analytics.",
      });
    }

    const isStudent = role === "Student";
    let ownStudentId = null;

    if (isStudent) {
      ownStudentId = getOwnStudentId(req);

      if (
        !ownStudentId ||
        !mongoose.isValidObjectId(ownStudentId)
      ) {
        return res.status(200).json({
          summary: {
            totalStudents: 0,
            averageMarks: 0,
            attendanceRate: 0,
            atRiskStudents: 0,
            passPercentage: 0,
            totalResults: 0,
          },
          courseDistribution: [],
          performanceByCourse: [],
          attendanceTrend: [],
          passFail: { pass: 0, fail: 0 },
        });
      }
    }

    const studentFilter = isStudent
      ? { _id: ownStudentId }
      : {};

    const resultFilter = isStudent
      ? { student: ownStudentId }
      : {};

    const attendanceFilter = isStudent
      ? { studentId: ownStudentId }
      : {};

    const [students, results, attendanceRecords] =
      await Promise.all([
        Student.find(studentFilter)
          .select("_id name course")
          .lean(),

        Result.find(resultFilter)
          .populate(
            "student",
            "name course"
          )
          .populate(
            "exam",
            "title course totalMarks passingMarks examDate"
          )
          .lean(),

        Attendance.find(attendanceFilter)
          .select("studentId date status")
          .sort({ date: 1 })
          .lean(),
      ]);

    const validResults = results.filter(
      (result) =>
        result.exam &&
        Number(result.exam.totalMarks) > 0
    );

    let totalPercentage = 0;
    let passCount = 0;
    let failCount = 0;

    const courseStats = new Map();
    const examStats = new Map();
    const dailyAttendance = new Map();

    for (const result of validResults) {
      const totalMarks = Number(result.exam.totalMarks);
      const marks = Number(result.marksObtained);
      const percentage = (marks / totalMarks) * 100;

      totalPercentage += percentage;

      const passingMarks = Number(
        result.exam.passingMarks ?? 0
      );

      if (marks >= passingMarks) {
        passCount++;
      } else {
        failCount++;
      }

      const course =
        result.exam.course ||
        result.student?.course ||
        "Unspecified";

      if (!courseStats.has(course)) {
        courseStats.set(course, {
          course,
          totalResults: 0,
          percentageTotal: 0,
          pass: 0,
          fail: 0,
        });
      }

      const courseStat = courseStats.get(course);
      courseStat.totalResults++;
      courseStat.percentageTotal += percentage;

      if (marks >= passingMarks) {
        courseStat.pass++;
      } else {
        courseStat.fail++;
      }

      const examKey = String(result.exam._id);

      if (!examStats.has(examKey)) {
        examStats.set(examKey, {
          exam: result.exam.title || "Untitled exam",
          course,
          percentageTotal: 0,
          totalResults: 0,
        });
      }

      const examStat = examStats.get(examKey);
      examStat.percentageTotal += percentage;
      examStat.totalResults++;
    }

    for (const stat of courseStats.values()) {
      stat.averagePercentage = Number(
        (stat.percentageTotal / stat.totalResults).toFixed(2)
      );
      delete stat.percentageTotal;
    }

    const performanceByCourse = [...courseStats.values()];

    const examPerformance = [...examStats.values()].map(
      (stat) => ({
        exam: stat.exam,
        course: stat.course,
        averagePercentage: Number(
          (stat.percentageTotal / stat.totalResults).toFixed(2)
        ),
        totalResults: stat.totalResults,
      })
    );

    const courseCounts = new Map();

    for (const student of students) {
      const course = student.course || "Unspecified";
      courseCounts.set(
        course,
        (courseCounts.get(course) || 0) + 1
      );
    }

    for (const record of attendanceRecords) {
      if (!dailyAttendance.has(record.date)) {
        dailyAttendance.set(record.date, {
          date: record.date,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        });
      }

      const day = dailyAttendance.get(record.date);

      if (record.status === "Present") day.present++;
      if (record.status === "Absent") day.absent++;
      if (record.status === "Late") day.late++;
      if (record.status === "Excused") day.excused++;
    }

    const eligibleAttendance = attendanceRecords.filter(
      (record) => record.status !== "Excused"
    );

    const attendedCount = eligibleAttendance.filter(
      (record) =>
        record.status === "Present" ||
        record.status === "Late"
    ).length;

    const attendanceRate =
      eligibleAttendance.length > 0
        ? Number(
            (
              (attendedCount / eligibleAttendance.length) *
              100
            ).toFixed(2)
          )
        : 0;

    // A student is flagged when their overall average
    // is below 40%, or their attendance rate is below 75%.
    // These are initial dashboard thresholds.
    const studentsWithResults = new Map();

    for (const result of validResults) {
      const studentId = String(result.student?._id || "");

      if (!studentId) continue;

      if (!studentsWithResults.has(studentId)) {
        studentsWithResults.set(studentId, {
          percentageTotal: 0,
          count: 0,
        });
      }

      const stat = studentsWithResults.get(studentId);

      stat.percentageTotal +=
        (Number(result.marksObtained) /
          Number(result.exam.totalMarks)) *
        100;

      stat.count++;
    }

    const attendanceByStudent = new Map();

    for (const record of attendanceRecords) {
      if (record.status === "Excused") continue;

      const studentId = String(record.studentId);

      if (!attendanceByStudent.has(studentId)) {
        attendanceByStudent.set(studentId, {
          eligible: 0,
          attended: 0,
        });
      }

      const stat = attendanceByStudent.get(studentId);
      stat.eligible++;

      if (
        record.status === "Present" ||
        record.status === "Late"
      ) {
        stat.attended++;
      }
    }

    let atRiskStudents = 0;

    if (!isStudent) {
      for (const student of students) {
        const studentId = String(student._id);
        const academic = studentsWithResults.get(studentId);
        const attendance = attendanceByStudent.get(studentId);

        const lowMarks =
          academic &&
          academic.count > 0 &&
          academic.percentageTotal / academic.count < 40;

        const lowAttendance =
          attendance &&
          attendance.eligible > 0 &&
          attendance.attended / attendance.eligible < 0.75;

        if (lowMarks || lowAttendance) {
          atRiskStudents++;
        }
      }
    } else {
      const academic = studentsWithResults.get(ownStudentId);
      const attendance = attendanceByStudent.get(ownStudentId);

      const lowMarks =
        academic &&
        academic.count > 0 &&
        academic.percentageTotal / academic.count < 40;

      const lowAttendance =
        attendance &&
        attendance.eligible > 0 &&
        attendance.attended / attendance.eligible < 0.75;

      if (lowMarks || lowAttendance) {
        atRiskStudents = 1;
      }
    }

    const summary = {
      totalStudents: students.length,
      averageMarks:
        validResults.length > 0
          ? Number(
              (totalPercentage / validResults.length).toFixed(2)
            )
          : 0,
      attendanceRate,
      atRiskStudents,
      passPercentage:
        validResults.length > 0
          ? Number(
              ((passCount / validResults.length) * 100).toFixed(2)
            )
          : 0,
      totalResults: validResults.length,
    };

    return res.status(200).json({
      summary,
      courseDistribution: isStudent
        ? []
        : [...courseCounts.entries()].map(
            ([course, count]) => ({ course, count })
          ),
      performanceByCourse,
      examPerformance,
      attendanceTrend: [...dailyAttendance.values()],
      passFail: {
        pass: passCount,
        fail: failCount,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);

    return res.status(500).json({
      message: "Failed to load academic analytics.",
    });
  }
});

module.exports = router;
