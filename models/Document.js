// models/Document.js
const mongoose = require("mongoose");

const stageFileMetadataSchema = new mongoose.Schema(
  {
    driveFileId: String,
    name: String,
    displayName: String,
    actualFilename: String,
    link: String,
    path: String,
    size: Number,
    mimeType: String,
    uploadTimestamp: String,
  },
  { _id: true },
);

const stageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Suspended"],
      default: "Pending",
    },
    approvers: [
      {
        approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String,
        subRole: String,
      },
    ],
    approvedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String,
        role: String,
        approvalDate: String,
      },
    ],
    suspendReason: { type: String, default: "" },
    // Add fileMetadata for stages
    fileMetadata: [stageFileMetadataSchema],
    // Optional: Add deadline for stage
    deadline: String,
    // Optional: Add amount for stage
    amount: Number,
  },
  { _id: true },
);

const documentSchema = new mongoose.Schema({
  tag: { type: String, unique: true },
  title: String,
  name: String,
  notes: String,
  groupName: String,
  projectName: String,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvers: [
    {
      approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      subRole: String,
    },
  ],
  approvedBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      role: String,
      approvalDate: String,
    },
  ],
  fileMetadata: [stageFileMetadataSchema], // Document-level files
  stages: [stageSchema], // Stages with their own fileMetadata
  submissionDate: String,
  status: {
    type: String,
    enum: ["Pending", "Approved", "Suspended"],
    default: "Pending",
  },
  suspendReason: { type: String, default: "" },
  declaration: String,
});

module.exports = mongoose.model("Document", documentSchema);
