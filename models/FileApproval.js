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
  year: {
    type: Number,
    required: true,
  },
  month: {
    type: Number,
    required: true,
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
});

module.exports = mongoose.model("FileApproval", fileApprovalSchema);
