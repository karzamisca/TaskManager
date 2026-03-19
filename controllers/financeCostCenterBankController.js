// controllers/financeCostCenterBankController.js
const CostCenter = require("../models/CostCenter");
const FinanceCostCenterBankLog = require("../models/FinanceCostCenterBankLog");
const mongoose = require("mongoose");

// Helper function to get client IP
const getClientIp = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

// Helper function to log actions
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

// Helper to extract response message
const getResponseMessage = (res) => {
  return "Operation completed";
};

// Helper function to parse date from DD/MM/YYYY
const parseDate = (dateString) => {
  if (!dateString) return null;
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

// Helper function to format date to DD/MM/YYYY
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function to add months to a date
const addMonths = (dateString, months) => {
  const date = parseDate(dateString);
  if (!date) return null;
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
};

// Helper function to get first day of month
const getFirstDayOfMonth = (dateString) => {
  const date = parseDate(dateString);
  if (!date) return null;
  date.setDate(1);
  return formatDate(date);
};

// Helper function to calculate days between two dates
const daysBetween = (startDateString, endDateString) => {
  const start = parseDate(startDateString);
  const end = parseDate(endDateString);
  if (!start || !end) return 0;
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Helper function to calculate monthly payment (gốc + lãi)
const calculateMonthlyPayment = (
  loanAmount,
  annualInterestRate,
  loanTermMonths,
) => {
  const monthlyRate = annualInterestRate / 12;
  // Công thức tính PMT: P * r * (1+r)^n / ((1+r)^n - 1)
  const payment =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, loanTermMonths)) /
    (Math.pow(1 + monthlyRate, loanTermMonths) - 1);
  return payment;
};

