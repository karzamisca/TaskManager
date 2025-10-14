// routes/financeCostCenterConstructionRoute.js
const express = require("express");
const router = express.Router();
const {
  getCostCenters,
  getConstructionEntries,
  addConstructionEntry,
  updateConstructionEntry,
  deleteConstructionEntry,
} = require("../controllers/financeCostCenterConstructionController");

const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeCostCenterConstruction", authMiddleware, (req, res) => {
  res.sendFile("financeCostCenterConstruction.html", {
    root: "./views/financePages/financeCostCenterConstruction",
  });
});
// GET all cost centers
router.get(
  "/financeCostCenterConstructionControl/cost-centers",
  getCostCenters
);

// GET construction entries for a specific cost center
router.get(
  "/financeCostCenterConstructionControl/:costCenterId/entries",
  getConstructionEntries
);

// POST new construction entry to a cost center
router.post(
  "/financeCostCenterConstructionControl/:costCenterId/entries",
  addConstructionEntry
);

// PUT update construction entry in a cost center
router.put(
  "/financeCostCenterConstructionControl/:costCenterId/entries/:entryId",
  updateConstructionEntry
);

// DELETE construction entry from a cost center
router.delete(
  "/financeCostCenterConstructionControl/:costCenterId/entries/:entryId",
  deleteConstructionEntry
);

module.exports = router;

module.exports = router;
