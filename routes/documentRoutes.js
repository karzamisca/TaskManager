// routes/documentRoutes.js
const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Submit document route
router.get("/submit", authMiddleware, (req, res) => {
  res.sendFile("submit.html", { root: "./views" }); // Serve the submit document page
});

router.post("/submit", authMiddleware, documentController.submitDocument);

// Approve document route
router.get("/approve", authMiddleware, documentController.getPendingDocuments);
router.post("/approve/:id", authMiddleware, documentController.approveDocument);

// View approved documents route
router.get("/view-approved", authMiddleware, documentController.getApprovedDocuments);

// API routes to fetch documents
router.get("/api/pending-documents", authMiddleware, documentController.getPendingDocumentsApi);
router.get("/api/approved-documents", authMiddleware, documentController.getApprovedDocumentsApi);

module.exports = router;
