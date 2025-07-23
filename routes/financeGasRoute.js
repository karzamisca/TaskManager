//routes/financeGasRoute.js
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

module.exports = router;
