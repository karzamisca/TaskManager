// routes/sftpRoutes.js
const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const sftpController = require("../controllers/sftpController");
const { sftpConfig } = require("../config/sftpConfig");
const router = express.Router();

// Configure multer for file uploads using the corrected config
const upload = multer(sftpConfig.upload);

router.get(
  "/sftpPurchasing",
  authMiddleware,
  sftpController.getSftpPurchasingViews
);
router.get(
  "/sftpTechnical",
  authMiddleware,
  sftpController.getSftpTechnicalViews
);
router.get(
  "/sftpAccounting",
  authMiddleware,
  sftpController.getSftpAccountingViews
);
router.get(
  "/sftpNorthernRepresentativeOffice",
  authMiddleware,
  sftpController.getSftpNorthernRepresentativeOfficeViews
);

// SFTP connection routes
router.post("/sftpConnect", authMiddleware, sftpController.connect);
router.post("/sftpDisconnect", authMiddleware, sftpController.disconnect);
router.get("/sftpStatus", authMiddleware, sftpController.getStatus);

// File operations routes
router.get("/sftpFiles", authMiddleware, sftpController.listFiles);
router.post("/sftpMkdir", authMiddleware, sftpController.createDirectory);

// Fixed upload route - ensure multer runs before auth middleware
router.post(
  "/sftpUpload",
  upload.array("files"),
  authMiddleware,
  sftpController.uploadFiles
);

router.post("/sftpDownload", authMiddleware, sftpController.downloadFile);
router.post("/sftpDelete", authMiddleware, sftpController.deleteFiles);
router.post("/sftpRename", authMiddleware, sftpController.renameFile);

//START OF SFTP PURCHASING DEPARTMENT ROUTE
router.get(
  "/sftpFilesForPurchasing",
  authMiddleware,
  sftpController.listFilesForPurchasing
);
router.post(
  "/sftpMkdirForPurchasing",
  authMiddleware,
  sftpController.createDirectoryForPurchasing
);
router.post(
  "/sftpUploadForPurchasing",
  upload.array("files"),
  authMiddleware,
  sftpController.uploadFilesForPurchasing
);
router.post(
  "/sftpDeleteForPurchasing",
  authMiddleware,
  sftpController.deleteFilesForPurchasing
);
router.post(
  "/sftpRenameForPurchasing",
  authMiddleware,
  sftpController.renameFileForPurchasing
);
// Add this to the SFTP Purchasing Department Route
router.post(
  "/sftpPasteForPurchasing",
  authMiddleware,
  sftpController.pasteFilesForPurchasing
);
//END OF SFTP PURCHASING DEPARTMENT ROUTE

//START OF SFTP TECHNICAL DEPARTMENT ROUTE
router.post(
  "/sftpDeleteForTechnical",
  authMiddleware,
  sftpController.deleteFilesForTechnical
);
router.post(
  "/sftpRenameForTechnical",
  authMiddleware,
  sftpController.renameFileForTechnical
);
//END OF SFTP TECHNICAL DEPARTMENT ROUTE

// Health check
router.get("/sftpHealth", authMiddleware, sftpController.getHealth);

module.exports = router;
