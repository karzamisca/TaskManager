// models/CostCenter.js
const mongoose = require("mongoose");

// Define the schema for purchase/sale transactions
const purchaseSaleSchema = new mongoose.Schema({
  amount: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
});

// Define the schema for commission and bonus tracking
const commissionBonusSchema = new mongoose.Schema({
  purchase: { type: Number, default: 0 },
  sale: { type: Number, default: 0 },
});

// Define the schema for monthly financial entries
const monthEntrySchema = new mongoose.Schema({
  purchaseContract: purchaseSaleSchema,
  saleContract: purchaseSaleSchema,
  transportCost: { type: Number, default: 0 },
  commissionBonus: commissionBonusSchema,
});

// Define the schema for monthly data
const monthSchema = new mongoose.Schema({
  name: { type: String, required: true },
  entries: [monthEntrySchema],
});

// Define the schema for yearly data
const yearSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  months: [monthSchema],
});

// Define the schema for construction entries
const constructionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  date: {
    type: String,
    required: true,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
  },
});

// Add new schema for periodic principal payment settings
const periodicPrincipalSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  paymentFrequencyMonths: { type: Number, default: 3, min: 1 },
  principalPaymentRate: { type: Number, default: 0, min: 0, max: 100 },
  usePercentageRate: { type: Boolean, default: true },
  fixedPrincipalAmount: { type: Number, default: 0, min: 0 },
});

