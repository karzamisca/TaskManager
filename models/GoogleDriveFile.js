const mongoose = require("mongoose");

const googleDriveFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  googleDriveId: { type: String, required: true },
  mimeType: String,
  uploadedAt: String,
});

module.exports = mongoose.model("GoogleDriveFile", googleDriveFileSchema);
