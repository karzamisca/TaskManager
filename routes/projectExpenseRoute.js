// routes/projectExpenseRoute.js
const express = require("express");
const projectExpenseController = require("../controllers/projectExpenseController");
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

router.get(
  "/projectExpense",
  authMiddleware,
  projectExpenseController.getFormAndProjectExpense
); // Serve HTML form and table
router.get(
  "/projectExpenseAll",
  authMiddleware,
  projectExpenseController.getAllProjectExpense
); // Serve all projectExpense as JSON

router.post(
  "/projectExpenseReceiveApprove/:id",
  authMiddleware,
  projectExpenseController.approveReceiveProjectExpense
);
router.post(
  "/projectExpenseNew",
  authMiddleware,
  projectExpenseController.createProjectExpense
); // Submit new projectExpense
router.delete(
  "/projectExpenseDelete/:id",
  authMiddleware,
  projectExpenseController.deleteProjectExpense
); // Delete projectExpense by ID
router.delete(
  "/projectExpenseDelete",
  authMiddleware,
  projectExpenseController.deleteMultipleProjectExpense
);

//For updating projectExpense
router.post(
  "/projectExpenseUpdate",
  authMiddleware,
  projectExpenseController.updateProjectExpense
);
router.get(
  "/projectExpenseTags",
  authMiddleware,
  projectExpenseController.getTags
);

// Export and Import routes
router.get(
  "/projectExpenseExport",
  authMiddleware,
  projectExpenseController.exportToExcel
); // Export projectExpense to Excel
router.post(
  "/projectExpenseImport",
  authMiddleware,
  upload.single("excelFile"),
  projectExpenseController.importFromExcel
); // Import projectExpense from Excel

module.exports = router;
