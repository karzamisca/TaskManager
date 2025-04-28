const express = require("express");
const router = express.Router();
const salaryController = require("../controllers/userSalaryRecorderController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/userSalaryRecordPage",
  authMiddleware,
  salaryController.getUserSalaryRecordPage
);
router.get(
  "/userSalaryRecords",
  authMiddleware,
  salaryController.getAllUserSalaryRecords
);
router.get(
  "/userSalaryRecords/:id",
  authMiddleware,
  salaryController.getUserSalaryRecordById
);
router.post(
  "/userSalaryRecords",
  authMiddleware,
  salaryController.createOrUpdateUserSalaryRecord
);
router.delete(
  "/userSalaryRecords/:id",
  authMiddleware,
  salaryController.deleteUserSalaryRecord
);

module.exports = router;
