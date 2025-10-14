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

// Define the schema for bank entries
const bankSchema = new mongoose.Schema({
  name: { type: String, required: true },
  income: { type: Number, default: 0 },
  expense: { type: Number, default: 0 },
  date: {
    type: String,
    required: true,
    match: [/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format"],
  },
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
  bank: [bankSchema], // New field for bank entries
});

// Pre-save hooks to calculate totals
purchaseSaleSchema.pre("save", function (next) {
  this.totalCost = this.amount * this.unitCost;
  next();
});

constructionSchema.pre("save", function (next) {
  // Calculate net for construction entries
  this.net = this.income - this.expense;
  next();
});

bankSchema.pre("save", function (next) {
  // Calculate net for bank entries
  this.net = this.income - this.expense;
  next();
});

monthEntrySchema.pre("save", function (next) {
  // Calculate commission bonuses
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
