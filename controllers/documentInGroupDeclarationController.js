// controllers/groupDeclarationController.js
const GroupDeclaration = require("../models/GroupDeclaration");
const User = require("../models/User");
const Document = require("../models/Document");
const PaymentDocument = require("../models/DocumentPayment");
const ProposalDocument = require("../models/DocumentProposal");
const PurchasingDocument = require("../models/DocumentPurchasing");
const AdvancePaymentDocument = require("../models/DocumentAdvancePayment");
const DeliveryDocument = require("../models/DocumentDelivery");
const moment = require("moment-timezone");

// Serve the html file for the root route
exports.getDocumentInGroupDeclarationViews = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "headOfPurchasing",
      "captainOfPurchasing",
      "captainOfAccounting",
      "captainOfFinance",
    ].includes(req.user.role)
  ) {
    return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }
  res.sendFile("documentInGroupDeclaration.html", {
    root: "./views/documentPages/documentInGroupDeclaration",
  });
};

// Add a new groupDeclaration
exports.createGroupDeclaration = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
        "captainOfPurchasing",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { name, description } = req.body;

    // Check if groupDeclaration already exists
    const existingGroupDeclaration = await GroupDeclaration.findOne({ name });
    if (existingGroupDeclaration) {
      return res.json({ message: "GroupDeclaration name already exists" });
    }

    // Create new groupDeclaration
    const groupDeclaration = new GroupDeclaration({
      name,
      description,
    });

    await groupDeclaration.save();
    res.redirect("/documentInGroupDeclaration");
  } catch (error) {
    console.error("Error creating groupDeclaration:", error);
    res.send("Internal Server Error");
  }
};

// New method to get all groupDeclarations as JSON
exports.getGroupDeclaration = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "headOfPurchasing",
      "captainOfPurchasing",
      "captainOfAccounting",
      "captainOfFinance",
    ].includes(req.user.role)
  ) {
    return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  GroupDeclaration.find()
    .then((groupDeclarations) => {
      // Sort groups by date (extracted from the group name)
      const sortedGroups = groupDeclarations.sort((a, b) => {
        // Extract date from group name (format: PTT[DDMMYYYY])
        // For example, PTT01022023 → 01022023
        const dateA = a.name.replace("PTT", "");
        const dateB = b.name.replace("PTT", "");

        // Convert from DDMMYYYY to YYYYMMDD format for proper string comparison
        const formattedDateA =
          dateA.substring(4) + dateA.substring(2, 4) + dateA.substring(0, 2);
        const formattedDateB =
          dateB.substring(4) + dateB.substring(2, 4) + dateB.substring(0, 2);

        // Sort in descending order (newest first)
        return formattedDateB.localeCompare(formattedDateA);
      });

      res.json(sortedGroups);
    })
    .catch((err) => {
      console.log("Error fetching groupDeclarations:", err);
      res.send("Internal Server Error");
    });
};

exports.getGroupDeclarationedDocuments = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
        "captainOfPurchasing",
        "captainOfAccounting",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Fetch all documents from the models and filter out documents without a valid groupDeclarationName
    const Documents = await Document.find({
      $and: [
        { groupDeclarationName: { $ne: null } },
        { groupDeclarationName: { $ne: "" } },
      ],
    });
    const proposalDocuments = await ProposalDocument.find({
      $and: [
        { groupDeclarationName: { $ne: null } },
        { groupDeclarationName: { $ne: "" } },
      ],
    });
    const paymentDocuments = await PaymentDocument.find({
      $and: [
        { groupDeclarationName: { $ne: null } },
        { groupDeclarationName: { $ne: "" } },
      ],
    });
    const purchasingDocuments = await PurchasingDocument.find({
      $and: [
        { groupDeclarationName: { $ne: null } },
        { groupDeclarationName: { $ne: "" } },
      ],
    });
    const advancePaymentDocuments = await AdvancePaymentDocument.find({
      $and: [
        { groupDeclarationName: { $ne: null } },
        { groupDeclarationName: { $ne: "" } },
      ],
    });
    const deliveryDocuments = await DeliveryDocument.find({
      $and: [
        { groupDeclarationName: { $ne: null } },
        { groupDeclarationName: { $ne: "" } },
      ],
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

    // GroupDeclaration by groupDeclarationName
    const groupDeclarationedDocuments = allDocuments.reduce((acc, doc) => {
      if (!acc[doc.groupDeclarationName]) {
        acc[doc.groupDeclarationName] = [];
      }
      acc[doc.groupDeclarationName].push(doc);
      return acc;
    }, {});

    // Return groupDeclarationed documents as JSON
    res.json(groupDeclarationedDocuments);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.send("Internal Server Error");
  }
};

