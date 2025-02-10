// models/Room.js
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: String, required: true },
  isPrivate: { type: Boolean, default: true },
});

module.exports = mongoose.model("Room", roomSchema);
