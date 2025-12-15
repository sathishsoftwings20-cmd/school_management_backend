// backend/server.js
const dotenv = require("dotenv");
dotenv.config(); // load .env first

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");

// Connect database (do it after dotenv so process.env is available)
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// safe require helper to show clearer errors when modules fail to load
function safeRequire(relPath) {
  try {
    const p = path.join(__dirname, relPath);
    console.log("Requiring", p);
    return require(p);
  } catch (err) {
    console.error(
      "Failed to require",
      relPath,
      "\n",
      err && err.stack ? err.stack : err
    );
    throw err;
  }
}

// require routes after dotenv.config()
app.use("/api/auth", safeRequire("./routes/auth.routes"));
app.use("/api/users", safeRequire("./routes/user.routes"));
app.use("/api/student-auth", require("./routes/studentAuth.routes"));

// enable staff routes when ready
app.use("/api/staff", safeRequire("./routes/staff.routes"));
app.use("/api/classes", safeRequire("./routes/class.routes"));
app.use("/api/student", safeRequire("./routes/student.routes"));
app.use("/api/attendance", safeRequire("./routes/attendance.routes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
