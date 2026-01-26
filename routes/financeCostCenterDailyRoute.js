// routes/financeCostCenterDailyRoute.js
const express = require("express");
const router = express.Router();
const {
  getCostCenters,
  getDailyEntries,
  addDailyEntry,
  updateDailyEntry,
  deleteDailyEntry,
} = require("../controllers/financeCostCenterDailyController");

const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeCostCenterDaily", authMiddleware, (req, res) => {
  res.sendFile("financeCostCenterDaily.html", {
    root: "./views/financePages/financeCostCenterDaily",
  });
});

// GET all cost centers
router.get("/financeCostCenterDailyControl/cost-centers", getCostCenters);

// GET daily entries for a specific cost center
router.get(
  "/financeCostCenterDailyControl/:costCenterId/entries",
  getDailyEntries,
);

// POST new daily entry to a cost center
router.post(
  "/financeCostCenterDailyControl/:costCenterId/entries",
  addDailyEntry,
);

// PUT update daily entry in a cost center
router.put(
  "/financeCostCenterDailyControl/:costCenterId/entries/:entryId",
  updateDailyEntry,
);

// DELETE daily entry from a cost center
router.delete(
  "/financeCostCenterDailyControl/:costCenterId/entries/:entryId",
  deleteDailyEntry,
);

module.exports = router;
