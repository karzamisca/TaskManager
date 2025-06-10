// config/sftpConfig.js
const sftpController = require("../controllers/sftpController");

const sftpConfig = {
  connection: {
    host: process.env.FILE_SERVER_HOST,
    port: process.env.FILE_SERVER_PORT || 22,
    username: process.env.FILE_SERVER_USER,
    password: process.env.FILE_SERVER_PASS,
    readyTimeout: 30000,
  },
  upload: {
    dest: "uploads/",
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  },
  paths: {
    tempDir: "temp",
    uploadsDir: "uploads",
  },
};

async function initializeSFTP() {
  try {
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
