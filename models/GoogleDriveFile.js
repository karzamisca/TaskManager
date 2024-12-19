const mongoose = require("mongoose");

const googleDriveFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  googleDriveId: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("GoogleDriveFile", googleDriveFileSchema);
