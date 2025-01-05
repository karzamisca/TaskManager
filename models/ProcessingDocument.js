// models/ProcessingDocument.js

const mongoose = require("mongoose");

const processingDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Processing Document", required: true },
  products: [
    {
      productName: { type: String, required: true },
      costPerUnit: { type: Number, required: true },
      amount: { type: Number, required: true },
      totalCost: { type: Number, required: true }, // Cost per unit x amount
      note: { type: String },
    },
  ],
  appendedContent: [
    {
      maintenance: String,
      costCenter: String,
      dateOfError: String,
      errorDescription: String,
      direction: String,
      fileMetadata: {
        driveFileId: { type: String },
        name: { type: String },
        link: { type: String },
      },
    },
  ],
  fileMetadata: {
    driveFileId: { type: String },
    name: { type: String },
    link: { type: String },
  },
  submissionDate: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvers: [
    {
      approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: { type: String, required: true },
      subRole: { type: String, required: true },
    },
  ],
  approved: { type: Boolean, default: false },
  approvedBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: { type: String, required: true },
      role: { type: String, required: true },
      approvalDate: { type: String, required: true },
    },
  ],
  grandTotalCost: { type: Number, required: true }, // Sum of all totalCosts
});

module.exports = mongoose.model("ProcessingDocument", processingDocumentSchema);
