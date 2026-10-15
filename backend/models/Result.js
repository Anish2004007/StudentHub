
const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },

    marksObtained: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// A student can have only one result per exam.
resultSchema.index(
  { student: 1, exam: 1 },
  { unique: true }
);

module.exports = mongoose.model("Result", resultSchema);
