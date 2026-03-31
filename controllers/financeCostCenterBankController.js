// controllers/financeCostCenterBankController.js
const CostCenter = require("../models/CostCenter");
const FinanceCostCenterBankLog = require("../models/FinanceCostCenterBankLog");

const getClientIp = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

const logAction = async (
  req,
  res,
  action,
  costCenterId = null,
  bankEntryId = null,
  requestData = null,
) => {
  const logData = {
    userId: req.user.id,
    username: req.user.username,
    userRole: req.user.role,
    userDepartment: req.user.department,
    action: action,
    costCenterId: costCenterId,
    bankEntryId: bankEntryId,
    requestData: requestData,
    responseStatus: res.statusCode,
    responseMessage: res.statusMessage || getResponseMessage(res),
    ipAddress: getClientIp(req),
    userAgent: req.get("User-Agent"),
  };

  await FinanceCostCenterBankLog.logAction(logData);
};

const getResponseMessage = (res) => {
  return "Operation completed";
};

// Get bank entries for a specific cost center
exports.getBankEntries = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "GET_BANK_ENTRIES", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter) {
      await logAction(req, res, "GET_BANK_ENTRIES", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    await logAction(req, res, "GET_BANK_ENTRIES", costCenterId, null, {
      entriesCount: costCenter.bank ? costCenter.bank.length : 0,
    });

    res.json(costCenter.bank || []);
  } catch (error) {
    await logAction(
      req,
      res,
      "GET_BANK_ENTRIES",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      },
    );
    res.status(500).json({ message: error.message });
  }
};

// Add new bank entry to a cost center
exports.addBankEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "ADD_BANK_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const {
      name,
      income,
      expense,
      date,
      loanDisbursementDate,
      interestRate,
      deductionDate,
      monthsWithNoPrincipalRepayment,
      maturityDate,
    } = req.body;

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, null, {
        error: "Invalid date format",
        dateProvided: date,
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    // Check if this is a complete loan entry
    const isCompleteLoan =
      loanDisbursementDate &&
      deductionDate &&
      maturityDate &&
      interestRate !== undefined;

    if (isCompleteLoan) {
      if (!dateRegex.test(loanDisbursementDate)) {
        return res.status(400).json({
          message: "Valid loan disbursement date is required (DD/MM/YYYY)",
        });
      }
      if (
        interestRate === undefined ||
        interestRate === null ||
        interestRate < 0
      ) {
        return res
          .status(400)
          .json({ message: "Valid interest rate is required" });
      }
      if (!dateRegex.test(deductionDate)) {
        return res
          .status(400)
          .json({ message: "Valid deduction date is required (DD/MM/YYYY)" });
      }
      if (
        monthsWithNoPrincipalRepayment === undefined ||
        monthsWithNoPrincipalRepayment < 0
      ) {
        return res
          .status(400)
          .json({ message: "Months with no principal repayment is required" });
      }
      if (!dateRegex.test(maturityDate)) {
        return res
          .status(400)
          .json({ message: "Valid maturity date is required (DD/MM/YYYY)" });
      }
    }

    const newEntry = {
      name,
      income: parseFloat(income) || 0,
      expense: parseFloat(expense) || 0,
      date,
      ...(isCompleteLoan && {
        loanDisbursementDate,
        interestRate: parseFloat(interestRate),
        deductionDate,
        monthsWithNoPrincipalRepayment: parseInt(
          monthsWithNoPrincipalRepayment,
        ),
        maturityDate,
        isCompleteLoan: true,
      }),
    };

    if (!costCenter.bank) {
      costCenter.bank = [];
    }

    costCenter.bank.push(newEntry);
    await costCenter.save();

    const savedEntry = costCenter.bank[costCenter.bank.length - 1];

    if (isCompleteLoan && savedEntry.isCompleteLoan) {
      await savedEntry.generateDailyEntries(costCenterId, CostCenter);
    }

    await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, savedEntry._id, {
      entryData: newEntry,
    });

    res.status(201).json(newEntry);
  } catch (error) {
    console.error("Error adding bank entry:", error);
    await logAction(req, res, "ADD_BANK_ENTRY", req.params.costCenterId, null, {
      error: error.message,
    });
    res.status(400).json({ message: error.message });
  }
};

