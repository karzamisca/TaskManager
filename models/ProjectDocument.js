const mongoose = require("mongoose");

const projectDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  phases: {
    proposal: {
      status: { type: String, default: "Pending" }, // Initial phase is "Pending"
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      task: { type: String, default: "" },
      costCenter: { type: String, default: "" },
      dateOfError: { type: String, default: "" },
      detailsDescription: { type: String, default: "" },
      direction: { type: String, default: "" },
      submissionDate: { type: String, default: "" },
    },
    purchasing: {
      status: { type: String, default: "Locked" }, // Initial phase is "Locked"
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      title: { type: String, default: "Payment Document" },
      name: { type: String, default: "" },
      paymentMethod: { type: String, default: "" },
      amountOfMoney: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      paymentDeadline: { type: String, default: "" },
      submissionDate: { type: String, default: "" },
    },
    payment: {
      status: { type: String, default: "Locked" }, // Initial phase is "Locked"
      approvedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      title: { type: String, default: "Payment Document" },
      name: { type: String, default: "" },
      paymentMethod: { type: String, default: "" },
      amountOfMoney: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      paymentDeadline: { type: String, default: "" },
      submissionDate: { type: String, default: "" },
    },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ProjectDocument", projectDocumentSchema);
