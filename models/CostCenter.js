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

// Define the schema for bank entries with loan fields
const bankSchema = new mongoose.Schema({
  name: { type: String, required: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  date: {
    type: String,
    required: true,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
  },
  // Các trường mới cho tính toán lãi vay
  disbursementDate: {
    // Ngày nhận nợ
    type: String,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
    default: null,
  },
  interestRate: { type: Number, default: 0 }, // Lãi suất (%/năm)
  loanTerm: { type: Number, default: 0 }, // Kỳ vay (tháng)
  deductionDate: {
    // Ngày trích nợ hàng tháng
    type: String,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
    default: null,
  },
  monthsWithoutPrincipal: { type: Number, default: 0 }, // Tháng không trả gốc
  generatedDailyEntryIds: [{ type: mongoose.Schema.Types.ObjectId }], // IDs của daily entries đã sinh
  note: { type: String, default: "" },
});

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
  // Prediction fields
  incomePrediction: { type: Number, default: 0 },
  expensePrediction: { type: Number, default: 0 },
  note: { type: String, default: "" },
  // Liên kết với bank entry nếu được sinh ra từ khoản vay
  sourceBankEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CostCenter.bank",
  },
  isLoanInterest: { type: Boolean, default: false },
  loanMonth: { type: Number, default: null }, // Tháng thứ mấy của kỳ vay
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
