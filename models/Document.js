// models/Document.js
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  tag: { type: String },
  name: { type: String },
  title: { type: String, default: "Generic Document", required: true },
  notes: { type: String },
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
      description: { type: String, default: "" },
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
    enum: ["Pending", "Approved", "Suspended"],
    default: "Pending",
  },
  suspendReason: { type: String, default: "" },
  declaration: { type: String, default: "" },
  groupName: { type: String },
  groupDeclarationName: { type: String },
  projectName: { type: String },
});

module.exports = mongoose.model("Document", documentSchema);
