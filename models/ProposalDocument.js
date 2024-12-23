// models/ProposalDocument.js
const mongoose = require("mongoose");

const proposalDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Proposal Document", required: true },
  maintenance: { type: String, required: true },
  costCenter: { type: String, required: true },
  dateOfError: { type: String, required: true },
  errorDescription: { type: String, required: true },
  direction: { type: String, required: true },
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
});

module.exports = mongoose.model("ProposalDocument", proposalDocumentSchema);
