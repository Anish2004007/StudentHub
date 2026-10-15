
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

async function listUsers() {
  await mongoose.connect(
    process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/collegeDB"
  );

  const users = await User.find()
    .select("name email role isActive")
    .lean();

  if (users.length === 0) {
    console.log("No user accounts found.");
  } else {
    console.log("Existing StudentHub accounts:");

    users.forEach((user) => {
      console.log({
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    });
  }
}

listUsers()
  .catch((error) => {
    console.error("Unable to list accounts:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
