// models/ItemOrder.js
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  itemName: {
    type: String,
    required: true,
  },
  itemCode: {
    type: String,
    required: true,
  },
  unit: {
    type: String,
    required: true,
  },
  unitPrice: {
    type: Number,
    required: true,
  },
  vat: {
    type: Number,
    required: true,
  },
  unitPriceAfterVAT: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  totalPriceAfterVAT: {
    type: Number,
    required: true,
  },
});

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
    },
  ],
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAmountAfterVAT: {
    type: Number,
    required: true,
    min: 0,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  formattedOrderDate: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "cancelled"],
    default: "pending",
  },
  notes: {
    type: String,
    trim: true,
    default: "",
  },
  groups: [groupSchema], // Groups với items nested bên trong
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  formattedUpdatedAt: {
    type: String,
  },
});

// Format dates before saving
orderSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Format dates to dd-mm-yyyy
  const formatDate = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatDateTime = (date) => {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  // Format order date
  if (this.orderDate) {
    this.formattedOrderDate = formatDate(this.orderDate);
  }

  // Format updated at
  if (this.updatedAt) {
    this.formattedUpdatedAt = formatDateTime(this.updatedAt);
  }

  // Ensure groups is an array and validate
  if (!this.groups) {
    this.groups = [];
  }

  if (this.groups && Array.isArray(this.groups)) {
    // Filter out invalid groups
    this.groups = this.groups.filter(
      (group) =>
        group &&
        group.name &&
        typeof group.name === "string" &&
        group.name.trim() !== "" &&
        Array.isArray(group.items)
    );

    // Remove duplicate item references within groups
    this.groups.forEach((group) => {
      if (group.items && Array.isArray(group.items)) {
        group.items = [...new Set(group.items)];
      }
    });
  }

  next();
});

const Order = mongoose.model("ItemOrder", orderSchema);
module.exports = Order;
