//routes/financeSummaryRoute.js
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
  "/revenue-by-cost-center",
  financeSummaryController.getRevenueByCostCenter
);

module.exports = router;
