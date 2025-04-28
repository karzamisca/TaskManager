//routes\salaryRoutes.js
const express = require("express");
const router = express.Router();
const employeeSalaryController = require("../controllers/employeeSalaryController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/employeeSalaryRecordPage",
  authMiddleware,
  employeeSalaryController.getEmployeeSalaryRecordPage
);
router.get(
  "/employeeSalaryRecord",
  authMiddleware,
  employeeSalaryController.getAllEmployeeSalaryRecord
); // NEW: get all
router.get(
  "/employeeSalaryRecord/:id",
  authMiddleware,
  employeeSalaryController.getEmployeeSalaryRecordById
); // for edit modal
router.post(
  "/employeeSalaryRecord",
  authMiddleware,
  employeeSalaryController.createOrUpdateEmployeeSalaryRecord
);
router.delete(
  "/employeeSalaryRecord/:id",
  authMiddleware,
  employeeSalaryController.deleteEmployeeSalaryRecord
);

module.exports = router;
