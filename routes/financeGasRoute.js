//routes/financeGasRoute.js
const express = require("express");
const router = express.Router();
const centersController = require("../controllers/financeGasController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeGas", authMiddleware, centersController.getFinanceGasPage);
router.get(
  "/financeGasControlSummaryExportToExcel",
  authMiddleware,
  centersController.exportAllCentersSummaryToExcel
);
router.get(
  "/financeGasControl",
  authMiddleware,
  centersController.getAllCenters
);
router.post(
  "/financeGasControl",
  authMiddleware,
  centersController.createCenter
);
router.post(
  "/financeGasControl/:centerId/years/:year/months/:monthName/entries",
  authMiddleware,
  centersController.addMonthEntry
);
router.delete(
  "/financeGasControl/:id",
  authMiddleware,
  centersController.deleteCenter
);
router.post(
  "/financeGasControl/:centerId/years",
  authMiddleware,
  centersController.addYear
);
router.put(
  "/financeGasControl/:centerId/years/:year",
  authMiddleware,
  centersController.updateYear
);
router.put(
  "/financeGasControl/:centerId/reorderYears",
  authMiddleware,
  centersController.reorderYears
);
router.delete(
  "/financeGasControl/:centerId/years/:year/months/:monthName/entries/:entryIndex",
  authMiddleware,
  centersController.deleteMonthEntry
);
router.put(
  "/financeGasControl/:centerId/years/:year/months/:monthName/entries/:entryIndex",
  authMiddleware,
  centersController.updateMonthEntry
);
router.put(
  "/financeGasControl/:id",
  authMiddleware,
  centersController.updateCenter
);

module.exports = router;
