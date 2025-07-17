//routes/reportRoute.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const reportController = require("../controllers/reportController");

router.get("/reportSummary", authMiddleware, (req, res) => {
  res.sendFile("reportSummary.html", {
    root: "./views/reportPages/reportSummary",
  }); // Serve the main report page
});

router.get("/reportSubmission", authMiddleware, (req, res) => {
  res.sendFile("reportSubmission.html", {
    root: "./views/reportPages/reportSubmission",
  }); // Serve the main report page
});

router.get("/reportGet", authMiddleware, reportController.getReports);

router.get("/reportGet/:id", authMiddleware, reportController.getReportById);

// Create a new report
router.post(
  "/reportSubmission",
  authMiddleware,
  reportController.reportSubmission
);

module.exports = router;
