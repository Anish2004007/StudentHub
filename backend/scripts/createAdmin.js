require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

async function createAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("Configure MONGODB_URI and JWT_SECRET in .env first.");
  }

  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running."
    );
  }

  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("Use an Admin password of at least 12 characters.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  await User.create({
    name: ADMIN_NAME.trim(),
    email,
    password: ADMIN_PASSWORD,
    role: "Admin",
  });

  console.log(`Admin account created successfully for ${email}.`);
}

createAdmin()
  .catch((error) => {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });