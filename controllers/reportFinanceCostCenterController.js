// controllers/reportFinanceCostCenterController.js
const FinanceGasLog = require("../models/FinanceGasLog");
const FinanceCostCenterBankLog = require("../models/FinanceCostCenterBankLog");
const FinanceCostCenterConstructionLog = require("../models/FinanceCostCenterConstructionLog");
const path = require("path");

// Serve the HTML page with role-based access control
exports.getReportFinanceCostCenterPage = (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("reportFinanceCostCenter.html", {
    root: "./views/reportPages/reportFinanceCostCenter",
  });
};

// Get logs with pagination - only fetch the requested page
exports.getLogs = async (req, res) => {
  try {
    const {
      type = "all",
      user,
      action,
      dateFrom,
      dateTo,
      page = 1,
      limit = 30,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object based on query parameters
    const filter = {};

    if (type !== "all") {
      filter.controller = getControllerByType(type);
    }

    if (user) {
      filter.username = { $regex: user, $options: "i" };
    }

    if (action && action !== "all") {
      filter.action = action;
    }

    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) {
        // Include the entire end date
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = endDate;
      }
    }

    // Use aggregation pipeline for better performance
    const pipeline = [
      { $match: filter },
      { $sort: { timestamp: -1 } },
      {
        $facet: {
          metadata: [{ $count: "totalCount" }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    ];

    // Query each collection based on type filter
    let results = {
      gas: { data: [], total: 0 },
      bank: { data: [], total: 0 },
      construction: { data: [], total: 0 },
    };

    const queries = [];

    if (type === "all" || type === "gas") {
      queries.push(
        FinanceGasLog.aggregate(pipeline).then((result) => {
          results.gas.data = result[0]?.data || [];
          results.gas.total = result[0]?.metadata[0]?.totalCount || 0;
        }),
      );
    }

    if (type === "all" || type === "bank") {
      queries.push(
        FinanceCostCenterBankLog.aggregate(pipeline).then((result) => {
          results.bank.data = result[0]?.data || [];
          results.bank.total = result[0]?.metadata[0]?.totalCount || 0;
        }),
      );
    }

    if (type === "all" || type === "construction") {
      queries.push(
        FinanceCostCenterConstructionLog.aggregate(pipeline).then((result) => {
          results.construction.data = result[0]?.data || [];
          results.construction.total = result[0]?.metadata[0]?.totalCount || 0;
        }),
      );
    }

    await Promise.all(queries);

    // For "all" type, we need to merge and re-sort
    let logs = [];
    let totalCount = 0;

    if (type === "all") {
      // Combine all logs
      const allData = [
        ...results.gas.data.map((log) => ({ ...log, type: "gas" })),
        ...results.bank.data.map((log) => ({ ...log, type: "bank" })),
        ...results.construction.data.map((log) => ({
          ...log,
          type: "construction",
        })),
      ];

      // Sort combined results
      logs = allData.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      );

      // Get total count from all collections
      totalCount =
        results.gas.total + results.bank.total + results.construction.total;
    } else {
      // Single type
      const typeData = results[type];
      logs = typeData.data.map((log) => ({ ...log, type }));
      totalCount = typeData.total;
    }

    // Add type information to logs if not already present
    logs.forEach((log) => {
      if (!log.type) {
        if (log.controller === "financeGasController") {
          log.type = "gas";
        } else if (log.action && log.action.includes("CONSTRUCTION")) {
          log.type = "construction";
        } else {
          log.type = "bank";
        }
      }
    });

    res.json({
      logs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalCount,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ message: "Lỗi khi tải nhật ký" });
  }
};

// Helper function to get controller by type
function getControllerByType(type) {
  const controllers = {
    gas: "financeGasController",
    bank: "financeCostCenterBankController",
    construction: "financeCostCenterConstructionController",
  };
  return controllers[type];
}
