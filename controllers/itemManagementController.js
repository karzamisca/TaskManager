// controllers/itemManagementController.js
const Item = require("../models/Item");

// Get all active items
exports.getAllItems = async (req, res) => {
  try {
    const items = await Item.find({ isDeleted: false })
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

// Get all items including deleted (for admin)
exports.getAllItemsWithDeleted = async (req, res) => {
  try {
    const items = await Item.find()
      .populate("createdBy", "username")
      .populate("deletedBy", "username")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error("Error fetching all items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

// Get single item with audit history
exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("createdBy", "username")
      .populate("auditHistory.editedBy", "username")
      .populate("deletedBy", "username");

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
};

// Create new item
exports.createItem = async (req, res) => {
  try {
    const { name, code, unitPrice } = req.body;

    // Check if code already exists (including deleted items)
    const existingItem = await Item.findOne({ code });
    if (existingItem && !existingItem.isDeleted) {
      return res.status(400).json({ error: "Item code already exists" });
    }

    const item = new Item({
      name,
      code,
      unitPrice: parseFloat(unitPrice),
      createdBy: req.user.id,
      auditHistory: [
        {
          newName: name,
          newCode: code,
          newUnitPrice: parseFloat(unitPrice),
          editedBy: req.user.id,
          action: "create",
        },
      ],
    });

    await item.save();

    // Populate the createdBy field before sending response
    await item.populate("createdBy", "username");
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
};

// Update item
exports.updateItem = async (req, res) => {
  try {
    const { name, code, unitPrice } = req.body;
    const itemId = req.params.id;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.isDeleted) {
      return res.status(400).json({ error: "Cannot update deleted item" });
    }

    // Check if new code conflicts with other active items
    if (code !== item.code) {
      const existingItem = await Item.findOne({
        code,
        isDeleted: false,
        _id: { $ne: itemId },
      });
      if (existingItem) {
        return res.status(400).json({ error: "Item code already exists" });
      }
    }

    // Create audit entry
    const auditEntry = {
      oldName: item.name,
      newName: name,
      oldCode: item.code,
      newCode: code,
      oldUnitPrice: item.unitPrice,
      newUnitPrice: parseFloat(unitPrice),
      editedBy: req.user.id,
      action: "update",
    };

    // Update item
    item.name = name;
    item.code = code;
    item.unitPrice = parseFloat(unitPrice);
    item.auditHistory.push(auditEntry);

    await item.save();

    // Populate fields before sending response
    await item.populate("createdBy", "username");
    await item.populate("auditHistory.editedBy", "username");

    res.json(item);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
};

// Soft delete item
exports.deleteItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.isDeleted) {
      return res.status(400).json({ error: "Item already deleted" });
    }

    // Create audit entry for deletion
    const auditEntry = {
      oldName: item.name,
      oldCode: item.code,
      oldUnitPrice: item.unitPrice,
      editedBy: req.user.id,
      action: "delete",
    };

    // Soft delete the item
    item.isDeleted = true;
    item.deletedAt = Date.now();
    item.deletedBy = req.user.id;
    item.auditHistory.push(auditEntry);

    await item.save();

    res.json({
      message: "Item deleted successfully",
      item: {
        id: item._id,
        name: item.name,
        code: item.code,
        deletedAt: item.deletedAt,
      },
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
};

// Restore deleted item
exports.restoreItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (!item.isDeleted) {
      return res.status(400).json({ error: "Item is not deleted" });
    }

    // Check if code conflicts with other active items
    const existingItem = await Item.findOne({
      code: item.code,
      isDeleted: false,
      _id: { $ne: itemId },
    });
    if (existingItem) {
      return res.status(400).json({
        error: `Cannot restore item. Code "${item.code}" is already in use by another active item.`,
      });
    }

    // Create audit entry for restoration
    const auditEntry = {
      newName: item.name,
      newCode: item.code,
      newUnitPrice: item.unitPrice,
      editedBy: req.user.id,
      action: "create", // Treating restore as a new creation
    };

    // Restore the item
    item.isDeleted = false;
    item.deletedAt = null;
    item.deletedBy = null;
    item.auditHistory.push(auditEntry);

    await item.save();

    res.json({
      message: "Item restored successfully",
      item: {
        id: item._id,
        name: item.name,
        code: item.code,
      },
    });
  } catch (error) {
    console.error("Error restoring item:", error);
    res.status(500).json({ error: "Failed to restore item" });
  }
};

// Get item audit history only
exports.getItemAuditHistory = async (req, res) => {
  try {
    const itemId = req.params.id;

    const item = await Item.findById(itemId)
      .populate("auditHistory.editedBy", "username")
      .select("auditHistory");

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item.auditHistory);
  } catch (error) {
    console.error("Error fetching audit history:", error);
    res.status(500).json({ error: "Failed to fetch audit history" });
  }
};
