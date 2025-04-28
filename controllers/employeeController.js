// controllers/employeeController.js
const Employee = require("../models/Employee");
const CostCenter = require("../models/CostCenter");

exports.getEmployeeMainPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    // Serve the HTML file
    res.sendFile("employeeMain.html", {
      root: "./views/employeePages/employeeMain",
    });
  } catch (error) {
    console.error("Error serving the employee main page:", error);
    res.send("Server error");
  }
};

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const employees = await Employee.find().populate("costCenter");
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const employee = await Employee.findById(req.params.id).populate(
      "costCenter"
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new employee
exports.createEmployee = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const {
      username,
      costCenter,
      baseSalary,
      holidayBonusPerDay,
      nightShiftBonusPerDay,
      socialInsurance,
    } = req.body;

    // Check if username already exists
    const existingEmployee = await Employee.findOne({ username });
    if (existingEmployee) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Check if cost center exists
    const costCenterExists = await CostCenter.findById(costCenter);
    if (!costCenterExists) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newEmployee = new Employee({
      username,
      costCenter,
      baseSalary,
      holidayBonusPerDay: holidayBonusPerDay || 0,
      nightShiftBonusPerDay: nightShiftBonusPerDay || 0,
      socialInsurance: socialInsurance || 0,
    });

    const savedEmployee = await newEmployee.save();
    await savedEmployee.populate("costCenter");
    res.status(201).json(savedEmployee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const {
      username,
      costCenter,
      baseSalary,
      holidayBonusPerDay,
      nightShiftBonusPerDay,
      socialInsurance,
    } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // If username is changing, check for conflicts
    if (username && username !== employee.username) {
      const existingEmployee = await Employee.findOne({ username });
      if (existingEmployee) {
        return res.status(400).json({ message: "Username already exists" });
      }
      employee.username = username;
    }

    // Update other fields if provided
    if (costCenter) {
      const costCenterExists = await CostCenter.findById(costCenter);
      if (!costCenterExists) {
        return res.status(404).json({ message: "Cost center not found" });
      }
      employee.costCenter = costCenter;
    }

    if (baseSalary !== undefined) employee.baseSalary = baseSalary;
    if (holidayBonusPerDay !== undefined)
      employee.holidayBonusPerDay = holidayBonusPerDay;
    if (nightShiftBonusPerDay !== undefined)
      employee.nightShiftBonusPerDay = nightShiftBonusPerDay;
    if (socialInsurance !== undefined)
      employee.socialInsurance = socialInsurance;

    const updatedEmployee = await employee.save();
    await updatedEmployee.populate("costCenter");
    res.json(updatedEmployee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    await employee.deleteOne();
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all cost centers
exports.getAllCostCenters = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "headOfHumanResources",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const costCenters = await CostCenter.find();
    res.json(costCenters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