// Add a document to a groupDeclaration
exports.addDocumentToGroupDeclaration = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
        "captainOfPurchasing",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { documentId, documentType, groupDeclarationName } = req.body;

    // Check if group is locked
    const group = await GroupDeclaration.findOne({
      name: groupDeclarationName,
    });
    if (group && group.locked) {
      return res.json({
        message: `Nhóm đã bị khóa. Không thể thêm tài liệu.`,
      });
    }

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
        return res.json({ message: "Invalid document type" });
    }

    if (!document) {
      return res.json({ message: "Document not found" });
    }

    // Update the document with the groupDeclaration name
    document.groupDeclarationName = groupDeclarationName;

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

    res.json({ message: "Phiếu thêm vào nhóm thành công." });
  } catch (error) {
    console.error("Error adding document to groupDeclaration:", error);
    res.send("Internal Server Error");
  }
};

// Get all unassigned documents
exports.getUnassignedDocuments = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
        "captainOfPurchasing",
        "captainOfAccounting",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    // Fetch documents with no groupDeclaration assigned
    const genericDocuments = await Document.find({
      $or: [{ groupDeclarationName: null }, { groupDeclarationName: "" }],
    });

    const proposalDocuments = await ProposalDocument.find({
      $or: [{ groupDeclarationName: null }, { groupDeclarationName: "" }],
    });

    const purchasingDocuments = await PurchasingDocument.find({
      $or: [{ groupDeclarationName: null }, { groupDeclarationName: "" }],
    });

    const paymentDocuments = await PaymentDocument.find({
      $or: [{ groupDeclarationName: null }, { groupDeclarationName: "" }],
    });

    const advancePaymentDocuments = await AdvancePaymentDocument.find({
      $or: [{ groupDeclarationName: null }, { groupDeclarationName: "" }],
    });

    const deliveryDocuments = await DeliveryDocument.find({
      $or: [{ groupDeclarationName: null }, { groupDeclarationName: "" }],
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
    res.send("Internal Server Error");
  }
};

// Remove document from groupDeclaration
exports.removeDocumentFromGroupDeclaration = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
        "captainOfPurchasing",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

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
        return res.json({ message: "Invalid document type" });
    }

    if (!document) {
      return res.json({ message: "Document not found" });
    }

    // Check if group is locked
    if (document.groupDeclarationName) {
      const group = await GroupDeclaration.findOne({
        name: document.groupDeclarationName,
      });
      if (group && group.locked) {
        return res.json({
          message: `Nhóm đã bị khóa. Không thể xóa tài liệu.`,
        });
      }
    }

    // Remove the groupDeclaration assignment
    document.groupDeclarationName = "";

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

    res.json({ message: "Phiếu xóa khỏi nhóm thành công." });
  } catch (error) {
    console.error("Error removing document from groupDeclaration:", error);
    res.send("Internal Server Error");
  }
};

exports.lockGroupDeclaration = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { name } = req.body;

    const groupDeclaration = await GroupDeclaration.findOne({ name });
    if (!groupDeclaration) {
      return res.json({ message: "Không tìm thấy nhóm" });
    }

    groupDeclaration.locked = true;
    groupDeclaration.lockedBy = req.user.id;
    groupDeclaration.lockedAt = new Date();

    await groupDeclaration.save();
    res.json({ message: "Nhóm đã được khóa thành công" });
  } catch (error) {
    console.error("Error locking group:", error);
    res.send("Lỗi máy chủ");
  }
};

exports.unlockGroupDeclaration = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const { name } = req.body;

    const groupDeclaration = await GroupDeclaration.findOne({ name });
    if (!groupDeclaration) {
      return res.json({ message: "Không tìm thấy nhóm" });
    }

    groupDeclaration.locked = false;
    groupDeclaration.lockedBy = null;
    groupDeclaration.lockedAt = null;

    await groupDeclaration.save();
    res.json({ message: "Nhóm đã được mở khóa thành công" });
  } catch (error) {
    console.error("Error unlocking group:", error);
    res.send("Lỗi máy chủ");
  }
};
