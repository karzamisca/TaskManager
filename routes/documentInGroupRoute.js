// routes/groupRoute.js
const express = require("express");
const router = express.Router();
const groupController = require("../controllers/documentInGroupController");
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route to display group creation form
router.get(
  "/documentInGroup",
  authMiddleware,
  groupController.getDocumentInGroupViews
);

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

// Route to get unassigned documents
router.get(
  "/getUnassignedDocumentsForGroup",
  groupController.getUnassignedDocuments
);

// Routes for document group management
router.post(
  "/addDocumentToGroup",
  authMiddleware,
  groupController.addDocumentToGroup
);
router.post(
  "/removeDocumentFromGroup",
  authMiddleware,
  groupController.removeDocumentFromGroup
);

module.exports = router;
