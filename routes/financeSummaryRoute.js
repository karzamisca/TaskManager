// routes/financeSummaryRoute.js
const express = require("express");
const router = express.Router();
const financeSummaryController = require("../controllers/financeSummaryController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeSummary", authMiddleware, (req, res) => {
  res.sendFile("financeSummary.html", {
    root: "./views/financePages/financeSummary",
  });
});
router.get(
  "/finaceSummaryGetAvailableYears",
  financeSummaryController.getAvailableYears
);
router.get(
  "/financeSummaryRevenueByCostCenter",
  authMiddleware,
  financeSummaryController.getRevenueByCostCenter
);
router.get(
  "/financeSummaryCostCenters",
  authMiddleware,
  financeSummaryController.getAllCostCenters
);
router.post(
  "/financeSummaryCostCenterGroups",
  authMiddleware,
  financeSummaryController.createCostCenterGroup
);
router.get(
  "/financeSummaryCostCenterGroups",
  authMiddleware,
  financeSummaryController.getCostCenterGroups
);
router.delete(
  "/financeSummaryCostCenterGroups/:id",
  authMiddleware,
  financeSummaryController.deleteCostCenterGroup
);
router.put(
  "/financeSummaryCostCenterGroups/:id",
  authMiddleware,
  financeSummaryController.updateCostCenterGroup
);

module.exports = router;
