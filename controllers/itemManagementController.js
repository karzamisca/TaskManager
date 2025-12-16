// controllers/itemManagementController.js
const Item = require("../models/Item");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

// Get all active items with sorting
exports.getAllItems = async (req, res) => {
  try {
    const { sortBy = "name", sortOrder = "asc" } = req.query;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const items = await Item.find({ isDeleted: false })
      .populate("createdBy", "username")
      .sort(sortOptions);
    res.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

// Get all items including deleted (for admin) with sorting
exports.getAllItemsWithDeleted = async (req, res) => {
  try {
    const { sortBy = "name", sortOrder = "asc" } = req.query;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const items = await Item.find()
      .populate("createdBy", "username")
      .populate("deletedBy", "username")
      .sort(sortOptions);
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
    const { name, code, unit, unitPrice, vat = 0 } = req.body;

    // Check if code already exists (including deleted items)
    const existingItem = await Item.findOne({ code });
    if (existingItem && !existingItem.isDeleted) {
      return res.status(400).json({ error: "Item code already exists" });
    }

    // Calculate unitPriceAfterVAT
    const vatPercentage = parseFloat(vat);
    const unitPriceValue = parseFloat(unitPrice);
    const unitPriceAfterVAT = unitPriceValue * (1 + vatPercentage / 100);

    const item = new Item({
      name,
      code,
      unit: unit || "cái",
      unitPrice: unitPriceValue,
      vat: vatPercentage,
      unitPriceAfterVAT,
      createdBy: req.user.id,
      auditHistory: [
        {
          newName: name,
          newCode: code,
          newUnit: unit || "cái",
          newUnitPrice: unitPriceValue,
          newVAT: vatPercentage,
          newUnitPriceAfterVAT: unitPriceAfterVAT,
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
    const { name, code, unit, unitPrice, vat } = req.body;
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

    // Calculate new unitPriceAfterVAT
    const vatPercentage = vat !== undefined ? parseFloat(vat) : item.vat;
    const unitPriceValue = parseFloat(unitPrice);
    const unitPriceAfterVAT = unitPriceValue * (1 + vatPercentage / 100);

    // Create audit entry
    const auditEntry = {
      oldName: item.name,
      newName: name,
      oldCode: item.code,
      newCode: code,
      oldUnit: item.unit,
      newUnit: unit || item.unit,
      oldUnitPrice: item.unitPrice,
      newUnitPrice: unitPriceValue,
      oldVAT: item.vat,
      newVAT: vatPercentage,
      oldUnitPriceAfterVAT: item.unitPriceAfterVAT,
      newUnitPriceAfterVAT: unitPriceAfterVAT,
      editedBy: req.user.id,
      action: "update",
    };

    // Update item
    item.name = name;
    item.code = code;
    item.unit = unit || item.unit;
    item.unitPrice = unitPriceValue;
    item.vat = vatPercentage;
    item.unitPriceAfterVAT = unitPriceAfterVAT;
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
      oldUnit: item.unit,
      oldUnitPrice: item.unitPrice,
      oldVAT: item.vat,
      oldUnitPriceAfterVAT: item.unitPriceAfterVAT,
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
        unit: item.unit,
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
      newUnit: item.unit,
      newUnitPrice: item.unitPrice,
      newVAT: item.vat,
      newUnitPriceAfterVAT: item.unitPriceAfterVAT,
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
        unit: item.unit,
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

// Export items to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const { includeDeleted = false } = req.query;

    // Fetch items based on includeDeleted parameter
    let items;
    if (includeDeleted === "true") {
      items = await Item.find()
        .populate("createdBy", "username")
        .populate("deletedBy", "username");
    } else {
      items = await Item.find({ isDeleted: false }).populate(
        "createdBy",
        "username"
      );
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Danh sách mặt hàng");

    // Add header row with styling
    worksheet.columns = [
      { header: "Mã hàng", key: "code", width: 15 },
      { header: "Tên hàng", key: "name", width: 30 },
      { header: "Đơn vị", key: "unit", width: 10 },
      { header: "Đơn giá", key: "unitPrice", width: 15 },
      { header: "VAT (%)", key: "vat", width: 10 },
      { header: "Giá sau VAT", key: "unitPriceAfterVAT", width: 15 },
      { header: "Trạng thái", key: "status", width: 15 },
      { header: "Người tạo", key: "createdBy", width: 20 },
      { header: "Ngày tạo", key: "createdAt", width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Add data rows
    items.forEach((item) => {
      const row = worksheet.addRow({
        code: item.code,
        name: item.name,
        unit: item.unit || "cái",
        unitPrice: item.unitPrice,
        vat: item.vat,
        unitPriceAfterVAT: item.unitPriceAfterVAT,
        status: item.isDeleted ? "Đã xóa" : "Đang hoạt động",
        createdBy: item.createdBy?.username || "Không xác định",
        createdAt: new Date(item.createdAt).toLocaleString("vi-VN"),
      });

      // Apply currency formatting to price columns
      row.getCell("unitPrice").numFmt = "#,##0";
      row.getCell("unitPriceAfterVAT").numFmt = "#,##0";

      // Color coding for status
      if (item.isDeleted) {
        row.getCell("status").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFCDD2" },
        };
      } else {
        row.getCell("status").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC8E6C9" },
        };
      }
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = Math.max(column.width, column.header.length + 2);
    });

    // Set response headers for file download
    const fileName =
      includeDeleted === "true"
        ? `danh-sach-mat-hang-toan-bo_${
            new Date().toISOString().split("T")[0]
          }.xlsx`
        : `danh-sach-mat-hang-dang-hoat-dong_${
            new Date().toISOString().split("T")[0]
          }.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    res.status(500).json({ error: "Failed to export to Excel" });
  }
};

// Import items from Excel
exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không có file được tải lên" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet(1); // Get first worksheet
    if (!worksheet) {
      return res.status(400).json({ error: "File Excel không hợp lệ" });
    }

    const importResults = {
      success: 0,
      failed: 0,
      errors: [],
      skipped: 0,
      total: 0,
    };

    // Skip header row (row 1)
    let rowNumber = 2;
    while (worksheet.getRow(rowNumber).getCell(1).value) {
      const row = worksheet.getRow(rowNumber);
      importResults.total++;

      try {
        const code = row.getCell(1).value?.toString().trim();
        const name = row.getCell(2).value?.toString().trim();
        const unit = row.getCell(3).value?.toString().trim() || "cái";
        const unitPrice = parseFloat(row.getCell(4).value) || 0;
        const vat = parseFloat(row.getCell(5).value) || 0;
        const unitPriceAfterVAT = unitPrice * (1 + vat / 100);

        // Validate required fields
        if (!code || !name) {
          importResults.failed++;
          importResults.errors.push({
            row: rowNumber,
            code: code || "(trống)",
            error: "Thiếu mã hàng hoặc tên hàng",
          });
          rowNumber++;
          continue;
        }

        if (isNaN(unitPrice) || unitPrice < 0) {
          importResults.failed++;
          importResults.errors.push({
            row: rowNumber,
            code,
            error: "Đơn giá không hợp lệ",
          });
          rowNumber++;
          continue;
        }

        if (vat < 0 || vat > 100) {
          importResults.failed++;
          importResults.errors.push({
            row: rowNumber,
            code,
            error: "VAT phải nằm trong khoảng 0-100%",
          });
          rowNumber++;
          continue;
        }

        // Check if item with same code already exists and is active
        const existingItem = await Item.findOne({ code, isDeleted: false });
        if (existingItem) {
          importResults.skipped++;
          importResults.errors.push({
            row: rowNumber,
            code,
            error: `Mã hàng "${code}" đã tồn tại`,
          });
          rowNumber++;
          continue;
        }

        // Create new item
        const item = new Item({
          name,
          code,
          unit,
          unitPrice,
          vat,
          unitPriceAfterVAT,
          createdBy: req.user.id,
          auditHistory: [
            {
              newName: name,
              newCode: code,
              newUnit: unit,
              newUnitPrice: unitPrice,
              newVAT: vat,
              newUnitPriceAfterVAT: unitPriceAfterVAT,
              editedBy: req.user.id,
              action: "create",
              note: "Nhập từ Excel",
            },
          ],
        });

        await item.save();
        importResults.success++;
      } catch (error) {
        importResults.failed++;
        importResults.errors.push({
          row: rowNumber,
          code: row.getCell(1).value?.toString() || "(lỗi)",
          error: error.message || "Lỗi không xác định",
        });
      }

      rowNumber++;
    }

    // Generate summary Excel file with import results
    if (importResults.errors.length > 0) {
      const resultWorkbook = new ExcelJS.Workbook();
      const resultWorksheet = resultWorkbook.addWorksheet("Kết quả nhập file");

      // Add summary
      resultWorksheet.addRow(["Tổng kết nhập file Excel"]);
      resultWorksheet.addRow([]);
      resultWorksheet.addRow(["Tổng số dòng:", importResults.total]);
      resultWorksheet.addRow(["Thành công:", importResults.success]);
      resultWorksheet.addRow(["Thất bại:", importResults.failed]);
      resultWorksheet.addRow(["Đã bỏ qua:", importResults.skipped]);
      resultWorksheet.addRow([]);
      resultWorksheet.addRow(["Chi tiết lỗi:"]);

      // Add error headers
      resultWorksheet.addRow(["Dòng", "Mã hàng", "Lỗi"]);

      // Style headers
      resultWorksheet.getRow(9).font = { bold: true };
      resultWorksheet.getRow(9).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEBEE" },
      };

      // Add error details
      importResults.errors.forEach((error) => {
        resultWorksheet.addRow([error.row, error.code, error.error]);
      });

      // Auto-fit columns
      resultWorksheet.columns.forEach((column) => {
        column.width = Math.max(column.width || 0, 15);
      });

      const buffer = await resultWorkbook.xlsx.writeBuffer();

      res.json({
        message: "Nhập file hoàn tất",
        summary: importResults,
        errorFile: buffer.toString("base64"),
      });
    } else {
      res.json({
        message: "Nhập file thành công",
        summary: importResults,
      });
    }
  } catch (error) {
    console.error("Error importing from Excel:", error);
    res
      .status(500)
      .json({ error: "Failed to import from Excel: " + error.message });
  }
};

// Download template for import
exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mẫu nhập file");

    // Add headers with formatting
    worksheet.addRow([
      "Mã hàng*",
      "Tên hàng*",
      "Đơn vị",
      "Đơn giá*",
      "VAT (%)",
    ]);

    // Style the header row
    const headerRow = worksheet.getRow(10);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1976D2" },
    };

    // Style example rows
    for (let i = 11; i <= 14; i++) {
      const row = worksheet.getRow(i);
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      };
    }

    // Set column widths
    worksheet.columns = [
      { width: 15 },
      { width: 30 },
      { width: 10 },
      { width: 15 },
      { width: 10 },
    ];

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="mau-nhap-file-mat-hang.xlsx"'
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error downloading template:", error);
    res.status(500).json({ error: "Failed to download template" });
  }
};
