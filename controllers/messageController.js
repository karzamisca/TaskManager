// controllers/messageController.js
const moment = require("moment-timezone");
const Room = require("../models/Room");
const RoomMessage = require("../models/RoomMessage");
const User = require("../models/User");
const drive = require("../middlewares/googleAuthMiddleware");
const { Readable } = require("stream");
const path = require("path");

async function uploadToGoogleDrive(file) {
  try {
    const fileMetadata = {
      name: file.originalname,
      parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID], // Make sure to set this in .env
    };

    const media = {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink",
    });

    // Set file to be accessible via link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      fileName: file.originalname,
    };
  } catch (error) {
    console.error("Error uploading to Google Drive:", error);
    throw error;
  }
}

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

exports.createRoom = async (req, res) => {
  const { name, memberIds } = req.body;

  try {
    const newRoom = new Room({
      name,
      creator: req.user.id,
      members: [...new Set([req.user.id, ...memberIds])], // Ensure unique members including creator
      createdAt: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    await newRoom.save();
    res
      .status(201)
      .json({ message: "Room created successfully", roomId: newRoom._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating room" });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user.id })
      .populate("creator", "username")
      .populate("members", "username");
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching rooms" });
  }
};

exports.postRoomMessage = async (req, res) => {
  const { roomId, content } = req.body;
  let attachments = [];

  try {
    // Verify user is a member of the room
    const room = await Room.findOne({ _id: roomId, members: req.user.id });
    if (!room) {
      return res
        .status(403)
        .json({ error: "Not authorized to post in this room" });
    }

    // Handle file uploads if present
    if (req.files && req.files.length > 0) {
      // Upload each file to Google Drive
      attachments = await Promise.all(
        req.files.map((file) => uploadToGoogleDrive(file))
      );
    }

    const newMessage = new RoomMessage({
      room: roomId,
      user: req.user.id,
      content,
      attachments,
      createdAt: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    await newMessage.save();
    res.status(201).json({ message: "Message posted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error posting message" });
  }
};

exports.getRoomMessages = async (req, res) => {
  const { roomId } = req.params;

  try {
    // Verify user is a member of the room
    const room = await Room.findOne({ _id: roomId, members: req.user.id });
    if (!room) {
      return res
        .status(403)
        .json({ error: "Not authorized to view this room" });
    }

    const messages = await RoomMessage.find({ room: roomId }).populate(
      "user",
      "username"
    );
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching messages" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    // Exclude the requesting user from the list
    const users = await User.find(
      { _id: { $ne: req.user.id } },
      "username department"
    );
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching users" });
  }
};

// Add to controllers/roomController.js
exports.addMembersToRoom = async (req, res) => {
  const { roomId, memberIds } = req.body;

  try {
    const room = await Room.findOne({ _id: roomId, creator: req.user.id });
    if (!room) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify this room" });
    }

    // Add new members while preventing duplicates
    room.members = [...new Set([...room.members, ...memberIds])];
    await room.save();

    res.json({ message: "Members added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error adding members" });
  }
};

exports.removeMemberFromRoom = async (req, res) => {
  const { roomId, memberId } = req.body;

  try {
    const room = await Room.findOne({ _id: roomId, creator: req.user.id });
    if (!room) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify this room" });
    }

    // Cannot remove the creator
    if (memberId === room.creator.toString()) {
      return res.status(400).json({ error: "Cannot remove room creator" });
    }

    room.members = room.members.filter((id) => id.toString() !== memberId);
    await room.save();

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error removing member" });
  }
};

exports.deleteRoom = async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await Room.findOne({ _id: roomId, creator: req.user.id });
    if (!room) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this room" });
    }

    // Delete all messages in the room
    await RoomMessage.deleteMany({ room: roomId });
    // Delete the room
    await Room.deleteOne({ _id: roomId });

    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting room" });
  }
};
