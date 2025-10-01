// models/DocumentAdvancePaymentReclaim.js
const mongoose = require("mongoose");

const advancePaymentReclaimDocumentSchema = new mongoose.Schema({
  tag: { type: String, required: true, unique: true },
  title: {
    type: String,
    default: "Advance Payment Reclaim Document",
    required: true,
  },
  name: { type: String, required: true },
  costCenter: { type: String },
  content: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  advancePaymentReclaim: { type: Number, required: true },
  paymentDeadline: { type: String, default: "Not specified" },
  extendedPaymentDeadline: { type: String, default: "Not specified" },
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
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  approvers: [
    {
      approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: { type: String, required: true },
      subRole: { type: String, required: true },
    },
  ],
  appendedPurchasingDocuments: [
    {
      type: mongoose.Schema.Types.Mixed, // Stores full Purchasing Document details
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
    enum: ["Pending", "Approved", "Suspended"], // Possible states
    default: "Pending",
  },
  suspendReason: { type: String, default: "" },
  declaration: { type: String, default: "" },
  groupName: { type: String },
  groupDeclarationName: { type: String },
  projectName: { type: String },
});

module.exports = mongoose.model(
  "DocumentAdvancePaymentReclaim",
  advancePaymentReclaimDocumentSchema
);
