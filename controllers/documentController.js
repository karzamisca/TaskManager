// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const mongoose = require("mongoose");

exports.submitDocument = async (req, res) => {
  const { title, content, approvers } = req.body;

  try {
    // Fetch the approvers' details, including their usernames
    const approverDetails = await Promise.all(approvers.map(async (approverId) => {
      const approver = await User.findById(approverId);
      return {
        approver: approverId,
        username: approver.username, // Get the username
        subRole: req.body[`subRole_${approverId}`], // Get the sub-role for each approver
      };
    }));

    const newDocument = new Document({
      title,
      content,
      submittedBy: req.user.id,
      approvers: approverDetails, // Save approver details including username and sub-role
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
    if (req.user.role !== "approver") {
      return res.status(403).send("Access denied. Only approvers can approve documents.");
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Check if the current approver has already approved
    if (document.approvedBy.includes(req.user.id)) {
      return res.status(400).send("You have already approved this document.");
    }

    // Add current approver to the list of approvers who approved
    document.approvedBy.push(req.user.id);

    // If all approvers have approved, mark the document as approved
    if (document.approvedBy.length === document.approvers.length) {
      document.approved = true;
    }

    await document.save();
    res.redirect("/approveDocument");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving document");
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
