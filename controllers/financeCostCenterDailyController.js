// controllers/financeCostCenterDailyController.js
const CostCenter = require("../models/CostCenter");
const FinanceCostCenterDailyLog = require("../models/FinanceCostCenterDailyLog");

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
  dailyEntryId = null,
  requestData = null,
) => {
  const logData = {
    userId: req.user.id,
    username: req.user.username,
    userRole: req.user.role,
    userDepartment: req.user.department,
    action: action,
    costCenterId: costCenterId,
    dailyEntryId: dailyEntryId,
    requestData: requestData,
    responseStatus: res.statusCode,
    responseMessage: res.statusMessage || getResponseMessage(res),
    ipAddress: getClientIp(req),
    userAgent: req.get("User-Agent"),
  };

  await FinanceCostCenterDailyLog.logAction(logData);
};

// Helper to extract response message
const getResponseMessage = (res) => {
  return "Operation completed";
};

// Get daily entries for a specific cost center
exports.getDailyEntries = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính hàng ngày")
    ) {
      await logAction(req, res, "GET_DAILY_ENTRIES", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter) {
      await logAction(req, res, "GET_DAILY_ENTRIES", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    // Convert entries to include virtual fields
    const entries = (costCenter.daily || []).map((entry) => {
      const entryObj = entry.toObject();
      // Add virtual fields (variance removed)
      entryObj.net = entry.income - entry.expense;
      entryObj.predictedNet =
        (entry.incomePrediction || 0) - (entry.expensePrediction || 0);
      return entryObj;
    });

    await logAction(req, res, "GET_DAILY_ENTRIES", costCenterId, null, {
      entriesCount: entries.length,
    });

    res.json(entries);
  } catch (error) {
    await logAction(
      req,
      res,
      "GET_DAILY_ENTRIES",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      },
    );
    res.status(500).json({ message: error.message });
  }
};

// Add new daily entry to a cost center
exports.addDailyEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính hàng ngày")
    ) {
      await logAction(req, res, "ADD_DAILY_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const {
      name,
      income,
      expense,
      date,
      // Simplified prediction fields
      incomePrediction,
      expensePrediction,
      note,
    } = req.body;

    // Validate required fields
    if (!name || !date) {
      await logAction(req, res, "ADD_DAILY_ENTRY", costCenterId, null, {
        error: "Missing required fields",
        data: { name, date },
      });
      return res.status(400).json({ message: "Name and date are required" });
    }

    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      await logAction(req, res, "ADD_DAILY_ENTRY", costCenterId, null, {
        error: "Invalid date format",
        dateProvided: date,
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      await logAction(req, res, "ADD_DAILY_ENTRY", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newEntry = {
      name: name.trim(),
      income: parseFloat(income) || 0,
      expense: parseFloat(expense) || 0,
      date,
      // Add simplified prediction fields
      incomePrediction: parseFloat(incomePrediction) || 0,
      expensePrediction: parseFloat(expensePrediction) || 0,
      note: note ? note.trim() : "",
    };

    // Initialize daily array if it doesn't exist
    if (!costCenter.daily) {
      costCenter.daily = [];
    }

    costCenter.daily.push(newEntry);
    await costCenter.save();

    // Get the saved entry ID
    const savedEntry = costCenter.daily[costCenter.daily.length - 1];
    const entryWithVirtuals = savedEntry.toObject();
    // Add virtual fields (variance removed)
    entryWithVirtuals.net = savedEntry.income - savedEntry.expense;
    entryWithVirtuals.predictedNet =
      (savedEntry.incomePrediction || 0) - (savedEntry.expensePrediction || 0);

    await logAction(req, res, "ADD_DAILY_ENTRY", costCenterId, savedEntry._id, {
      entryData: newEntry,
    });

    res.status(201).json(entryWithVirtuals);
  } catch (error) {
    await logAction(
      req,
      res,
      "ADD_DAILY_ENTRY",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      },
    );
    res.status(400).json({ message: error.message });
  }
};

// Update daily entry in a cost center
exports.updateDailyEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính hàng ngày")
    ) {
      await logAction(req, res, "UPDATE_DAILY_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const {
      name,
      income,
      expense,
      date,
      // Simplified prediction fields
      incomePrediction,
      expensePrediction,
      note,
    } = req.body;

    // Validate date format if provided
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (date && !dateRegex.test(date)) {
      await logAction(req, res, "UPDATE_DAILY_ENTRY", costCenterId, entryId, {
        error: "Invalid date format",
        dateProvided: date,
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter || !costCenter.daily) {
      await logAction(req, res, "UPDATE_DAILY_ENTRY", costCenterId, entryId, {
        error: "Cost center or daily entries not found",
      });
      return res
        .status(404)
        .json({ message: "Cost center or daily entries not found" });
    }

    const entry = costCenter.daily.id(entryId);
    if (!entry) {
      await logAction(req, res, "UPDATE_DAILY_ENTRY", costCenterId, entryId, {
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
      incomePrediction: entry.incomePrediction,
      expensePrediction: entry.expensePrediction,
      note: entry.note,
    };

    if (name !== undefined) entry.name = name.trim();
    if (income !== undefined) entry.income = parseFloat(income) || 0;
    if (expense !== undefined) entry.expense = parseFloat(expense) || 0;
    if (date !== undefined) entry.date = date;
    if (note !== undefined) entry.note = note.trim();

    // Update simplified prediction fields
    if (incomePrediction !== undefined)
      entry.incomePrediction = parseFloat(incomePrediction) || 0;
    if (expensePrediction !== undefined)
      entry.expensePrediction = parseFloat(expensePrediction) || 0;

    await costCenter.save();

    // Add virtual fields to response (variance removed)
    const updatedEntry = entry.toObject();
    updatedEntry.net = entry.income - entry.expense;
    updatedEntry.predictedNet =
      (entry.incomePrediction || 0) - (entry.expensePrediction || 0);

    await logAction(req, res, "UPDATE_DAILY_ENTRY", costCenterId, entryId, {
      oldValues: oldValues,
      newValues: {
        name: entry.name,
        income: entry.income,
        expense: entry.expense,
        date: entry.date,
        incomePrediction: entry.incomePrediction,
        expensePrediction: entry.expensePrediction,
        note: entry.note,
      },
    });

    res.json(updatedEntry);
  } catch (error) {
    await logAction(
      req,
      res,
      "UPDATE_DAILY_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      },
    );
    res.status(400).json({ message: error.message });
  }
};

// Delete daily entry from a cost center
exports.deleteDailyEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính hàng ngày")
    ) {
      await logAction(req, res, "DELETE_DAILY_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter || !costCenter.daily) {
      await logAction(req, res, "DELETE_DAILY_ENTRY", costCenterId, entryId, {
        error: "Cost center or daily entries not found",
      });
      return res
        .status(404)
        .json({ message: "Cost center or daily entries not found" });
    }

    const entryToDelete = costCenter.daily.id(entryId);
    if (!entryToDelete) {
      await logAction(req, res, "DELETE_DAILY_ENTRY", costCenterId, entryId, {
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
      incomePrediction: entryToDelete.incomePrediction,
      expensePrediction: entryToDelete.expensePrediction,
      note: entryToDelete.note,
    };

    costCenter.daily.pull(entryId);
    await costCenter.save();

    await logAction(req, res, "DELETE_DAILY_ENTRY", costCenterId, entryId, {
      deletedEntry: deletedEntryData,
    });

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    await logAction(
      req,
      res,
      "DELETE_DAILY_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      },
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
      !req.user.permissions?.includes("Nhập liệu tài chính hàng ngày")
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
