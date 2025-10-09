const mongoose = require("mongoose");

const fileLogSchema = new mongoose.Schema({
  fileName: String,
  originalName: String,
  filePath: String,
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
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

module.exports = mongoose.model("FileLog", fileLogSchema);
