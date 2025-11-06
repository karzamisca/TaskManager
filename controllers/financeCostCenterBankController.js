// controllers/financeCostCenterBankController.js
const CostCenter = require("../models/CostCenter");
const FinanceCostCenterBankLog = require("../models/FinanceCostCenterBankLog");

// Helper function to get client IP
const getClientIp = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

// Helper function to log actions
const logAction = async (
  req,
  res,
  action,
  costCenterId = null,
  bankEntryId = null,
  requestData = null
) => {
  const logData = {
    userId: req.user.id,
    username: req.user.username,
    userRole: req.user.role,
    userDepartment: req.user.department,
    action: action,
    costCenterId: costCenterId,
    bankEntryId: bankEntryId,
    requestData: requestData,
    responseStatus: res.statusCode,
    responseMessage: res.statusMessage || getResponseMessage(res),
    ipAddress: getClientIp(req),
    userAgent: req.get("User-Agent"),
  };

  await FinanceCostCenterBankLog.logAction(logData);
};

// Helper to extract response message
const getResponseMessage = (res) => {
  // You might need to adjust this based on how you send responses
  return "Operation completed";
};

// Get bank entries for a specific cost center
exports.getBankEntries = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "GET_BANK_ENTRIES", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter) {
      await logAction(req, res, "GET_BANK_ENTRIES", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    await logAction(req, res, "GET_BANK_ENTRIES", costCenterId, null, {
      entriesCount: costCenter.bank ? costCenter.bank.length : 0,
    });

    res.json(costCenter.bank || []);
  } catch (error) {
    await logAction(
      req,
      res,
      "GET_BANK_ENTRIES",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      }
    );
    res.status(500).json({ message: error.message });
  }
};

// Add new bank entry to a cost center
exports.addBankEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "ADD_BANK_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const { name, income, expense, date } = req.body;

    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, null, {
        error: "Invalid date format",
        dateProvided: date,
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newEntry = {
      name,
      income: parseFloat(income) || 0,
      expense: parseFloat(expense) || 0,
      date,
    };

    // Initialize bank array if it doesn't exist
    if (!costCenter.bank) {
      costCenter.bank = [];
    }

    costCenter.bank.push(newEntry);
    await costCenter.save();

    // Get the saved entry ID
    const savedEntry = costCenter.bank[costCenter.bank.length - 1];

    await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, savedEntry._id, {
      entryData: {
        name: newEntry.name,
        income: newEntry.income,
        expense: newEntry.expense,
        date: newEntry.date,
      },
    });

    res.status(201).json(newEntry);
  } catch (error) {
    await logAction(req, res, "ADD_BANK_ENTRY", req.params.costCenterId, null, {
      error: error.message,
    });
    res.status(400).json({ message: error.message });
  }
};

// Update bank entry in a cost center
exports.updateBankEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const { name, income, expense, date } = req.body;

    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (date && !dateRegex.test(date)) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
        error: "Invalid date format",
        dateProvided: date,
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter || !costCenter.bank) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
        error: "Cost center or bank entries not found",
      });
      return res
        .status(404)
        .json({ message: "Cost center or bank entries not found" });
    }

    const entry = costCenter.bank.id(entryId);
    if (!entry) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
        error: "Entry not found",
      });
      return res.status(404).json({ message: "Entry not found" });
    }

    // Store old values for logging
    const oldValues = {
      name: entry.name,
      income: entry.income,
      expense: entry.expense,
      date: entry.date,
    };

    if (name) entry.name = name;
    if (income !== undefined) entry.income = parseFloat(income) || 0;
    if (expense !== undefined) entry.expense = parseFloat(expense) || 0;
    if (date) entry.date = date;

    await costCenter.save();

    await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
      oldValues: oldValues,
      newValues: {
        name: entry.name,
        income: entry.income,
        expense: entry.expense,
        date: entry.date,
      },
    });

    res.json(entry);
  } catch (error) {
    await logAction(
      req,
      res,
      "UPDATE_BANK_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      }
    );
    res.status(400).json({ message: error.message });
  }
};

// Delete bank entry from a cost center
exports.deleteBankEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "DELETE_BANK_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter || !costCenter.bank) {
      await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
        error: "Cost center or bank entries not found",
      });
      return res
        .status(404)
        .json({ message: "Cost center or bank entries not found" });
    }

    const entryToDelete = costCenter.bank.id(entryId);
    if (!entryToDelete) {
      await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
        error: "Entry not found",
      });
      return res.status(404).json({ message: "Entry not found" });
    }

    // Store entry data for logging before deletion
    const deletedEntryData = {
      name: entryToDelete.name,
      income: entryToDelete.income,
      expense: entryToDelete.expense,
      date: entryToDelete.date,
    };

    costCenter.bank.pull(entryId);
    await costCenter.save();

    await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
      deletedEntry: deletedEntryData,
    });

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    await logAction(
      req,
      res,
      "DELETE_BANK_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      }
    );
    res.status(400).json({ message: error.message });
  }
};

// Get all cost centers (for dropdown selection)
exports.getCostCenters = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "GET_COST_CENTERS", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Fetch cost centers sorted alphabetically by name
    const costCenters = await CostCenter.find({}, "name _id").sort({ name: 1 });

    await logAction(req, res, "GET_COST_CENTERS", null, null, {
      costCentersCount: costCenters.length,
    });

    res.json(costCenters);
  } catch (error) {
    await logAction(req, res, "GET_COST_CENTERS", null, null, {
      error: error.message,
    });
    res.status(500).json({ message: error.message });
  }
};