// Update bank entry
exports.updateBankEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const {
      name,
      income,
      expense,
      date,
      loanDisbursementDate,
      interestRate,
      deductionDate,
      monthsWithNoPrincipalRepayment,
      maturityDate,
    } = req.body;

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (date && !dateRegex.test(date)) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
        error: "Invalid date format",
        dateProvided: date,
      });
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter || !costCenter.bank) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
        error: "Cost center or bank entries not found",
      });
      return res
        .status(404)
        .json({ message: "Cost center or bank entries not found" });
    }

    const entry = costCenter.bank.id(entryId);
    if (!entry) {
      await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
        error: "Entry not found",
      });
      return res.status(404).json({ message: "Entry not found" });
    }

    const oldValues = {
      name: entry.name,
      income: entry.income,
      expense: entry.expense,
      date: entry.date,
      loanDisbursementDate: entry.loanDisbursementDate,
      interestRate: entry.interestRate,
      deductionDate: entry.deductionDate,
      monthsWithNoPrincipalRepayment: entry.monthsWithNoPrincipalRepayment,
      maturityDate: entry.maturityDate,
      isCompleteLoan: entry.isCompleteLoan,
    };

    if (name) entry.name = name;
    if (income !== undefined) entry.income = parseFloat(income) || 0;
    if (expense !== undefined) entry.expense = parseFloat(expense) || 0;
    if (date) entry.date = date;

    const willBeCompleteLoan =
      (loanDisbursementDate || entry.loanDisbursementDate) &&
      (deductionDate || entry.deductionDate) &&
      (maturityDate || entry.maturityDate) &&
      (interestRate !== undefined || entry.interestRate !== undefined);

    if (loanDisbursementDate) {
      if (!dateRegex.test(loanDisbursementDate)) {
        return res.status(400).json({
          message: "Valid loan disbursement date is required (DD/MM/YYYY)",
        });
      }
      entry.loanDisbursementDate = loanDisbursementDate;
    }

    if (interestRate !== undefined) {
      if (interestRate < 0) {
        return res
          .status(400)
          .json({ message: "Valid interest rate is required" });
      }
      entry.interestRate = parseFloat(interestRate);
    }

    if (deductionDate) {
      if (!dateRegex.test(deductionDate)) {
        return res
          .status(400)
          .json({ message: "Valid deduction date is required (DD/MM/YYYY)" });
      }
      entry.deductionDate = deductionDate;
    }

    if (monthsWithNoPrincipalRepayment !== undefined) {
      if (monthsWithNoPrincipalRepayment < 0) {
        return res
          .status(400)
          .json({ message: "Months with no principal repayment is required" });
      }
      entry.monthsWithNoPrincipalRepayment = parseInt(
        monthsWithNoPrincipalRepayment,
      );
    }

    if (maturityDate) {
      if (!dateRegex.test(maturityDate)) {
        return res
          .status(400)
          .json({ message: "Valid maturity date is required (DD/MM/YYYY)" });
      }
      entry.maturityDate = maturityDate;
    }

    entry.isCompleteLoan =
      willBeCompleteLoan &&
      entry.loanDisbursementDate &&
      entry.deductionDate &&
      entry.maturityDate &&
      entry.interestRate !== undefined;

    await costCenter.save();

    if (entry.isCompleteLoan) {
      await entry.updateDailyEntries(costCenterId, CostCenter);
    } else if (oldValues.isCompleteLoan) {
      costCenter.daily = costCenter.daily.filter(
        (dailyEntry) => dailyEntry.loanId !== entry._id.toString(),
      );
      await costCenter.save();
    }

    await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
      oldValues: oldValues,
      newValues: {
        name: entry.name,
        income: entry.income,
        expense: entry.expense,
        date: entry.date,
        loanDisbursementDate: entry.loanDisbursementDate,
        interestRate: entry.interestRate,
        deductionDate: entry.deductionDate,
        monthsWithNoPrincipalRepayment: entry.monthsWithNoPrincipalRepayment,
        maturityDate: entry.maturityDate,
        isCompleteLoan: entry.isCompleteLoan,
      },
    });

    res.json(entry);
  } catch (error) {
    await logAction(
      req,
      res,
      "UPDATE_BANK_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      },
    );
    res.status(400).json({ message: error.message });
  }
};

