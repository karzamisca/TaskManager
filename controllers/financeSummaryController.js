// controllers/financeSummaryController.js
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const CostCenter = require("../models/CostCenter");
const CostCenterGroup = require("../models/CostCenterGroup");
const DocumentPayment = require("../models/DocumentPayment");

exports.getAllCostCenters = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }
  try {
    const costCenters = await CostCenter.find().select("name category -_id"); // Include category field

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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }
  try {
    const { year, costCenters, category } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Year parameter is required" });
    }

    // Get all cost centers with optional category filter
    let query = {};
    if (category && category !== "all") {
      query.category = category;
    }

    const allCostCenters = await CostCenter.find(query).lean();
    let costCenterNames = allCostCenters.map((cc) => cc.name);

    // Filter by selected cost centers if provided
    if (costCenters && costCenters.trim() !== "") {
      const selectedCostCenters = costCenters
        .split(",")
        .map((cc) => cc.trim())
        .filter((cc) => cc);
      if (selectedCostCenters.length > 0) {
        // Filter to only include selected cost centers that exist in the database
        costCenterNames = costCenterNames.filter((name) =>
          selectedCostCenters.includes(name)
        );

        // If no valid cost centers are found, return empty result
        if (costCenterNames.length === 0) {
          return res.json([]);
        }
      }
    }

    // Get all user monthly records for the specified year and cost centers
    // EXCLUDE management roles: deputyDirector, director, headOfAccounting
    const userRecords = await UserMonthlyRecord.find({
      recordYear: parseInt(year),
      role: {
        $nin: ["deputyDirector", "director", "headOfAccounting"],
      },
    })
      .populate("costCenter")
      .lean();

    // Filter user records by selected cost centers
    const filteredUserRecords = userRecords.filter(
      (record) =>
        record.costCenter && costCenterNames.includes(record.costCenter.name)
    );

    // Get all finance data from the merged CostCenter model
    const financeData = await CostCenter.find({
      "years.year": parseInt(year),
      name: { $in: costCenterNames },
    }).lean();

    // Get all payment documents for the specified year and cost centers
    const paymentDocuments = await DocumentPayment.find({
      costCenter: { $in: costCenterNames },
    }).lean();

    // Get construction data for the specified year
    const constructionData = await CostCenter.find({
      "construction.date": { $regex: `/${year}$` }, // Match dates ending with the year
      name: { $in: costCenterNames },
    }).select("name construction");

    // Filter payment documents by submission year and create a map
    const costCenterPaymentMap = {}; // To accumulate payments by cost center per month

    paymentDocuments.forEach((doc) => {
      // Check if the document has stages
      if (doc.stages && doc.stages.length > 0) {
        // Process each stage separately
        doc.stages.forEach((stage) => {
          const dateInfo = getMonthYearFromSubmissionDate(stage.deadline);
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

          // Use stage amount instead of totalPayment
          costCenterPaymentMap[key] += stage.amount || 0;
        });
      } else {
        // Original logic for documents without stages
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

        // Use totalPayment for documents without stages
        costCenterPaymentMap[key] += doc.totalPayment || 0;
      }
    });

    // Process construction data by month
    const costCenterConstructionMap = {};

    constructionData.forEach((center) => {
      center.construction.forEach((construction) => {
        // Parse the date (DD/MM/YYYY format)
        const [day, month, year] = construction.date.split("/");
        const monthKey = `${parseInt(month)}-${year}`;
        const recordKey = `${center.name}-${monthKey}`;

        if (!costCenterConstructionMap[recordKey]) {
          costCenterConstructionMap[recordKey] = {
            income: 0,
            expense: 0,
            net: 0,
          };
        }

        costCenterConstructionMap[recordKey].income += construction.income || 0;
        costCenterConstructionMap[recordKey].expense +=
          construction.expense || 0;
        costCenterConstructionMap[recordKey].net +=
          construction.income - construction.expense || 0;
      });
    });

    // Process the data
    const results = [];
    const costCenterSalaryMap = {}; // To accumulate salaries by cost center

    // First pass: Calculate total salaries per cost center per month
    // FIXED: Using currentSalary instead of grossSalary
    // Management roles (deputyDirector, director, headOfAccounting) are already excluded from userRecords
    for (const record of filteredUserRecords) {
      if (!record.costCenter) continue;

      const key = `${record.costCenter.name}-${record.recordMonth}-${record.recordYear}`;

      if (!costCenterSalaryMap[key]) {
        costCenterSalaryMap[key] = 0;
      }
      // Using currentSalary (net salary after deductions)
      costCenterSalaryMap[key] += record.currentSalary || 0;
    }

    // Second pass: Calculate net revenue including payment documents AND construction
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

        // Initialize construction values
        let constructionIncome = 0;
        let constructionExpense = 0;
        let constructionNet = 0;

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

        // Get total salary for this cost center/month (excluding management roles)
        const salaryKey = `${costCenterName}-${month}-${year}`;
        totalSalary = costCenterSalaryMap[salaryKey] || 0;

        // Get total payments for this cost center/month
        const paymentKey = `${costCenterName}-${month}-${year}`;
        totalPayments = costCenterPaymentMap[paymentKey] || 0;

        // Get construction data for this cost center and month
        const constructionKey = `${costCenterName}-${month}-${year}`;
        const constructionDataForMonth =
          costCenterConstructionMap[constructionKey];
        if (constructionDataForMonth) {
          constructionIncome = constructionDataForMonth.income;
          constructionExpense = constructionDataForMonth.expense;
          constructionNet = constructionDataForMonth.net;
        }

        // Calculate net revenue
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
          totalSale: totalSale,
          totalPurchase: totalPurchase,
          totalTransport: totalTransport,
          totalCommissionPurchase: totalCommissionPurchase,
          totalCommissionSale: totalCommissionSale,
          totalSalary: totalSalary, // Sum of all employee salaries (EXCLUDING management roles)
          totalPayments: totalPayments,
          constructionIncome: constructionIncome,
          constructionExpense: constructionExpense,
          constructionNet: constructionNet,
          netRevenue: netRevenue,
        });
      }
    }

    // Sort results by cost center name and then by month
    results.sort((a, b) => {
      if (a.costCenter !== b.costCenter) {
        return a.costCenter.localeCompare(b.costCenter);
      }
      return a.recordMonth - b.recordMonth;
    });

    res.json(results);
  } catch (error) {
    console.error("Error in getRevenueByCostCenter:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createCostCenterGroup = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }
  try {
    const { name, costCenters } = req.body;
    const createdBy = req.user._id;

    const newGroup = new CostCenterGroup({
      name,
      costCenters,
      createdBy,
    });

    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (error) {
    console.error("Error creating cost center group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getCostCenterGroups = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }
  try {
    const groups = await CostCenterGroup.find();
    res.json(groups);
  } catch (error) {
    console.error("Error fetching cost center groups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteCostCenterGroup = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }
  try {
    const { id } = req.params;
    const group = await CostCenterGroup.findOneAndDelete({
      _id: id,
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error deleting cost center group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
