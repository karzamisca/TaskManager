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
  "/api/salary-records",
  authMiddleware,
  salaryController.getAllSalaryRecords
); // NEW: get all
router.get(
  "/api/salary-records/:id",
  authMiddleware,
  salaryController.getSalaryRecordById
); // for edit modal
router.post(
  "/api/salary-records",
  authMiddleware,
  salaryController.createOrUpdateSalaryRecord
);
router.delete(
  "/api/salary-records/:id",
  authMiddleware,
  salaryController.deleteSalaryRecord
);

module.exports = router;
