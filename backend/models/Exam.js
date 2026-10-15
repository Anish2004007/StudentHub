
const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Exam title is required"],
      trim: true,
    },

    course: {
      type: String,
      required: [true, "Course is required"],
      trim: true,
    },

    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: [1, "Semester must be at least 1"],
      max: [12, "Semester cannot exceed 12"],
    },

    examType: {
      type: String,
      required: [true, "Exam type is required"],
      enum: [
        "Internal",
        "Mid Semester",
        "End Semester",
        "Practical",
        "Supplementary",
      ],
    },

    examDate: {
      type: Date,
      required: [true, "Exam date is required"],
    },

    duration: {
      type: Number,
      required: [true, "Exam duration is required"],
      min: [1, "Duration must be greater than 0"],
    },

    totalMarks: {
      type: Number,
      required: [true, "Total marks are required"],
      min: [1, "Total marks must be greater than 0"],
    },

    passingMarks: {
      type: Number,
      required: [true, "Passing marks are required"],
      min: [0, "Passing marks cannot be negative"],
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Exam", examSchema);