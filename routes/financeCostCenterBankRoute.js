// routes/financeCostCenterBankRoute.js
const express = require("express");
const router = express.Router();
const {
  getCostCenters,
  getBankEntries,
  addBankEntry,
  updateBankEntry,
  deleteBankEntry,
  getCostCenterWithFundLimit,
  updateFundLimitBank,
  getGeneratedDailyEntries,
  calculateLoanSchedule,
} = require("../controllers/financeCostCenterBankController");

const authMiddleware = require("../middlewares/authMiddleware");

// Serve HTML page
router.get("/financeCostCenterBank", authMiddleware, (req, res) => {
  res.sendFile("financeCostCenterBank.html", {
    root: "./views/financePages/financeCostCenterBank",
  });
});

// ==================== COST CENTER ROUTES ====================

// GET all cost centers (for dropdown)
router.get(
  "/financeCostCenterBankControl/cost-centers",
  authMiddleware,
  getCostCenters,
);

// GET cost center with fund limit info
router.get(
  "/financeCostCenterBankControl/:costCenterId/fund-info",
  authMiddleware,
  getCostCenterWithFundLimit,
);

// PUT update fund limit bank
router.put(
  "/financeCostCenterBankControl/:costCenterId/fund-limit",
  authMiddleware,
  updateFundLimitBank,
);

// ==================== BANK ENTRIES ROUTES ====================

// GET all bank entries for a specific cost center
router.get(
  "/financeCostCenterBankControl/:costCenterId/entries",
  authMiddleware,
  getBankEntries,
);

// POST new bank entry to a cost center
router.post(
  "/financeCostCenterBankControl/:costCenterId/entries",
  authMiddleware,
  addBankEntry,
);

// PUT update bank entry in a cost center
router.put(
  "/financeCostCenterBankControl/:costCenterId/entries/:entryId",
  authMiddleware,
  updateBankEntry,
);

// DELETE bank entry from a cost center
router.delete(
  "/financeCostCenterBankControl/:costCenterId/entries/:entryId",
  authMiddleware,
  deleteBankEntry,
);

// ==================== LOAN CALCULATION ROUTES ====================

// GET generated daily entries from a bank entry (loan)
router.get(
  "/financeCostCenterBankControl/:costCenterId/bank-entries/:bankEntryId/generated-daily",
  authMiddleware,
  getGeneratedDailyEntries,
);

// POST calculate loan schedule preview (không lưu vào DB)
router.post(
  "/financeCostCenterBankControl/calculate-loan-schedule",
  authMiddleware,
  calculateLoanSchedule,
);

module.exports = router;
