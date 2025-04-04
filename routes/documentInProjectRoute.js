// routes/projectDocumentRoute.js
const express = require("express");
const projectDocumentController = require("../controllers/documentInProjectController");
const authMiddleware = require("../middlewares/authMiddleware");
// Configure multer for file uploads
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const router = express.Router();

router.get(
  "/documentInProject",
  authMiddleware,
  projectDocumentController.getDocumentInProjectViews
);
router.post(
  "/createProjectDocument",
  authMiddleware,
  projectDocumentController.createProjectDocument
);
router.post(
  "/approvePhaseProjectDocument",
  authMiddleware,
  projectDocumentController.approvePhaseProjectDocument
);
router.post(
  "/updatePhaseDetailsProjectDocument",
  authMiddleware,
  projectDocumentController.updatePhaseDetailsProjectDocument
);
router.get(
  "/getProjectDocument/:id",
  authMiddleware,
  projectDocumentController.getProjectDocument
);
router.get(
  "/getAllProjectDocuments",
  authMiddleware,
  projectDocumentController.getAllProjectDocuments
);
router.get(
  "/getRoleProjectDocument",
  projectDocumentController.getRoleProjectDocument
);
router.get(
  "/costCentersProjectDocument",
  authMiddleware,
  projectDocumentController.getCostCentersProjectDocument
);

// File upload route
router.post(
  "/uploadProjectFiles",
  authMiddleware,
  upload.array("files"),
  projectDocumentController.uploadFiles
);

// File removal route
router.post(
  "/removeProjectFile",
  authMiddleware,
  projectDocumentController.removeFile
);

module.exports = router;
