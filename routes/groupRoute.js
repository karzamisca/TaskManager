const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route to display group creation form
router.get("/groupedDocument", authMiddleware, (req, res) => {
  res.sendFile("groupDocument.html", {
    root: "./views/approvals/groups",
  });
});

// Route to handle form submission
router.post("/createGroup", authMiddleware, groupController.createGroup);
router.get("/getGroup", groupController.getGroup);
router.get("/getGroupedDocuments", groupController.getGroupedDocuments);
// Approve document route
router.get(
  "/approveGroupedDocument",
  authMiddleware,
  documentController.getPendingDocument
);
router.post(
  "/approveGroupedDocument/:id",
  authMiddleware,
  groupController.approveGroupedDocument
);
router.post(
  "/deleteGroupedDocument/:id",
  authMiddleware,
  groupController.deleteGroupedDocument
);

module.exports = router;
