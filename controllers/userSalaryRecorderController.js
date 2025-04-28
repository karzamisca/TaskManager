const UserSalaryRecord = require("../models/UserSalaryRecord");
const User = require("../models/User");

exports.getUserSalaryRecordPage = (req, res) => {
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
    res.sendFile("userSalaryRecord.html", {
      root: "./views/userPages/userSalaryRecord",
    });
  } catch (error) {
    console.error("Error serving the user's salary page:", error);
    res.send("Server error");
  }
};

exports.getAllUserSalaryRecords = async (req, res) => {
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
    const records = await UserSalaryRecord.find().populate({
      path: "user",
      populate: { path: "costCenter" },
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserSalaryRecordById = async (req, res) => {
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
    const record = await UserSalaryRecord.findById(req.params.id).populate({
      path: "user",
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

exports.createOrUpdateUserSalaryRecord = async (req, res) => {
  try {
    // Authorization check
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
      user,
      month,
      year,
      holidayDays,
      nightShiftDays,
      holidayBonusRate,
      nightShiftBonusRate,
    } = req.body;

    // Get user with populated costCenter
    const userData = await User.findById(user).populate("costCenter");
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate cost center exists
    if (!userData.costCenter) {
      return res.status(400).json({
        message: "User has no cost center assigned",
      });
    }

    // Calculate total salary
    const baseSalary = userData.baseSalary;
    const holidayBonus =
      holidayDays * (holidayBonusRate || userData.holidayBonusPerDay);
    const nightShiftBonus =
      nightShiftDays * (nightShiftBonusRate || userData.nightShiftBonusPerDay);
    const socialInsurance = userData.socialInsurance;
    const totalSalary =
      baseSalary + holidayBonus + nightShiftBonus - socialInsurance;

    // Check for existing record
    let record = await UserSalaryRecord.findOne({ user, month, year });

    if (record) {
      // Update existing record
      record.username = userData.username;
      record.costCenter = userData.costCenter._id;
      record.costCenterName = userData.costCenter.name;
      record.holidayDays = holidayDays;
      record.nightShiftDays = nightShiftDays;
      record.holidayBonusRate = holidayBonusRate || userData.holidayBonusPerDay;
      record.nightShiftBonusRate =
        nightShiftBonusRate || userData.nightShiftBonusPerDay;
      record.totalSalary = totalSalary;

      const updatedRecord = await record.save();
      return res.json(updatedRecord);
    }

    // Create new record
    const newRecord = new UserSalaryRecord({
      user,
      username: userData.username,
      costCenter: userData.costCenter._id,
      costCenterName: userData.costCenter.name,
      month,
      year,
      holidayDays,
      nightShiftDays,
      holidayBonusRate: holidayBonusRate || userData.holidayBonusPerDay,
      nightShiftBonusRate:
        nightShiftBonusRate || userData.nightShiftBonusPerDay,
      totalSalary,
    });

    const savedRecord = await newRecord.save();
    return res.status(201).json(savedRecord);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        message:
          "A salary record already exists for this user for the specified month and year.",
      });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation error",
        details: err.errors,
      });
    }

    console.error("Error in createOrUpdateUserSalaryRecord:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUserSalaryRecord = async (req, res) => {
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
    const record = await UserSalaryRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Salary record not found" });
    }
    await record.deleteOne();
    res.json({ message: "Salary record deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
