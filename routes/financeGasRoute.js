const express = require("express");
const router = express.Router();
const centersController = require("../controllers/financeGasController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/financeGas", authMiddleware, (req, res) => {
  res.sendFile("financeGas.html", {
    root: "./views/financePages/financeGas",
  });
});
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

module.exports = router;
