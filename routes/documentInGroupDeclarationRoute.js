// routes/groupDeclarationRoute.js
const express = require("express");
const router = express.Router();
const groupDeclarationController = require("../controllers/documentInGroupDeclarationController");
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Route to display groupDeclaration creation form
router.get(
  "/documentInGroupDeclaration",
  authMiddleware,
  groupDeclarationController.getDocumentInGroupDeclarationViews
);

// Route to handle form submission
router.post(
  "/createGroupDeclaration",
  authMiddleware,
  groupDeclarationController.createGroupDeclaration
);
router.get(
  "/getGroupDeclaration",
  groupDeclarationController.getGroupDeclaration
);
router.get(
  "/getGroupDeclarationedDocuments",
  groupDeclarationController.getGroupDeclarationedDocuments
);
// Approve document route
router.get(
  "/approveGroupDeclarationedDocument",
  authMiddleware,
  documentController.getPendingDocument
);
router.post(
  "/approveGroupDeclarationedDocument/:id",
  authMiddleware,
  groupDeclarationController.approveGroupDeclarationedDocument
);
router.post(
  "/deleteGroupDeclarationedDocument/:id",
  authMiddleware,
  groupDeclarationController.deleteGroupDeclarationedDocument
);

// Route to get unassigned documents
router.get(
  "/getUnassignedDocumentsForGroupDeclaration",
  groupDeclarationController.getUnassignedDocuments
);

// Routes for document groupDeclaration management
router.post(
  "/addDocumentToGroupDeclaration",
  authMiddleware,
  groupDeclarationController.addDocumentToGroupDeclaration
);
router.post(
  "/removeDocumentFromGroupDeclaration",
  authMiddleware,
  groupDeclarationController.removeDocumentFromGroupDeclaration
);

// Routes for locking or unlocking document groupDeclaration
router.post(
  "/unlockGroupDeclaration",
  authMiddleware,
  groupDeclarationController.unlockGroupDeclaration
);
router.post(
  "/lockGroupDeclaration",
  authMiddleware,
  groupDeclarationController.lockGroupDeclaration
);

module.exports = router;
