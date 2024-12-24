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

module.exports = router;
