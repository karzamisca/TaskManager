// models/ReportDocument.js
const mongoose = require("mongoose");

const reportDocumentSchema = new mongoose.Schema({
  title: { type: String, default: "Report Document", required: true },
  tags: {
    type: String,
    required: true,
  },
  postProcessingReport: {
    type: String,
    required: true,
  },
  submissionDate: {
    type: String,
    required: true,
    default: () => moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  },
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
  approvedBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: { type: String, required: true },
      role: { type: String, required: true },
      approvalDate: { type: String, required: true },
    },
  ],
  approved: { type: Boolean, default: false },
});

module.exports = mongoose.model("ReportDocument", reportDocumentSchema);