// Helper function to generate daily entries from loan
const generateDailyEntriesFromLoan = async (
  costCenter,
  bankEntry,
  isNew = true,
) => {
  if (
    !bankEntry.disbursementDate ||
    !bankEntry.interestRate ||
    !bankEntry.loanTerm ||
    !bankEntry.deductionDate
  ) {
    return []; // Không phải khoản vay, không cần sinh daily entries
  }

  const loanAmount = bankEntry.income || 0;
  if (loanAmount <= 0) return [];

  const annualInterestRate = bankEntry.interestRate / 100;
  const monthlyInterestRate = annualInterestRate / 12;
  const dailyInterestRate = annualInterestRate / 365;

  const monthsWithoutPrincipal = bankEntry.monthsWithoutPrincipal || 0;
  const disbursementDate = bankEntry.disbursementDate;
  const deductionDate = bankEntry.deductionDate;
  const loanTerm = bankEntry.loanTerm;

  // Xóa các daily entries cũ nếu có (khi update)
  if (
    !isNew &&
    bankEntry.generatedDailyEntryIds &&
    bankEntry.generatedDailyEntryIds.length > 0
  ) {
    await CostCenter.updateOne(
      { _id: costCenter._id },
      {
        $pull: {
          daily: {
            _id: { $in: bankEntry.generatedDailyEntryIds },
          },
        },
      },
    );
  }

  const generatedIds = [];
  let remainingBalance = loanAmount;
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    annualInterestRate,
    loanTerm,
  );

  // Tạo daily entries cho từng tháng
  for (let month = 0; month < loanTerm; month++) {
    let expenseAmount = 0;
    let incomeAmount = 0;
    let principalPaid = 0;
    let interestPaid = 0;
    let entryName = "";
    let description = "";

    // Tính ngày của tháng này
    let currentMonthDate;
    if (month === 0) {
      currentMonthDate = deductionDate; // Tháng đầu tiên là ngày trích nợ
    } else {
      currentMonthDate = addMonths(deductionDate, month);
    }
    if (!currentMonthDate) continue;

    // KIỂM TRA: Có đang trong thời gian không trả gốc không?
    const isGracePeriod = month < monthsWithoutPrincipal;

    // Tháng đầu tiên (tính từ ngày nhận nợ đến ngày trích nợ đầu tiên)
    if (month === 0) {
      const days = daysBetween(disbursementDate, deductionDate);
      interestPaid = days * dailyInterestRate * loanAmount;
      expenseAmount = interestPaid;
      principalPaid = 0;

      if (isGracePeriod) {
        entryName = `Dự kiến lãi vay tháng ${month + 1} (Tháng không gốc) - ${bankEntry.name}`;
        description = `Dự kiến chỉ trả lãi ${days} ngày từ ${disbursementDate} đến ${deductionDate}`;
      } else {
        entryName = `Dự kiến lãi vay tháng ${month + 1} - ${bankEntry.name}`;
        description = `Dự kiến trả lãi ${days} ngày đầu kỳ`;
      }
    }
    // Tháng cuối cùng của kỳ vay
    else if (month === loanTerm - 1) {
      const lastPaymentDate = addMonths(disbursementDate, loanTerm);
      const firstDayOfLastMonth = getFirstDayOfMonth(currentMonthDate);
      if (lastPaymentDate && firstDayOfLastMonth) {
        const days = daysBetween(firstDayOfLastMonth, lastPaymentDate);

        if (isGracePeriod) {
          // Nếu tháng cuối vẫn còn trong thời gian không gốc (hiếm gặp)
          interestPaid = days * dailyInterestRate * remainingBalance;
          expenseAmount = interestPaid;
          principalPaid = 0;
          entryName = `Dự kiến lãi vay tháng cuối (Tháng không gốc) - ${bankEntry.name}`;
          description = `Dự kiến chỉ trả lãi ${days} ngày cuối kỳ`;
        } else {
          // Tính lãi cho số ngày trong tháng cuối
          interestPaid = days * dailyInterestRate * remainingBalance;
          principalPaid = remainingBalance; // Trả hết gốc còn lại
          expenseAmount = interestPaid + principalPaid;
          entryName = `Dự kiến trả nợ tháng cuối - ${bankEntry.name}`;
          description = `Dự kiến trả gốc: ${Math.round(principalPaid).toLocaleString("vi-VN")}đ, lãi: ${Math.round(interestPaid).toLocaleString("vi-VN")}đ (${days} ngày)`;
        }
      }
    }
    // Các tháng giữa
    else {
      if (isGracePeriod) {
        // Chỉ trả lãi, không trả gốc
        interestPaid = monthlyInterestRate * remainingBalance;
        expenseAmount = interestPaid;
        principalPaid = 0;
        entryName = `Dự kiến lãi vay tháng ${month + 1} (Tháng không gốc) - ${bankEntry.name}`;
        description = `Dự kiến chỉ trả lãi, số dư nợ: ${Math.round(remainingBalance).toLocaleString("vi-VN")}đ`;
      } else {
        // Trả cả gốc và lãi theo phương thức đều hàng tháng
        interestPaid = monthlyInterestRate * remainingBalance;
        principalPaid = monthlyPayment - interestPaid;
        expenseAmount = monthlyPayment;

        // Cập nhật số dư còn lại cho tháng sau
        if (principalPaid > 0) {
          remainingBalance -= principalPaid;
        }

        entryName = `Dự kiến trả nợ tháng ${month + 1} - ${bankEntry.name}`;
        description = `Dự kiến trả gốc: ${Math.round(principalPaid).toLocaleString("vi-VN")}đ, lãi: ${Math.round(interestPaid).toLocaleString("vi-VN")}đ`;
      }
    }

    // Tạo daily entry - SỬ DỤNG PREDICTION FIELDS
    const newDailyEntry = {
      name: entryName,
      income: 0, // Thực tế = 0 vì chưa phát sinh
      expense: 0, // Thực tế = 0 vì chưa phát sinh
      date: currentMonthDate, // Ngày dự kiến phát sinh

      // PREDICTION FIELDS - dự đoán cho tương lai
      incomePrediction: incomeAmount, // Dự đoán thu nhập (nếu có)
      expensePrediction: Math.round(expenseAmount), // Dự đoán chi phí

      note: `[DỰ KIẾN] ${description}`,
      isLoanInterest: true,
      loanMonth: month + 1,
      sourceBankEntryId: bankEntry._id,
    };

    costCenter.daily.push(newDailyEntry);
    const savedEntry = costCenter.daily[costCenter.daily.length - 1];
    generatedIds.push(savedEntry._id);
  }

  bankEntry.generatedDailyEntryIds = generatedIds;
  return generatedIds;
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
      disbursementDate,
      interestRate,
      loanTerm,
      deductionDate,
      monthsWithoutPrincipal,
      note,
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

    // Validate các trường mới nếu có
    if (disbursementDate && !dateRegex.test(disbursementDate)) {
      return res
        .status(400)
        .json({ message: "Disbursement date must be in DD/MM/YYYY format" });
    }
    if (deductionDate && !dateRegex.test(deductionDate)) {
      return res
        .status(400)
        .json({ message: "Deduction date must be in DD/MM/YYYY format" });
    }

    // Validate monthsWithoutPrincipal không vượt quá loanTerm
    if (
      monthsWithoutPrincipal &&
      loanTerm &&
      parseInt(monthsWithoutPrincipal) > parseInt(loanTerm)
    ) {
      return res.status(400).json({
        message: "Số tháng không trả gốc không thể lớn hơn kỳ vay",
      });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, null, {
        error: "Cost center not found",
      });
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newEntry = {
      name,
      income: parseFloat(income) || 0,
      expense: parseFloat(expense) || 0,
      date,
      disbursementDate: disbursementDate || null,
      interestRate: parseFloat(interestRate) || 0,
      loanTerm: parseInt(loanTerm) || 0,
      deductionDate: deductionDate || null,
      monthsWithoutPrincipal: parseInt(monthsWithoutPrincipal) || 0,
      note: note || "",
      generatedDailyEntryIds: [],
    };

    if (!costCenter.bank) {
      costCenter.bank = [];
    }

    costCenter.bank.push(newEntry);

    // Sinh daily entries nếu là khoản vay
    const savedEntry = costCenter.bank[costCenter.bank.length - 1];
    if (
      savedEntry.disbursementDate &&
      savedEntry.interestRate > 0 &&
      savedEntry.loanTerm > 0 &&
      savedEntry.deductionDate
    ) {
      await generateDailyEntriesFromLoan(costCenter, savedEntry, true);
    }

    await costCenter.save();

    await logAction(req, res, "ADD_BANK_ENTRY", costCenterId, savedEntry._id, {
      entryData: {
        name: newEntry.name,
        income: newEntry.income,
        expense: newEntry.expense,
        date: newEntry.date,
        disbursementDate: newEntry.disbursementDate,
        interestRate: newEntry.interestRate,
        loanTerm: newEntry.loanTerm,
        deductionDate: newEntry.deductionDate,
        monthsWithoutPrincipal: newEntry.monthsWithoutPrincipal,
      },
    });

    res.status(201).json(savedEntry);
  } catch (error) {
    await logAction(req, res, "ADD_BANK_ENTRY", req.params.costCenterId, null, {
      error: error.message,
    });
    res.status(400).json({ message: error.message });
  }
};

