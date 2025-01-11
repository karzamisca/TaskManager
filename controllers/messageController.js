// controllers/messageController.js
const Message = require("../models/Message");
const moment = require("moment-timezone");

// Post a new message
exports.postMessage = async (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content is required." });
  }

  try {
    const newMessage = new Message({
      user: req.user.id, // User ID from the authenticated token
      content,
      createdAt: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    await newMessage.save();
    res.status(201).json({ message: "Message posted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error posting message." });
  }
};

// Get all messages
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find().populate("user", "username");

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching messages." });
  }
};
