// routes/sftpRoutes.js
const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const sftpController = require("../controllers/sftpController");
const sftpConfig = require("../config/sftpConfig");
const router = express.Router();

// Configure multer for file uploads
const upload = multer(sftpConfig.upload);

router.get("/sftpMain", authMiddleware, sftpController.getSftpMainViews);
router.get(
  "/sftpPurchasing",
  authMiddleware,
  sftpController.getSftpPurchasingViews
);
// SFTP connection routes
router.post("/sftpConnect", authMiddleware, sftpController.connect);
router.post("/sftpDisconnect", authMiddleware, sftpController.disconnect);
router.get("/sftpStatus", authMiddleware, sftpController.getStatus);

// File operations routes
router.get("/sftpFiles", authMiddleware, sftpController.listFiles);
router.post("/sftpMkdir", authMiddleware, sftpController.createDirectory);
router.post(
  "/sftpUpload",
  upload.array("files"),
  authMiddleware,
  sftpController.uploadFiles
);
router.post("/sftpDownload", authMiddleware, sftpController.downloadFile);
router.post("/sftpDelete", authMiddleware, sftpController.deleteFiles);
router.post("/sftpRename", authMiddleware, sftpController.renameFile);

// Health check
router.get("/sftpHealth", authMiddleware, sftpController.getHealth);

module.exports = router;