// Update bank entry in a cost center
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
      disbursementDate,
      interestRate,
      loanTerm,
      deductionDate,
      monthsWithoutPrincipal,
      note,
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

    // Validate các trường mới nếu có
    if (disbursementDate && !dateRegex.test(disbursementDate)) {
      return res
        .status(400)
        .json({ message: "Disbursement date must be in DD/MM/YYYY format" });
    }
    if (deductionDate && !dateRegex.test(deductionDate)) {
      return res
        .status(400)
        .json({ message: "Deduction date must be in DD/MM/YYYY format" });
    }

    // Validate monthsWithoutPrincipal không vượt quá loanTerm
    if (
      monthsWithoutPrincipal &&
      loanTerm &&
      parseInt(monthsWithoutPrincipal) > parseInt(loanTerm)
    ) {
      return res.status(400).json({
        message: "Số tháng không trả gốc không thể lớn hơn kỳ vay",
      });
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
      disbursementDate: entry.disbursementDate,
      interestRate: entry.interestRate,
      loanTerm: entry.loanTerm,
      deductionDate: entry.deductionDate,
      monthsWithoutPrincipal: entry.monthsWithoutPrincipal,
      note: entry.note,
    };

    if (name) entry.name = name;
    if (income !== undefined) entry.income = parseFloat(income) || 0;
    if (expense !== undefined) entry.expense = parseFloat(expense) || 0;
    if (date) entry.date = date;
    if (disbursementDate !== undefined)
      entry.disbursementDate = disbursementDate || null;
    if (interestRate !== undefined)
      entry.interestRate = parseFloat(interestRate) || 0;
    if (loanTerm !== undefined) entry.loanTerm = parseInt(loanTerm) || 0;
    if (deductionDate !== undefined)
      entry.deductionDate = deductionDate || null;
    if (monthsWithoutPrincipal !== undefined)
      entry.monthsWithoutPrincipal = parseInt(monthsWithoutPrincipal) || 0;
    if (note !== undefined) entry.note = note || "";

    // Sinh lại daily entries nếu có thay đổi
    if (
      entry.disbursementDate &&
      entry.interestRate > 0 &&
      entry.loanTerm > 0 &&
      entry.deductionDate
    ) {
      await generateDailyEntriesFromLoan(costCenter, entry, false);
    }

    await costCenter.save();

    await logAction(req, res, "UPDATE_BANK_ENTRY", costCenterId, entryId, {
      oldValues: oldValues,
      newValues: {
        name: entry.name,
        income: entry.income,
        expense: entry.expense,
        date: entry.date,
        disbursementDate: entry.disbursementDate,
        interestRate: entry.interestRate,
        loanTerm: entry.loanTerm,
        deductionDate: entry.deductionDate,
        monthsWithoutPrincipal: entry.monthsWithoutPrincipal,
        note: entry.note,
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

// Delete bank entry from a cost center
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

    // Xóa các daily entries liên quan
    if (
      entryToDelete.generatedDailyEntryIds &&
      entryToDelete.generatedDailyEntryIds.length > 0
    ) {
      await CostCenter.updateOne(
        { _id: costCenterId },
        {
          $pull: {
            daily: {
              _id: { $in: entryToDelete.generatedDailyEntryIds },
            },
          },
        },
      );
    }

    const deletedEntryData = {
      name: entryToDelete.name,
      income: entryToDelete.income,
      expense: entryToDelete.expense,
      date: entryToDelete.date,
      disbursementDate: entryToDelete.disbursementDate,
      interestRate: entryToDelete.interestRate,
      loanTerm: entryToDelete.loanTerm,
      deductionDate: entryToDelete.deductionDate,
      monthsWithoutPrincipal: entryToDelete.monthsWithoutPrincipal,
      note: entryToDelete.note,
    };

    costCenter.bank.pull(entryId);
    await costCenter.save();

    await logAction(req, res, "DELETE_BANK_ENTRY", costCenterId, entryId, {
      deletedEntry: deletedEntryData,
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

// Get all cost centers (for dropdown selection)
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
      "name fundLimitBank bank daily",
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

    // Tính tổng từ bank entries (chỉ tính income/expense gốc, không bao gồm daily entries sinh ra từ vay)
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

// API để lấy daily entries đã sinh từ bank entries
exports.getGeneratedDailyEntries = async (req, res) => {
  try {
    const { costCenterId, bankEntryId } = req.params;

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    const bankEntry = costCenter.bank.id(bankEntryId);
    if (!bankEntry) {
      return res.status(404).json({ message: "Bank entry not found" });
    }

    const generatedEntries = costCenter.daily.filter(
      (entry) =>
        bankEntry.generatedDailyEntryIds &&
        bankEntry.generatedDailyEntryIds.includes(entry._id),
    );

    res.json(generatedEntries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// API để tính toán trước lịch trả nợ
exports.calculateLoanSchedule = async (req, res) => {
  try {
    const {
      loanAmount,
      interestRate,
      loanTerm,
      disbursementDate,
      deductionDate,
      monthsWithoutPrincipal = 0,
    } = req.body;

    const annualInterestRate = interestRate / 100;
    const monthlyInterestRate = annualInterestRate / 12;
    const dailyInterestRate = annualInterestRate / 365;

    const results = [];
    let remainingBalance = loanAmount;
    const monthlyPayment = calculateMonthlyPayment(
      loanAmount,
      annualInterestRate,
      loanTerm,
    );
    let totalInterest = 0;
    let totalPrincipal = 0;

    for (let month = 0; month < loanTerm; month++) {
      let expenseAmount = 0;
      let principalPaid = 0;
      let interestPaid = 0;
      let description = "";
      let status = "";

      const currentMonthDate =
        month === 0 ? deductionDate : addMonths(deductionDate, month);
      const isGracePeriod = month < monthsWithoutPrincipal;

      // Tháng đầu tiên
      if (month === 0) {
        const days = daysBetween(disbursementDate, deductionDate);
        interestPaid = days * dailyInterestRate * loanAmount;
        expenseAmount = interestPaid;
        principalPaid = 0;
        description = `Lãi ${days} ngày từ ${disbursementDate} đến ${deductionDate}`;
        status = isGracePeriod ? "Chỉ lãi (Tháng không gốc)" : "Lãi đầu kỳ";
      }
      // Tháng cuối cùng
      else if (month === loanTerm - 1) {
        const lastPaymentDate = addMonths(disbursementDate, loanTerm);
        const firstDayOfLastMonth = getFirstDayOfMonth(currentMonthDate);
        if (lastPaymentDate && firstDayOfLastMonth) {
          const days = daysBetween(firstDayOfLastMonth, lastPaymentDate);

          if (isGracePeriod) {
            interestPaid = days * dailyInterestRate * remainingBalance;
            expenseAmount = interestPaid;
            principalPaid = 0;
            description = `Lãi ${days} ngày cuối kỳ`;
            status = "Chỉ lãi (Tháng không gốc)";
          } else {
            interestPaid = days * dailyInterestRate * remainingBalance;
            principalPaid = remainingBalance;
            expenseAmount = interestPaid + principalPaid;
            description = `Lãi ${days} ngày, trả hết gốc còn lại`;
            status = "Trả hết gốc + lãi";
          }
        }
      }
      // Các tháng giữa
      else {
        if (isGracePeriod) {
          interestPaid = monthlyInterestRate * remainingBalance;
          expenseAmount = interestPaid;
          principalPaid = 0;
          description = `Lãi tháng ${month + 1} trên dư nợ ${Math.round(remainingBalance).toLocaleString("vi-VN")}đ`;
          status = "Chỉ lãi (Tháng không gốc)";
        } else {
          interestPaid = monthlyInterestRate * remainingBalance;
          principalPaid = monthlyPayment - interestPaid;
          expenseAmount = monthlyPayment;
          remainingBalance -= principalPaid;
          description = `Trả gốc ${Math.round(principalPaid).toLocaleString("vi-VN")}đ, lãi ${Math.round(interestPaid).toLocaleString("vi-VN")}đ`;
          status = "Trả gốc + lãi";
        }
      }

      totalInterest += interestPaid;
      totalPrincipal += principalPaid;

      results.push({
        month: month + 1,
        date: currentMonthDate,
        payment: Math.round(expenseAmount),
        principal: Math.round(principalPaid),
        interest: Math.round(interestPaid),
        remainingBalance: Math.max(0, Math.round(remainingBalance)),
        description,
        status,
      });
    }

    res.json({
      loanAmount: Math.round(loanAmount),
      interestRate,
      loanTerm,
      monthsWithoutPrincipal,
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalInterest + loanAmount),
      totalInterest: Math.round(totalInterest),
      totalPrincipal: Math.round(totalPrincipal),
      schedule: results,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
