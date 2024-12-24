// routes/googleDriveRoute.js
const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  uploadFile,
  downloadFile,
  getFiles,
  getRootFiles,
  deleteFile,
  createFolder,
  getFolders,
  deleteFolder,
} = require("../controllers/googleDriveController");

const router = express.Router();

// Set up multer to handle in-memory file uploads
const storage = multer.memoryStorage(); // Store file in memory (buffer)
const upload = multer({ storage: storage });

// Serve index.html from the 'views' folder
router.get("/googleDriveFileTransfer", authMiddleware, (req, res) => {
  res.sendFile("googleDriveFileTransfer.html", {
    root: "./views/transfer/googleDrive",
  });
});

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

module.exports = router;
