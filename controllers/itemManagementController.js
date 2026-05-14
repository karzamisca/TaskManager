// controllers/itemManagementController.js
const Item = require("../models/Item");
const ItemStock = require("../models/ItemStock");
const CostCenter = require("../models/CostCenter");
const Order = require("../models/ItemOrder");
const ExcelJS = require("exceljs");

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDateTime = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

/**
 * Given an array of items and a costCenterId, merge inStorage from ItemStock.
 * If costCenterId is omitted, inStorage is returned as null (not tracked globally).
 */
const mergeStockIntoItems = async (items, costCenterId) => {
  if (!costCenterId) {
    return items.map((item) => ({
      ...item.toObject(),
      inStorage: null,
      costCenterId: null,
    }));
  }

  const stocks = await ItemStock.find({
    costCenterId,
    itemId: { $in: items.map((i) => i._id) },
  }).lean();

  const stockMap = Object.fromEntries(
    stocks.map((s) => [s.itemId.toString(), s.inStorage]),
  );

  return items.map((item) => ({
    ...item.toObject(),
    inStorage: stockMap[item._id.toString()] ?? 0,
    costCenterId,
  }));
};

/**
 * Upsert stock for one item+costCenter and append a stockHistory entry.
 */
const upsertStock = async (
  itemId,
  costCenterId,
  newInStorage,
  userId,
  note = "",
) => {
  const existing = await ItemStock.findOne({ itemId, costCenterId });
  const oldInStorage = existing ? existing.inStorage : null;

  const historyEntry = {
    oldInStorage,
    newInStorage,
    updatedBy: userId,
    updatedAt: new Date(),
    note,
  };

  if (existing) {
    existing.inStorage = newInStorage;
    existing.updatedBy = userId;
    existing.updatedAt = new Date();
    existing.stockHistory.push(historyEntry);
    await existing.save();
    return existing;
  } else {
    const stock = new ItemStock({
      itemId,
      costCenterId,
      inStorage: newInStorage,
      updatedBy: userId,
      updatedAt: new Date(),
      stockHistory: [historyEntry],
    });
    await stock.save();
    return stock;
  }
};

// ─── Auth / View ─────────────────────────────────────────────────────────────

