// models/DocumentInProject.js
const mongoose = require("mongoose");

// Helper function to format dates in GMT+7
function getCurrentGMT7Date() {
  const date = new Date();
  const offset = 7; // GMT+7
  const localTime = date.getTime() + offset * 60 * 60 * 1000;
  const localDate = new Date(localTime);
  const day = String(localDate.getUTCDate()).padStart(2, "0");
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = localDate.getUTCFullYear();
  const hours = String(localDate.getUTCHours()).padStart(2, "0");
  const minutes = String(localDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(localDate.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// File attachment schema
const fileAttachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  googleDriveId: { type: String, required: true },
  googleDriveUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: String, default: getCurrentGMT7Date },
});

const DocumentInProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  phases: {
    proposal: {
      status: { type: String, default: "Pending" },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      task: { type: String, default: "" },
      costCenter: { type: String, default: "" },
      dateOfError: { type: String, default: "" },
      detailsDescription: { type: String, default: "" },
      direction: { type: String, default: "" },
      lastUpdatedAt: { type: String, default: "" },
      attachments: [fileAttachmentSchema], // Add attachments array
    },
    purchasing: {
      status: { type: String, default: "Locked" },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      title: { type: String, default: "Purchasing Document" },
      products: [
        {
          productName: { type: String, required: true },
          costPerUnit: { type: Number, required: true },
          amount: { type: Number, required: true },
          totalCost: { type: Number, required: true }, // Cost per unit x amount
          note: { type: String },
        },
      ],
      grandTotalCost: { type: Number, default: 0 }, // Sum of all totalCosts
      lastUpdatedAt: { type: String, default: "" },
      attachments: [fileAttachmentSchema], // Add attachments array
    },
    payment: {
      status: { type: String, default: "Locked" },
      approvedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      title: { type: String, default: "Payment Document" },
      paymentMethod: { type: String, default: "" },
      amountOfMoney: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      paymentDeadline: { type: String, default: "" },
      lastUpdatedAt: { type: String, default: "" },
      attachments: [fileAttachmentSchema], // Add attachments array
    },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: String, default: getCurrentGMT7Date },
});

module.exports = mongoose.model("DocumentInProject", DocumentInProjectSchema);
