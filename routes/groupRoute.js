const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route to display group creation form
router.get("/group", authMiddleware, (req, res) => {
  res.sendFile("groupIndex.html", {
    root: "./views/approvals/groups",
  });
});

// Route to handle form submission
router.post("/createGroup", authMiddleware, groupController.createGroup);
router.get("/getGroup", groupController.getGroup);
router.get("/getGroupedDocuments", groupController.getGroupedDocuments);

module.exports = router;
