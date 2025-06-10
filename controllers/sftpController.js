// controllers/sftpController.js
const fs = require("fs");
const path = require("path");
const { SFTPManager } = require("../utils/sftpService");
const sftpConfig = require("../config/sftpConfig");

// Initialize SFTP manager
const sftpManager = new SFTPManager();

// Utility functions
function ensureTempDir() {
  const tempDir = path.join(__dirname, "..", sftpConfig.paths.tempDir);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

function cleanupTempFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function sanitizePath(inputPath) {
  // Normalize path and prevent directory traversal
  let cleanPath = path.posix.normalize(inputPath);
  if (!cleanPath.startsWith("/")) {
    cleanPath = "/" + cleanPath;
  }
  return cleanPath;
}

exports.getSftpMainViews = (req, res) => {
  if (
    ![
      "approver",
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfMechanical",
      "headOfTechnical",
      "headOfAccounting",
      "headOfPurchasing",
      "headOfOperations",
      "headOfNorthernRepresentativeOffice",
      "captainOfMechanical",
      "captainOfTechnical",
      "captainOfPurchasing",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
  }
  res.sendFile("sftpMain.html", {
    root: "./views/sftpPages/sftpMain",
  });
};

exports.getSftpPurchasingViews = (req, res) => {
  if (
    ![
      "approver",
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfMechanical",
      "headOfTechnical",
      "headOfAccounting",
      "headOfPurchasing",
      "headOfOperations",
      "headOfNorthernRepresentativeOffice",
      "captainOfMechanical",
      "captainOfTechnical",
      "captainOfPurchasing",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
  }
  res.sendFile("sftpPurchasing.html", {
    root: "./views/sftpPages/sftpPurchasing",
  });
};

// Connect to SFTP server using environment variables
exports.connect = async function (req, res, next) {
  try {
    // Check if required environment variables are set
    if (
      !process.env.FILE_SERVER_HOST ||
      !process.env.FILE_SERVER_USER ||
      !process.env.FILE_SERVER_PASS
    ) {
      if (res.json) {
        return res.status(400).json({
          error: "SFTP server configuration missing in environment variables",
        });
      } else {
        throw new Error(
          "SFTP server configuration missing in environment variables"
        );
      }
    }

    // Disconnect existing connection if any
    if (sftpManager.isConnected()) {
      await sftpManager.disconnect();
    }

    await sftpManager.connect(sftpConfig.connection);

    if (res.json) {
      res.json({
        status: "connected",
        config: {
          host: process.env.FILE_SERVER_HOST,
          port: process.env.FILE_SERVER_PORT || 22,
          username: process.env.FILE_SERVER_USER,
        },
      });
    }
  } catch (error) {
    console.error("Connection error:", error);
    if (res.json) {
      res.status(500).json({ error: error.message });
    } else {
      throw error;
    }
  }
};

// Disconnect from SFTP server
exports.disconnect = async function (req, res) {
  try {
    await sftpManager.disconnect();
    res.json({ status: "disconnected" });
  } catch (error) {
    console.error("Disconnect error:", error);
    res.status(500).json({ error: error.message });
  }
};

// List files in directory
exports.listFiles = async function (req, res) {
  try {
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const remotePath = sanitizePath(req.query.path || "/");
    const files = await sftpManager.listFiles(remotePath);

    res.json(files);
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create directory
exports.createDirectory = async function (req, res) {
  try {
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const { path: parentPath, name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Directory name is required" });
    }

    const sanitizedParentPath = sanitizePath(parentPath || "/");
    const fullPath = path.posix.join(sanitizedParentPath, name);

    await sftpManager.createDirectory(fullPath);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Create directory error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Upload files
exports.uploadFiles = async function (req, res) {
  try {
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const remotePath = sanitizePath(req.body.path || "/");
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const uploadPromises = files.map(async (file) => {
      const remoteFilePath = path.posix.join(remotePath, file.originalname);

      try {
        await sftpManager.uploadFile(file.path, remoteFilePath);
        cleanupTempFile(file.path);
      } catch (error) {
        cleanupTempFile(file.path);
        throw error;
      }
    });

    await Promise.all(uploadPromises);
    res.json({ status: "success", uploaded: files.length });
  } catch (error) {
    console.error("Upload error:", error);
    // Cleanup any remaining temp files
    if (req.files) {
      req.files.forEach((file) => cleanupTempFile(file.path));
    }
    res.status(500).json({ error: error.message });
  }
};

// Download file
exports.downloadFile = async function (req, res) {
  try {
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const { path: remotePath, filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const sanitizedPath = sanitizePath(remotePath || "/");
    const fullRemotePath = path.posix.join(sanitizedPath, filename);

    // Create temporary file for download
    const tempDir = ensureTempDir();
    const tempFilePath = path.join(
      tempDir,
      `download_${Date.now()}_${filename}`
    );

    await sftpManager.downloadFile(fullRemotePath, tempFilePath);

    // Send file to client
    res.download(tempFilePath, filename, (err) => {
      // Cleanup temp file after download
      cleanupTempFile(tempFilePath);

      if (err) {
        console.error("Download send error:", err);
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete files/directories
exports.deleteFiles = async function (req, res) {
  try {
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const { path: remotePath, files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: "Files array is required" });
    }

    const sanitizedPath = sanitizePath(remotePath || "/");

    const deletePromises = files.map(async (filename) => {
      const fullPath = path.posix.join(sanitizedPath, filename);
      await sftpManager.deleteFile(fullPath);
    });

    await Promise.all(deletePromises);
    res.json({ status: "success", deleted: files.length });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Rename file/directory
exports.renameFile = async function (req, res) {
  try {
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const { path: remotePath, oldName, newName } = req.body;

    if (!oldName || !newName) {
      return res
        .status(400)
        .json({ error: "Both old and new names are required" });
    }

    const sanitizedPath = sanitizePath(remotePath || "/");
    const oldPath = path.posix.join(sanitizedPath, oldName);
    const newPath = path.posix.join(sanitizedPath, newName);

    await sftpManager.renameFile(oldPath, newPath);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Rename error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get connection status
exports.getStatus = function (req, res) {
  try {
    const statusInfo = sftpManager.getStatusInfo();

    // Only return plain objects, not the actual connection instances
    const response = {
      connected: statusInfo.connected,
      config: statusInfo.connected
        ? {
            host: process.env.FILE_SERVER_HOST,
            port: process.env.FILE_SERVER_PORT || 22,
            username: process.env.FILE_SERVER_USER,
          }
        : null,
      timestamp: new Date().toISOString(),
      reconnectAttempts: statusInfo.reconnectAttempts,
      maxReconnectAttempts: statusInfo.maxReconnectAttempts,
      autoReconnect: statusInfo.autoReconnect,
    };

    res.json(response);
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({
      error: "Failed to get status",
      connected: false,
      config: null,
    });
  }
};

// Health check
exports.getHealth = function (req, res) {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

// Cleanup method for graceful shutdown
exports.cleanup = async function () {
  if (sftpManager.isConnected()) {
    await sftpManager.disconnect();
  }

  // Cleanup temp directory
  const tempDir = path.join(__dirname, "..", sftpConfig.paths.tempDir);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

// Export the sftpManager and utility function for use in other modules
exports.sftpManager = sftpManager;
exports.ensureTempDir = ensureTempDir;
