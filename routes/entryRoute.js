// routes/entryRoute.js
const express = require("express");
const entryController = require("../controllers/entryController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");
const path = require("path");
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Upload files to the 'uploads' directory
  },
  filename: function (req, file, cb) {
    // Use the original name
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// File filter to accept only Excel files
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Tập tin không hợp lệ. Chỉ cho phép các tệp Excel./Invalid file type. Only Excel files are allowed."
      ),
      false
    );
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

router.get("/entry", authMiddleware, entryController.getFormAndEntries); // Serve HTML form and table
router.get("/entryAll", authMiddleware, entryController.getAllEntries); // Serve all entries as JSON

router.post(
  "/entryReceiveApprove/:id",
  authMiddleware,
  entryController.approveReceiveEntry
);
router.post("/entryNew", authMiddleware, entryController.createEntry); // Submit new entry
router.delete("/entryDelete/:id", authMiddleware, entryController.deleteEntry); // Delete entry by ID
router.delete(
  "/entriesDelete",
  authMiddleware,
  entryController.deleteMultipleEntries
);

//For updating entry
router.post("/entryUpdate", authMiddleware, entryController.updateEntry);
router.get("/entryTags", authMiddleware, entryController.getTags);

// Export and Import routes
router.get("/entryExport", authMiddleware, entryController.exportToExcel); // Export entries to Excel
router.post(
  "/entryImport",
  authMiddleware,
  upload.single("excelFile"),
  entryController.importFromExcel
); // Import entries from Excel

module.exports = router;
