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

// Helper function to clean filename to ASCII
const cleanFileNameToAscii = (filename) => {
  if (!filename) return "file";

  // Get file extension
  const ext = path.extname(filename);

  // Remove extension from filename
  const nameWithoutExt = path.basename(filename, ext);

  // Convert to ASCII: remove accents, special characters, and normalize
  const cleanName = nameWithoutExt
    .normalize("NFD") // Normalize to decomposed form
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-zA-Z0-9\s_-]/g, "") // Remove special characters except spaces, underscores, and hyphens
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_+/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .toLowerCase(); // Convert to lowercase

  // If cleaning resulted in empty string, use default name
  const finalName = cleanName || "file";

  return finalName + ext;
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Clean the original filename to ASCII
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    const cleanedName = cleanFileNameToAscii(originalName);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // Use cleaned ASCII name for the saved file
    cb(null, uniqueSuffix + "-" + cleanedName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Ensure proper encoding handling
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    cb(null, true);
  },
});

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
