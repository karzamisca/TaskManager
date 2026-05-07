// routes/itemManagementRoute.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/itemManagementController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel";
    ok
      ? cb(null, true)
      : cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"), false);
  },
});

// ── Page view ──────────────────────────────────────────────────────────────────
router.get("/itemManagement", authMiddleware, ctrl.getItemManagementViews);

// ── Cost centers (for dropdown) ────────────────────────────────────────────────
router.get(
  "/itemManagementControl/costCenters",
  authMiddleware,
  ctrl.getCostCenters,
);

// ── Excel (must be before /:id to avoid route collision) ──────────────────────
router.get(
  "/itemManagementControl/export/excel",
  authMiddleware,
  ctrl.exportToExcel,
);
router.get(
  "/itemManagementControl/template/excel",
  authMiddleware,
  ctrl.downloadTemplate,
);
router.post(
  "/itemManagementControl/import/excel",
  authMiddleware,
  upload.single("file"),
  ctrl.importFromExcel,
);

// ── Items list ─────────────────────────────────────────────────────────────────
router.get("/itemManagementControl", authMiddleware, ctrl.getAllItems);
router.get(
  "/itemManagementControl/all",
  authMiddleware,
  ctrl.getAllItemsWithDeleted,
);
router.post("/itemManagementControl", authMiddleware, ctrl.createItem);

// ── Single item ────────────────────────────────────────────────────────────────
router.get("/itemManagementControl/:id", authMiddleware, ctrl.getItem);
router.put("/itemManagementControl/:id", authMiddleware, ctrl.updateItem);
router.delete("/itemManagementControl/:id", authMiddleware, ctrl.deleteItem);
router.patch(
  "/itemManagementControl/:id/restore",
  authMiddleware,
  ctrl.restoreItem,
);
router.get(
  "/itemManagementControl/:id/audit",
  authMiddleware,
  ctrl.getItemAuditHistory,
);

// ── Per-cost-center stock ──────────────────────────────────────────────────────
// NOTE: /stock/history must come BEFORE /stock to avoid Express matching
//       "history" as the :costCenterId param on a deeper route.
router.get(
  "/itemManagementControl/:id/stock/history",
  authMiddleware,
  ctrl.getItemStockHistory,
);
router.patch(
  "/itemManagementControl/:id/stock",
  authMiddleware,
  ctrl.updateStock,
);
router.get(
  "/itemManagementControl/:id/stock",
  authMiddleware,
  ctrl.getItemStockByCostCenter,
);

module.exports = router;
