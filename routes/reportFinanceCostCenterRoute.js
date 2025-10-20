// routes/reportFinanceCostCenterRoute.js
const express = require("express");
const router = express.Router();
const reportFinanceCostCenterController = require("../controllers/reportFinanceCostCenterController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/reportFinanceCostCenter",
  authMiddleware,
  reportFinanceCostCenterController.getReportFinanceCostCenterPage
);
// Get all logs with filtering and pagination
router.get(
  "/reportFinanceCostCenterControl",
  authMiddleware,
  reportFinanceCostCenterController.getLogs
);

module.exports = router;
