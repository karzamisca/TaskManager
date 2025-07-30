//routes/financeBankRoute.js
const express = require("express");
const router = express.Router();
const centersController = require("../controllers/financeBankController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeBank", authMiddleware, (req, res) => {
  res.sendFile("financeBank.html", {
    root: "./views/financePages/financeBank",
  });
});
router.get(
  "/financeBankControl",
  authMiddleware,
  centersController.getAllCenters
);
router.post(
  "/financeBankControl",
  authMiddleware,
  centersController.createCenter
);
router.post(
  "/financeBankControl/:centerId/years/:year/months/:monthName/entries",
  authMiddleware,
  centersController.addMonthEntry
);
router.delete(
  "/financeBankControl/:id",
  authMiddleware,
  centersController.deleteCenter
);
router.post(
  "/financeBankControl/:centerId/years",
  authMiddleware,
  centersController.addYear
);
router.put(
  "/financeBankControl/:centerId/years/:year",
  authMiddleware,
  centersController.updateYear
);
router.put(
  "/financeBankControl/:centerId/reorderYears",
  authMiddleware,
  centersController.reorderYears
);
router.delete(
  "/financeBankControl/:centerId/years/:year/months/:monthName/entries/:entryIndex",
  authMiddleware,
  centersController.deleteMonthEntry
);
router.put(
  "/financeBankControl/:centerId/years/:year/months/:monthName/entries/:entryIndex",
  authMiddleware,
  centersController.updateMonthEntry
);

module.exports = router;
