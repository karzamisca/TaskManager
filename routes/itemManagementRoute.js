// routes/itemManagementRoute.js
const express = require("express");
const router = express.Router();
const itemManagementController = require("../controllers/itemManagementController");
const authMiddleware = require("../middlewares/authMiddleware");

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

// Get all items including deleted)
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

module.exports = router;
