// controllers/financeSummaryController.js
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const CostCenter = require("../models/CostCenter");
const CostCenterGroup = require("../models/CostCenterGroup");
const DocumentPayment = require("../models/DocumentPayment");

exports.getAvailableYears = async (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "captainOfFinance",
      "submitterOfFinance",
    ].includes(req.user.role) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  try {
    // Get unique years from UserMonthlyRecord
    const userRecordYears = await UserMonthlyRecord.distinct("recordYear");

    // Get unique years from CostCenter finance data
    const costCenterYears = await CostCenter.distinct("years.year");

    // Get unique years from DocumentPayment (extract from submissionDate)
    const paymentDocs = await DocumentPayment.find({})
      .select("submissionDate stages")
      .lean();
    const paymentYears = new Set();

    paymentDocs.forEach((doc) => {
      // Process documents with stages
      if (doc.stages && doc.stages.length > 0) {
        doc.stages.forEach((stage) => {
          const dateInfo = getMonthYearFromSubmissionDate(stage.deadline);
          if (dateInfo) {
            paymentYears.add(dateInfo.year);
          }
        });
      } else {
        // Process documents without stages
        const dateInfo = getMonthYearFromSubmissionDate(doc.submissionDate);
        if (dateInfo) {
          paymentYears.add(dateInfo.year);
        }
      }
    });

    // Combine all years and remove duplicates
    const allYears = [
      ...new Set([
        ...userRecordYears,
        ...costCenterYears,
        ...Array.from(paymentYears),
      ]),
    ];

    // Filter out invalid years and sort in descending order
    const validYears = allYears
      .filter(
        (year) => year && year >= 2000 && year <= new Date().getFullYear() + 2
      )
      .sort((a, b) => b - a);

    res.json(validYears);
  } catch (error) {
    console.error("Error fetching available years:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllCostCenters = async (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "captainOfFinance",
      "submitterOfFinance",
    ].includes(req.user.role) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "captainOfFinance",
      "submitterOfFinance",
    ].includes(req.user.role) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  try {
    const { years, costCenters, category } = req.query;

    if (!years) {
      return res.status(400).json({ error: "Years parameter is required" });
    }

    // Parse years parameter - it can be a single year or multiple years separated by commas
    const yearList = years
      .split(",")
      .map((year) => parseInt(year.trim()))
      .filter((year) => !isNaN(year));

    if (yearList.length === 0) {
      return res.status(400).json({ error: "No valid years provided" });
    }

    // Get all cost centers with optional category filter
    let query = {};
    if (category && category !== "all") {
      query.category = category;
    }

    const allCostCenters = await CostCenter.find(query).lean();
    let costCenterNames = allCostCenters.map((cc) => cc.name);

    // Enhanced cost center filtering with better URL handling and matching
    if (costCenters && costCenters.trim() !== "") {
      const selectedCostCenters = costCenters
        .split(",")
        .map((cc) => decodeURIComponent(cc.trim())) // Decode URL encoded characters like &, :, etc.
        .filter((cc) => cc);

      if (selectedCostCenters.length > 0) {
        // Use more robust matching that handles special characters
        costCenterNames = costCenterNames.filter((name) =>
          selectedCostCenters.some((selected) => {
            // Exact match
            const exactMatch = selected === name;
            // Case insensitive match
            const caseInsensitiveMatch =
              selected.toLowerCase() === name.toLowerCase();

            return exactMatch || caseInsensitiveMatch;
          })
        );

        // If no exact matches found, try partial matching
        if (costCenterNames.length === 0) {
          costCenterNames = allCostCenters
            .filter((cc) =>
              selectedCostCenters.some(
                (selected) =>
                  cc.name.includes(selected) ||
                  selected.includes(cc.name) ||
                  cc.name.toLowerCase().includes(selected.toLowerCase()) ||
                  selected.toLowerCase().includes(cc.name.toLowerCase())
              )
            )
            .map((cc) => cc.name);
        }

        // If still no matches, return empty result
        if (costCenterNames.length === 0) {
          return res.json([]);
        }
      }
    }

    // Get all user monthly records for the specified years and cost centers
    // EXCLUDE management roles: deputyDirector, director, headOfAccounting
    const userRecords = await UserMonthlyRecord.find({
      recordYear: { $in: yearList },
      role: {
        $nin: ["deputyDirector", "director", "headOfAccounting"],
      },
    })
      .populate("costCenter")
      .lean();

    // Enhanced user record filtering with better cost center matching
    const filteredUserRecords = userRecords.filter((record) => {
      if (!record.costCenter) return false;

      return costCenterNames.some((ccName) => {
        const exactMatch = ccName === record.costCenter.name;
        const caseInsensitiveMatch =
          ccName.toLowerCase() === record.costCenter.name.toLowerCase();

        return exactMatch || caseInsensitiveMatch;
      });
    });

    // Get all finance data from the merged CostCenter model for all years
    const financeData = await CostCenter.find({
      "years.year": { $in: yearList },
      name: { $in: costCenterNames },
    }).lean();

    // Get all payment documents for the specified years and cost centers
    const paymentDocuments = await DocumentPayment.find({
      costCenter: { $in: costCenterNames },
    }).lean();

    // Get construction data for the specified years
    const constructionData = await CostCenter.find({
      name: { $in: costCenterNames },
    }).select("name construction");

    // Get bank data for the specified years
    const bankData = await CostCenter.find({
      name: { $in: costCenterNames },
    }).select("name bank");

    // Filter payment documents by submission date and create a map
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

          // Only include payments that align with the requested years
          if (!yearList.includes(recordYear)) {
            return;
          }

          const key = `${doc.costCenter}-${recordMonth}-${recordYear}`;

          if (!costCenterPaymentMap[key]) {
            costCenterPaymentMap[key] = 0;
          }

          // Use stage amount instead of totalPayment
          costCenterPaymentMap[key] += stage.amount || 0;
        });
      } else if (
        doc.appendedPurchasingDocuments &&
        doc.appendedPurchasingDocuments.length > 0
      ) {
        // Payment document with appended purchasing documents but no stages
        // Distribute payment based on product-level cost centers
        const dateInfo = getMonthYearFromSubmissionDate(doc.submissionDate);
        if (!dateInfo) {
          return; // Skip if invalid date
        }

        // Align with your existing month-shifting logic
        let recordMonth = dateInfo.month + 1;
        let recordYear = dateInfo.year;

        // Handle year boundary
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        // Only include payments that align with the requested years
        if (!yearList.includes(recordYear)) {
          return;
        }

        // Iterate through each appended purchasing document
        doc.appendedPurchasingDocuments.forEach((purchasingDoc) => {
          if (purchasingDoc.products && purchasingDoc.products.length > 0) {
            // Iterate through each product
            purchasingDoc.products.forEach((product) => {
              const productCostCenter = product.costCenter || "Chưa có";

              // Only process if the product's cost center is in our filter list
              if (costCenterNames.includes(productCostCenter)) {
                const key = `${productCostCenter}-${recordMonth}-${recordYear}`;

                if (!costCenterPaymentMap[key]) {
                  costCenterPaymentMap[key] = 0;
                }

                // Add the product's total cost (after VAT) to the appropriate cost center
                costCenterPaymentMap[key] += product.totalCostAfterVat || 0;
              }
            });
          }
        });
      } else {
        // Original logic for documents without stages or appended purchasing documents
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

        // Only include payments that align with the requested years
        if (!yearList.includes(recordYear)) {
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

    // Process construction data by month using the same month logic
    const costCenterConstructionMap = {};

    constructionData.forEach((center) => {
      center.construction.forEach((construction) => {
        // Parse the date (DD/MM/YYYY format)
        const [day, month, yearStr] = construction.date.split("/");
        const constructionMonth = parseInt(month);
        const constructionYear = parseInt(yearStr);

        // Apply the same month-shifting logic as payments:
        // Construction in March (month 3) should be attributed to recordMonth 4 of the target year
        let recordMonth = constructionMonth + 1;
        let recordYear = constructionYear;

        // Handle year boundary: December construction should be attributed to January of next year
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        // Only include construction that aligns with the requested years
        if (!yearList.includes(recordYear)) {
          return;
        }

        const recordKey = `${center.name}-${recordMonth}-${recordYear}`;

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

    // Process bank data by month using the same month logic
    const costCenterBankMap = {};

    bankData.forEach((center) => {
      center.bank.forEach((bankEntry) => {
        // Parse the date (DD/MM/YYYY format)
        const [day, month, yearStr] = bankEntry.date.split("/");
        const bankMonth = parseInt(month);
        const bankYear = parseInt(yearStr);

        // Apply the same month-shifting logic as payments and construction:
        // Bank entry in March (month 3) should be attributed to recordMonth 4 of the target year
        let recordMonth = bankMonth + 1;
        let recordYear = bankYear;

        // Handle year boundary: December bank entries should be attributed to January of next year
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        // Only include bank entries that align with the requested years
        if (!yearList.includes(recordYear)) {
          return;
        }

        const recordKey = `${center.name}-${recordMonth}-${recordYear}`;

        if (!costCenterBankMap[recordKey]) {
          costCenterBankMap[recordKey] = {
            income: 0,
            expense: 0,
            net: 0,
          };
        }

        costCenterBankMap[recordKey].income += bankEntry.income || 0;
        costCenterBankMap[recordKey].expense += bankEntry.expense || 0;
        costCenterBankMap[recordKey].net +=
          bankEntry.income - bankEntry.expense || 0;
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

    // Second pass: Calculate net revenue including payment documents, construction AND bank data
    // Process for each year in the yearList
    for (const year of yearList) {
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

          // Initialize bank values
          let bankIncome = 0;
          let bankExpense = 0;
          let bankNet = 0;

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
                  totalCommissionPurchase +=
                    entry.commissionBonus?.purchase || 0;
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

          // Get construction data for this cost center and month (using the same month logic)
          const constructionKey = `${costCenterName}-${month}-${year}`;
          const constructionDataForMonth =
            costCenterConstructionMap[constructionKey];
          if (constructionDataForMonth) {
            constructionIncome = constructionDataForMonth.income;
            constructionExpense = constructionDataForMonth.expense;
            constructionNet = constructionDataForMonth.net;
          }

          // Get bank data for this cost center and month (using the same month logic)
          const bankKey = `${costCenterName}-${month}-${year}`;
          const bankDataForMonth = costCenterBankMap[bankKey];
          if (bankDataForMonth) {
            bankIncome = bankDataForMonth.income;
            bankExpense = bankDataForMonth.expense;
            bankNet = bankDataForMonth.net;
          }

          // Calculate net revenue INCLUDING construction AND bank data
          const netRevenue =
            totalSale -
            totalPurchase -
            totalTransport -
            totalCommissionPurchase -
            totalCommissionSale -
            totalSalary -
            totalPayments +
            constructionNet +
            bankNet; // Add both construction and bank net to overall revenue

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
            bankIncome: bankIncome,
            bankExpense: bankExpense,
            bankNet: bankNet,
            netRevenue: netRevenue,
          });
        }
      }
    }

    // Sort results by cost center name, then by year, then by month
    results.sort((a, b) => {
      if (a.costCenter !== b.costCenter) {
        return a.costCenter.localeCompare(b.costCenter);
      }
      if (a.recordYear !== b.recordYear) {
        return a.recordYear - b.recordYear;
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
    ) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "captainOfFinance",
      "submitterOfFinance",
    ].includes(req.user.role) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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
    ) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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

// Edit cost center group - add or remove cost centers
exports.updateCostCenterGroup = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  try {
    const { id } = req.params;
    const { name, costCenters, action, costCenter } = req.body;

    let group = await CostCenterGroup.findById(id);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // If full update with name and costCenters array
    if (name && costCenters) {
      group.name = name;
      group.costCenters = costCenters;
    }
    // If single cost center action (add/remove)
    else if (action && costCenter) {
      if (action === "add") {
        // Add cost center if not already in group
        if (!group.costCenters.includes(costCenter)) {
          group.costCenters.push(costCenter);
        }
      } else if (action === "remove") {
        // Remove cost center from group
        group.costCenters = group.costCenters.filter((cc) => cc !== costCenter);
      }
    }

    await group.save();
    res.json(group);
  } catch (error) {
    console.error("Error updating cost center group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
