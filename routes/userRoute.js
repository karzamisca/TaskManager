//routes\userRoute.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/userSalaryCalculation",
  authMiddleware,
  userController.getUserSalaryCalculationPage
);
router.get("/userControl", authMiddleware, userController.getAllUsers);
router.get("/userControl/:id", authMiddleware, userController.getUserById);
router.post("/userControl", authMiddleware, userController.createUser);
router.put("/userControl/:id", authMiddleware, userController.updateUser);
router.delete("/userControl/:id", authMiddleware, userController.deleteUser);
router.get(
  "/userControlCostCenters",
  authMiddleware,
  userController.getAllCostCenters
);
router.get("/userControlManagers", authMiddleware, userController.getManagers);

router.get(
  "/userMonthlyRecord",
  authMiddleware,
  userController.getUserMonthlyRecordPage
);
router.get(
  "/userMonthlyRecordGet",
  authMiddleware,
  userController.getAllUserMonthlyRecord
);

router.get(
  "/exportSalaryPDF",
  authMiddleware,
  userController.exportSalaryPaymentPDF
);

router.get(
  "/exportSalaryExcel",
  authMiddleware,
  userController.exportSalaryPaymentExcel
);

module.exports = router;
