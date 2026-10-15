const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Excused"],
      required: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

attendanceSchema.index(
  { studentId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);