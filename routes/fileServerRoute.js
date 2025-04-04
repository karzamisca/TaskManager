// routes/fileServerRoute.js
const express = require("express");
const router = express.Router();
const fileServerController = require("../controllers/fileServerController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/mainFileTransfer", authMiddleware, (req, res) => {
  res.sendFile("mainFileTransfer.html", { root: "./views/transfer" }); // Serve the template page
});

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

// Download a file or folder
router.get(
  "/fileServerDownload",
  authMiddleware,
  fileServerController.downloadFile
);

// Upload files
router.post("/fileServerUpload", fileServerController.uploadFile);

module.exports = router;