// Delete bank entry
exports.deleteBankEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "DELETE_BANK_ENTRY", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId, entryId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter || !costCenter.bank) {
      await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
        error: "Cost center or bank entries not found",
      });
      return res
        .status(404)
        .json({ message: "Cost center or bank entries not found" });
    }

    const entryToDelete = costCenter.bank.id(entryId);
    if (!entryToDelete) {
      await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
        error: "Entry not found",
      });
      return res.status(404).json({ message: "Entry not found" });
    }

    // Remove associated daily entries
    costCenter.daily = costCenter.daily.filter(
      (entry) => entry.loanId !== entryId,
    );

    costCenter.bank.pull(entryId);
    await costCenter.save();

    await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
      deletedEntry: { name: entryToDelete.name },
    });

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    await logAction(
      req,
      res,
      "DELETE_BANK_ENTRY",
      req.params.costCenterId,
      req.params.entryId,
      {
        error: error.message,
      },
    );
    res.status(400).json({ message: error.message });
  }
};

// Get all cost centers
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
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "GET_COST_CENTERS", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const costCenters = await CostCenter.find({}, "name _id").sort({ name: 1 });

    await logAction(req, res, "GET_COST_CENTERS", null, null, {
      costCentersCount: costCenters.length,
    });

    res.json(costCenters);
  } catch (error) {
    await logAction(req, res, "GET_COST_CENTERS", null, null, {
      error: error.message,
    });
    res.status(500).json({ message: error.message });
  }
};

// Get cost center with fund limit info
exports.getCostCenterWithFundLimit = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "GET_COST_CENTER_WITH_FUND", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(
      costCenterId,
      "name fundLimitBank bank",
    );

    if (!costCenter) {
      await logAction(
        req,
        res,
        "GET_COST_CENTER_WITH_FUND",
        costCenterId,
        null,
        {
          error: "Cost center not found",
        },
      );
      return res.status(404).json({ message: "Cost center not found" });
    }

    let totalIncome = 0;
    let totalExpense = 0;

    if (costCenter.bank && costCenter.bank.length > 0) {
      costCenter.bank.forEach((entry) => {
        totalIncome += entry.income || 0;
        totalExpense += entry.expense || 0;
      });
    }

    const fundAvailableBank =
      (costCenter.fundLimitBank || 0) - totalExpense + totalIncome;

    await logAction(req, res, "GET_COST_CENTER_WITH_FUND", costCenterId, null, {
      fundLimitBank: costCenter.fundLimitBank,
      calculatedTotals: { totalIncome, totalExpense, fundAvailableBank },
    });

    res.json({
      name: costCenter.name,
      fundLimitBank: costCenter.fundLimitBank || 0,
      fundAvailableBank,
      totalIncome,
      totalExpense,
    });
  } catch (error) {
    await logAction(
      req,
      res,
      "GET_COST_CENTER_WITH_FUND",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      },
    );
    res.status(500).json({ message: error.message });
  }
};

