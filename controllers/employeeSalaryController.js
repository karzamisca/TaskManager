// controllers/salaryController.js
const EmployeeSalaryRecord = require("../models/EmployeeSalaryRecord");
const Employee = require("../models/Employee");

exports.getEmployeeSalaryRecordPage = (req, res) => {
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
    res.sendFile("employeeSalaryRecord.html", {
      root: "./views/employeePages/employeeSalaryRecord",
    });
  } catch (error) {
    console.error("Error serving the employee's salary page:", error);
    res.send("Server error");
  }
};

// Get all salary records
exports.getAllEmployeeSalaryRecord = async (req, res) => {
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
    const records = await EmployeeSalaryRecord.find().populate({
      path: "employee",
      populate: { path: "costCenter" },
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get salary record by ID
exports.getEmployeeSalaryRecordById = async (req, res) => {
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
    const record = await EmployeeSalaryRecord.findById(req.params.id).populate({
      path: "employee",
      populate: { path: "costCenter" },
    });

    if (!record) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create or update salary record - handle bonus rates
exports.createOrUpdateEmployeeSalaryRecord = async (req, res) => {
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
      employee,
      month,
      year,
      holidayDays,
      nightShiftDays,
      holidayBonusRate,
      nightShiftBonusRate,
    } = req.body;

    // Get employee to calculate total salary
    const employeeData = await Employee.findById(employee);
    if (!employeeData) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Calculate total salary
    const baseSalary = employeeData.baseSalary;
    const holidayBonus =
      holidayDays * (holidayBonusRate || employeeData.holidayBonusPerDay);
    const nightShiftBonus =
      nightShiftDays *
      (nightShiftBonusRate || employeeData.nightShiftBonusPerDay);
    const socialInsurance = employeeData.socialInsurance;

    const totalSalary =
      baseSalary + holidayBonus + nightShiftBonus - socialInsurance;

    // Check if a record already exists for this employee/month/year
    let record = await EmployeeSalaryRecord.findOne({
      employee,
      month,
      year,
    });

    if (record) {
      // Update existing record
      record.holidayDays = holidayDays;
      record.nightShiftDays = nightShiftDays;
      record.holidayBonusRate =
        holidayBonusRate || employeeData.holidayBonusPerDay;
      record.nightShiftBonusRate =
        nightShiftBonusRate || employeeData.nightShiftBonusPerDay;
      record.totalSalary = totalSalary;

      await record.save();
      res.json(record);
    } else {
      // Create new record
      const newRecord = new EmployeeSalaryRecord({
        employee,
        month,
        year,
        holidayDays,
        nightShiftDays,
        holidayBonusRate: holidayBonusRate || employeeData.holidayBonusPerDay,
        nightShiftBonusRate:
          nightShiftBonusRate || employeeData.nightShiftBonusPerDay,
        totalSalary,
      });

      const savedRecord = await newRecord.save();
      res.status(201).json(savedRecord);
    }
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error - violating the unique constraint
      return res.status(400).json({
        message:
          "A salary record already exists for this employee for the specified month and year.",
      });
    }
    res.status(500).json({ message: err.message });
  }
};

// Delete salary record
exports.deleteEmployeeSalaryRecord = async (req, res) => {
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
    const record = await EmployeeSalaryRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    await record.deleteOne();
    res.json({ message: "Salary record deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
