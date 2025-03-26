// controllers/projectController.js
const Project = require("../models/Project");
const User = require("../models/User");
const Document = require("../models/Document");
const PaymentDocument = require("../models/PaymentDocument");
const ProposalDocument = require("../models/ProposalDocument");
const PurchasingDocument = require("../models/PurchasingDocument");
const AdvancePaymentDocument = require("../models/AdvancePaymentDocument");
const DeliveryDocument = require("../models/DeliveryDocument");
const moment = require("moment-timezone");

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
    res.redirect("/projectedDocument");
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

exports.approveProjectedDocument = async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user.role !== "approver") {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền phê duyệt tài liệu./Access denied. You don't have permission to approve document."
      );
    }

    // Check if the document is a Generic, Proposal, or Purchasing Document
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id)) ||
      (await DeliveryDocument.findById(id));

    if (!document) {
      return res.send("Không tìm thấy tài liệu/Document not found");
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.send("Không tìm thấy người dùng/User not found");
    }

    const isChosenApprover = document.approvers.some(
      (approver) => approver.approver.toString() === req.user.id
    );

    if (!isChosenApprover) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền phê duyệt tài liệu này./Access denied. You don't have permission to approve this document."
      );
    }

    const hasApproved = document.approvedBy.some(
      (approver) => approver.user.toString() === req.user.id
    );

    if (hasApproved) {
      return res.send(
        "Bạn đã phê duyệt tài liệu rồi./You have already approved this document."
      );
    }

    // Add the current approver to the list of `approvedBy`
    document.approvedBy.push({
      user: user.id,
      username: user.username,
      role: user.role,
      approvalDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    // If all approvers have approved, mark it as fully approved
    if (document.approvedBy.length === document.approvers.length) {
      document.approved = true;
    }

    // Save document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof AdvancePaymentDocument) {
      await AdvancePaymentDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof DeliveryDocument) {
      await DeliveryDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.redirect("/projectedDocument");
  } catch (err) {
    console.error("Error approving document:", err);
    res.send("Lỗi phê duyệt tài liệu/Error approving document");
  }
};

exports.deleteProjectedDocument = async (req, res) => {
  const { id } = req.params;

  try {
    // Try to find the document in each collection
    let document = await Document.findById(id);
    let documentType = "Generic";

    if (!document) {
      document = await ProposalDocument.findById(id);
      if (document) documentType = "Proposal";
    }

    if (!document && documentType === "Generic") {
      document = await PurchasingDocument.findById(id);
      if (document) documentType = "Purchasing";
    }

    if (!document && documentType === "Generic") {
      document = await PaymentDocument.findById(id);
      if (document) documentType = "Payment";
    }

    if (!document && documentType === "Generic") {
      document = await AdvancePaymentDocument.findById(id);
      if (document) documentType = "AdvancePayment";
    }

    if (!document && documentType === "Generic") {
      document = await DeliveryDocument.findById(id);
      if (document) documentType = "Delivery";
    }

    if (!document) {
      return res.send("Document not found");
    }

    // Delete the document based on its type
    if (documentType === "Proposal") {
      await ProposalDocument.findByIdAndDelete(id);
    } else if (documentType === "Purchasing") {
      await PurchasingDocument.findByIdAndDelete(id);
    } else if (documentType === "Payment") {
      await PaymentDocument.findByIdAndDelete(id);
    } else if (documentType === "AdvancePayment") {
      await AdvancePaymentDocument.findByIdAndDelete(id);
    } else if (documentType === "Delivery") {
      await DeliveryDocument.findByIdAndDelete(id);
    } else {
      await Document.findByIdAndDelete(id);
    }

    res.redirect("/projectedDocument"); // Redirect after deletion
  } catch (err) {
    console.error("Error deleting document:", err);
    res.send("Lỗi xóa tài liệu/Error deleting document");
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
    }

    res.status(200).json({ message: "Document added to project successfully" });
  } catch (error) {
    console.error("Error adding document to project:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Get all unassigned documents
exports.getUnassignedDocuments = async (req, res) => {
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
    }

    res
      .status(200)
      .json({ message: "Document removed from project successfully" });
  } catch (error) {
    console.error("Error removing document from project:", error);
    res.status(500).send("Internal Server Error");
  }
};
