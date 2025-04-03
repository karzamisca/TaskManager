// models/Group.js
const mongoose = require("mongoose");

const groupDeclarationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
});

module.exports = mongoose.model("GroupDeclaration", groupDeclarationSchema);
