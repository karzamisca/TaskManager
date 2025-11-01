// routes/fileApprovalRoute.js
const express = require("express");
const router = express.Router();
const fileApprovalController = require("../controllers/fileApprovalController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads/pending");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
});

// Routes
router.get("/fileApproval", authMiddleware, (req, res) => {
  res.sendFile("fileApproval.html", {
    root: "./views/fileApprovalPages",
  });
});

// Add projects route
router.get("/fileApprovalControl/projects", fileApprovalController.getProjects);

router.post(
  "/fileApprovalControl/upload",
  upload.single("file"),
  fileApprovalController.uploadFile
);
router.get(
  "/fileApprovalControl/pending",
  fileApprovalController.getPendingFiles
);
router.get(
  "/fileApprovalControl/history",
  fileApprovalController.getFileHistory
);
router.get("/fileApprovalControl/:id", fileApprovalController.getFileById);
router.post(
  "/fileApprovalControl/:id/approve",
  fileApprovalController.approveFile
);
router.post(
  "/fileApprovalControl/:id/reject",
  fileApprovalController.rejectFile
);

module.exports = router;
