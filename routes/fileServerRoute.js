const express = require("express");
const router = express.Router();
const fileServerController = require("../controllers/fileServerController");
const authMiddleware = require("../middlewares/authMiddleware");

// Serve HTML
router.get("/fileServer", authMiddleware, fileServerController.serveHTML);

// List files
router.get(
  "/fileServerManager",
  authMiddleware,
  fileServerController.listFiles
);

// Create folder
router.post(
  "/fileServerManager",
  authMiddleware,
  fileServerController.createFolder
);

// Delete file/folder
router.delete(
  "/fileServerManager",
  authMiddleware,
  fileServerController.deleteFile
);

// Download file
router.get(
  "/fileServerDownload",
  authMiddleware,
  fileServerController.downloadFile
);

module.exports = router;
