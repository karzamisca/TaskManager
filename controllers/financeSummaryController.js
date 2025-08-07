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
    const costCenterSalaryMap = {}; // To accumulate salaries by cost center

    // First pass: Calculate total salaries per cost center per month
    for (const record of userRecords) {
      if (!record.costCenter) continue;

      const key = `${record.costCenter.name}-${record.recordMonth}-${record.recordYear}`;

      if (!costCenterSalaryMap[key]) {
        costCenterSalaryMap[key] = 0;
      }
      costCenterSalaryMap[key] += record.grossSalary || 0;
    }

    // Second pass: Calculate net revenue
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

          // Calculate total values across all entries
          let totalSale = 0;
          let totalPurchase = 0;
          let totalTransport = 0;
          let totalCommissionPurchase = 0;
          let totalCommissionSale = 0;

          monthData.entries.forEach((entry) => {
            totalSale += entry.saleContract?.totalCost || 0;
            totalPurchase += entry.purchaseContract?.totalCost || 0;
            totalTransport += entry.transportCost || 0;
            totalCommissionPurchase += entry.commissionBonus?.purchase || 0;
            totalCommissionSale += entry.commissionBonus?.sale || 0;
          });

          // Get total salary for this cost center/month
          const salaryKey = `${record.costCenter.name}-${record.recordMonth}-${record.recordYear}`;
          const totalSalary = costCenterSalaryMap[salaryKey] || 0;

          // Calculate net revenue
          const netRevenue =
            totalSale -
            totalPurchase -
            totalTransport -
            totalCommissionPurchase -
            totalCommissionSale -
            totalSalary;

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
            totalSale: totalSale,
            totalPurchase: totalPurchase,
            totalTransport: totalTransport,
            totalCommissionPurchase: totalCommissionPurchase,
            totalCommissionSale: totalCommissionSale,
            totalSalary: totalSalary,
            netRevenue: netRevenue,
            ratio: totalSale > 0 ? totalSalary / totalSale : 0,
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
