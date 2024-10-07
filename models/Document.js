const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approved: { type: Boolean, default: false },
});

module.exports = mongoose.model("Document", documentSchema);
