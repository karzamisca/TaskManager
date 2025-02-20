// routes/documentRoute.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const documentController = require("../controllers/documentController");
const Group = require("../models/Group");
const authMiddleware = require("../middlewares/authMiddleware");

// Set up multer to handle in-memory file uploads
const storage = multer.memoryStorage(); // Store file in memory (buffer)
const upload = multer({ storage: storage });

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

router.post(
  "/suspendDocument/:id",
  authMiddleware,
  documentController.suspendDocument
);

router.post(
  "/openDocument/:id",
  authMiddleware,
  documentController.openDocument
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

// Routes to fetch payment documents and calculate sums
router.get("/separatedViewPaymentDocument", authMiddleware, (req, res) => {
  res.sendFile("separatedViewPaymentDocument.html", {
    root: "./views/approvals/documents/separatedViewDocuments",
  });
});
router.get(
  "/getPaymentDocumentForSeparatedView",
  authMiddleware,
  documentController.getPaymentDocumentForSeparatedView
);
router.post(
  "/updatePaymentDocument/:id",
  upload.single("file"),
  authMiddleware,
  documentController.updatePaymentDocument
);
router.post(
  "/updatePaymentDocumentDeclaration/:id",
  authMiddleware,
  documentController.updatePaymentDocumentDeclaration
);
router.get(
  "/getPaymentDocument/:id",
  authMiddleware,
  documentController.getPaymentDocument
);

router.get("/separatedViewProposalDocument", authMiddleware, (req, res) => {
  res.sendFile("separatedViewProposalDocument.html", {
    root: "./views/approvals/documents/separatedViewDocuments",
  });
});
router.get(
  "/getProposalDocumentForSeparatedView",
  authMiddleware,
  documentController.getProposalDocumentForSeparatedView
);
router.post(
  "/updateProposalDocument/:id",
  upload.single("file"),
  authMiddleware,
  documentController.updateProposalDocument
);
router.get(
  "/getProposalDocument/:id",
  authMiddleware,
  documentController.getProposalDocument
);

router.get("/separatedViewPurchasingDocument", authMiddleware, (req, res) => {
  res.sendFile("separatedViewPurchasingDocument.html", {
    root: "./views/approvals/documents/separatedViewDocuments",
  });
});
// Route to fetch purchasing documents for the separated view
router.get(
  "/getPurchasingDocumentForSeparatedView",
  authMiddleware,
  documentController.getPurchasingDocumentsForSeparatedView
);
// Route to fetch a specific purchasing document by ID
router.get(
  "/getPurchasingDocument/:id",
  authMiddleware,
  documentController.getPurchasingDocument
);
// Route to update a purchasing document
router.post(
  "/updatePurchasingDocument/:id",
  upload.single("file"),
  authMiddleware,
  documentController.updatePurchasingDocument
);

module.exports = router;
