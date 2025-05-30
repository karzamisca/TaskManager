//controllers\userController.js
const User = require("../models/User");
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const CostCenter = require("../models/CostCenter");

exports.getUserMainPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    res.sendFile("userMain.html", {
      root: "./views/userPages/userMain",
    });
  } catch (error) {
    console.error("Error serving the user main page:", error);
    res.send("Server error");
  }
};

exports.getUserSalaryCalculationPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    res.sendFile("userSalaryCalculation.html", {
      root: "./views/userPages/userSalaryCalculation",
    });
  } catch (error) {
    console.error("Error serving the user's salary page:", error);
    res.send("Server error");
  }
};

exports.getManagers = async (req, res) => {
  try {
    const privilegedRoles = [
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfMechanical",
      "headOfTechnical",
      "headOfAccounting",
      "headOfPurchasing",
      "headOfOperations",
      "headOfNorthernRepresentativeOffice",
    ];

    const managers = await User.find({
      role: { $in: privilegedRoles },
    }).select("_id username role"); // Only return necessary fields

    res.json(managers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all users except privileged roles
exports.getAllUsers = async (req, res) => {
  try {
    const privilegedRoles = ["superAdmin", "deputyDirector", "director"];

    // Always exclude privileged roles from results
    const baseQuery = {
      role: { $nin: privilegedRoles },
    };

    let finalQuery = { ...baseQuery };

    // If user is not in privileged roles, only show users they manage
    if (!privilegedRoles.includes(req.user.role)) {
      finalQuery.assignedManager = req._id;
    }

    const users = await User.find(finalQuery).populate("costCenter").populate({
      path: "assignedManager",
      select: "username role", // Only return these fields for manager
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const user = await User.findById(req.params.id).populate("costCenter");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    const {
      username,
      costCenter,
      assignedManager,
      baseSalary,
      commissionBonus,
      holidayBonusPerDay,
      nightShiftBonusPerDay,
      insurableSalary,
      currentHolidayDays,
      currentNightShiftDays,
      travelExpense,
    } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const costCenterExists = await CostCenter.findById(costCenter);
    if (!costCenterExists) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newUser = new User({
      username,
      costCenter,
      assignedManager,
      baseSalary,
      commissionBonus: commissionBonus || 0,
      holidayBonusPerDay: holidayBonusPerDay || 0,
      nightShiftBonusPerDay: nightShiftBonusPerDay || 0,
      insurableSalary: insurableSalary || 0,
      currentHolidayDays: currentHolidayDays || 0,
      currentNightShiftDays: currentNightShiftDays || 0,
      dependantCount: req.body.dependantCount || 0,
      travelExpense: travelExpense || 0,
    });

    const savedUser = await newUser.save();
    await savedUser.populate("costCenter");
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    const {
      username,
      costCenter,
      assignedManager,
      baseSalary,
      commissionBonus,
      holidayBonusPerDay,
      nightShiftBonusPerDay,
      insurableSalary,
      currentHolidayDays,
      currentNightShiftDays,
      travelExpense,
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      user.username = username;
    }

    if (costCenter) {
      const costCenterExists = await CostCenter.findById(costCenter);
      if (!costCenterExists) {
        return res.status(404).json({ message: "Cost center not found" });
      }
      user.costCenter = costCenter;
    }

    if (baseSalary !== undefined) user.baseSalary = baseSalary;
    if (commissionBonus !== undefined) {
      user.commissionBonus = commissionBonus;
    }
    if (holidayBonusPerDay !== undefined)
      user.holidayBonusPerDay = holidayBonusPerDay;
    if (nightShiftBonusPerDay !== undefined)
      user.nightShiftBonusPerDay = nightShiftBonusPerDay;
    if (insurableSalary !== undefined) user.insurableSalary = insurableSalary;
    if (currentHolidayDays !== undefined)
      user.currentHolidayDays = currentHolidayDays;
    if (currentNightShiftDays !== undefined)
      user.currentNightShiftDays = currentNightShiftDays;
    if (travelExpense !== undefined) user.travelExpense = travelExpense;
    if (assignedManager) {
      const managerExists = await User.findById(assignedManager);
      if (!managerExists) {
        return res.status(404).json({ message: "Manager not found" });
      }
      user.assignedManager = assignedManager;
    }
    if (req.body.dependantCount !== undefined) {
      user.dependantCount = req.body.dependantCount;
    }

    const updatedUser = await user.save();
    await updatedUser.populate("costCenter");
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await user.deleteOne();
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllCostCenters = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    // Fetch all cost centers
    const costCenters = await CostCenter.find();

    // Sort the cost centers alphabetically by name
    // Assuming each cost center has a 'name' field - adjust if your field is named differently
    const sortedCostCenters = costCenters.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    res.json(sortedCostCenters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserMonthlyRecordPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    res.sendFile("userMonthlyRecord.html", {
      root: "./views/userPages/userMonthlyRecord",
    });
  } catch (error) {
    console.error("Error serving the user main page:", error);
    res.send("Server error");
  }
};
exports.getAllUserMonthlyRecord = async (req, res) => {
  try {
    const records = await UserMonthlyRecord.find()
      .populate("userId", "username")
      .populate("costCenter", "name")
      .populate("assignedManager", "username")
      .sort({ recordYear: -1, recordMonth: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
