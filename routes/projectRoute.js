// routes/projectRoute.js
const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

////PROJECT DOCUMENT ROUTES
// Route to display project creation form
router.get(
  "/projectDocument",
  authMiddleware,
  projectController.getProjectDocumentViews
);
// Route to handle form submission
router.post("/createProject", authMiddleware, projectController.createProject);
router.get("/getProject", projectController.getProject);
router.get("/getProjectedDocuments", projectController.getProjectedDocuments);
// Approve document route
router.get(
  "/approveProjectedDocument",
  authMiddleware,
  documentController.getPendingDocument
);

// Route to get unassigned documents
router.get(
  "/getUnassignedDocumentsForProject",
  projectController.getUnassignedDocumentsForProject
);

// Routes for document project management
router.post(
  "/addDocumentToProject",
  authMiddleware,
  projectController.addDocumentToProject
);
router.post(
  "/removeDocumentFromProject",
  authMiddleware,
  projectController.removeDocumentFromProject
);
////END OF PROJECT DOCUMENT ROUTES

module.exports = router;
