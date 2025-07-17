// controllers/projectController.js
const Project = require("../models/Project");
const User = require("../models/User");
const Document = require("../models/Document");
const PaymentDocument = require("../models/DocumentPayment");
const ProposalDocument = require("../models/DocumentProposal");
const PurchasingDocument = require("../models/DocumentPurchasing");
const AdvancePaymentDocument = require("../models/DocumentAdvancePayment");
const DeliveryDocument = require("../models/DocumentDelivery");
const ProjectProposalDocument = require("../models/DocumentProjectProposal");
const moment = require("moment-timezone");

////PROJECT DOCUMENT CONTROLLERS
// Serve the html file for the root route
exports.getProjectDocumentViews = (req, res) => {
  if (
    ![
      "approver",
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfMechanical",
      "headOfTechnical",
      "headOfAccounting",
      "headOfPurchasing",
      "headOfOperations",
      "headOfNorthernRepresentativeOffice",
      "captainOfMechanical",
      "captainOfTechnical",
      "captainOfPurchasing",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
  }
  res.sendFile("projectDocument.html", {
    root: "./views/projectPages/projectDocument",
  });
};

// Add a new project
exports.createProject = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if project already exists
    const existingProject = await Project.findOne({ name });
    if (existingProject) {
      return res.json({ message: "Project name already exists" });
    }

    // Create new project
    const project = new Project({
      name,
      description,
    });

    await project.save();
    res.redirect("/projectDocument");
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).send("Internal Server Error");
  }
};

// New method to get all projects as JSON
exports.getProject = (req, res) => {
  Project.find()
    .then((projects) => {
      res.json(projects);
    })
    .catch((err) => {
      console.log("Error fetching projects:", err);
      res.status(500).send("Internal Server Error");
    });
};

exports.getProjectedDocuments = async (req, res) => {
  try {
    // Fetch all documents from the models and filter out documents without a valid projectName
    const Documents = await Document.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });
    const proposalDocuments = await ProposalDocument.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });
    const paymentDocuments = await PaymentDocument.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });
    const purchasingDocuments = await PurchasingDocument.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });
    const advancePaymentDocuments = await AdvancePaymentDocument.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });
    const deliveryDocuments = await DeliveryDocument.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });
    const projectProposalDocuments = await ProjectProposalDocument.find({
      $and: [{ projectName: { $ne: null } }, { projectName: { $ne: "" } }],
    });

    // Combine all documents into one array with a 'type' field
    const allDocuments = [
      ...Documents.map((doc) => ({
        ...doc.toObject(),
        type: "Chung/Generic",
      })),
      ...proposalDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Đề xuất/Proposal",
      })),
      ...purchasingDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Mua hàng/Purchasing",
      })),
      ...paymentDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Thanh toán/Payment",
      })),
      ...advancePaymentDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Tạm ứng/Advance Payment",
      })),
      ...deliveryDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Xuất kho/Delivery",
      })),
      ...projectProposalDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Đề nghị mở dự án/Project Proposal",
      })),
    ];

    // Project by projectName
    const projectedDocuments = allDocuments.reduce((acc, doc) => {
      if (!acc[doc.projectName]) {
        acc[doc.projectName] = [];
      }
      acc[doc.projectName].push(doc);
      return acc;
    }, {});

    // Return projected documents as JSON
    res.json(projectedDocuments);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Add a document to a project
