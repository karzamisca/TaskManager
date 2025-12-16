// routes/itemManagementRoute.js
const express = require("express");
const router = express.Router();
const itemManagementController = require("../controllers/itemManagementController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"), false);
    }
  },
});

// Item Main page
router.get("/itemMain", authMiddleware, (req, res) => {
  res.sendFile("/itemMain.html", {
    root: "./views/itemPages/itemMain",
  });
});

router.get("/itemManagement", authMiddleware, (req, res) => {
  res.sendFile("/itemManagement.html", {
    root: "./views/itemPages/itemManagement",
  });
});

// Get all active items
router.get(
  "/itemManagementControl",
  authMiddleware,
  itemManagementController.getAllItems
);

// Get all items including deleted
router.get(
  "/itemManagementControl/all",
  authMiddleware,
  itemManagementController.getAllItemsWithDeleted
);

// Create new item
router.post(
  "/itemManagementControl",
  authMiddleware,
  itemManagementController.createItem
);

// Get single item
router.get(
  "/itemManagementControl/:id",
  authMiddleware,
  itemManagementController.getItem
);

// Update item
router.put(
  "/itemManagementControl/:id",
  authMiddleware,
  itemManagementController.updateItem
);

// Soft delete item
router.delete(
  "/itemManagementControl/:id",
  authMiddleware,
  itemManagementController.deleteItem
);

// Restore deleted item
router.patch(
  "/itemManagementControl/:id/restore",
  authMiddleware,
  itemManagementController.restoreItem
);

// Get item audit history
router.get(
  "/itemManagementControl/:id/audit",
  authMiddleware,
  itemManagementController.getItemAuditHistory
);

// Export items to Excel
router.get(
  "/itemManagementControl/export/excel",
  authMiddleware,
  itemManagementController.exportToExcel
);

// Import items from Excel
router.post(
  "/itemManagementControl/import/excel",
  authMiddleware,
  upload.single("file"),
  itemManagementController.importFromExcel
);

// Download import template
router.get(
  "/itemManagementControl/template/excel",
  authMiddleware,
  itemManagementController.downloadTemplate
);

module.exports = router;
