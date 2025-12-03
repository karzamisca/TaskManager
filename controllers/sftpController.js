// controllers/sftpController.js
const fs = require("fs");
const path = require("path");
const { SFTPManager } = require("../utils/sftpService");
const { sftpConfig } = require("../config/sftpConfig"); // Fixed import

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

exports.getSftpAccountingViews = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "captainOfAccounting",
      "submitterOfAccounting",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("sftpAccounting.html", {
    root: "./views/sftpPages/sftpAccounting",
  });
};

exports.getSftpNorthernRepresentativeOfficeViews = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfNorthernRepresentativeOffice",
      "captainOfNorthernRepresentativeOffice",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("sftpNorthernRepresentativeOffice.html", {
    root: "./views/sftpPages/sftpNorthernRepresentativeOffice",
  });
};

const connectionMonitor = {
  isActive: false,
  checkInterval: 30000, // 30 seconds
  timer: null,
  start: function (sftpManager) {
    if (this.isActive) return;

    this.isActive = true;
    this.timer = setInterval(async () => {
      try {
        if (!sftpManager.isConnected()) {
          console.log(
            "Connection monitor: SFTP connection lost, attempting to reconnect..."
          );
          await sftpManager.connect(sftpConfig.connection);
        }
      } catch (error) {
        console.error("Connection monitor error:", error);
      }
    }, this.checkInterval);
  },
  stop: function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.isActive = false;
    }
  },
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
      return res.status(400).json({
        error: "SFTP server configuration missing in environment variables",
      });
    }

    // Start connection monitor if not already active
    if (!connectionMonitor.isActive) {
      connectionMonitor.start(sftpManager);
    }

    // If already connected, return current status
    if (sftpManager.isConnected()) {
      return res.json({
        status: "already_connected",
        config: {
          host: process.env.FILE_SERVER_HOST,
          port: process.env.FILE_SERVER_PORT || 22,
          username: process.env.FILE_SERVER_USER,
        },
      });
    }

    await sftpManager.connect(sftpConfig.connection);

    res.json({
      status: "connected",
      config: {
        host: process.env.FILE_SERVER_HOST,
        port: process.env.FILE_SERVER_PORT || 22,
        username: process.env.FILE_SERVER_USER,
      },
    });
  } catch (error) {
    console.error("Connection error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Disconnect from SFTP server
exports.disconnect = async function (req, res) {
  try {
    connectionMonitor.stop();
    await sftpManager.disconnect();
    res.json({ status: "disconnected" });
  } catch (error) {
    console.error("Disconnect error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add connection monitoring to all operations
function ensureConnected() {
  return new Promise(async (resolve, reject) => {
    if (sftpManager.isConnected()) {
      return resolve();
    }

    // Try to reconnect automatically
    try {
      await sftpManager.connect(sftpConfig.connection);
      resolve();
    } catch (error) {
      reject(new Error("Unable to establish SFTP connection"));
    }
  });
}

// List files in directory
exports.listFiles = async function (req, res) {
  try {
    await ensureConnected();

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

    // Validate that all files have the required properties
    const invalidFiles = files.filter(
      (file) => !file.path || !file.originalname
    );
    if (invalidFiles.length > 0) {
      console.error("Invalid files detected:", invalidFiles);
      return res.status(400).json({
        error: "Some files are missing required properties",
        details: invalidFiles.map((f) => ({
          filename: f.originalname,
          hasPath: !!f.path,
        })),
      });
    }

    const uploadPromises = files.map(async (file) => {
      const remoteFilePath = path.posix.join(remotePath, file.originalname);

      try {
        // Verify local file exists
        if (!fs.existsSync(file.path)) {
          throw new Error(`Local file not found: ${file.path}`);
        }

        await sftpManager.uploadFile(file.path, remoteFilePath);
        cleanupTempFile(file.path);
      } catch (error) {
        console.error(`Failed to upload ${file.originalname}:`, error);
        cleanupTempFile(file.path);
        throw new Error(
          `Failed to upload ${file.originalname}: ${error.message}`
        );
      }
    });

    await Promise.all(uploadPromises);
    res.json({ status: "success", uploaded: files.length });
  } catch (error) {
    console.error("Upload error:", error);
    // Cleanup any remaining temp files
    if (req.files) {
      req.files.forEach((file) => {
        if (file.path) {
          cleanupTempFile(file.path);
        }
      });
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

//START OF SFTP PURCHASING DEPARTMENT CONTROLLER
exports.getSftpPurchasingViews = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfPurchasing",
      "captainOfPurchasing",
      "headOfAccounting",
      "captainOfAccounting",
      "captainOfFinance",
      "submitterOfAccounting",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("sftpPurchasing.html", {
    root: "./views/sftpPages/sftpPurchasing",
  });
};

function isRestrictedPaymentUser(role) {
  return [
    "submitterOfAccounting",
    "captainOfAccounting",
    "headOfAccounting",
    "captainOfFinance",
  ].includes(role);
}

// Function to validate path access for restricted users
function validatePaymentUserPathAccess(userRole, requestedPath) {
  if (!isRestrictedPaymentUser(userRole)) {
    return true; // Not a restricted user, allow access
  }

  // Define allowed paths for payment users
  const allowedPaths = [
    "/purchasing", // Allow root purchasing folder for navigation
    "/purchasing/Hồ sơ nhập khẩu",
    "/purchasing/invoices",
    "/purchasing/receipts",
  ];

  // Check if requested path is exactly an allowed path or starts with an allowed path + /
  return allowedPaths.some(
    (allowedPath) =>
      requestedPath === allowedPath ||
      requestedPath.startsWith(allowedPath + "/")
  );
}

exports.listFilesForPurchasing = async function (req, res) {
  try {
    await ensureConnected();

    const remotePath = sanitizePath(req.query.path || "/");

    // Check if user is restricted payment user and path is allowed
    if (
      isRestrictedPaymentUser(req.user.role) &&
      !validatePaymentUserPathAccess(req.user.role, remotePath)
    ) {
      return res
        .status(403)
        .json({ error: "Access to this path is restricted for your role" });
    }

    let files = await sftpManager.listFiles(remotePath);

    // Filter out parent directory if we're at the root
    if (remotePath === "/") {
      files = files.filter((file) => file.name !== ".." && file.name !== ".");
    }

    // For payment users in /purchasing root, only show allowed subfolders
    if (
      isRestrictedPaymentUser(req.user.role) &&
      remotePath === "/purchasing"
    ) {
      const allowedSubfolders = ["Hồ sơ nhập khẩu", "invoices", "receipts"];
      files = files.filter(
        (file) =>
          file.type === "directory" && allowedSubfolders.includes(file.name)
      );
    }

    res.json(files);
  } catch (error) {
    console.error("List files error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.createDirectoryForPurchasing = async function (req, res) {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
        "captainOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
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

exports.uploadFilesForPurchasing = async function (req, res) {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
        "captainOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const remotePath = sanitizePath(req.body.path || "/");
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Validate that all files have the required properties
    const invalidFiles = files.filter(
      (file) => !file.path || !file.originalname
    );
    if (invalidFiles.length > 0) {
      console.error("Invalid files detected:", invalidFiles);
      return res.status(400).json({
        error: "Some files are missing required properties",
        details: invalidFiles.map((f) => ({
          filename: f.originalname,
          hasPath: !!f.path,
        })),
      });
    }

    const uploadPromises = files.map(async (file) => {
      const remoteFilePath = path.posix.join(remotePath, file.originalname);

      try {
        // Verify local file exists
        if (!fs.existsSync(file.path)) {
          throw new Error(`Local file not found: ${file.path}`);
        }

        await sftpManager.uploadFile(file.path, remoteFilePath);
        cleanupTempFile(file.path);
      } catch (error) {
        console.error(`Failed to upload ${file.originalname}:`, error);
        cleanupTempFile(file.path);
        throw new Error(
          `Failed to upload ${file.originalname}: ${error.message}`
        );
      }
    });

    await Promise.all(uploadPromises);
    res.json({ status: "success", uploaded: files.length });
  } catch (error) {
    console.error("Upload error:", error);
    // Cleanup any remaining temp files
    if (req.files) {
      req.files.forEach((file) => {
        if (file.path) {
          cleanupTempFile(file.path);
        }
      });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.deleteFilesForPurchasing = async function (req, res) {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
        "captainOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
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
exports.renameFileForPurchasing = async function (req, res) {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
        "captainOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
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
exports.pasteFilesForPurchasing = async function (req, res) {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
        "captainOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    if (!sftpManager.isConnected()) {
      return res.status(400).json({ error: "Not connected to SFTP server" });
    }

    const { sourcePath, targetPath, files, operation } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Files array is required" });
    }

    if (!operation || !["cut", "copy"].includes(operation)) {
      return res.status(400).json({ error: "Valid operation is required" });
    }

    const sanitizedSourcePath = sanitizePath(sourcePath || "/");
    const sanitizedTargetPath = sanitizePath(targetPath || "/");

    let pastedCount = 0;
    const results = [];

    for (const filename of files) {
      const sourceFile = path.posix.join(sanitizedSourcePath, filename);
      const targetFile = path.posix.join(sanitizedTargetPath, filename);

      try {
        if (operation === "copy") {
          await sftpManager.copy(sourceFile, targetFile);
        } else {
          // cut operation (move)
          await sftpManager.move(sourceFile, targetFile);
        }
        pastedCount++;
        results.push({
          name: filename,
          status: "success",
        });
      } catch (error) {
        console.error(`Failed to process ${filename}:`, error);
        results.push({
          name: filename,
          status: "error",
          message: error.message,
        });
      }
    }

    res.json({
      status: "completed",
      pasted: pastedCount,
      total: files.length,
      results,
    });
  } catch (error) {
    console.error("Paste error:", error);
    res.status(500).json({
      error: error.message,
      status: "failed",
    });
  }
};
//END OF SFTP PURCHASING DEPARTMENT CONTROLLER

//START OF SFTP TECHNICAL DEPARTMENT CONTROLLER
exports.getSftpTechnicalViews = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfTechnical",
      "captainOfTechnical",
      "submitterOfTechnical",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("sftpTechnical.html", {
    root: "./views/sftpPages/sftpTechnical",
  });
};

// Delete files/directories
exports.deleteFilesForTechnical = async function (req, res) {
  try {
    if (
      !["superAdmin", "director", "deputyDirector", "headOfTechnical"].includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
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
exports.renameFileForTechnical = async function (req, res) {
  try {
    if (
      !["superAdmin", "director", "deputyDirector", "headOfTechnical"].includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
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
//END OF SFTP TECHNICAL DEPARTMENT CONTROLLER

// Export the sftpManager and utility function for use in other modules
exports.sftpManager = sftpManager;
exports.ensureTempDir = ensureTempDir;
