// routes/messageRoute.js
const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/message", authMiddleware, (req, res) => {
  res.sendFile("index.html", {
    root: "./views/messages",
  });
});

// Protected routes (only authenticated users can post messages)
router.post("/messagePost", authMiddleware, messageController.postMessage);

// Public route to get messages
router.get("/messageGet", authMiddleware, messageController.getMessages);

router.post("/room/create", authMiddleware, messageController.createRoom);
router.get("/rooms", authMiddleware, messageController.getRooms);
router.post("/room/message", authMiddleware, messageController.postRoomMessage);
router.get(
  "/room/:roomId/messages",
  authMiddleware,
  messageController.getRoomMessages
);
router.get("/users", authMiddleware, messageController.getUsers);
router.post(
  "/room/members/add",
  authMiddleware,
  messageController.addMembersToRoom
);
router.post(
  "/room/members/remove",
  authMiddleware,
  messageController.removeMemberFromRoom
);
router.delete("/room/:roomId", authMiddleware, messageController.deleteRoom);

module.exports = router;
