
const mongoose = require("mongoose");

const academicEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Holiday",
        "Examination",
        "Assignment Deadline",
        "College Event",
        "Academic",
        "Other",
      ],
    },
    startDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    endDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    allDay: {
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String,
      default: "",
      match: /^$|^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      default: "",
      match: /^$|^([01]\d|2[0-3]):[0-5]\d$/,
    },
    location: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },
    course: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
  },
  { timestamps: true }
);

academicEventSchema.index({ startDate: 1, endDate: 1, course: 1 });

module.exports = mongoose.model("AcademicEvent", academicEventSchema);
