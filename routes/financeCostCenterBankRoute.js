// routes/financeCostCenterBankRoute.js
const express = require("express");
const router = express.Router();
const {
  getCostCenters,
  getBankEntries,
  addBankEntry,
  updateBankEntry,
  deleteBankEntry,
} = require("../controllers/financeCostCenterBankController");

const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeCostCenterBank", authMiddleware, (req, res) => {
  res.sendFile("financeCostCenterBank.html", {
    root: "./views/financePages/financeCostCenterBank",
  });
});

// GET all cost centers
router.get("/financeCostCenterBankControl/cost-centers", getCostCenters);

// GET bank entries for a specific cost center
router.get(
  "/financeCostCenterBankControl/:costCenterId/entries",
  getBankEntries
);

// POST new bank entry to a cost center
router.post(
  "/financeCostCenterBankControl/:costCenterId/entries",
  addBankEntry
);

// PUT update bank entry in a cost center
router.put(
  "/financeCostCenterBankControl/:costCenterId/entries/:entryId",
  updateBankEntry
);

// DELETE bank entry from a cost center
router.delete(
  "/financeCostCenterBankControl/:costCenterId/entries/:entryId",
  deleteBankEntry
);

module.exports = router;
