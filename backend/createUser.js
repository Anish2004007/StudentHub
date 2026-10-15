
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

async function createUser() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from backend/.env");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("\nConnected to MongoDB.\n");

    console.log("1. Create Faculty account");
    console.log("2. Create Student account\n");

    const choice = (await ask("Choose account type (1 or 2): ")).trim();

    let role;
    let studentId = null;

    if (choice === "1") {
      role = "Faculty";
    } else if (choice === "2") {
      role = "Student";
    } else {
      throw new Error("Invalid choice.");
    }

    const email = (await ask("Enter account email: "))
      .trim()
      .toLowerCase();

    const name = (await ask("Enter account holder name: ")).trim();

    const password = await ask(
      "Enter a password (minimum 8 characters): "
    );

    if (!email || !name || password.length < 8) {
      throw new Error(
        "Name and email are required; password must be at least 8 characters."
      );
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error(
        "An account with this email already exists. No changes made."
      );
    }

    if (role === "Student") {
      const student = await Student.findOne({ email });

      if (!student) {
        throw new Error(
          "No student record has this email. Enter the email used in Student Management."
        );
      }

      const alreadyLinked = await User.findOne({
        studentId: student._id,
      });

      if (alreadyLinked) {
        throw new Error(
          "This student record already has a linked user account."
        );
      }

      studentId = student._id;
    }

    const user = new User({
      name,
      email,
      password,
      role,
      studentId,
    });

    await user.save();

    console.log("\nAccount created successfully!");
    console.log("Name:", user.name);
    console.log("Email:", user.email);
    console.log("Role:", user.role);

    if (user.studentId) {
      console.log("Linked student record:", user.studentId);
    }

    console.log(
      "\nYou can now log in using this email, the password you entered, and the matching role."
    );
  } catch (error) {
    console.error("\nCould not create account:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
}

createUser();
