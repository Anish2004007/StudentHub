
const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    course: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    faculty: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    room: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    semester: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },
    academicYear: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

timetableSchema.index({
  course: 1,
  dayOfWeek: 1,
  startTime: 1,
});

module.exports = mongoose.model("Timetable", timetableSchema);
