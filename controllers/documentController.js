// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const mongoose = require("mongoose");
const moment = require('moment-timezone');

exports.submitDocument = async (req, res) => {
  const { title, content, approvers } = req.body;

  try {
    // Ensure approvers is always an array, even if only one approver is selected
    const approversArray = Array.isArray(approvers) ? approvers : [approvers];

    // Fetch the approvers' details, including their usernames
    const approverDetails = await Promise.all(approversArray.map(async (approverId) => {
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
      submissionDate: moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'),
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
    res.sendFile("approveDocument.html", { root: "./views/approvals/documents" }); // Serve the approve document page
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

    const user = await User.findById(req.user.id); // Get the user who is approving
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Check if the current user is a chosen approver for this document
    const isChosenApprover = document.approvers.some(
      (approver) => approver.approver.toString() === req.user.id
    );
    if (!isChosenApprover) {
      return res.status(403).send("You are not an assigned approver for this document.");
    }

    // Check if the current approver has already approved the document
    const hasApproved = document.approvedBy.some(
      (approver) => approver.user.toString() === req.user.id
    );
    if (hasApproved) {
      return res.status(400).send("You have already approved this document.");
    }

    // Add the current approver to the list of approvedBy with their username and role
    document.approvedBy.push({
      user: user.id, // User ID
      username: user.username, // Username
      role: user.role, // Role
      approvalDate: moment().tz('Asia/Bangkok').format('YYYY-MM-DD HH:mm:ss'), 
    });

    // If all chosen approvers have approved, mark the document as fully approved
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
    const approvedDocuments = await Document.find({ approved: true })
      .populate('submittedBy', 'username') // Populate submitter's username
      .populate('approvers.approver', 'username'); // Populate approvers' usernames
    // Send the view-approved.html file and include the documents in a variable
    res.sendFile("viewApprovedDocument.html", { root: "./views/approvals/documents" }); // Serve the view approved documents page
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

exports.deleteDocument = async (req, res) => {
  const { id } = req.params;

  try {
    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Optionally, check if the user is authorized to delete this document

    await Document.findByIdAndDelete(id); // Delete the document
    res.redirect("/approveDocument"); // Redirect after deletion
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting document");
  }
};
