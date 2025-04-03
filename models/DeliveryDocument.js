// models\DeliveryDocument.js
const mongoose = require("mongoose");

const deliveryDocumentSchema = new mongoose.Schema({
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
      dateOfError: String,
      detailsDescription: String,
      direction: String,
      fileMetadata: {
        driveFileId: { type: String },
        name: { type: String },
        link: { type: String },
      },
      proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProposalDocument",
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

module.exports = mongoose.model("DeliveryDocument", deliveryDocumentSchema);
