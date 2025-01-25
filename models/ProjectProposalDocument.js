// models/ProjectProposalDocument.js
const mongoose = require("mongoose");

const projectProposalDocumentSchema = new mongoose.Schema({
  task: { type: String, required: true },
  costCenter: { type: String, required: true },
  dateOfError: { type: String, required: true },
  detailsDescription: { type: String, required: true },
  direction: { type: String, required: true },
  submissionDate: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model(
  "ProjectProposalDocument",
  projectProposalDocumentSchema
);
