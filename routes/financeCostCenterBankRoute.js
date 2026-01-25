// routes/financeCostCenterBankRoute.js
const express = require("express");
const router = express.Router();
const {
  getCostCenters,
  getBankEntries,
  addBankEntry,
  updateBankEntry,
  deleteBankEntry,
  getCostCenterBankFundLimit,
  updateCostCenterBankFundLimit,
} = require("../controllers/financeCostCenterBankController");

const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeCostCenterBank", authMiddleware, (req, res) => {
  res.sendFile("financeCostCenterBank.html", {
    root: "./views/financePages/financeCostCenterBank",
  });
});

// GET all cost centers
router.get(
  "/financeCostCenterBankControl/cost-centers",
  authMiddleware,
  getCostCenters,
);
// GET bank entries for a specific cost center
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

// Get costCenterBank fund limit
router.get(
  "/financeCostCenterBankControl/fund",
  authMiddleware,
  getCostCenterBankFundLimit,
);

// Update costCenterBank fund limit
router.put(
  "/financeCostCenterBankControl/fund",
  authMiddleware,
  updateCostCenterBankFundLimit,
);

module.exports = router;
