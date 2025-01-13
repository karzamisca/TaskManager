// routes/documentRoute.js
const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Main page route
router.get("/mainDocument", authMiddleware, (req, res) => {
  res.sendFile("mainDocument.html", { root: "./views/approvals/documents" }); // Serve the submit document page
});
// Submit document route
router.get("/submitDocument", authMiddleware, (req, res) => {
  res.sendFile("submitDocument.html", { root: "./views/approvals/documents" }); // Serve the submit document page
});

// For restricting cost center
// Route to fetch cost centers
router.get(
  "/getCurrentUser",
  authMiddleware,
  documentController.getCurrentUser
);
router.get("/costCenters", authMiddleware, documentController.getCostCenters);

router.post(
  "/submitDocument",
  authMiddleware,
  documentController.submitDocument
);

// Route to get cost centers page (serving HTML)
router.get("/costCenterAdmin", authMiddleware, (req, res) => {
  res.sendFile("costCenterAdmin.html", { root: "./views/approvals/documents" }); // Serve the cost center admin page
});
// Route to fetch cost centers data (in JSON format)
router.get(
  "/getCostCenterAdmin",
  authMiddleware,
  documentController.getCostCenterAdmin
);
// Route to add a new cost center
router.post("/addCostCenter", authMiddleware, documentController.addCostCenter);
// Route to edit an existing cost center
router.post(
  "/editCostCenter/:id",
  authMiddleware,
  documentController.editCostCenter
);

// Approve document route
router.get(
  "/approveDocument",
  authMiddleware,
  documentController.getPendingDocument
);
router.post(
  "/approveDocument/:id",
  authMiddleware,
  documentController.approveDocument
);

// View approved documents route
router.get(
  "/viewApprovedDocument",
  authMiddleware,
  documentController.getApprovedDocument
);

// API routes to fetch documents
router.get(
  "/api/pendingDocument",
  authMiddleware,
  documentController.getPendingDocumentApi
);
router.get(
  "/api/approvedDocument",
  authMiddleware,
  documentController.getApprovedDocumentApi
);

router.post(
  "/deleteDocument/:id",
  authMiddleware,
  documentController.deleteDocument
);

router.get(
  "/api/approvedProposalDocuments",
  authMiddleware,
  documentController.getApprovedProposalDocuments
);

router.get(
  "/api/proposalDocument/:id",
  authMiddleware,
  documentController.getProposalDocumentById
);

// Route to fetch all approved Processing Documents
router.get(
  "/api/approvedProcessingDocuments",
  authMiddleware,
  documentController.getApprovedProcessingDocuments
);

// Route to fetch a specific Processing Document by ID
router.get(
  "/api/processingDocument/:id",
  authMiddleware,
  documentController.getProcessingDocumentById
);

router.get(
  "/exportDocumentToDocx/:id",
  authMiddleware,
  documentController.exportDocumentToDocx
);

module.exports = router;
