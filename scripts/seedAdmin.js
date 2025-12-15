// scripts/seedAdmin.js
require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/user.model");

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({
      email: "superadmin@school.com",
    });
    if (existingAdmin) {
      console.log(
        "SuperAdmin already exists:",
        existingAdmin.userId || existingAdmin._id
      );
      process.exit(0);
    }

    const superAdmin = new User({
      fullName: "Super Admin",
      email: "superadmin@school.com",
      password: "SuperAdmin123",
      role: "SuperAdmin",
      createdBy: null,
    });

    await superAdmin.save();

    console.log("SuperAdmin created successfully");
    console.log("Email: superadmin@school.com");
    console.log("Password: SuperAdmin123");
    console.log("Generated userId:", superAdmin.userId); // will be e.g. USER0001
    process.exit(0);
  } catch (err) {
    console.error("Error creating SuperAdmin:", err);
    process.exit(1);
  }
};

seedAdmin();
