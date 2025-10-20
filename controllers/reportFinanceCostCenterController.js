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

// Get all logs without pagination
exports.getLogs = async (req, res) => {
  try {
    const { type = "all", user, action, dateFrom, dateTo } = req.query;

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
      if (dateTo) filter.timestamp.$lte = new Date(dateTo);
    }

    // Get all logs without pagination
    const [gasLogs, bankLogs, constructionLogs] = await Promise.all([
      type === "all" || type === "gas"
        ? FinanceGasLog.find(filter).sort({ timestamp: -1 }).lean()
        : [],
      type === "all" || type === "bank"
        ? FinanceCostCenterBankLog.find(filter).sort({ timestamp: -1 }).lean()
        : [],
      type === "all" || type === "construction"
        ? FinanceCostCenterConstructionLog.find(filter)
            .sort({ timestamp: -1 })
            .lean()
        : [],
    ]);

    // Combine and sort all logs
    const allLogs = [...gasLogs, ...bankLogs, ...constructionLogs].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Add type information to each log
    allLogs.forEach((log) => {
      if (log.controller === "financeGasController") {
        log.type = "gas";
      } else {
        // Determine if it's bank or construction based on action or other fields
        if (log.action && log.action.includes("CONSTRUCTION")) {
          log.type = "construction";
        } else {
          log.type = "bank";
        }
      }
    });

    res.json({
      logs: allLogs,
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
