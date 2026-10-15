
require("dotenv").config();

const mongoose = require("mongoose");
const readline = require("readline");
const User = require("./models/User");
const Student = require("./models/Student");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

async function fixStudentAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const email = (await ask(
      "Enter the email used when creating the account: "
    )).trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user) {
      throw new Error("User account not found.");
    }

    if (user.role !== "Faculty") {
      throw new Error(
        `Expected Faculty role, but found ${user.role}. No changes made.`
      );
    }

    const student = await Student.findOne({ email });

    if (!student) {
      throw new Error(
        "No student record matches this email. No changes made."
      );
    }

    const linkedUser = await User.findOne({
      studentId: student._id,
      _id: { $ne: user._id },
    });

    if (linkedUser) {
      throw new Error(
        "This student already has another linked account. No changes made."
      );
    }

    user.role = "Student";
    user.studentId = student._id;

    await user.save();

    console.log("\nAccount corrected successfully!");
    console.log("Name:", user.name);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Student record linked:", student._id);
    console.log("\nYou can now log in using the Student role.");
  } catch (error) {
    console.error("\nCould not correct account:", error.message);
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

fixStudentAccount();

