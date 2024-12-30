// routes/googleDriveRoute.js
const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getFileAndFolder,
  uploadFile,
  downloadFile,
  getFiles,
  getRootFiles,
  deleteFile,
  createFolder,
  getFolders,
  deleteFolder,
  syncFiles,
  syncFolders,
  fetchAndSync,
} = require("../controllers/googleDriveController");

const router = express.Router();

// Set up multer to handle in-memory file uploads
const storage = multer.memoryStorage(); // Store file in memory (buffer)
const upload = multer({ storage: storage });

// Serve view
router.get("/googleDriveFileTransfer", authMiddleware, getFileAndFolder);

// File upload route
router.post(
  "/uploadGoogleDriveFile",
  authMiddleware,
  upload.single("file"),
  uploadFile
);

// File download route
router.get("/downloadGoogleDriveFile/:id", authMiddleware, downloadFile);

// File deletion route
router.delete("/deleteGoogleDriveFile/:id", authMiddleware, deleteFile);

// Get all files route
router.get("/googleDriveFile", authMiddleware, getFiles);
// Route to fetch root-level files
router.get("/googleDriveRootFile", authMiddleware, getRootFiles);

// Create folder route
router.post("/createGoogleDriveFolder", authMiddleware, createFolder);

// Get all folders route
router.get("/googleDriveFolders", authMiddleware, getFolders);

router.delete("/deleteGoogleDriveFolder/:id", authMiddleware, deleteFolder);

router.get("/sync-files", syncFiles);
router.get("/sync-folders", syncFolders);
router.get("/fetch-and-sync", fetchAndSync);

module.exports = router;