// Update fund limit bank
exports.updateFundLimitBank = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      await logAction(req, res, "UPDATE_FUND_LIMIT_BANK", null, null, {
        error: "Permission denied",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const { fundLimitBank } = req.body;

    if (fundLimitBank === undefined || fundLimitBank === null) {
      await logAction(req, res, "UPDATE_FUND_LIMIT_BANK", costCenterId, null, {
        error: "Fund limit is required",
      });
      return res.status(400).json({ message: "Fund limit is required" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      await logAction(req, res, "UPDATE_FUND_LIMIT_BANK", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    const oldValue = costCenter.fundLimitBank;

    costCenter.fundLimitBank = parseFloat(fundLimitBank) || 0;
    await costCenter.save();

    await logAction(req, res, "UPDATE_FUND_LIMIT_BANK", costCenterId, null, {
      oldValue,
      newValue: costCenter.fundLimitBank,
    });

    res.json({
      success: true,
      fundLimitBank: costCenter.fundLimitBank,
      message: "Cập nhật hạn mức ngân hàng thành công!",
    });
  } catch (error) {
    await logAction(
      req,
      res,
      "UPDATE_FUND_LIMIT_BANK",
      req.params.costCenterId,
      null,
      {
        error: error.message,
      },
    );
    res.status(400).json({ message: error.message });
  }
};

// Regenerate loan entries
exports.regenerateLoanEntries = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính ngân hàng")
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    let regeneratedCount = 0;
    let skippedCount = 0;

    for (const bankEntry of costCenter.bank) {
      if (
        bankEntry.isCompleteLoan &&
        bankEntry.loanDisbursementDate &&
        bankEntry.deductionDate &&
        bankEntry.maturityDate
      ) {
        await bankEntry.updateDailyEntries(costCenterId, CostCenter);
        regeneratedCount++;
      } else {
        skippedCount++;
      }
    }

    res.json({
      success: true,
      message: `Đã tạo lại các khoản lãi vay cho ${regeneratedCount} khoản vay, bỏ qua ${skippedCount} khoản vay không đầy đủ thông tin`,
      count: regeneratedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Preview loan schedule with proper rounding
exports.previewLoanSchedule = async (req, res) => {
  try {
    const {
      loanAmount,
      interestRate,
      loanDisbursementDate,
      deductionDate,
      monthsWithNoPrincipalRepayment,
      maturityDate,
    } = req.body;

    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    if (!loanDisbursementDate || !dateRegex.test(loanDisbursementDate)) {
      return res
        .status(400)
        .json({ message: "Valid loan disbursement date is required" });
    }

    if (interestRate === undefined || interestRate < 0) {
      return res
        .status(400)
        .json({ message: "Valid interest rate is required" });
    }

    if (!deductionDate || !dateRegex.test(deductionDate)) {
      return res
        .status(400)
        .json({ message: "Valid deduction date is required" });
    }

    if (
      monthsWithNoPrincipalRepayment === undefined ||
      monthsWithNoPrincipalRepayment < 0
    ) {
      return res
        .status(400)
        .json({
          message: "Valid months with no principal repayment is required",
        });
    }

    if (!maturityDate || !dateRegex.test(maturityDate)) {
      return res
        .status(400)
        .json({ message: "Valid maturity date is required" });
    }

    const parseDateToTimestamp = (dateString) => {
      const parts = dateString.split("/");
      return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const getActualDaysBetween = (startDateStr, endDateStr) => {
      const startDate = parseDateToTimestamp(startDateStr);
      const endDate = parseDateToTimestamp(endDateStr);
      if (!startDate || !endDate) return 0;

      let days = 0;
      let current = new Date(startDate);
      const end = new Date(endDate);

      while (current < end) {
        days++;
        current.setDate(current.getDate() + 1);
      }

      return days;
    };

    const getDeductionDateForMonth = (baseDate, deductionDay) => {
      const date = new Date(baseDate);
      const lastDayOfMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
      ).getDate();
      const actualDay = Math.min(deductionDay, lastDayOfMonth);
      date.setDate(actualDay);
      return date;
    };

    const generateDeductionSchedule = () => {
      const schedule = [];
      const disbursementDate = parseDateToTimestamp(loanDisbursementDate);
      const maturityDateObj = parseDateToTimestamp(maturityDate);
      const deductionDay = parseInt(deductionDate.split("/")[0]);

      if (!disbursementDate || !maturityDateObj || !deductionDay)
        return schedule;

      const totalLoan = parseFloat(loanAmount) || 0;
      const gracePeriodMonths = parseInt(monthsWithNoPrincipalRepayment);
      const annualRatePercent = parseFloat(interestRate);

      // Get first deduction date
      let firstDeductionDate = new Date(disbursementDate);

      if (firstDeductionDate.getDate() <= deductionDay) {
        firstDeductionDate.setDate(deductionDay);
      } else {
        firstDeductionDate.setMonth(firstDeductionDate.getMonth() + 1);
        firstDeductionDate.setDate(deductionDay);
      }

      firstDeductionDate = getDeductionDateForMonth(
        firstDeductionDate,
        deductionDay,
      );

      if (firstDeductionDate <= disbursementDate) {
        firstDeductionDate.setMonth(firstDeductionDate.getMonth() + 1);
        firstDeductionDate = getDeductionDateForMonth(
          firstDeductionDate,
          deductionDay,
        );
      }

      // Calculate months with principal repayment
      let monthsWithPrincipal = 0;
      let currentDate = new Date(firstDeductionDate);
      let monthCounter = 0;

      while (currentDate <= maturityDateObj) {
        if (monthCounter >= gracePeriodMonths) {
          monthsWithPrincipal++;
        }
        monthCounter++;
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate = getDeductionDateForMonth(currentDate, deductionDay);
      }

      // Generate schedule
      let currentStartDate = new Date(disbursementDate);
      let currentDeductionDate = new Date(firstDeductionDate);
      let monthIndex = 0;
      let principalPaid = 0;

      while (currentDeductionDate <= maturityDateObj) {
        const isGracePeriod = monthIndex < gracePeriodMonths;

        const daysInPeriod = getActualDaysBetween(
          formatDate(currentStartDate),
          formatDate(currentDeductionDate),
        );

        const outstandingBalance = totalLoan - principalPaid;
        const interestExpense =
          (annualRatePercent / 100) * (daysInPeriod / 365) * outstandingBalance;

        let principalThisMonth = 0;
        if (!isGracePeriod && monthIndex >= gracePeriodMonths) {
          const remainingMonths =
            monthsWithPrincipal - (monthIndex - gracePeriodMonths);
          const remainingPrincipal = totalLoan - principalPaid;

          if (remainingMonths === 1) {
            // Last payment - pay remaining principal exactly
            principalThisMonth = remainingPrincipal;
          } else {
            // Regular payment - floor to avoid overpayment
            const rawPrincipal = remainingPrincipal / remainingMonths;
            principalThisMonth = Math.floor(rawPrincipal);
          }
        }

        const newOutstandingBalance = outstandingBalance - principalThisMonth;

        schedule.push({
          period: monthIndex + 1,
          deductionDate: formatDate(currentDeductionDate),
          startDate: formatDate(currentStartDate),
          endDate: formatDate(currentDeductionDate),
          daysInPeriod,
          interestExpense: Math.round(interestExpense),
          principalRepayment: Math.round(principalThisMonth),
          totalPayment: Math.round(interestExpense + principalThisMonth),
          outstandingBalance: Math.round(newOutstandingBalance),
          isGracePeriod,
          isFirstPayment: monthIndex === 0,
          isLastPayment: currentDeductionDate >= maturityDateObj,
        });

        principalPaid += principalThisMonth;
        currentStartDate = new Date(currentDeductionDate);
        monthIndex++;

        const nextDate = new Date(currentDeductionDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        currentDeductionDate = getDeductionDateForMonth(nextDate, deductionDay);
      }

      // Final adjustment to ensure outstanding balance is exactly 0
      if (schedule.length > 0) {
        const lastPayment = schedule[schedule.length - 1];
        if (lastPayment.outstandingBalance !== 0) {
          const adjustment = lastPayment.outstandingBalance;
          lastPayment.principalRepayment += adjustment;
          lastPayment.totalPayment += adjustment;
          lastPayment.outstandingBalance = 0;
        }
      }

      return schedule;
    };

    const schedule = generateDeductionSchedule();

    const summary = {
      totalInterest: schedule.reduce((sum, p) => sum + p.interestExpense, 0),
      totalPrincipal: schedule.reduce(
        (sum, p) => sum + p.principalRepayment,
        0,
      ),
      totalPayments: schedule.reduce((sum, p) => sum + p.totalPayment, 0),
      numberOfPayments: schedule.length,
      firstPaymentDate: schedule[0]?.deductionDate || null,
      lastPaymentDate: schedule[schedule.length - 1]?.deductionDate || null,
    };

    res.json({
      success: true,
      schedule,
      summary,
      loanDetails: {
        loanAmount: parseFloat(loanAmount),
        interestRate: parseFloat(interestRate),
        disbursementDate: loanDisbursementDate,
        maturityDate: maturityDate,
        deductionDate: deductionDate,
        gracePeriodMonths: parseInt(monthsWithNoPrincipalRepayment),
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
