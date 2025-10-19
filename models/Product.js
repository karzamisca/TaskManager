// models/Product.js
const mongoose = require("mongoose");

const productChangeSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true,
    enum: ["name", "code"],
  },
  oldValue: {
    type: String,
  },
  newValue: {
    type: String,
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
    },
    code: {
      type: String,
      unique: true,
    },
    // Track previous names and codes
    previousNames: [
      {
        name: String,
        changedAt: Date,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    previousCodes: [
      {
        code: String,
        changedAt: Date,
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    // Complete change history
    changeHistory: [productChangeSchema],
    // Original values for reference
    originalName: {
      type: String,
    },
    originalCode: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware to set original values on first save
productSchema.pre("save", function (next) {
  if (this.isNew) {
    this.originalName = this.name;
    this.originalCode = this.code;
  }
  next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
