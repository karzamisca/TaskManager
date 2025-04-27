//routes\salaryRoutes.js
const express = require("express");
const router = express.Router();
const salaryController = require("../controllers/salaryController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/adminSalary",
  authMiddleware,
  salaryController.getSalaryRecordPage
);
router.get(
  "/employeeSalaryRecord",
  authMiddleware,
  salaryController.getAllSalaryRecords
); // NEW: get all
router.get(
  "/employeeSalaryRecord/:id",
  authMiddleware,
  salaryController.getSalaryRecordById
); // for edit modal
router.post(
  "/employeeSalaryRecord",
  authMiddleware,
  salaryController.createOrUpdateSalaryRecord
);
router.delete(
  "/employeeSalaryRecord/:id",
  authMiddleware,
  salaryController.deleteSalaryRecord
);

module.exports = router;
