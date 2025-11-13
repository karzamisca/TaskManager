// routes/documentRoute.js
const express = require("express");
const multer = require("multer");
const router = express.Router();
const documentController = require("../controllers/documentController");
const Group = require("../models/Group");
const Project = require("../models/Project");
const Product = require("../models/Product");
const authMiddleware = require("../middlewares/authMiddleware");
const uploadDir = "uploads/";

// Set up multer to handle in-memory file uploads

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Ensure the original filename is properly decoded
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + originalName);
  },
});

const upload = multer({
  storage: storage,
  // Add file filter to handle encoding
  fileFilter: function (req, file, cb) {
    // Ensure proper encoding handling
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    cb(null, true);
  },
});

//// GENERAL ROUTE
// Submit document route
router.get("/documentSubmission", authMiddleware, (req, res) => {
  res.sendFile("documentSubmission.html", {
    root: "./views/documentPages/documentSubmission",
  }); // Serve the submit document page
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
router.get("/documentProduct", async (req, res) => {
  try {
    const products = await Product.find({}).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
//// END OF GENERAL ROUTE

//// PROPOSAL DOCUMENT ROUTE
router.get(
  "/approvedProposalsForPurchasing",
  authMiddleware,
  documentController.getApprovedProposalsForPurchasing
);
router.get(
  "/approvedProposalsForDelivery",
  authMiddleware,
  documentController.getApprovedProposalsForDelivery
);
router.get(
  "/approvedProposalsForReceipt",
  authMiddleware,
  documentController.getApprovedProposalsForReceipt
);
router.get(
  "/documentsContainingProposal/:proposalId",
  documentController.getDocumentsContainingProposal
);
router.get(
  "/proposalDocument/:id",
  authMiddleware,
  documentController.getProposalDocumentById
);
router.get("/documentSummaryProposal", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryProposal.html", {
    root: "./views/documentPages/documentSummaryProposal",
  });
});
router.get(
  "/getProposalDocumentForSeparatedView",
  authMiddleware,
  documentController.getProposalDocumentForSeparatedView
);
router.post(
  "/updateProposalDocument/:id",
  upload.array("files", 10), // Changed from upload.single to upload.array
  authMiddleware,
  documentController.updateProposalDocument
);
router.post(
  "/deleteProposalDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deleteProposalDocumentFile
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
  "/approvedPurchasingDocumentsForPayment",
  authMiddleware,
  documentController.getApprovedPurchasingDocumentsForPayment
);
router.get(
  "/approvedPurchasingDocumentsForAdvancePayment",
  authMiddleware,
  documentController.getApprovedPurchasingDocumentsForAdvancePayment
);
router.get(
  "/approvedPurchasingDocumentsForAdvancePaymentReclaim",
  authMiddleware,
  documentController.getApprovedPurchasingDocumentsForAdvancePaymentReclaim
);
router.get(
  "/documentsContainingPurchasing/:purchasingId",
  documentController.getDocumentsContainingPurchasing
);
// Route to fetch a specific Purchasing Document by ID
router.get(
  "/purchasingDocument/:id",
  authMiddleware,
  documentController.getPurchasingDocumentById
);
router.get("/documentSummaryPurchasing", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryPurchasing.html", {
    root: "./views/documentPages/documentSummaryPurchasing",
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
  upload.array("files", 10),
  authMiddleware,
  documentController.updatePurchasingDocument
);
router.post(
  "/deletePurchasingDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deletePurchasingDocumentFile
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
    root: "./views/documentPages/documentSummaryPayment",
  });
});
router.get(
  "/getPaymentDocumentForSeparatedView",
  authMiddleware,
  documentController.getPaymentDocumentForSeparatedView
);
router.post(
  "/updatePaymentDocument/:id",
  upload.array("files", 10),
  authMiddleware,
  documentController.updatePaymentDocument
);
router.delete(
  "/deletePaymentDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deletePaymentDocumentFile
);
router.post(
  "/uploadStageFile/:docId/:stageIndex",
  upload.single("file"),
  authMiddleware,
  documentController.uploadStageFile
);
router.post(
  "/removeStageFile/:docId/:stageIndex",
  authMiddleware,
  documentController.removeStageFile
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
router.post(
  "/updatePaymentDocumentPriority/:id",
  authMiddleware,
  documentController.updatePaymentDocumentPriority
);
router.get(
  "/getPaymentDocument/:id",
  authMiddleware,
  documentController.getPaymentDocument
);
router.post(
  "/approvePaymentStage/:docId/:stageIndex",
  authMiddleware,
  documentController.approvePaymentStage
);
router.post(
  "/approvePaymentDocument/:id",
  authMiddleware,
  documentController.approvePaymentDocument
);
router.post(
  "/suspendPaymentStage/:docId/:stageIndex",
  authMiddleware,
  documentController.suspendPaymentStage
);
router.post(
  "/openPaymentStage/:docId/:stageIndex",
  authMiddleware,
  documentController.openPaymentStage
);
//// END OF PAYMENT DOCUMENT ROUTE

//// ADVANCE PAYMENT DOCUMENT ROUTE
// Routes to fetch payment documents and calculate sums
router.get("/documentSummaryAdvancePayment", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryAdvancePayment.html", {
    root: "./views/documentPages/documentSummaryAdvancePayment",
  });
});
router.get(
  "/getAdvancePaymentDocumentForSeparatedView",
  authMiddleware,
  documentController.getAdvancePaymentDocumentForSeparatedView
);
router.post(
  "/updateAdvancePaymentDocument/:id",
  upload.array("files", 10),
  authMiddleware,
  documentController.updateAdvancePaymentDocument
);
router.post(
  "/deleteAdvancePaymentDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deleteAdvancePaymentDocumentFile
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

//// ADVANCE PAYMENT RECLAIM DOCUMENT ROUTE
// Routes to fetch payment documents and calculate sums
router.get(
  "/documentSummaryAdvancePaymentReclaim",
  authMiddleware,
  (req, res) => {
    res.sendFile("documentSummaryAdvancePaymentReclaim.html", {
      root: "./views/documentPages/documentSummaryAdvancePaymentReclaim",
    });
  }
);
router.get(
  "/getAdvancePaymentReclaimDocumentForSeparatedView",
  authMiddleware,
  documentController.getAdvancePaymentReclaimDocumentForSeparatedView
);
router.post(
  "/updateAdvancePaymentReclaimDocument/:id",
  upload.array("files", 10),
  authMiddleware,
  documentController.updateAdvancePaymentReclaimDocument
);
router.post(
  "/deleteAdvancePaymentReclaimDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deleteAdvancePaymentReclaimDocumentFile
);
router.post(
  "/updateAdvancePaymentReclaimDocumentDeclaration/:id",
  authMiddleware,
  documentController.updateAdvancePaymentReclaimDocumentDeclaration
);
router.post(
  "/massUpdateAdvancePaymentReclaimDocumentDeclaration",
  authMiddleware,
  documentController.massUpdateAdvancePaymentReclaimDocumentDeclaration
);
router.get(
  "/getAdvancePaymentReclaimDocument/:id",
  authMiddleware,
  documentController.getAdvancePaymentReclaimDocument
);
router.post(
  "/extendAdvancePaymentReclaimDeadline/:id",
  authMiddleware,
  documentController.extendAdvancePaymentReclaimDeadline
);
//// END OF ADVANCE PAYMENT RECLAIM DOCUMENT ROUTE

//// DELIVERY DOCUMENT ROUTE
router.get("/documentSummaryDelivery", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryDelivery.html", {
    root: "./views/documentPages/documentSummaryDelivery",
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
  upload.array("files", 10), // Changed to support multiple files
  authMiddleware,
  documentController.updateDeliveryDocument
);
router.post(
  "/deleteDeliveryDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deleteDeliveryDocumentFile
);
router.post(
  "/exportDeliveryDocumentsToExcel",
  authMiddleware,
  documentController.exportDeliveryDocumentsToExcel
);
//// END OF DELIVERY DOCUMENT ROUTE

//// RECEIPT DOCUMENT ROUTE
router.get("/documentSummaryReceipt", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryReceipt.html", {
    root: "./views/documentPages/documentSummaryReceipt",
  });
});

