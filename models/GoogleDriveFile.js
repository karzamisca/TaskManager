// models/GoogleDriveFile.js
const mongoose = require("mongoose");

const GoogleDriveFileSchema = new mongoose.Schema({
  name: String,
  googleDriveId: String,
  mimeType: String,
  parentFolderId: { type: String, default: null }, // Added parent folder field
  uploadedAt: String,
});

module.exports = mongoose.model("GoogleDriveFile", GoogleDriveFileSchema);
