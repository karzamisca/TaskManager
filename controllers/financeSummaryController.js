//controllers/financeSummaryController.js
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const FinanceGas = require("../models/FinanceGas");
const CostCenter = require("../models/CostCenter");

// Map month numbers to Vietnamese month names
const monthNumberToVietnamese = {
  1: "Tháng Một",
  2: "Tháng Hai",
  3: "Tháng Ba",
  4: "Tháng Tư",
  5: "Tháng Năm",
  6: "Tháng Sáu",
  7: "Tháng Bảy",
  8: "Tháng Tám",
  9: "Tháng Chín",
  10: "Tháng Mười",
  11: "Tháng Mười Một",
  12: "Tháng Mười Hai",
};

// Get revenue by matching cost centers
exports.getRevenueByCostCenter = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Year parameter is required" });
    }

    // Get all cost centers
    const costCenters = await CostCenter.find().lean();

    // Get all user monthly records for the specified year
    const userRecords = await UserMonthlyRecord.find({
      recordYear: parseInt(year),
    })
      .populate("costCenter")
      .lean();

    // Get all finance gas data for the specified year
    const financeData = await FinanceGas.find({
      "years.year": parseInt(year),
    }).lean();

    // Process the data
    const results = [];

    for (const record of userRecords) {
      if (!record.costCenter) continue;

      // Calculate the actual month (previous month)
      let actualMonthNumber = record.recordMonth - 1;
      let actualYear = record.recordYear;

      if (actualMonthNumber === 0) {
        actualMonthNumber = 12;
        actualYear -= 1;
      }

      const vietnameseMonth = monthNumberToVietnamese[actualMonthNumber];

      // Find matching finance data
      for (const center of financeData) {
        if (center.name === record.costCenter.name) {
          const yearData = center.years.find((y) => y.year === actualYear);
          if (!yearData) continue;

          const monthData = yearData.months.find(
            (m) => m.name === vietnameseMonth
          );
          if (!monthData) continue;

          // Calculate total revenue (sum of all entries' saleContract.totalCost)
          const totalRevenue = monthData.entries.reduce(
            (sum, entry) => sum + (entry.saleContract?.totalCost || 0),
            0
          );

          // Ensure all required fields are present
          results.push({
            costCenter: record.costCenter?.name || "N/A",
            realName: record.realName || "N/A",
            username: record.username || "N/A",
            department: record.department || "N/A",
            recordMonth: record.recordMonth,
            recordYear: record.recordYear,
            actualMonth: vietnameseMonth,
            actualYear: actualYear,
            grossSalary: record.grossSalary || 0,
            totalRevenue: totalRevenue,
            ratio: totalRevenue > 0 ? record.grossSalary / totalRevenue : 0,
          });
        }
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Error in getRevenueByCostCenter:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
