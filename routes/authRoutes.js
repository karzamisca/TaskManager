const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");

// Login route
router.get("/login", (req, res) => {
  res.sendFile("login.html", { root: "./views" });
});

// Post request for login
router.post("/login", authController.login);

// Logout route
router.get("/logout", authController.logout);

// Main page route
router.get("/main", authMiddleware, (req, res) => {
  res.sendFile("main.html", { root: "./views" }); // Serve the main page
});

// Submit document route
router.get("/submit", authMiddleware, (req, res) => {
  res.sendFile("submit.html", { root: "./views" }); // Serve the submit document page
});

router.post("/submit", authMiddleware, documentController.submitDocument);

// Approve document route
router.get("/approve", authMiddleware, documentController.getPendingDocuments);
router.post("/approve/:id", authMiddleware, documentController.approveDocument);

// View approved documents route
router.get(
  "/view-approved",
  authMiddleware,
  documentController.getApprovedDocuments
);

// API routes to fetch documents
router.get(
  "/api/pending-documents",
  authMiddleware,
  documentController.getPendingDocumentsApi
);
router.get(
  "/api/approved-documents",
  authMiddleware,
  documentController.getApprovedDocumentsApi
);

module.exports = router;
