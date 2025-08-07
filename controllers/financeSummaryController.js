// controllers/financeSummaryController.js
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const FinanceGas = require("../models/FinanceGas");
const CostCenter = require("../models/CostCenter");
const DocumentPayment = require("../models/DocumentPayment");

exports.getAllCostCenters = async (req, res) => {
  try {
    const costCenters = await CostCenter.find().select("name -_id"); // Only get the name field

    const sortedCostCenters = costCenters.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    res.json(sortedCostCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

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

// Helper function to extract month and year from submission date
const getMonthYearFromSubmissionDate = (submissionDate) => {
  try {
    // Parse DD-MM-YYYY HH:MM:SS format
    if (!submissionDate || typeof submissionDate !== "string") {
      return null;
    }

    // Extract date part (DD-MM-YYYY) from "DD-MM-YYYY HH:MM:SS"
    const datePart = submissionDate.split(" ")[0];
    const [day, month, year] = datePart.split("-");

    // Validate the parsed values
    if (!day || !month || !year) {
      return null;
    }

    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);

    // Basic validation
    if (
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      parsedYear < 1900 ||
      parsedYear > 3000
    ) {
      return null;
    }

    return {
      month: parsedMonth,
      year: parsedYear,
    };
  } catch (error) {
    console.error("Error parsing submission date:", submissionDate, error);
    return null;
  }
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
    const costCenterNames = costCenters.map((cc) => cc.name);

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

    // Get all payment documents for the specified year
    const paymentDocuments = await DocumentPayment.find({
      costCenter: { $in: costCenterNames },
    }).lean();

    // Filter payment documents by submission year and create a map
    const costCenterPaymentMap = {}; // To accumulate payments by cost center per month

    paymentDocuments.forEach((doc) => {
      const dateInfo = getMonthYearFromSubmissionDate(doc.submissionDate);
      if (!dateInfo) {
        return; // Skip if invalid date
      }

      // Align with your existing month-shifting logic:
      // Payment in March (month 3) should be attributed to recordMonth 4 of the target year
      let recordMonth = dateInfo.month + 1;
      let recordYear = dateInfo.year;

      // Handle year boundary: December payments should be attributed to January of next year
      if (recordMonth > 12) {
        recordMonth = 1;
        recordYear += 1;
      }

      // Only include payments that align with the requested year
      if (recordYear !== parseInt(year)) {
        return;
      }

      const key = `${doc.costCenter}-${recordMonth}-${recordYear}`;

      if (!costCenterPaymentMap[key]) {
        costCenterPaymentMap[key] = 0;
      }
      costCenterPaymentMap[key] += doc.totalPayment || 0;
    });

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

    // Second pass: Calculate net revenue including payment documents
    for (const costCenterName of costCenterNames) {
      for (let month = 1; month <= 12; month++) {
        // Calculate the actual month (previous month)
        let actualMonthNumber = month - 1;
        let actualYear = parseInt(year);

        if (actualMonthNumber === 0) {
          actualMonthNumber = 12;
          actualYear -= 1;
        }

        const vietnameseMonth = monthNumberToVietnamese[actualMonthNumber];

        // Initialize default values
        let totalSale = 0;
        let totalPurchase = 0;
        let totalTransport = 0;
        let totalCommissionPurchase = 0;
        let totalCommissionSale = 0;
        let totalSalary = 0;
        let totalPayments = 0;

        // Find matching finance data
        const center = financeData.find((c) => c.name === costCenterName);
        if (center) {
          const yearData = center.years.find((y) => y.year === actualYear);
          if (yearData) {
            const monthData = yearData.months.find(
              (m) => m.name === vietnameseMonth
            );
            if (monthData) {
              // Calculate total values across all entries
              monthData.entries.forEach((entry) => {
                totalSale += entry.saleContract?.totalCost || 0;
                totalPurchase += entry.purchaseContract?.totalCost || 0;
                totalTransport += entry.transportCost || 0;
                totalCommissionPurchase += entry.commissionBonus?.purchase || 0;
                totalCommissionSale += entry.commissionBonus?.sale || 0;
              });
            }
          }
        }

        // Get total salary for this cost center/month
        const salaryKey = `${costCenterName}-${month}-${year}`;
        totalSalary = costCenterSalaryMap[salaryKey] || 0;

        // Get total payments for this cost center/month
        const paymentKey = `${costCenterName}-${month}-${year}`;
        totalPayments = costCenterPaymentMap[paymentKey] || 0;

        // Calculate net revenue (subtract payments from the calculation)
        const netRevenue =
          totalSale -
          totalPurchase -
          totalTransport -
          totalCommissionPurchase -
          totalCommissionSale -
          totalSalary -
          totalPayments;

        results.push({
          costCenter: costCenterName,
          realName: "N/A",
          username: "N/A",
          department: "N/A",
          recordMonth: month,
          recordYear: parseInt(year),
          actualMonth: vietnameseMonth,
          actualYear: actualYear,
          grossSalary: totalSalary,
          totalSale: totalSale,
          totalPurchase: totalPurchase,
          totalTransport: totalTransport,
          totalCommissionPurchase: totalCommissionPurchase,
          totalCommissionSale: totalCommissionSale,
          totalSalary: totalSalary,
          totalPayments: totalPayments, // Add this new field
          netRevenue: netRevenue,
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Error in getRevenueByCostCenter:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
