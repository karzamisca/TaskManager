// models/Document.js
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvers: [
    {
      approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // User ID of the approver
      username: { type: String, required: true }, // Username of the approver
      subRole: { type: String, required: true }, // Sub-role of the approver
    }
  ],
  approved: { type: Boolean, default: false },
  approvedBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // User ID of the approver
      username: { type: String, required: true }, // Username of the approver
      role: { type: String, required: true }, // Role of the approver
    }
  ],
});

module.exports = mongoose.model("Document", documentSchema);


