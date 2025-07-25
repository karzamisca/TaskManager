// config/sftpConfig.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const sftpConfig = {
  connection: {
    host: process.env.FILE_SERVER_HOST,
    port: process.env.FILE_SERVER_PORT || 22,
    username: process.env.FILE_SERVER_USER,
    password: process.env.FILE_SERVER_PASS,
    readyTimeout: 30000,
  },
  upload: {
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadDir);
      },
      filename: function (req, file, cb) {
        // Ensure the original filename is properly decoded
        const originalName = Buffer.from(file.originalname, "latin1").toString(
          "utf8"
        );
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + originalName);
      },
    }),
    // Add file filter to handle encoding
    fileFilter: function (req, file, cb) {
      // Ensure proper encoding handling
      file.originalname = Buffer.from(file.originalname, "latin1").toString(
        "utf8"
      );
      cb(null, true);
    },
  },
  paths: {
    tempDir: "temp",
    uploadsDir: "uploads",
  },
};

async function initializeSFTP() {
  try {
    // Import here to avoid circular dependency
    const sftpController = require("../controllers/sftpController");

    // Get the sftpManager from the controller exports
    const sftpManager = sftpController.sftpManager;
    if (!sftpManager) {
      throw new Error("SFTP Manager not found in controller exports");
    }

    // Disconnect any existing connection
    if (sftpManager.isConnected()) {
      await sftpManager.disconnect();
    }

    // Connect using the configuration
    await sftpManager.connect(sftpConfig.connection);
    console.log("SFTP connection established successfully");
  } catch (error) {
    console.error(
      "Failed to establish SFTP connection on startup:",
      error.message
    );
    // Don't throw the error to prevent app from crashing
  }
}

module.exports = {
  sftpConfig,
  initializeSFTP,
};
