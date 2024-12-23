const mongoose = require("mongoose");

const googleDriveFolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  googleDriveId: { type: String, required: true },
  parentFolderId: { type: String, default: null }, // New field for subfolders
  createdAt: { type: String, required: true },
});

module.exports = mongoose.model("GoogleDriveFolder", googleDriveFolderSchema);
