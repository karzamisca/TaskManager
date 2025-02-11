// models/RoomMessage.js
const mongoose = require("mongoose");

const roomMessageSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  attachments: [
    {
      fileId: String,
      webViewLink: String,
      fileName: String,
    },
  ],
  createdAt: { type: String, required: true },
});

module.exports = mongoose.model("RoomMessage", roomMessageSchema);