exports.addDocumentToProject = async (req, res) => {
  try {
    const { documentId, documentType, projectName } = req.body;

    let document;
    // Find the document based on its type
    switch (documentType) {
      case "generic":
        document = await Document.findById(documentId);
        break;
      case "proposal":
        document = await ProposalDocument.findById(documentId);
        break;
      case "purchasing":
        document = await PurchasingDocument.findById(documentId);
        break;
      case "payment":
        document = await PaymentDocument.findById(documentId);
        break;
      case "advancePayment":
        document = await AdvancePaymentDocument.findById(documentId);
        break;
      case "delivery":
        document = await DeliveryDocument.findById(documentId);
        break;
      case "projectProposal":
        document = await ProjectProposalDocument.findById(documentId);
        break;
      default:
        return res.status(400).json({ message: "Invalid document type" });
    }

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update the document with the project name
    document.projectName = projectName;

    // Save the document in the appropriate collection
    switch (documentType) {
      case "generic":
        await Document.findByIdAndUpdate(documentId, document);
        break;
      case "proposal":
        await ProposalDocument.findByIdAndUpdate(documentId, document);
        break;
      case "purchasing":
        await PurchasingDocument.findByIdAndUpdate(documentId, document);
        break;
      case "payment":
        await PaymentDocument.findByIdAndUpdate(documentId, document);
        break;
      case "advancePayment":
        await AdvancePaymentDocument.findByIdAndUpdate(documentId, document);
        break;
      case "delivery":
        await DeliveryDocument.findByIdAndUpdate(documentId, document);
        break;
      case "projectProposal":
        await ProjectProposalDocument.findByIdAndUpdate(documentId, document);
        break;
    }

    res.status(200).json({ message: "Document added to project successfully" });
  } catch (error) {
    console.error("Error adding document to project:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Get all unassigned documents
exports.getUnassignedDocumentsForProject = async (req, res) => {
  try {
    // Fetch documents with no project assigned
    const genericDocuments = await Document.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    const proposalDocuments = await ProposalDocument.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    const purchasingDocuments = await PurchasingDocument.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    const paymentDocuments = await PaymentDocument.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    const advancePaymentDocuments = await AdvancePaymentDocument.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    const deliveryDocuments = await DeliveryDocument.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    const projectProposalDocuments = await ProjectProposalDocument.find({
      $or: [{ projectName: null }, { projectName: "" }],
    });

    // Combine all documents with type information
    const allDocuments = [
      ...genericDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "generic",
        displayType: "Chung/Generic",
      })),
      ...proposalDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "proposal",
        displayType: "Đề xuất/Proposal",
      })),
      ...purchasingDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "purchasing",
        displayType: "Mua hàng/Purchasing",
      })),
      ...paymentDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "payment",
        displayType: "Thanh toán/Payment",
      })),
      ...advancePaymentDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "advancePayment",
        displayType: "Tạm ứng/Advance Payment",
      })),
      ...deliveryDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "delivery",
        displayType: "Xuất kho/Delivery",
      })),
      ...projectProposalDocuments.map((doc) => ({
        ...doc.toObject(),
        documentType: "projectProposal",
        displayType: "Đề nghị mở dự án/Project Proposal",
      })),
    ];

    res.json(allDocuments);
  } catch (error) {
    console.error("Error fetching unassigned documents:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Remove document from project
exports.removeDocumentFromProject = async (req, res) => {
  try {
    const { documentId, documentType } = req.body;

    let document;
    // Find the document based on its type
    switch (documentType) {
      case "generic":
        document = await Document.findById(documentId);
        break;
      case "proposal":
        document = await ProposalDocument.findById(documentId);
        break;
      case "purchasing":
        document = await PurchasingDocument.findById(documentId);
        break;
      case "payment":
        document = await PaymentDocument.findById(documentId);
        break;
      case "advancePayment":
        document = await AdvancePaymentDocument.findById(documentId);
        break;
      case "delivery":
        document = await DeliveryDocument.findById(documentId);
        break;
      case "projectProposal":
        document = await ProjectProposalDocument.findById(documentId);
        break;
      default:
        return res.status(400).json({ message: "Invalid document type" });
    }

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Remove the project assignment
    document.projectName = "";

    // Save the document in the appropriate collection
    switch (documentType) {
      case "generic":
        await Document.findByIdAndUpdate(documentId, document);
        break;
      case "proposal":
        await ProposalDocument.findByIdAndUpdate(documentId, document);
        break;
      case "purchasing":
        await PurchasingDocument.findByIdAndUpdate(documentId, document);
        break;
      case "payment":
        await PaymentDocument.findByIdAndUpdate(documentId, document);
        break;
      case "advancePayment":
        await AdvancePaymentDocument.findByIdAndUpdate(documentId, document);
        break;
      case "delivery":
        await DeliveryDocument.findByIdAndUpdate(documentId, document);
        break;
      case "projectProposal":
        await ProjectProposalDocument.findByIdAndUpdate(documentId, document);
        break;
    }

    res
      .status(200)
      .json({ message: "Document removed from project successfully" });
  } catch (error) {
    console.error("Error removing document from project:", error);
    res.status(500).send("Internal Server Error");
  }
};
////END OF PROJECT DOCUMENT CONTROLLERS
