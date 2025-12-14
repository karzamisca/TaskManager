const express = require("express");
const router = express.Router();
const itemManagementController = require("../controllers/itemManagementController");
const authMiddleware = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

router.get("/itemManagement",  (req, res) => {
  res.sendFile("/itemManagement.html", {
    root: "./views/itemPages/itemManagement",
  });
});

// Get all active items
router.get("/itemManagementControl", itemManagementController.getAllItems);

// Get all items including deleted)
router.get("/itemManagementControl/all", itemManagementController.getAllItemsWithDeleted);

// Create new item
router.post("/itemManagementControl", itemManagementController.createItem);

// Get single item
router.get("/itemManagementControl/:id", itemManagementController.getItem);

// Update item
router.put("/itemManagementControl/:id", itemManagementController.updateItem);

// Soft delete item
router.delete("/itemManagementControl/:id", itemManagementController.deleteItem);

// Restore deleted item
router.patch("/itemManagementControl/:id/restore", itemManagementController.restoreItem);

// Get item audit history
router.get("/itemManagementControl/:id/audit", itemManagementController.getItemAuditHistory);

module.exports = router;