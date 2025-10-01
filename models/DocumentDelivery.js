// models/DocumentDelivery.js
const mongoose = require("mongoose");

const deliveryDocumentSchema = new mongoose.Schema({
  tag: { type: String, required: true, unique: true },
  title: { type: String, default: "Delivery Document", required: true },
  name: { type: String, required: true },
  costCenter: { type: String, required: true }, // Added costCenter field with same restrictions as ProposalDocument
  products: [
    {
      productName: { type: String, required: true },
      costPerUnit: { type: Number, required: true },
      amount: { type: Number, required: true },
      vat: { type: Number, required: true, default: 0 },
      totalCost: { type: Number, required: true }, // Cost per unit x amount
      totalCostAfterVat: { type: Number, required: true },
      note: { type: String },
    },
  ],
  appendedProposals: [
    {
      task: String,
      costCenter: String,
      groupName: String,
      dateOfError: String,
      detailsDescription: String,
      direction: String,
      fileMetadata: [
        {
          driveFileId: { type: String },
          name: { type: String },
          displayName: { type: String },
          actualFilename: { type: String },
          link: { type: String },
          path: { type: String },
          size: { type: String },
          mimeType: { type: String },
          uploadTimestamp: { type: String },
        },
      ],
      proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProposalDocument",
      },
      submissionDate: String,
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvers: [
        {
          approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          username: { type: String, required: true },
          subRole: { type: String, required: true },
        },
      ],
      approvedBy: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          username: { type: String, required: true },
          role: { type: String, required: true },
          approvalDate: { type: String, required: true },
        },
      ],
      status: {
        type: String,
        enum: ["Pending", "Approved", "Suspended"],
        default: "Pending",
      },
      declaration: { type: String, default: "" },
      suspendReason: { type: String, default: "" },
      projectName: String,
    },
  ],
  fileMetadata: [
    {
      driveFileId: { type: String },
      name: { type: String },
      displayName: { type: String },
      actualFilename: { type: String },
      link: { type: String },
      path: { type: String },
      size: { type: String },
      mimeType: { type: String },
      uploadTimestamp: { type: String },
    },
  ],
  stages: [
    {
      name: { type: String, required: true },
      amount: { type: Number, required: true },
      deadline: { type: String },
      approvers: [
        {
          approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          username: { type: String, required: true },
          subRole: { type: String, required: true },
        },
      ],
      approvedBy: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          username: { type: String, required: true },
          role: { type: String, required: true },
          approvalDate: { type: String, required: true },
        },
      ],
      status: {
        type: String,
        enum: ["Pending", "Approved", "Suspended"],
        default: "Pending",
      },
      paymentMethod: { type: String },
      notes: { type: String },
    },
  ],
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
  status: {
    type: String,
    enum: ["Pending", "Approved", "Suspended"], // Possible states
    default: "Pending",
  },
  suspendReason: { type: String, default: "" },
  groupName: { type: String },
  groupDeclarationName: { type: String },
  projectName: { type: String },
});

module.exports = mongoose.model("DocumentDelivery", deliveryDocumentSchema);
