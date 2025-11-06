// controllers/financeCostCenterConstructionController.js
const CostCenter = require("../models/CostCenter");
const FinanceCostCenterConstructionLog = require("../models/FinanceCostCenterConstructionLog");

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
  entryId = null,
  requestData = null
) => {
  const logData = {
    userId: req.user.id,
    username: req.user.username,
    userRole: req.user.role,
    userDepartment: req.user.department,
    action: action,
    controller: "financeCostCenterConstructionController",
    costCenterId: costCenterId,
    entryId: entryId,
    entryType: "construction",
    requestData: requestData,
    responseStatus: res.statusCode,
    responseMessage: res.statusMessage || getResponseMessage(res),
    ipAddress: getClientIp(req),
    userAgent: req.get("User-Agent"),
  };

  await FinanceCostCenterConstructionLog.logAction(logData);
};

// Helper to extract response message
const getResponseMessage = (res) => {
  return "Operation completed";
};

// Get construction entries for a specific cost center
exports.getConstructionEntries = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua sắm và xây dựng")
    ) {
      await logAction(req, res, "GET_CONSTRUCTION_ENTRIES", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua sắm và xây dựng",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter) {
      await logAction(
        req,
        res,
        "GET_CONSTRUCTION_ENTRIES",
        costCenterId,
        null,
        {
          error: "Cost center not found",
        }
      );
      return res.status(404).json({ message: "Cost center not found" });
    }

    await logAction(req, res, "GET_CONSTRUCTION_ENTRIES", costCenterId, null, {
      entriesCount: costCenter.construction
        ? costCenter.construction.length
        : 0,
    });

    res.json(costCenter.construction || []);
  } catch (error) {
    await logAction(
      req,
      res,
      "GET_CONSTRUCTION_ENTRIES",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      }
    );
    res.status(500).json({ message: error.message });
  }
};

// Add new construction entry to a cost center
exports.addConstructionEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua sắm và xây dựng")
    ) {
      await logAction(req, res, "ADD_CONSTRUCTION_ENTRY", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua sắm và xây dựng",
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
      await logAction(req, res, "ADD_CONSTRUCTION_ENTRY", costCenterId, null, {
        error: "Invalid date format",
        dateProvided: date,
        requiredFormat: "DD/MM/YYYY",
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      await logAction(req, res, "ADD_CONSTRUCTION_ENTRY", costCenterId, null, {
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

    // Initialize construction array if it doesn't exist
    if (!costCenter.construction) {
      costCenter.construction = [];
    }

    costCenter.construction.push(newEntry);
    await costCenter.save();

    // Get the saved entry ID
    const savedEntry =
      costCenter.construction[costCenter.construction.length - 1];

    await logAction(
      req,
      res,
      "ADD_CONSTRUCTION_ENTRY",
      costCenterId,
      savedEntry._id,
      {
        entryData: {
          name: newEntry.name,
          income: newEntry.income,
          expense: newEntry.expense,
          date: newEntry.date,
        },
      }
    );

    res.status(201).json(newEntry);
  } catch (error) {
    await logAction(
      req,
      res,
      "ADD_CONSTRUCTION_ENTRY",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      }
    );
    res.status(400).json({ message: error.message });
  }
};

// Update construction entry in a cost center
exports.updateConstructionEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua sắm và xây dựng")
    ) {
      await logAction(req, res, "UPDATE_CONSTRUCTION_ENTRY", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua sắm và xây dựng",
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
      await logAction(
        req,
        res,
        "UPDATE_CONSTRUCTION_ENTRY",
        costCenterId,
        entryId,
        {
          error: "Invalid date format",
          dateProvided: date,
          requiredFormat: "DD/MM/YYYY",
        }
      );
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter || !costCenter.construction) {
      await logAction(
        req,
        res,
        "UPDATE_CONSTRUCTION_ENTRY",
        costCenterId,
        entryId,
        {
          error: "Cost center or construction entries not found",
        }
      );
      return res
        .status(404)
        .json({ message: "Cost center or construction entries not found" });
    }

    const entry = costCenter.construction.id(entryId);
    if (!entry) {
      await logAction(
        req,
        res,
        "UPDATE_CONSTRUCTION_ENTRY",
        costCenterId,
        entryId,
        {
          error: "Entry not found",
        }
      );
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

    await logAction(
      req,
      res,
      "UPDATE_CONSTRUCTION_ENTRY",
      costCenterId,
      entryId,
      {
        oldValues: oldValues,
        newValues: {
          name: entry.name,
          income: entry.income,
          expense: entry.expense,
          date: entry.date,
        },
      }
    );

    res.json(entry);
  } catch (error) {
    await logAction(
      req,
      res,
      "UPDATE_CONSTRUCTION_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      }
    );
    res.status(400).json({ message: error.message });
  }
};

// Delete construction entry from a cost center
exports.deleteConstructionEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua sắm và xây dựng")
    ) {
      await logAction(req, res, "DELETE_CONSTRUCTION_ENTRY", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua sắm và xây dựng",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter || !costCenter.construction) {
      await logAction(
        req,
        res,
        "DELETE_CONSTRUCTION_ENTRY",
        costCenterId,
        entryId,
        {
          error: "Cost center or construction entries not found",
        }
      );
      return res
        .status(404)
        .json({ message: "Cost center or construction entries not found" });
    }

    const entryToDelete = costCenter.construction.id(entryId);
    if (!entryToDelete) {
      await logAction(
        req,
        res,
        "DELETE_CONSTRUCTION_ENTRY",
        costCenterId,
        entryId,
        {
          error: "Entry not found",
        }
      );
      return res.status(404).json({ message: "Entry not found" });
    }

    // Store entry data for logging before deletion
    const deletedEntryData = {
      name: entryToDelete.name,
      income: entryToDelete.income,
      expense: entryToDelete.expense,
      date: entryToDelete.date,
    };

    costCenter.construction.pull(entryId);
    await costCenter.save();

    await logAction(
      req,
      res,
      "DELETE_CONSTRUCTION_ENTRY",
      costCenterId,
      entryId,
      {
        deletedEntry: deletedEntryData,
      }
    );

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    await logAction(
      req,
      res,
      "DELETE_CONSTRUCTION_ENTRY",
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
      !req.user.permissions?.includes("Nhập liệu tài chính mua sắm và xây dựng")
    ) {
      await logAction(req, res, "GET_COST_CENTERS_CONSTRUCTION", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua sắm và xây dựng",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Fetch cost centers sorted alphabetically by name
    const costCenters = await CostCenter.find({}, "name _id").sort({ name: 1 });

    await logAction(req, res, "GET_COST_CENTERS_CONSTRUCTION", null, null, {
      costCentersCount: costCenters.length,
    });

    res.json(costCenters);
  } catch (error) {
    await logAction(req, res, "GET_COST_CENTERS_CONSTRUCTION", null, null, {
      error: error.message,
    });
    res.status(500).json({ message: error.message });
  }
};
