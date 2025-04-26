//routes\employeeRoutes.js
const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/api/employees",
  authMiddleware,
  employeeController.getAllEmployees
);
router.get(
  "/api/employees/:id",
  authMiddleware,
  employeeController.getEmployeeById
);
router.post(
  "/api/employees",
  authMiddleware,
  employeeController.createEmployee
);
router.put(
  "/api/employees/:id",
  authMiddleware,
  employeeController.updateEmployee
);
router.delete(
  "/api/employees/:id",
  authMiddleware,
  employeeController.deleteEmployee
);
router.get(
  "/api/employees/get/cost-centers",
  authMiddleware,
  employeeController.getAllCostCenters
);

module.exports = router;
