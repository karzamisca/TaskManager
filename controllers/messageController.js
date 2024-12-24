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

    // Format the `createdAt` field to Bangkok time
    const formattedMessages = messages.map((message) => ({
      id: message._id,
      user: { username: message.user.username },
      content: message.content,
      createdAt: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"), // Format as per requirement
    }));

    res.json(formattedMessages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching messages." });
  }
};
