// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const mongoose = require("mongoose");

exports.submitDocument = async (req, res) => {
  const { title, content, approvers } = req.body;

  try {
    const approverIds = Array.isArray(approvers) ? approvers : approvers.split(",");

    const newDocument = new Document({
      title,
      content,
      submittedBy: req.user.id,
      approvers: approverIds,  // Store approvers here
      approvals: [],            // Initialize empty approvals array
    });
    await newDocument.save();
    res.redirect("/mainDocument");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error submitting document");
  }
};

exports.getPendingDocument = async (req, res) => {
  try {
    const pendingDocument = await Document.find({ approved: false }).populate(
      "submittedBy"
    );
    // Send the approve.html file and include the documents in a variable
    res.sendFile("approveDocument.html", { root: "./views/documents" }); // Serve the approve document page
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching documents");
  }
};

exports.approveDocument = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user has the role of approver
    if (req.user.role !== "approver") {
      return res.status(403).send("Access denied. Only approvers can approve documents.");
    }

    // Find the document by ID
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Check if the user is an approver
    if (!document.approvers.includes(req.user.id)) {
      return res.status(403).send("You are not authorized to approve this document.");
    }

    // Add the approver's ID to the approvals array
    if (!document.approvals.includes(req.user.id)) {
      document.approvals.push(req.user.id);
    }

    // Check if all approvers have approved the document
    if (document.approvals.length === document.approvers.length) {
      document.approved = true;  // Mark document as approved if all approvers have approved
    }

    await document.save();
    res.redirect("/approveDocument");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving documents");
  }
};

exports.getApprovedDocument = async (req, res) => {
  try {
    const approvedDocument = await Document.find({ approved: true }).populate(
      "submittedBy"
    );
    // Send the view-approved.html file and include the documents in a variable
    res.sendFile("viewApprovedDocument.html", { root: "./views/documents" }); // Serve the view approved documents page
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching approved documents");
  }
};

exports.getPendingDocumentApi = async (req, res) => {
  try {
    const pendingDocument = await Document.find({ approved: false }).populate(
      "submittedBy"
    );
    res.json(pendingDocument);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching pending documents");
  }
};

exports.getApprovedDocumentApi = async (req, res) => {
  try {
    const approvedDocument = await Document.find({ approved: true }).populate(
      "submittedBy"
    );
    res.json(approvedDocument);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching approved documents");
  }
};
