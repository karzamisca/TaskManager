//app.js
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoute = require("./routes/authRoute");
const documentRoute = require("./routes/documentRoute");
const groupRoute = require("./routes/groupRoute");
const authMiddleware = require("./middlewares/authMiddleware"); // JWT middleware
const entryRoute = require("./routes/entryRoute");
const googleDriveRoute = require("./routes/googleDriveRoute");
const fileServerRoute = require("./routes/fileServerRoute");
const messageRoute = require("./routes/messageRoute");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cron = require("node-cron");
const axios = require("axios");
require("dotenv").config();

const app = express();

// Database connection
connectDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser()); // Use cookie-parser to parse cookies
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Routes
app.use("/", authRoute);
app.use("/", authMiddleware, googleDriveRoute);
app.use("/", authMiddleware, fileServerRoute);
app.use("/", authMiddleware, documentRoute); // Apply JWT middleware to document routes
app.use("/", authMiddleware, groupRoute);
app.use("/", authMiddleware, entryRoute);
app.use("/", authMiddleware, messageRoute);

// Error handling for multer
app.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err.message === "Invalid file type. Only Excel files are allowed."
  ) {
    res.send(err.message);
  } else {
    next(err);
  }
});

// Cron job to ping the server every 5 minutes to keep it warm
cron.schedule("*/5 * * * *", async () => {
  try {
    const serverUrl =
      `https://kylongtask.azurewebsites.net/login` ||
      `http://localhost:${PORT}`;
    await axios.get(serverUrl);
    console.log("Server pinged to keep it warm");
  } catch (error) {
    console.error("Failed to ping server:", error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