router.get(
  "/getReceiptDocumentForSeparatedView",
  authMiddleware,
  documentController.getReceiptDocumentsForSeparatedView
);

router.get(
  "/getReceiptDocument/:id",
  authMiddleware,
  documentController.getReceiptDocument
);

router.post(
  "/updateReceiptDocument/:id",
  upload.array("files", 10),
  authMiddleware,
  documentController.updateReceiptDocument
);

router.post(
  "/deleteReceiptDocumentFile/:docId/:fileId",
  authMiddleware,
  documentController.deleteReceiptDocumentFile
);

router.post(
  "/exportReceiptDocumentsToExcel",
  authMiddleware,
  documentController.exportReceiptDocumentsToExcel
);
//// END OF RECEIPT DOCUMENT ROUTE

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
    root: "./views/documentPages/documentSummaryProjectProposal",
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

//// SUMMARY ROUTES
// Serve the summary HTML page
router.get("/documentSummaryUnapproved", authMiddleware, (req, res) => {
  res.sendFile("documentSummaryUnapproved.html", {
    root: "./views/documentPages/documentSummaryUnapproved",
  });
});

// API endpoint to fetch unapproved document counts
router.get(
  "/unapprovedDocumentsSummary",
  authMiddleware,
  documentController.getUnapprovedDocumentsSummary
);

module.exports = router;
