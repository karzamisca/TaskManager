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
    res.redirect("/main"); // Redirect to main page after submission
  } catch (err) {
    console.error(err);
    res.status(500).send("Error submitting document");
  }
};

exports.getPendingDocuments = async (req, res) => {
  try {
    const pendingDocuments = await Document.find({ approved: false }).populate(
      "submittedBy"
    );
    // Send the approve.html file and include the documents in a variable
    res.sendFile("approve.html", { root: "./views" }); // Serve the approve document page
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching documents");
  }
};

exports.approveDocument = async (req, res) => {
  const { id } = req.params;

  try {
    await Document.findByIdAndUpdate(id, { approved: true });
    res.redirect("/approve"); // Redirect to the approve page after approval
  } catch (err) {
    console.error(err);
    res.status(500).send("Error approving document");
  }
};

exports.getApprovedDocuments = async (req, res) => {
  try {
    const approvedDocuments = await Document.find({ approved: true }).populate(
      "submittedBy"
    );
    // Send the view-approved.html file and include the documents in a variable
    res.sendFile("view-approved.html", { root: "./views" }); // Serve the view approved documents page
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching approved documents");
  }
};

exports.getPendingDocumentsApi = async (req, res) => {
  try {
    const pendingDocuments = await Document.find({ approved: false }).populate(
      "submittedBy"
    );
    res.json(pendingDocuments);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching pending documents");
  }
};

exports.getApprovedDocumentsApi = async (req, res) => {
  try {
    const approvedDocuments = await Document.find({ approved: true }).populate(
      "submittedBy"
    );
    res.json(approvedDocuments);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching approved documents");
  }
};
