//routes\employeeRoutes.js
const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get(
  "/employeeMain",
  authMiddleware,
  employeeController.getEmployeeMainPage
);
router.get("/employees", authMiddleware, employeeController.getAllEmployees);
router.get(
  "/employees/:id",
  authMiddleware,
  employeeController.getEmployeeById
);
router.post("/employees", authMiddleware, employeeController.createEmployee);
router.put("/employees/:id", authMiddleware, employeeController.updateEmployee);
router.delete(
  "/employees/:id",
  authMiddleware,
  employeeController.deleteEmployee
);
router.get(
  "/employeesCostCenters",
  authMiddleware,
  employeeController.getAllCostCenters
);

module.exports = router;
