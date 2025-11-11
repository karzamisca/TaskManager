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

router.post(
  "/fileApprovalControl/upload",
  authMiddleware,
  upload.single("file"),
  fileApprovalController.uploadFile
);

// FIXED: Put specific routes BEFORE parameterized routes to avoid conflicts
router.get(
  "/fileApprovalControl/pending",
  authMiddleware,
  fileApprovalController.getPendingFiles
);

// NEW ROUTES FOR APPROVED FILES - MUST COME BEFORE :id ROUTE
router.get(
  "/fileApprovalControl/approved",
  authMiddleware,
  fileApprovalController.getApprovedFiles
);

router.get(
  "/fileApprovalControl/eligible-users",
  authMiddleware,
  fileApprovalController.getEligibleUsers
);

router.get(
  "/fileApprovalControl/history",
  authMiddleware,
  fileApprovalController.getFileHistory
);

// Get statistics
router.get(
  "/fileApprovalControl/categories/stats",
  authMiddleware,
  fileApprovalController.getCategoriesWithCounts
);

// Fixed routes without optional parameters
router.get(
  "/fileApprovalControl/category/:category",
  authMiddleware,
  fileApprovalController.getFilesByCategory
);

router.get(
  "/fileApprovalControl/category/:category/:status",
  authMiddleware,
  fileApprovalController.getFilesByCategory
);

// Get available years for a category
router.get(
  "/fileApprovalControl/category/:category/years",
  authMiddleware,
  fileApprovalController.getAvailableYears
);

// Get available months for a category and year
router.get(
  "/fileApprovalControl/category/:category/year/:year/months",
  authMiddleware,
  fileApprovalController.getAvailableMonths
);

// Get files by category, year, and month
router.get(
  "/fileApprovalControl/category/:category/year/:year/month/:month",
  authMiddleware,
  fileApprovalController.getFilesByCategoryYearMonth
);

router.get(
  "/fileApprovalControl/category/:category/year/:year/month/:month/:status",
  authMiddleware,
  fileApprovalController.getFilesByCategoryYearMonth
);

// PARAMETERIZED ROUTES MUST COME LAST
router.get(
  "/fileApprovalControl/:id",
  authMiddleware,
  fileApprovalController.getFileById
);

router.post(
  "/fileApprovalControl/:id/approve",
  authMiddleware,
  fileApprovalController.approveFile
);

router.post(
  "/fileApprovalControl/:id/reject",
  authMiddleware,
  fileApprovalController.rejectFile
);

router.post(
  "/fileApprovalControl/:fileId/permissions",
  authMiddleware,
  fileApprovalController.setFilePermissions
);

module.exports = router;
