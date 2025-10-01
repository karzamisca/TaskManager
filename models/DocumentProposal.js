// models/DocumentProposal.js
const mongoose = require("mongoose");

const proposalDocumentSchema = new mongoose.Schema({
  tag: { type: String, required: true, unique: true },
  title: { type: String, default: "Proposal Document", required: true },
  task: { type: String, required: true },
  costCenter: { type: String, required: true },
  dateOfError: { type: String, required: true },
  detailsDescription: { type: String, required: true },
  direction: { type: String, required: true },
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
  declaration: { type: String, default: "" },
  suspendReason: { type: String, default: "" },
  groupName: { type: String },
  groupDeclarationName: { type: String },
  projectName: { type: String },
});

module.exports = mongoose.model("DocumentProposal", proposalDocumentSchema);