exports.getItemManagementViews = (req, res) => {
  const allowed = [
    "approver",
    "superAdmin",
    "director",
    "deputyDirector",
    "headOfPurchasing",
    "headOfNorthernRepresentativeOffice",
    "captainOfPurchasing",
  ];
  if (!allowed.includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("itemManagement.html", {
    root: "./views/itemPages/itemManagement",
  });
};

// ─── Cost Center list (for frontend dropdown) ────────────────────────────────

exports.getCostCenters = async (req, res) => {
  try {
    const costCenters = await CostCenter.find(
      {},
      "name category allowedUsers",
    ).lean();

    res.json(costCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.status(500).json({ error: "Failed to fetch cost centers" });
  }
};

// ─── Item CRUD ────────────────────────────────────────────────────────────────

/** GET /itemManagementControl?costCenterId=xxx&sortBy=name&sortOrder=asc */
exports.getAllItems = async (req, res) => {
  try {
    const { sortBy = "name", sortOrder = "asc", costCenterId } = req.query;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const items = await Item.find({ isDeleted: false })
      .populate("createdBy", "username")
      .sort(sortOptions);

    const result = await mergeStockIntoItems(items, costCenterId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

/** GET /itemManagementControl/all?costCenterId=xxx */
exports.getAllItemsWithDeleted = async (req, res) => {
  try {
    const { sortBy = "name", sortOrder = "asc", costCenterId } = req.query;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const items = await Item.find()
      .populate("createdBy", "username")
      .populate("deletedBy", "username")
      .sort(sortOptions);

    const result = await mergeStockIntoItems(items, costCenterId);
    res.json(result);
  } catch (error) {
    console.error("Error fetching all items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

/** GET /itemManagementControl/:id?costCenterId=xxx */
exports.getItem = async (req, res) => {
  try {
    const { costCenterId } = req.query;

    const item = await Item.findById(req.params.id)
      .populate("createdBy", "username")
      .populate("auditHistory.editedBy", "username")
      .populate("deletedBy", "username");

    if (!item) return res.status(404).json({ error: "Item not found" });

    const [merged] = await mergeStockIntoItems([item], costCenterId);
    res.json(merged);
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
};

/** POST /itemManagementControl  — body: { name, code, unit, unitPrice, vat, costCenterId?, inStorage? } */
exports.createItem = async (req, res) => {
  try {
    const {
      name,
      code,
      unit,
      unitPrice,
      vat = 0,
      costCenterId,
      inStorage = 0,
    } = req.body;

    // costCenterId is now optional
    let costCenter = null;
    if (costCenterId) {
      costCenter = await CostCenter.findById(costCenterId);
      if (!costCenter) {
        return res.status(404).json({ error: "Cost center not found" });
      }
    }

    const existing = await Item.findOne({ code, isDeleted: false });
    if (existing) {
      return res.status(400).json({ error: "Item code already exists" });
    }

    const vatPct = parseFloat(vat);
    const price = parseFloat(unitPrice);
    const priceAfterVAT = price * (1 + vatPct / 100);
    const inStorageValue = parseInt(inStorage) || 0;

    const item = new Item({
      name,
      code,
      unit: unit || "cái",
      unitPrice: price,
      vat: vatPct,
      unitPriceAfterVAT: priceAfterVAT,
      createdBy: req.user.id,
      auditHistory: [
        {
          newName: name,
          newCode: code,
          newUnit: unit || "cái",
          newUnitPrice: price,
          newVAT: vatPct,
          newUnitPriceAfterVAT: priceAfterVAT,
          editedBy: req.user.id,
          action: "create",
          note: costCenter
            ? `Tạo tại cost center: ${costCenter.name}`
            : "Tạo mặt hàng",
        },
      ],
    });

    await item.save();

    if (costCenterId && costCenter) {
      await upsertStock(
        item._id,
        costCenterId,
        inStorageValue,
        req.user.id,
        `Tạo mặt hàng tại ${costCenter.name}`,
      );
    }

    await item.populate("createdBy", "username");

    res.status(201).json({
      ...item.toObject(),
      inStorage: costCenterId ? inStorageValue : null,
      costCenterId: costCenterId || null,
    });
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
};

/** PUT /itemManagementControl/:id  — body: { name, code, unit, unitPrice, vat, costCenterId?, inStorage? } */
exports.updateItem = async (req, res) => {
  try {
    const { name, code, unit, unitPrice, vat, costCenterId, inStorage } =
      req.body;
    const itemId = req.params.id;

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.isDeleted)
      return res.status(400).json({ error: "Cannot update deleted item" });

    if (code !== item.code) {
      const conflict = await Item.findOne({
        code,
        isDeleted: false,
        _id: { $ne: itemId },
      });
      if (conflict)
        return res.status(400).json({ error: "Item code already exists" });
    }

    let costCenterName = costCenterId || "";
    if (costCenterId) {
      const costCenter = await CostCenter.findById(costCenterId).lean();
      costCenterName = costCenter ? costCenter.name : costCenterId;
    }

    const vatPct = vat !== undefined ? parseFloat(vat) : item.vat;
    const price = parseFloat(unitPrice);
    const priceAfterVAT = price * (1 + vatPct / 100);

    const currentStock = costCenterId
      ? await ItemStock.findOne({ itemId, costCenterId })
      : null;
    const oldInStorage = currentStock ? currentStock.inStorage : 0;
    const newInStorage =
      inStorage !== undefined ? parseInt(inStorage) : oldInStorage;

    const auditEntry = {
      oldName: item.name,
      newName: name,
      oldCode: item.code,
      newCode: code,
      oldUnit: item.unit,
      newUnit: unit || item.unit,
      oldUnitPrice: item.unitPrice,
      newUnitPrice: price,
      oldVAT: item.vat,
      newVAT: vatPct,
      oldUnitPriceAfterVAT: item.unitPriceAfterVAT,
      newUnitPriceAfterVAT: priceAfterVAT,
      editedBy: req.user.id,
      action: "update",
      note: costCenterId
        ? `Cập nhật tại cost center: ${costCenterName}, tồn kho: ${oldInStorage} → ${newInStorage}`
        : "Cập nhật mặt hàng",
    };

    // Capture old name BEFORE mutation
    const oldName = item.name;

    item.name = name;
    item.code = code;
    item.unit = unit || item.unit;
    item.unitPrice = price;
    item.vat = vatPct;
    item.unitPriceAfterVAT = priceAfterVAT;
    item.auditHistory.push(auditEntry);
    await item.save();

    if (costCenterId) {
      await upsertStock(
        itemId,
        costCenterId,
        newInStorage,
        req.user.id,
        `Cập nhật mặt hàng tại ${costCenterName}`,
      );
    }

    // ── Sync orders ──
    let ordersUpdated = 0;
    try {
      const pendingOrders = await Order.find({
        status: "pending",
        "items.itemId": itemId,
      });

      for (const order of pendingOrders) {
        let changed = false;
        order.items = order.items.map((oi) => {
          if (oi.itemId.toString() !== itemId) return oi;
          changed = true;
          const qty = oi.quantity;
          return {
            ...oi.toObject(),
            itemName: name,
            itemCode: code,
            unit: unit || oi.unit,
            unitPrice: price,
            vat: vatPct,
            unitPriceAfterVAT: priceAfterVAT,
            totalPrice: price * qty,
            totalPriceAfterVAT: priceAfterVAT * qty,
          };
        });

        if (changed) {
          order.totalAmount = order.items.reduce((s, i) => s + i.totalPrice, 0);
          order.totalAmountAfterVAT = order.items.reduce(
            (s, i) => s + i.totalPriceAfterVAT,
            0,
          );
          order.formattedUpdatedAt = formatDateTime(new Date());
          order.updatedAt = new Date();
          await order.save();
          ordersUpdated++;
        }
      }
    } catch (err) {
      console.error("Error updating orders:", err);
    }

    // ── Sync name to all document types ──
    const syncResult = {
      purchasingDocsUpdated: 0,
      deliveryDocsUpdated: 0,
      receiptDocsUpdated: 0,
      paymentDocsUpdated: 0,
      advancePaymentDocsUpdated: 0,
      advancePaymentReclaimDocsUpdated: 0,
    };

    if (oldName !== name) {
      try {
        const DocumentPurchasing = require("../models/DocumentPurchasing");
        const DocumentDelivery = require("../models/DocumentDelivery");
        const DocumentReceipt = require("../models/DocumentReceipt");
        const DocumentPayment = require("../models/DocumentPayment");
        const DocumentAdvancePayment = require("../models/DocumentAdvancePayment");
        const DocumentAdvancePaymentReclaim = require("../models/DocumentAdvancePaymentReclaim");

        const arrayFilterUpdate = {
          $set: { "products.$[elem].productName": name },
        };
        const arrayFilterOptions = {
          arrayFilters: [{ "elem.productName": oldName }],
        };
        const productNameQuery = { "products.productName": oldName };

        // ── Direct products[] array — single updateMany each ──
        const [purchasingResult, deliveryResult, receiptResult] =
          await Promise.all([
            DocumentPurchasing.updateMany(
              productNameQuery,
              arrayFilterUpdate,
              arrayFilterOptions,
            ),
            DocumentDelivery.updateMany(
              productNameQuery,
              arrayFilterUpdate,
              arrayFilterOptions,
            ),
            DocumentReceipt.updateMany(
              productNameQuery,
              arrayFilterUpdate,
              arrayFilterOptions,
            ),
          ]);

        syncResult.purchasingDocsUpdated = purchasingResult.modifiedCount;
        syncResult.deliveryDocsUpdated = deliveryResult.modifiedCount;
        syncResult.receiptDocsUpdated = receiptResult.modifiedCount;

        // ── appendedPurchasingDocuments (Mixed) — must load, mutate, markModified, save ──
        // Helper: mutate appendedPurchasingDocuments in-place, return whether anything changed
        const mutateMixedAppended = (doc) => {
          let changed = false;
          doc.appendedPurchasingDocuments = doc.appendedPurchasingDocuments.map(
            (purchDoc) => {
              if (!Array.isArray(purchDoc.products)) return purchDoc;
              const updatedProducts = purchDoc.products.map((p) => {
                if (p.productName === oldName) {
                  changed = true;
                  return { ...p, productName: name };
                }
                return p;
              });
              return { ...purchDoc, products: updatedProducts };
            },
          );
          return changed;
        };

        const mixedQuery = {
          "appendedPurchasingDocuments.products.productName": oldName,
        };

        const [paymentDocs, advancePaymentDocs, advancePaymentReclaimDocs] =
          await Promise.all([
            DocumentPayment.find(mixedQuery),
            DocumentAdvancePayment.find(mixedQuery),
            DocumentAdvancePaymentReclaim.find(mixedQuery),
          ]);

        const saveMixedDocs = async (docs, countKey) => {
          for (const doc of docs) {
            const changed = mutateMixedAppended(doc);
            if (changed) {
              doc.markModified("appendedPurchasingDocuments");
              await doc.save();
              syncResult[countKey]++;
            }
          }
        };

        await Promise.all([
          saveMixedDocs(paymentDocs, "paymentDocsUpdated"),
          saveMixedDocs(advancePaymentDocs, "advancePaymentDocsUpdated"),
          saveMixedDocs(
            advancePaymentReclaimDocs,
            "advancePaymentReclaimDocsUpdated",
          ),
        ]);
      } catch (err) {
        console.error("Error syncing item name to documents:", err);
      }
    }

    await item.populate("createdBy", "username");
    await item.populate("auditHistory.editedBy", "username");

    res.json({
      ...item.toObject(),
      inStorage: costCenterId ? newInStorage : null,
      costCenterId: costCenterId || null,
      ordersUpdated,
      ...syncResult,
    });
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
};

/** PATCH /itemManagementControl/:id/stock  — update stock for one cost center only */
exports.updateStock = async (req, res) => {
  try {
    const { costCenterId, inStorage } = req.body;
    const itemId = req.params.id;

    if (!costCenterId)
      return res.status(400).json({ error: "costCenterId is required" });
    if (inStorage === undefined)
      return res.status(400).json({ error: "inStorage is required" });

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.isDeleted)
      return res.status(400).json({ error: "Item is deleted" });

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter)
      return res.status(404).json({ error: "Cost center not found" });

    const stock = await upsertStock(
      itemId,
      costCenterId,
      parseInt(inStorage),
      req.user.id,
      "Cập nhật tồn kho thủ công",
    );

    res.json({ itemId, costCenterId, inStorage: stock.inStorage });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(500).json({ error: "Failed to update stock" });
  }
};

/** GET /itemManagementControl/:id/stock  — get stock across all cost centers */
exports.getItemStockByCostCenter = async (req, res) => {
  try {
    const stocks = await ItemStock.find({ itemId: req.params.id })
      .populate("costCenterId", "name category")
      .populate("updatedBy", "username")
      .lean();

    res.json(stocks);
  } catch (error) {
    console.error("Error fetching item stock:", error);
    res.status(500).json({ error: "Failed to fetch item stock" });
  }
};

/** GET /itemManagementControl/:id/stock/history?costCenterId=xxx */
exports.getItemStockHistory = async (req, res) => {
  try {
    const { costCenterId } = req.query;
    if (!costCenterId)
      return res.status(400).json({ error: "costCenterId is required" });

    const stock = await ItemStock.findOne({
      itemId: req.params.id,
      costCenterId,
    })
      .populate("stockHistory.updatedBy", "username")
      .lean();

    if (!stock) return res.json([]);

    // Return newest first
    res.json(stock.stockHistory.slice().reverse());
  } catch (error) {
    console.error("Error fetching stock history:", error);
    res.status(500).json({ error: "Failed to fetch stock history" });
  }
};

/** DELETE /itemManagementControl/:id */
exports.deleteItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await Item.findById(itemId);

    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.isDeleted)
      return res.status(400).json({ error: "Item already deleted" });

    const pendingOrders = await Order.find({
      status: "pending",
      "items.itemId": itemId,
    });
    if (pendingOrders.length > 0) {
      return res.status(400).json({
        error: `Cannot delete item. It exists in ${pendingOrders.length} pending order(s).`,
        pendingOrdersCount: pendingOrders.length,
      });
    }

    item.isDeleted = true;
    item.deletedAt = Date.now();
    item.deletedBy = req.user.id;
    item.auditHistory.push({
      oldName: item.name,
      oldCode: item.code,
      oldUnit: item.unit,
      oldUnitPrice: item.unitPrice,
      oldVAT: item.vat,
      oldUnitPriceAfterVAT: item.unitPriceAfterVAT,
      editedBy: req.user.id,
      action: "delete",
    });

    await item.save();

    res.json({
      message: "Item deleted successfully",
      item: { id: item._id, name: item.name },
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
};

/** PATCH /itemManagementControl/:id/restore */
exports.restoreItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await Item.findById(itemId);

    if (!item) return res.status(404).json({ error: "Item not found" });
    if (!item.isDeleted)
      return res.status(400).json({ error: "Item is not deleted" });

    const conflict = await Item.findOne({
      code: item.code,
      isDeleted: false,
      _id: { $ne: itemId },
    });
    if (conflict) {
      return res.status(400).json({
        error: `Cannot restore item. Code "${item.code}" is already in use.`,
      });
    }

    item.isDeleted = false;
    item.deletedAt = null;
    item.deletedBy = null;
    item.auditHistory.push({
      newName: item.name,
      newCode: item.code,
      newUnit: item.unit,
      newUnitPrice: item.unitPrice,
      newVAT: item.vat,
      newUnitPriceAfterVAT: item.unitPriceAfterVAT,
      editedBy: req.user.id,
      action: "create",
      note: "Khôi phục mặt hàng",
    });

    await item.save();
    res.json({
      message: "Item restored successfully",
      item: { id: item._id, name: item.name },
    });
  } catch (error) {
    console.error("Error restoring item:", error);
    res.status(500).json({ error: "Failed to restore item" });
  }
};

/** GET /itemManagementControl/:id/audit */
exports.getItemAuditHistory = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("auditHistory.editedBy", "username")
      .select("auditHistory");

    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item.auditHistory);
  } catch (error) {
    console.error("Error fetching audit history:", error);
    res.status(500).json({ error: "Failed to fetch audit history" });
  }
};

// ─── Excel Export ─────────────────────────────────────────────────────────────

/** GET /itemManagementControl/export/excel?costCenterId=xxx&includeDeleted=false */
exports.exportToExcel = async (req, res) => {
  try {
    const { includeDeleted = "false", costCenterId } = req.query;

    const query = includeDeleted === "true" ? {} : { isDeleted: false };
    const items = await Item.find(query)
      .populate("createdBy", "username")
      .populate("deletedBy", "username")
      .lean();

    let stockMap = {};
    let costCenterName = "";

    if (costCenterId) {
      const cc = await CostCenter.findById(costCenterId).lean();
      costCenterName = cc ? cc.name : costCenterId;
      const stocks = await ItemStock.find({ costCenterId }).lean();
      stockMap = Object.fromEntries(
        stocks.map((s) => [s.itemId.toString(), s.inStorage]),
      );
    } else {
      // Export ALL cost center stocks — one sheet per cost center
      const allCCs = await CostCenter.find({}, "name").lean();
      const allStocks = await ItemStock.find({}).lean();
      const grouped = {};
      for (const s of allStocks) {
        const ccId = s.costCenterId.toString();
        if (!grouped[ccId]) grouped[ccId] = {};
        grouped[ccId][s.itemId.toString()] = s.inStorage;
      }

      const workbook = new ExcelJS.Workbook();

      for (const cc of allCCs) {
        const ws = workbook.addWorksheet(cc.name.substring(0, 31));
        const ccStock = grouped[cc._id.toString()] || {};

        ws.columns = [
          { header: "Mã hàng", key: "code", width: 15 },
          { header: "Tên hàng", key: "name", width: 30 },
          { header: "Đơn vị", key: "unit", width: 10 },
          { header: "Đơn giá", key: "unitPrice", width: 15 },
          { header: "VAT (%)", key: "vat", width: 10 },
          { header: "Giá sau VAT", key: "unitPriceAfterVAT", width: 15 },
          { header: `Tồn kho (${cc.name})`, key: "inStorage", width: 18 },
          { header: "Trạng thái", key: "status", width: 15 },
          { header: "Người tạo", key: "createdBy", width: 20 },
          { header: "Ngày tạo", key: "createdAt", width: 20 },
        ];

        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        items.forEach((item) => {
          const row = ws.addRow({
            code: item.code,
            name: item.name,
            unit: item.unit || "cái",
            unitPrice: item.unitPrice,
            vat: item.vat,
            unitPriceAfterVAT: item.unitPriceAfterVAT,
            inStorage: ccStock[item._id.toString()] ?? 0,
            status: item.isDeleted ? "Đã xóa" : "Đang hoạt động",
            createdBy: item.createdBy?.username || "Không xác định",
            createdAt: new Date(item.createdAt).toLocaleString("vi-VN"),
          });
          row.getCell("unitPrice").numFmt = "#,##0";
          row.getCell("unitPriceAfterVAT").numFmt = "#,##0";
        });
      }

      const fileName = `danh-sach-mat-hang-tat-ca-cost-center_${new Date().toISOString().split("T")[0]}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      await workbook.xlsx.write(res);
      return res.end();
    }

    // Single cost center export
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Danh sách mặt hàng");

    worksheet.columns = [
      { header: "Mã hàng", key: "code", width: 15 },
      { header: "Tên hàng", key: "name", width: 30 },
      { header: "Đơn vị", key: "unit", width: 10 },
      { header: "Đơn giá", key: "unitPrice", width: 15 },
      { header: "VAT (%)", key: "vat", width: 10 },
      { header: "Giá sau VAT", key: "unitPriceAfterVAT", width: 15 },
      { header: `Tồn kho (${costCenterName})`, key: "inStorage", width: 18 },
      { header: "Trạng thái", key: "status", width: 15 },
      { header: "Người tạo", key: "createdBy", width: 20 },
      { header: "Ngày tạo", key: "createdAt", width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    items.forEach((item) => {
      const row = worksheet.addRow({
        code: item.code,
        name: item.name,
        unit: item.unit || "cái",
        unitPrice: item.unitPrice,
        vat: item.vat,
        unitPriceAfterVAT: item.unitPriceAfterVAT,
        inStorage: stockMap[item._id.toString()] ?? 0,
        status: item.isDeleted ? "Đã xóa" : "Đang hoạt động",
        createdBy: item.createdBy?.username || "Không xác định",
        createdAt: new Date(item.createdAt).toLocaleString("vi-VN"),
      });
      row.getCell("unitPrice").numFmt = "#,##0";
      row.getCell("unitPriceAfterVAT").numFmt = "#,##0";

      row.getCell("status").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: item.isDeleted ? "FFFFCDD2" : "FFC8E6C9" },
      };
    });

    const fileName = `danh-sach-mat-hang-${costCenterName || "tat-ca"}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    res.status(500).json({ error: "Failed to export to Excel" });
  }
};

// ─── Excel Import ─────────────────────────────────────────────────────────────

exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Không có file được tải lên" });

    const { costCenterId } = req.body;
    if (!costCenterId)
      return res.status(400).json({ error: "Vui lòng chọn cost center" });

    const costCenter = await CostCenter.findById(costCenterId).lean();
    if (!costCenter)
      return res.status(404).json({ error: "Cost center không tồn tại" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet)
      return res.status(400).json({ error: "File Excel không hợp lệ" });

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      ordersUpdated: 0,
      errors: [],
      orderUpdateErrors: [],
    };

    let rowNumber = 2;
    while (worksheet.getRow(rowNumber).getCell(1).value) {
      const row = worksheet.getRow(rowNumber);
      results.total++;

      try {
        const code = row.getCell(1).value?.toString().trim();
        const name = row.getCell(2).value?.toString().trim();
        const unit = row.getCell(3).value?.toString().trim() || "cái";
        const unitPrice = parseFloat(row.getCell(4).value) || 0;
        const vat = parseFloat(row.getCell(5).value) || 0;
        const inStorage = parseInt(row.getCell(6).value) || 0;
        const unitPriceAfterVAT = unitPrice * (1 + vat / 100);

        if (!code || !name) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            code: code || "(trống)",
            error: "Thiếu mã hàng hoặc tên hàng",
          });
          rowNumber++;
          continue;
        }
        if (isNaN(unitPrice) || unitPrice < 0) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            code,
            error: "Đơn giá không hợp lệ",
          });
          rowNumber++;
          continue;
        }
        if (vat < 0 || vat > 100) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            code,
            error: "VAT phải trong khoảng 0-100%",
          });
          rowNumber++;
          continue;
        }

        const existingItem = await Item.findOne({ code, isDeleted: false });

        if (existingItem) {
          const oldValues = {
            name: existingItem.name,
            unit: existingItem.unit,
            unitPrice: existingItem.unitPrice,
            vat: existingItem.vat,
            unitPriceAfterVAT: existingItem.unitPriceAfterVAT,
          };

          existingItem.name = name;
          existingItem.unit = unit;
          existingItem.unitPrice = unitPrice;
          existingItem.vat = vat;
          existingItem.unitPriceAfterVAT = unitPriceAfterVAT;
          existingItem.auditHistory.push({
            oldName: oldValues.name,
            newName: name,
            oldCode: code,
            newCode: code,
            oldUnit: oldValues.unit,
            newUnit: unit,
            oldUnitPrice: oldValues.unitPrice,
            newUnitPrice: unitPrice,
            oldVAT: oldValues.vat,
            newVAT: vat,
            oldUnitPriceAfterVAT: oldValues.unitPriceAfterVAT,
            newUnitPriceAfterVAT: unitPriceAfterVAT,
            editedBy: req.user.id,
            action: "update",
            note: `Cập nhật từ Excel import tại ${costCenter.name}`,
          });

          await existingItem.save();

          await upsertStock(
            existingItem._id,
            costCenterId,
            inStorage,
            req.user.id,
            `Cập nhật từ Excel import tại ${costCenter.name}`,
          );

          results.updated++;
          results.success++;

          try {
            const pendingOrders = await Order.find({
              status: "pending",
              "items.itemId": existingItem._id,
            });
            for (const order of pendingOrders) {
              let changed = false;
              order.items = order.items.map((oi) => {
                if (oi.itemId.toString() !== existingItem._id.toString())
                  return oi;
                changed = true;
                return {
                  ...oi.toObject(),
                  itemName: name,
                  itemCode: code,
                  unit,
                  unitPrice,
                  vat,
                  unitPriceAfterVAT,
                  totalPrice: unitPrice * oi.quantity,
                  totalPriceAfterVAT: unitPriceAfterVAT * oi.quantity,
                };
              });
              if (changed) {
                order.totalAmount = order.items.reduce(
                  (s, i) => s + i.totalPrice,
                  0,
                );
                order.totalAmountAfterVAT = order.items.reduce(
                  (s, i) => s + i.totalPriceAfterVAT,
                  0,
                );
                order.formattedUpdatedAt = formatDateTime(new Date());
                order.updatedAt = new Date();
                await order.save();
                results.ordersUpdated++;
              }
            }
          } catch (err) {
            results.orderUpdateErrors.push({ code, error: err.message });
          }
        } else {
          const deletedItem = await Item.findOne({ code, isDeleted: true });
          if (deletedItem) {
            results.errors.push({
              row: rowNumber,
              code,
              error: `Mã "${code}" đã từng tồn tại và đã bị xóa. Đang tạo mới.`,
              warning: true,
            });
          }

          const newItem = new Item({
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
                note: `Nhập từ Excel tại ${costCenter.name}`,
              },
            ],
          });

          await newItem.save();

          await upsertStock(
            newItem._id,
            costCenterId,
            inStorage,
            req.user.id,
            `Nhập từ Excel tại ${costCenter.name}`,
          );

          results.created++;
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          code: row.getCell(1).value?.toString() || "(lỗi)",
          error: error.message || "Lỗi không xác định",
        });
      }

      rowNumber++;
    }

    if (results.errors.length > 0 || results.updated > 0) {
      const rb = new ExcelJS.Workbook();
      const rws = rb.addWorksheet("Kết quả nhập file");

      rws.addRow(["Tổng kết nhập file Excel"]);
      rws.addRow([]);
      rws.addRow(["Cost Center:", costCenter.name]);
      rws.addRow(["Tổng số dòng:", results.total]);
      rws.addRow(["Thành công:", results.success]);
      rws.addRow(["  - Tạo mới:", results.created]);
      rws.addRow(["  - Cập nhật:", results.updated]);
      rws.addRow(["Đơn hàng được cập nhật:", results.ordersUpdated]);
      rws.addRow(["Thất bại:", results.failed]);
      rws.addRow([]);

      if (results.errors.length > 0) {
        rws.addRow(["Chi tiết lỗi/cảnh báo:"]);
        const hRow = rws.addRow(["Dòng", "Mã hàng", "Thông báo", "Loại"]);
        hRow.font = { bold: true };
        results.errors.forEach((e) => {
          const r = rws.addRow([
            e.row,
            e.code,
            e.error,
            e.warning ? "Cảnh báo" : "Lỗi",
          ]);
          if (e.warning) {
            r.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF3CD" },
            };
          }
        });
      }

      rws.columns.forEach((col) => {
        col.width = Math.max(col.width || 0, 20);
      });

      const buffer = await rb.xlsx.writeBuffer();
      return res.json({
        message: "Nhập file hoàn tất",
        summary: results,
        errorFile: buffer.toString("base64"),
      });
    }

    res.json({ message: "Nhập file thành công", summary: results });
  } catch (error) {
    console.error("Error importing from Excel:", error);
    res.status(500).json({ error: "Failed to import: " + error.message });
  }
};

// ─── Template Download ────────────────────────────────────────────────────────

exports.downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mẫu nhập file");

    worksheet.addRow([
      "Mã hàng*",
      "Tên hàng*",
      "Đơn vị",
      "Đơn giá*",
      "VAT (%)",
      "Tồn kho",
    ]);
    worksheet.addRow(["MH001", "Ví dụ mặt hàng 1", "cái", 100000, 10, 50]);
    worksheet.addRow(["MH002", "Ví dụ mặt hàng 2", "kg", 250000, 8, 100]);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1976D2" },
    };

    worksheet.columns = [
      { width: 15 },
      { width: 30 },
      { width: 10 },
      { width: 15 },
      { width: 10 },
      { width: 12 },
    ];

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="mau-nhap-mat-hang.xlsx"',
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error downloading template:", error);
    res.status(500).json({ error: "Failed to download template" });
  }
};
