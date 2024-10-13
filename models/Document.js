// models/Document.js
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],  // Array of approvers
  approvals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],  // Store approved approver IDs
  approved: { type: Boolean, default: false },
});

module.exports = mongoose.model("Document", documentSchema);
