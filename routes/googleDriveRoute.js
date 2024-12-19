const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  uploadFile,
  downloadFile,
  getFiles,
  deleteFile,
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

router.post(
  "/uploadGoogleDriveFile",
  authMiddleware,
  upload.single("file"),
  uploadFile
);
router.get("/downloadGoogleDriveFile/:id", authMiddleware, downloadFile);
router.delete("/deleteGoogleDriveFile/:id", authMiddleware, deleteFile);
router.get("/googleDriveFile", authMiddleware, getFiles);

module.exports = router;
