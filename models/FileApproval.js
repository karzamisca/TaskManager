// models/FileApproval.js
const mongoose = require("mongoose");

const fileApprovalSchema = new mongoose.Schema({
  fileName: String,
  originalName: String,
  filePath: String,
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  category: {
    type: String,
    enum: ["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"],
    required: true,
  },
  // Company specific fields
  companySubcategory: {
    type: String,
    required: false,
  },
  department: {
    type: String,
    required: false,
  },
  employeeName: {
    type: String,
    required: false,
  },
  assetType: {
    type: String,
    required: false,
  },
  assetName: {
    type: String,
    required: false,
  },
  documentSubtype: {
    type: String,
    required: false,
  },

  // Partner specific fields
  partnerName: {
    type: String,
    required: false,
  },
  contractType: {
    type: String,
    enum: ["Hợp đồng mua", "Hợp đồng bán", "Bảo hành & Khiếu nại"],
    required: false,
  },
  contractNumber: {
    type: String,
    required: false,
  },
  documentType: {
    type: String,
    required: false,
  },

  // Bank specific fields
  bankName: {
    type: String,
    required: false,
  },

  // Legal specific fields
  legalDocumentType: {
    type: String,
    required: false,
  },

  // Common fields
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: false,
    min: 1,
    max: 12,
  },
  nextcloudPath: String,
  shareUrl: String,
  fileSize: Number,
  mimeType: String,
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: String,
  actionTakenAt: Date,
  actionTakenBy: String,
  ipAddress: String,
  // File viewing permissions
  viewableBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  // Track who set the viewing permissions
  permissionsSetBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  permissionsSetAt: Date,
});

module.exports = mongoose.model("FileApproval", fileApprovalSchema);
