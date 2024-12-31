//app.js
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoute = require("./routes/authRoute");
const documentRoute = require("./routes/documentRoute");
const authMiddleware = require("./middlewares/authMiddleware"); // JWT middleware
const entryRoute = require("./routes/entryRoute");
const googleDriveRoute = require("./routes/googleDriveRoute");
const messageRoute = require("./routes/messageRoute");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");
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
app.use("/", authMiddleware, documentRoute); // Apply JWT middleware to document routes
app.use("/", authMiddleware, entryRoute);
app.use("/", authMiddleware, messageRoute);
app.use(
  cors({
    origin: "https://kylongtask.azurewebsites.net", // The WebView origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
