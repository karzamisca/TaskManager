// routes/documentRoute.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const documentController = require("../controllers/documentController");
const Group = require("../models/Group");
const Project = require("../models/Project");
const authMiddleware = require("../middlewares/authMiddleware");

// Set up multer to handle in-memory file uploads
const storage = multer.memoryStorage(); // Store file in memory (buffer)
const upload = multer({ storage: storage });

//// GENERAL ROUTE
router.get("/documentMain", authMiddleware, (req, res) => {
  res.sendFile("documentMain.html", {
    root: "./views/documentPages/documentMain",
  }); // Serve the main document page
});
// Submit document route
router.get("/documentSubmission", authMiddleware, (req, res) => {
  res.sendFile("documentSubmission.html", {
    root: "./views/documentPages/documentSubmission",
  }); // Serve the submit document page
});
router.get("/documentSummary", authMiddleware, (req, res) => {
  res.sendFile("documentSummary.html", {
    root: "./views/documentPages/documentSummary",
  }); // Serve the main document summary page
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
router.get(
  "/exportDocumentToDocx/:id",
  authMiddleware,
  documentController.exportDocumentToDocx
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
router.get("/getGroupDocument", authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({}, "name");
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get("/getProjectDocument", authMiddleware, async (req, res) => {
  try {
    const groups = await Project.find({}, "name");
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
//// END OF GENERAL ROUTE

//// PROPOSAL DOCUMENT ROUTE
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
router.get("/documentSummaryProposal", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryProposal.html", {
    root: "./views/documentPages",
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
router.post(
  "/updateProposalDocumentDeclaration/:id",
  authMiddleware,
  documentController.updateProposalDocumentDeclaration
);
router.get(
  "/getProposalDocument/:id",
  authMiddleware,
  documentController.getProposalDocument
);
router.post(
  "/suspendProposalDocument/:id",
  authMiddleware,
  documentController.suspendProposalDocument
);
router.post(
  "/openProposalDocument/:id",
  authMiddleware,
  documentController.openProposalDocument
);
//// END OF PROPOSAL DOCUMENT ROUTE

//// PURCHASING DOCUMENT ROUTE
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
router.get("/documentSummaryPurchasing", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryPurchasing.html", {
    root: "./views/documentPages",
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
router.post(
  "/updatePurchasingDocumentDeclaration/:id",
  authMiddleware,
  documentController.updatePurchasingDocumentDeclaration
);
router.post(
  "/suspendPurchasingDocument/:id",
  authMiddleware,
  documentController.suspendPurchasingDocument
);
router.post(
  "/openPurchasingDocument/:id",
  authMiddleware,
  documentController.openPurchasingDocument
);
//// END OF PURCHASING DOCUMENT ROUTE

//// PAYMENT DOCUMENT ROUTE
// Routes to fetch payment documents and calculate sums
router.get("/documentSummaryPayment", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryPayment.html", {
    root: "./views/documentPages",
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
router.post(
  "/massUpdatePaymentDocumentDeclaration",
  authMiddleware,
  documentController.massUpdatePaymentDocumentDeclaration
);
router.get(
  "/getPaymentDocument/:id",
  authMiddleware,
  documentController.getPaymentDocument
);
//// END OF PAYMENT DOCUMENT ROUTE

//// ADVANCE PAYMENT DOCUMENT ROUTE
// Routes to fetch payment documents and calculate sums
router.get("/documentSummaryAdvancePayment", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryAdvancePayment.html", {
    root: "./views/documentPages",
  });
});
router.get(
  "/getAdvancePaymentDocumentForSeparatedView",
  authMiddleware,
  documentController.getAdvancePaymentDocumentForSeparatedView
);
router.post(
  "/updateAdvancePaymentDocument/:id",
  upload.single("file"),
  authMiddleware,
  documentController.updateAdvancePaymentDocument
);
router.post(
  "/updateAdvancePaymentDocumentDeclaration/:id",
  authMiddleware,
  documentController.updateAdvancePaymentDocumentDeclaration
);
router.post(
  "/massUpdateAdvancePaymentDocumentDeclaration",
  authMiddleware,
  documentController.massUpdateAdvancePaymentDocumentDeclaration
);
router.get(
  "/getAdvancePaymentDocument/:id",
  authMiddleware,
  documentController.getAdvancePaymentDocument
);
//// END OF ADVANCE PAYMENT DOCUMENT ROUTE

//// DELIVERY DOCUMENT ROUTE
router.get("/documentSummaryDelivery", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryDelivery.html", {
    root: "./views/documentPages",
  });
});
router.get(
  "/getDeliveryDocumentForSeparatedView",
  authMiddleware,
  documentController.getDeliveryDocumentsForSeparatedView
);
router.get(
  "/getDeliveryDocument/:id",
  authMiddleware,
  documentController.getDeliveryDocument
);
router.post(
  "/updateDeliveryDocument/:id",
  upload.single("file"),
  authMiddleware,
  documentController.updateDeliveryDocument
);
//// END OF DELIVERY DOCUMENT ROUTE

//// PROJECT PROPOSAL DOCUMENT ROUTE
// Route to fetch all approved Project Proposals
router.get(
  "/approvedProjectProposals",
  authMiddleware,
  documentController.getApprovedProjectProposals
);

// Route to fetch a specific Project Proposal by ID
router.get(
  "/projectProposal/:id",
  authMiddleware,
  documentController.getProjectProposalById
);

router.get("/documentSummaryProjectProposal", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryProjectProposal.html", {
    root: "./views/documentPages",
  });
});

// Route to fetch project proposals for the separated view
router.get(
  "/getProjectProposalForSeparatedView",
  authMiddleware,
  documentController.getProjectProposalsForSeparatedView
);

// Route to fetch a specific project proposal by ID
router.get(
  "/getProjectProposal/:id",
  authMiddleware,
  documentController.getProjectProposal
);

// Route to update a project proposal
router.post(
  "/updateProjectProposal/:id",
  upload.single("file"),
  authMiddleware,
  documentController.updateProjectProposal
);

router.post(
  "/updateProjectProposalDeclaration/:id",
  authMiddleware,
  documentController.updateProjectProposalDeclaration
);

router.post(
  "/suspendProjectProposal/:id",
  authMiddleware,
  documentController.suspendProjectProposal
);

router.post(
  "/openProjectProposal/:id",
  authMiddleware,
  documentController.openProjectProposal
);
//// END OF PROJECT PROPOSAL DOCUMENT ROUTE

module.exports = router;
