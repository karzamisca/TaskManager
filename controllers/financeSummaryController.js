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
      "headOfAccounting",
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
      if (doc.stages && doc.stages.length > 0) {
        doc.stages.forEach((stage) => {
          const dateInfo = getMonthYearFromSubmissionDate(stage.deadline);
          if (dateInfo) {
            paymentYears.add(dateInfo.year);
          }
        });
      } else {
        const dateInfo = getMonthYearFromSubmissionDate(doc.submissionDate);
        if (dateInfo) {
          paymentYears.add(dateInfo.year);
        }
      }
    });

    // Get unique years from CostCenter bank and daily entries
    const bankDailyDocs = await CostCenter.find({
      $or: [{ "bank.0": { $exists: true } }, { "daily.0": { $exists: true } }],
    })
      .select("bank daily")
      .lean();

    const bankDailyYears = new Set();

    bankDailyDocs.forEach((doc) => {
      (doc.bank || []).forEach((entry) => {
        if (entry.date) {
          const [, , yearStr] = entry.date.split("/");
          const y = parseInt(yearStr);
          if (y) bankDailyYears.add(y);
        }
      });
      (doc.daily || []).forEach((entry) => {
        if (entry.date) {
          const [, , yearStr] = entry.date.split("/");
          const y = parseInt(yearStr);
          if (y) bankDailyYears.add(y);
        }
      });
    });

    // Combine all years and remove duplicates
    const allYears = [
      ...new Set([
        ...userRecordYears,
        ...costCenterYears,
        ...Array.from(paymentYears),
        ...Array.from(bankDailyYears),
      ]),
    ];

    // Filter out invalid years and sort in descending order
    const validYears = allYears
      .filter(
        (year) => year && year >= 2000 && year <= new Date().getFullYear() + 2,
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
      "headOfAccounting",
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
    const costCenters = await CostCenter.find().select("name category -_id");

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
      "headOfAccounting",
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

    const yearList = years
      .split(",")
      .map((year) => parseInt(year.trim()))
      .filter((year) => !isNaN(year));

    if (yearList.length === 0) {
      return res.status(400).json({ error: "No valid years provided" });
    }

    let query = {};
    if (category && category !== "all") {
      query.category = category;
    }

    const allCostCenters = await CostCenter.find(query).lean();
    let costCenterNames = allCostCenters.map((cc) => cc.name);

    if (costCenters && costCenters.trim() !== "") {
      const selectedCostCenters = costCenters
        .split(",")
        .map((cc) => decodeURIComponent(cc.trim()))
        .filter((cc) => cc);

      if (selectedCostCenters.length > 0) {
        costCenterNames = costCenterNames.filter((name) =>
          selectedCostCenters.some((selected) => {
            const exactMatch = selected === name;
            const caseInsensitiveMatch =
              selected.toLowerCase() === name.toLowerCase();
            return exactMatch || caseInsensitiveMatch;
          }),
        );

        if (costCenterNames.length === 0) {
          costCenterNames = allCostCenters
            .filter((cc) =>
              selectedCostCenters.some(
                (selected) =>
                  cc.name.includes(selected) ||
                  selected.includes(cc.name) ||
                  cc.name.toLowerCase().includes(selected.toLowerCase()) ||
                  selected.toLowerCase().includes(cc.name.toLowerCase()),
              ),
            )
            .map((cc) => cc.name);
        }

        if (costCenterNames.length === 0) {
          return res.json([]);
        }
      }
    }

    const userRecords = await UserMonthlyRecord.find({
      recordYear: { $in: yearList },
      role: {
        $nin: ["deputyDirector", "director", "headOfAccounting"],
      },
    })
      .populate("costCenter")
      .lean();

    const filteredUserRecords = userRecords.filter((record) => {
      if (!record.costCenter) return false;
      return costCenterNames.some((ccName) => {
        const exactMatch = ccName === record.costCenter.name;
        const caseInsensitiveMatch =
          ccName.toLowerCase() === record.costCenter.name.toLowerCase();
        return exactMatch || caseInsensitiveMatch;
      });
    });

    const financeData = await CostCenter.find({
      "years.year": { $in: yearList },
      name: { $in: costCenterNames },
    }).lean();

    const paymentDocuments = await DocumentPayment.find({
      costCenter: { $in: costCenterNames },
    }).lean();

    const constructionData = await CostCenter.find({
      name: { $in: costCenterNames },
    }).select("name construction");

    const bankData = await CostCenter.find({
      name: { $in: costCenterNames },
    }).select("name bank daily");

    // Build payment map
    const costCenterPaymentMap = {};

    paymentDocuments.forEach((doc) => {
      if (doc.stages && doc.stages.length > 0) {
        // Staged payments: use stage deadline
        doc.stages.forEach((stage) => {
          const dateInfo = getMonthYearFromSubmissionDate(stage.deadline);
          if (!dateInfo) return;

          let recordMonth = dateInfo.month + 1;
          let recordYear = dateInfo.year;
          if (recordMonth > 12) {
            recordMonth = 1;
            recordYear += 1;
          }

          if (!yearList.includes(recordYear)) return;

          const key = `${doc.costCenter}-${recordMonth}-${recordYear}`;
          if (!costCenterPaymentMap[key]) costCenterPaymentMap[key] = 0;
          costCenterPaymentMap[key] += stage.amount || 0;
        });
      } else if (doc.appendedPurchasingDocuments?.length > 0) {
        // Appended purchasing documents: use deputyDirector's approvalDate
        const deputyApproval = doc.approvedBy?.find(
          (a) => a.role === "deputyDirector",
        );

        // Skip if not yet approved by deputyDirector
        if (!deputyApproval) return;

        const dateInfo = getMonthYearFromSubmissionDate(
          deputyApproval.approvalDate,
        );
        if (!dateInfo) return;

        let recordMonth = dateInfo.month + 1;
        let recordYear = dateInfo.year;
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        if (!yearList.includes(recordYear)) return;

        doc.appendedPurchasingDocuments.forEach((purchasingDoc) => {
          if (purchasingDoc.products?.length > 0) {
            purchasingDoc.products.forEach((product) => {
              const productCostCenter = product.costCenter || "Chưa có";
              if (costCenterNames.includes(productCostCenter)) {
                const key = `${productCostCenter}-${recordMonth}-${recordYear}`;
                if (!costCenterPaymentMap[key]) costCenterPaymentMap[key] = 0;
                costCenterPaymentMap[key] += product.totalCostAfterVat || 0;
              }
            });
          }
        });
      } else {
        // Normal documents: use deputyDirector's approvalDate
        const deputyApproval = doc.approvedBy?.find(
          (a) => a.role === "deputyDirector",
        );

        // Skip if not yet approved by deputyDirector
        if (!deputyApproval) return;

        const dateInfo = getMonthYearFromSubmissionDate(
          deputyApproval.approvalDate,
        );
        if (!dateInfo) return;

        let recordMonth = dateInfo.month + 1;
        let recordYear = dateInfo.year;
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        if (!yearList.includes(recordYear)) return;

        const key = `${doc.costCenter}-${recordMonth}-${recordYear}`;
        if (!costCenterPaymentMap[key]) costCenterPaymentMap[key] = 0;
        costCenterPaymentMap[key] += doc.totalPayment || 0;
      }
    });

    // Process construction data by month
    const costCenterConstructionMap = {};

    constructionData.forEach((center) => {
      center.construction.forEach((construction) => {
        const [day, month, yearStr] = construction.date.split("/");
        const constructionMonth = parseInt(month);
        const constructionYear = parseInt(yearStr);

        let recordMonth = constructionMonth + 1;
        let recordYear = constructionYear;
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        if (!yearList.includes(recordYear)) return;

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

    // Process bank data by month
    const costCenterBankMap = {};

    bankData.forEach((center) => {
      // Raw bank entries (skip complete loans)
      center.bank.forEach((bankEntry) => {
        if (bankEntry.isCompleteLoan) return;

        const [day, month, yearStr] = bankEntry.date.split("/");
        const bankMonth = parseInt(month);
        const bankYear = parseInt(yearStr);

        let recordMonth = bankMonth + 1;
        let recordYear = bankYear;
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        if (!yearList.includes(recordYear)) return;

        const recordKey = `${center.name}-${recordMonth}-${recordYear}`;
        if (!costCenterBankMap[recordKey]) {
          costCenterBankMap[recordKey] = { income: 0, expense: 0, net: 0 };
        }

        costCenterBankMap[recordKey].income += bankEntry.income || 0;
        costCenterBankMap[recordKey].expense += bankEntry.expense || 0;
        costCenterBankMap[recordKey].net +=
          (bankEntry.income || 0) - (bankEntry.expense || 0);
      });

      // Daily loan amortization entries
      (center.daily || []).forEach((dailyEntry) => {
        if (!dailyEntry.isLoanInterest) return;

        const [day, month, yearStr] = dailyEntry.date.split("/");
        const dailyMonth = parseInt(month);
        const dailyYear = parseInt(yearStr);

        let recordMonth = dailyMonth + 1;
        let recordYear = dailyYear;
        if (recordMonth > 12) {
          recordMonth = 1;
          recordYear += 1;
        }

        if (!yearList.includes(recordYear)) return;

        const recordKey = `${center.name}-${recordMonth}-${recordYear}`;
        if (!costCenterBankMap[recordKey]) {
          costCenterBankMap[recordKey] = { income: 0, expense: 0, net: 0 };
        }

        const loanExpense = dailyEntry.expensePrediction || 0;
        const loanIncome = dailyEntry.incomePrediction || 0;

        costCenterBankMap[recordKey].income += loanIncome;
        costCenterBankMap[recordKey].expense += loanExpense;
        costCenterBankMap[recordKey].net += loanIncome - loanExpense;
      });
    });

    // Build results
    const results = [];
    const costCenterSalaryMap = {};

    for (const record of filteredUserRecords) {
      if (!record.costCenter) continue;

      const key = `${record.costCenter.name}-${record.recordMonth}-${record.recordYear}`;
      if (!costCenterSalaryMap[key]) costCenterSalaryMap[key] = 0;
      costCenterSalaryMap[key] += record.currentSalary || 0;
    }

    for (const year of yearList) {
      for (const costCenterName of costCenterNames) {
        for (let month = 1; month <= 12; month++) {
          let actualMonthNumber = month - 1;
          let actualYear = parseInt(year);

          if (actualMonthNumber === 0) {
            actualMonthNumber = 12;
            actualYear -= 1;
          }

          const vietnameseMonth = monthNumberToVietnamese[actualMonthNumber];

          let totalSale = 0;
          let totalPurchase = 0;
          let totalTransport = 0;
          let totalCommissionPurchase = 0;
          let totalCommissionSale = 0;
          let totalSalary = 0;
          let totalPayments = 0;
          let constructionIncome = 0;
          let constructionExpense = 0;
          let constructionNet = 0;
          let bankIncome = 0;
          let bankExpense = 0;
          let bankNet = 0;

          const center = financeData.find((c) => c.name === costCenterName);
          if (center) {
            const yearData = center.years.find((y) => y.year === actualYear);
            if (yearData) {
              const monthData = yearData.months.find(
                (m) => m.name === vietnameseMonth,
              );
              if (monthData) {
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

          const salaryKey = `${costCenterName}-${month}-${year}`;
          totalSalary = costCenterSalaryMap[salaryKey] || 0;

          const paymentKey = `${costCenterName}-${month}-${year}`;
          totalPayments = costCenterPaymentMap[paymentKey] || 0;

          const constructionKey = `${costCenterName}-${month}-${year}`;
          const constructionDataForMonth =
            costCenterConstructionMap[constructionKey];
          if (constructionDataForMonth) {
            constructionIncome = constructionDataForMonth.income;
            constructionExpense = constructionDataForMonth.expense;
            constructionNet = constructionDataForMonth.net;
          }

          const bankKey = `${costCenterName}-${month}-${year}`;
          const bankDataForMonth = costCenterBankMap[bankKey];
          if (bankDataForMonth) {
            bankIncome = bankDataForMonth.income;
            bankExpense = bankDataForMonth.expense;
            bankNet = bankDataForMonth.net;
          }

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
            totalSalary: totalSalary,
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

    // Sort by cost center name, then year, then month
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
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "captainOfFinance",
    ].includes(req.user.role) &&
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
      "headOfAccounting",
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
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "captainOfFinance",
    ].includes(req.user.role) &&
    !req.user.permissions?.includes("Xem bảng tài chính tổng hợp")
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  try {
    const { id } = req.params;
    const group = await CostCenterGroup.findOneAndDelete({ _id: id });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error deleting cost center group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateCostCenterGroup = async (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "captainOfFinance",
    ].includes(req.user.role) &&
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

    if (name && costCenters) {
      group.name = name;
      group.costCenters = costCenters;
    } else if (action && costCenter) {
      if (action === "add") {
        if (!group.costCenters.includes(costCenter)) {
          group.costCenters.push(costCenter);
        }
      } else if (action === "remove") {
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
