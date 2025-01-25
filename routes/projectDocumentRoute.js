const express = require("express");
const projectDocumentController = require("../controllers/projectDocumentController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/projectDocument",
  authMiddleware,
  projectDocumentController.getProjectDocumentView
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

module.exports = router;
