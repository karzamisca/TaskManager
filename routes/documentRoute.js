// routes/documentRoute.js
const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const Group = require("../models/Group");
const authMiddleware = require("../middlewares/authMiddleware");

// Main single document approval page route
router.get("/mainDocument", authMiddleware, (req, res) => {
  res.sendFile("mainDocument.html", { root: "./views/approvals/documents" }); // Serve the submit document page
});

// Main approval page route
router.get("/mainApproval", authMiddleware, (req, res) => {
  res.sendFile("mainApproval.html", { root: "./views/approvals" }); // Serve the submit document page
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

// Serve the Cost Center Admin page
router.get(
  "/costCenterAdmin",
  authMiddleware,
  documentController.getCostCenterAdminPage
);
// API to get all cost centers
router.get(
  "/getCostCenterAdmin",
  authMiddleware,
  documentController.getCostCenters
);
router.post("/addCostCenter", authMiddleware, documentController.addCostCenter);
router.post(
  "/editCostCenter/:id",
  authMiddleware,
  documentController.editCostCenter
);
router.delete(
  "/deleteCostCenter/:id",
  authMiddleware,
  documentController.deleteCostCenter
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
  "/pendingDocument",
  authMiddleware,
  documentController.getPendingDocumentApi
);
router.get(
  "/approvedDocument",
  authMiddleware,
  documentController.getApprovedDocumentApi
);

router.post(
  "/deleteDocument/:id",
  authMiddleware,
  documentController.deleteDocument
);

router.get(
  "/approvedProposalDocuments",
  authMiddleware,
  documentController.getApprovedProposalDocuments
);

router.get(
  "/proposalDocument/:id",
  authMiddleware,
  documentController.getProposalDocumentById
);

// Route to fetch all approved Purchasing Documents
router.get(
  "/approvedPurchasingDocuments",
  authMiddleware,
  documentController.getApprovedPurchasingDocuments
);

// Route to fetch a specific Purchasing Document by ID
router.get(
  "/purchasingDocument/:id",
  authMiddleware,
  documentController.getPurchasingDocumentById
);

router.get(
  "/exportDocumentToDocx/:id",
  authMiddleware,
  documentController.exportDocumentToDocx
);

router.get("/getGroupDocument", authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({}, "name");
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
