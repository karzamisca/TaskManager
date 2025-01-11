// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: { type: String, required: true },
});

module.exports = mongoose.model("Message", messageSchema);
