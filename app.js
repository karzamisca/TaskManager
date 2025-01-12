//app.js
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoute = require("./routes/authRoute");
const documentRoute = require("./routes/documentRoute");
const authMiddleware = require("./middlewares/authMiddleware");
const entryRoute = require("./routes/entryRoute");
const googleDriveRoute = require("./routes/googleDriveRoute");
const messageRoute = require("./routes/messageRoute");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
require("dotenv").config();

// Create Express instance
const app = express();

// Initialize middleware before any async operations
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  express.static(path.join(__dirname, "views"), {
    maxAge: "2d", // Cache static files for 1 day
  })
);
app.use(cookieParser());

// Ensure uploads directory exists synchronously before server starts
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Preload routes
const routes = {
  auth: authRoute,
  googleDrive: googleDriveRoute,
  document: documentRoute,
  entry: entryRoute,
  message: messageRoute,
};

// Graceful shutdown handling
let server;
const gracefulShutdown = () => {
  console.log("Received kill signal, shutting down gracefully");
  server?.close(() => {
    console.log("Closed out remaining connections");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 30000);
};

// Async server initialization
async function startServer() {
  try {
    // Connect to database first
    await connectDB();
    console.log("Database connected successfully");

    // Mount routes after DB connection
    app.use("/", routes.auth);
    app.use("/", authMiddleware, routes.googleDrive);
    app.use("/", authMiddleware, routes.document);
    app.use("/", authMiddleware, routes.entry);
    app.use("/", authMiddleware, routes.message);

    // Error handling middleware
    app.use((err, req, res, next) => {
      if (
        err instanceof multer.MulterError ||
        err.message === "Invalid file type. Only Excel files are allowed."
      ) {
        return res.status(400).json({ error: err.message });
      }
      console.error(err.stack);
      res.status(500).json({ error: "Something broke!" });
    });

    // Start server only after all initialization is complete
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Enable keep-alive
    server.keepAliveTimeout = 65000; // Slightly higher than ALB's idle timeout
    server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

    // Handle shutdown signals
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start server with error handling
startServer().catch(console.error);

// Export for testing
module.exports = app;
