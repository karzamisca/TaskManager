// models/GroupDeclaration.js
const mongoose = require("mongoose");

const groupDeclarationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  locked: { type: Boolean, default: false },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lockedAt: { type: Date },
});

module.exports = mongoose.model("GroupDeclaration", groupDeclarationSchema);