// Helper functions for date calculations
const parseDateToTimestamp = (dateString) => {
  if (!dateString) return null;
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

// Get the actual deduction date for a given month
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

// Generate monthly deduction schedule with periodic principal payment support
const generateDeductionSchedule = (entry) => {
  const schedule = [];
  const disbursementDate = parseDateToTimestamp(entry.loanDisbursementDate);
  const maturityDate = parseDateToTimestamp(entry.maturityDate);
  const deductionDay = parseInt(entry.deductionDate.split("/")[0]);

  if (!disbursementDate || !maturityDate || !deductionDay) return schedule;

  const totalLoan = entry.income || 0;
  const gracePeriodMonths = entry.monthsWithNoPrincipalRepayment || 0;
  const annualRatePercent = entry.interestRate;
  const periodicPrincipal = entry.periodicPrincipal || {
    enabled: false,
    paymentFrequencyMonths: 3,
    principalPaymentRate: 0,
    usePercentageRate: true,
    fixedPrincipalAmount: 0,
  };

  // Get the first deduction date
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

  // Count total payments before maturity
  let paymentCount = 0;
  let tempDate = new Date(firstDeductionDate);
  while (tempDate < maturityDate) {
    paymentCount++;
    tempDate.setMonth(tempDate.getMonth() + 1);
    tempDate = getDeductionDateForMonth(tempDate, deductionDay);
  }

  // Generate schedule for regular payments
  let currentStartDate = new Date(disbursementDate);
  let currentDeductionDate = new Date(firstDeductionDate);
  let monthIndex = 0;
  let principalPaid = 0;
  let lastPrincipalPaymentMonth = -1;

  // Regular payments (all deductions before maturity date)
  while (currentDeductionDate < maturityDate) {
    const isGracePeriod = monthIndex < gracePeriodMonths;

    const daysInPeriod = getActualDaysBetween(
      formatDate(currentStartDate),
      formatDate(currentDeductionDate),
    );

    const outstandingBalance = totalLoan - principalPaid;
    const interestExpense =
      (annualRatePercent / 100) * (daysInPeriod / 365) * outstandingBalance;

    let principalThisMonth = 0;
    let paymentNote = "";

    if (!isGracePeriod) {
      const monthsSinceLastPrincipal = monthIndex - lastPrincipalPaymentMonth;
      const shouldPayPrincipal = periodicPrincipal.enabled
        ? monthsSinceLastPrincipal >= periodicPrincipal.paymentFrequencyMonths
        : true;

      if (shouldPayPrincipal) {
        if (periodicPrincipal.enabled) {
          const remainingPrincipal = totalLoan - principalPaid;

          if (periodicPrincipal.usePercentageRate) {
            const rate = periodicPrincipal.principalPaymentRate / 100;
            let rawPrincipal = remainingPrincipal * rate;
            rawPrincipal = Math.min(rawPrincipal, remainingPrincipal - 1);
            principalThisMonth = Math.floor(rawPrincipal);
            if (principalThisMonth > 0) {
              paymentNote = `Trả gốc định kỳ ${periodicPrincipal.paymentFrequencyMonths} tháng (${periodicPrincipal.principalPaymentRate}% số dư)`;
            }
          } else {
            const fixedAmount = periodicPrincipal.fixedPrincipalAmount;
            principalThisMonth = Math.min(fixedAmount, remainingPrincipal - 1);
            if (principalThisMonth > 0) {
              paymentNote = `Trả gốc định kỳ ${periodicPrincipal.paymentFrequencyMonths} tháng (${fixedAmount.toLocaleString("vi-VN")} VND cố định)`;
            }
          }
          lastPrincipalPaymentMonth = monthIndex;
        } else {
          const remainingPayments = paymentCount - monthIndex;
          const remainingPrincipal = totalLoan - principalPaid;

          if (remainingPayments === 1) {
            principalThisMonth = 0;
          } else {
            const rawPrincipal = remainingPrincipal / remainingPayments;
            principalThisMonth = Math.floor(rawPrincipal);
          }
        }
      } else if (periodicPrincipal.enabled) {
        paymentNote = `Kỳ chỉ trả lãi (không đến kỳ trả gốc định kỳ)`;
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
      isLastPayment: false,
      isFinalPeriod: false,
      paymentNote,
    });

    principalPaid += principalThisMonth;
    currentStartDate = new Date(currentDeductionDate);
    monthIndex++;

    const nextDate = new Date(currentDeductionDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    currentDeductionDate = getDeductionDateForMonth(nextDate, deductionDay);
  }

  // FINAL PERIOD: From last deduction date to maturity date
  const lastStartDate = currentStartDate;
  const finalEndDate = maturityDate;

  const finalDaysInPeriod = getActualDaysBetween(
    formatDate(lastStartDate),
    formatDate(finalEndDate),
  );

  const finalOutstandingBalance = totalLoan - principalPaid;

  const finalInterestExpense =
    (annualRatePercent / 100) *
    (finalDaysInPeriod / 365) *
    finalOutstandingBalance;

  const finalPrincipalRepayment = finalOutstandingBalance;

  let finalNote = "Kỳ trả nợ cuối cùng (tất toán tại ngày đáo hạn)";
  if (periodicPrincipal.enabled && principalPaid > 0) {
    finalNote += ` - Đã trả gốc ${principalPaid.toLocaleString("vi-VN")} VND trước đó`;
  }

  schedule.push({
    period: schedule.length + 1,
    deductionDate: formatDate(finalEndDate),
    startDate: formatDate(lastStartDate),
    endDate: formatDate(finalEndDate),
    daysInPeriod: finalDaysInPeriod,
    interestExpense: Math.round(finalInterestExpense),
    principalRepayment: Math.round(finalPrincipalRepayment),
    totalPayment: Math.round(finalInterestExpense + finalPrincipalRepayment),
    outstandingBalance: 0,
    isGracePeriod: false,
    isFirstPayment: false,
    isLastPayment: true,
    isFinalPeriod: true,
    paymentNote: finalNote,
  });

  return schedule;
};

// Define the schema for bank entries (ALL ARE LOANS)
const bankSchema = new mongoose.Schema({
  name: { type: String, required: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  date: {
    type: String,
    required: true,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
  },
  loanDisbursementDate: {
    type: String,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
    default: null,
  },
  interestRate: {
    type: Number,
    default: 0,
    min: 0,
  },
  deductionDate: {
    type: String,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
    default: null,
  },
  monthsWithNoPrincipalRepayment: {
    type: Number,
    default: 0,
    min: 0,
  },
  maturityDate: {
    type: String,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
    default: null,
  },
  isCompleteLoan: {
    type: Boolean,
    default: false,
  },
  periodicPrincipal: {
    type: periodicPrincipalSchema,
    default: () => ({
      enabled: false,
      paymentFrequencyMonths: 3,
      principalPaymentRate: 0,
      usePercentageRate: true,
      fixedPrincipalAmount: 0,
    }),
  },
});

// Method to generate daily entries from loan interest
bankSchema.methods.generateDailyEntries = async function (
  costCenterId,
  CostCenterModel,
) {
  if (
    !this.isCompleteLoan ||
    !this.loanDisbursementDate ||
    !this.deductionDate ||
    !this.maturityDate
  ) {
    return;
  }

  const costCenter = await CostCenterModel.findById(costCenterId);
  if (!costCenter) return;

  const schedule = generateDeductionSchedule(this);

  for (const payment of schedule) {
    let note = "";
    if (payment.isFinalPeriod) {
      note = `Kỳ trả nợ cuối cùng (tất toán tại ngày đáo hạn): ${payment.startDate} → ${payment.endDate} (${payment.daysInPeriod} ngày). Lãi suất: ${this.interestRate}%, Trả gốc tất toán: ${payment.principalRepayment.toLocaleString("vi-VN")} VND, Trả lãi: ${payment.interestExpense.toLocaleString("vi-VN")} VND, Tổng thanh toán: ${payment.totalPayment.toLocaleString("vi-VN")} VND`;
      if (this.periodicPrincipal?.enabled) {
        note += ` (Hình thức trả gốc định kỳ)`;
      }
    } else if (payment.isGracePeriod) {
      note = `Ân hạn - Chỉ trả lãi. Kỳ ${payment.period}: ${payment.startDate} → ${payment.endDate} (${payment.daysInPeriod} ngày). Lãi suất: ${this.interestRate}%, Dư nợ: ${(payment.outstandingBalance + payment.principalRepayment).toLocaleString("vi-VN")} VND, Tiền lãi dự kiến: ${payment.interestExpense.toLocaleString("vi-VN")} VND`;
    } else {
      note = `Kỳ ${payment.period}: ${payment.startDate} → ${payment.endDate} (${payment.daysInPeriod} ngày). Lãi suất: ${this.interestRate}%, Trả gốc dự kiến: ${payment.principalRepayment.toLocaleString("vi-VN")} VND, Trả lãi dự kiến: ${payment.interestExpense.toLocaleString("vi-VN")} VND, Dư nợ còn lại: ${payment.outstandingBalance.toLocaleString("vi-VN")} VND`;
      if (payment.paymentNote) note += ` (${payment.paymentNote})`;
    }

    costCenter.daily.push({
      name: `Lãi vay - ${this.name}`,
      income: 0,
      expense: 0,
      expensePrediction: payment.totalPayment,
      date: payment.deductionDate,
      incomePrediction: 0,
      note: note,
      loanId: this._id.toString(),
      isLoanInterest: true,
      deductionDateUsed: payment.deductionDate,
      interestRateUsed: this.interestRate,
      outstandingBalanceUsed:
        payment.outstandingBalance + payment.principalRepayment,
      daysInPeriod: payment.daysInPeriod,
      periodNumber: payment.period,
      isGracePeriod: payment.isGracePeriod || false,
      isFinalPeriod: payment.isFinalPeriod || false,
    });
  }

  await costCenter.save();
};

// Method to update daily entries when loan is modified
bankSchema.methods.updateDailyEntries = async function (
  costCenterId,
  CostCenterModel,
) {
  const costCenter = await CostCenterModel.findById(costCenterId);
  if (!costCenter) return;

  // Delete all old daily entries for this loan
  costCenter.daily = costCenter.daily.filter(
    (entry) => entry.loanId !== this._id.toString(),
  );
  await costCenter.save();

  // Recreate them fresh
  await this.generateDailyEntries(costCenterId, CostCenterModel);
};

// Define the schema for daily entries
const dailySchema = new mongoose.Schema({
  name: { type: String, required: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  date: {
    type: String,
    required: true,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
  },
  incomePrediction: { type: Number, default: 0 },
  expensePrediction: { type: Number, default: 0 },
  note: { type: String, default: "" },
  isLoanInterest: { type: Boolean, default: false },
  loanId: { type: String, default: null },
  deductionDateUsed: { type: String, default: null },
  interestRateUsed: { type: Number, default: 0 },
  outstandingBalanceUsed: { type: Number, default: 0 },
  daysInPeriod: { type: Number, default: 0 },
  periodNumber: { type: Number, default: 0 },
  isGracePeriod: { type: Boolean, default: false },
  isFinalPeriod: { type: Boolean, default: false },
});

// Define the merged cost center schema
const costCenterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  category: {
    type: String,
    enum: ["Mua bán khí", "Thuê trạm", "Thuê bồn", "Đội"],
    default: "Mua bán khí",
  },
  allowedUsers: {
    type: [String],
    default: [],
  },
  years: [yearSchema],
  construction: [constructionSchema],
  bank: [bankSchema],
  daily: [dailySchema],
  fundLimitBank: {
    type: Number,
    default: 0,
  },
});

// Pre-save hooks
purchaseSaleSchema.pre("save", function (next) {
  this.totalCost = this.amount * this.unitCost;
  next();
});

constructionSchema.pre("save", function (next) {
  this.net = this.income - this.expense;
  next();
});

bankSchema.pre("save", function (next) {
  this.net = this.income - this.expense;
  next();
});

dailySchema.pre("save", function (next) {
  this.net = this.income - this.expense;
  this.predictedNet = this.incomePrediction - this.expensePrediction;
  next();
});

monthEntrySchema.pre("save", function (next) {
  if (
    this.purchaseContract &&
    this.commissionRatePurchase &&
    this.currencyExchangeRate
  ) {
    this.commissionBonus = this.commissionBonus || {};
    this.commissionBonus.purchase =
      this.commissionRatePurchase *
      this.purchaseContract.amount *
      this.currencyExchangeRate;
  }

  if (
    this.saleContract &&
    this.commissionRateSale &&
    this.currencyExchangeRate
  ) {
    this.commissionBonus = this.commissionBonus || {};
    this.commissionBonus.sale =
      this.commissionRateSale *
      this.saleContract.amount *
      this.saleContract.unitCost;
  }
  next();
});

const CostCenter = mongoose.model("CostCenter", costCenterSchema);
module.exports = CostCenter;
