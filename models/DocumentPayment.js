// models/DocumentPayment.js
const mongoose = require("mongoose");

const paymentDocumentSchema = new mongoose.Schema({
  tag: { type: String, required: true, unique: true },
  title: { type: String, default: "Payment Document", required: true },
  name: { type: String, required: true },
  costCenter: { type: String },
  content: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  totalPayment: { type: Number, required: true },
  advancePayment: { type: Number, default: 0 },
  paymentDeadline: { type: String, default: "Not specified" },
  priority: {
    type: String,
    enum: ["Cao", "Trung bình", "Thấp"],
    default: "Thấp",
    required: true,
  },
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
      priority: {
        type: String,
        enum: ["Cao", "Trung bình", "Thấp"],
        default: "Thấp",
        required: true,
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
      paymentMethod: { type: String },
      notes: { type: String },
      fileMetadata: {
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
      declaration: { type: String, default: "" },
      groupDeclarationName: { type: String },
      suspendReason: { type: String, default: "" },
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
    enum: ["Pending", "Approved", "Suspended"],
    default: "Pending",
  },
  notes: { type: String, default: "" },
  suspendReason: { type: String, default: "" },
  declaration: { type: String, default: "" },
  groupName: { type: String },
  groupDeclarationName: { type: String },
  projectName: { type: String },
});

module.exports = mongoose.model("DocumentPayment", paymentDocumentSchema);
