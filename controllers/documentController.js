// controllers/authController.js
const Document = require("../models/Document");

exports.submitDocument = async (req, res) => {
  const { title, content } = req.body;

  try {
    const newDocument = new Document({
      title,
      content,
      submittedBy: req.session.user, // Link the document to the user who submitted it
    });
    await newDocument.save();
    res.redirect("/mainDocument"); // Redirect to main page after submission
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
    await Document.findByIdAndUpdate(id, { approved: true });
    res.redirect("/approveDocument"); // Redirect to the approve page after approval
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
