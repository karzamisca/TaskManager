const FinanceGasLog = require("../models/FinanceGasLog");
const FinanceCostCenterBankLog = require("../models/FinanceCostCenterBankLog");
const FinanceCostCenterConstructionLog = require("../models/FinanceCostCenterConstructionLog");
const path = require("path");

const reportFinanceCostCenterController = {
  async getLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        type = "all",
        user,
        action,
        dateFrom,
        dateTo,
      } = req.query;

      const skip = (page - 1) * limit;

      // Build filter object based on query parameters
      const filter = {};

      if (type !== "all") {
        filter.controller = this.getControllerByType(type);
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

      // Get logs from all collections
      const [gasLogs, bankLogs, constructionLogs] = await Promise.all([
        type === "all" || type === "gas"
          ? FinanceGasLog.find(filter)
              .sort({ timestamp: -1 })
              .skip(skip)
              .limit(parseInt(limit))
              .lean()
          : [],
        type === "all" || type === "bank"
          ? FinanceCostCenterBankLog.find(filter)
              .sort({ timestamp: -1 })
              .skip(skip)
              .limit(parseInt(limit))
              .lean()
          : [],
        type === "all" || type === "construction"
          ? FinanceCostCenterConstructionLog.find(filter)
              .sort({ timestamp: -1 })
              .skip(skip)
              .limit(parseInt(limit))
              .lean()
          : [],
      ]);

      // Combine and sort all logs
      const allLogs = [...gasLogs, ...bankLogs, ...constructionLogs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, parseInt(limit));

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

      // Get total counts for pagination
      const totalCounts = await Promise.all([
        type === "all" || type === "gas"
          ? FinanceGasLog.countDocuments(filter)
          : 0,
        type === "all" || type === "bank"
          ? FinanceCostCenterBankLog.countDocuments(filter)
          : 0,
        type === "all" || type === "construction"
          ? FinanceCostCenterConstructionLog.countDocuments(filter)
          : 0,
      ]);

      const total = totalCounts.reduce((sum, count) => sum + count, 0);

      res.json({
        logs: allLogs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Lỗi khi tải nhật ký" });
    }
  },

  getControllerByType(type) {
    const controllers = {
      gas: "financeGasController",
      bank: "financeCostCenterBankController",
      construction: "financeCostCenterBankController",
    };
    return controllers[type];
  },

  // Serve the HTML page with role-based access control
  getReportFinanceCostCenterPage: (req, res) => {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    res.sendFile("reportFinanceCostCenter.html", {
      root: "./views/reportPages/reportFinanceCostCenter",
    });
  },
};

module.exports = reportFinanceCostCenterController;
