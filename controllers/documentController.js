// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const CostCenter = require("../models/CostCenter");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const ProposalDocument = require("../models/DocumentProposal.js");
const PurchasingDocument = require("../models/DocumentPurchasing.js");
const DeliveryDocument = require("../models/DocumentDelivery.js");
const PaymentDocument = require("../models/DocumentPayment.js");
const AdvancePaymentDocument = require("../models/DocumentAdvancePayment.js");
const AdvancePaymentReclaimDocument = require("../models/DocumentAdvancePaymentReclaim.js");
const ProjectProposalDocument = require("../models/DocumentProjectProposal.js");
const drive = require("../middlewares/googleAuthMiddleware.js");
const { Readable } = require("stream");
const multer = require("multer");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const { groupDocumentsByApprover } = require("../utils/emailService");
const {
  createGenericDocTemplate,
  createProposalDocTemplate,
  createPurchasingDocTemplate,
  createDeliveryDocTemplate,
  createPaymentDocTemplate,
  createAdvancePaymentDocTemplate,
} = require("../utils/docxTemplates");
// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure 'uploads/' directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({
  dest: "uploads/", // Temporary storage for uploaded files
});
require("dotenv").config();
const axios = require("axios");

const CHATFUEL_BOT_ID = process.env.CHATFUEL_BOT_ID;
const CHATFUEL_TOKEN = process.env.CHATFUEL_TOKEN;
const CHATFUEL_BLOCK_ID = process.env.CHATFUEL_BLOCK_ID;

//// GENERAL CONTROLLER
// Utility functions for document filtering and sorting
const documentUtils = {
  // Filter documents based on user permissions
  filterDocumentsByUserAccess: (userId, userRole) => {
    return {
      $or: [
        { submittedBy: userId },
        { "approvers.approver": userId },
        ...(userRole === "headOfAccounting" ||
        userRole === "superAdmin" ||
        userRole === "headOfPurchasing" ||
        userRole === "captainOfPurchasing"
          ? [{}] // Include all documents if user is headOfAccounting or superAdmin
          : []),
      ],
    };
  },

  // New function to filter documents based on username constraints with hierarchy
  filterDocumentsByUsername: (documents, username) => {
    // If username is not one of the restricted users, return all documents
    const restrictedUsers = ["HoangNam", "PhongTran", "HuynhDiep"];
    if (!restrictedUsers.includes(username)) {
      return documents;
    }

    // Define the hierarchy: HoangNam must approve before PhongTran, PhongTran before HuynhDiep
    const hierarchy = {
      HuynhDiep: ["PhongTran", "HoangNam"], // PhongTran must approve before HuynhDiep
      PhongTran: ["HoangNam"], // HoangNam must approve before PhongTran
    };

    // Filter documents for restricted users
    return documents.filter((doc) => {
      // Get all approver objects with usernames
      const allApproversWithUsernames = doc.approvers.map((approver) => ({
        id: approver.approver._id.toString(),
        username: approver.approver.username,
      }));

      // Get all approved users with usernames
      const approvedUsers = doc.approvedBy.map((approval) => ({
        id: approval.user._id.toString(),
        username: approval.user.username,
      }));

      const approvedUsernames = approvedUsers.map((user) => user.username);

      // Check if current user has already approved this document
      const currentUserHasApproved = approvedUsernames.includes(username);

      // If the user has already approved this document, they can see it
      if (currentUserHasApproved) {
        return true;
      }

      // Find pending approvers (those not in approvedBy)
      const pendingApprovers = allApproversWithUsernames.filter(
        (approver) => !approvedUsers.some((user) => user.id === approver.id)
      );

      const pendingUsernames = pendingApprovers.map(
        (approver) => approver.username
      );

      // If there are no pending approvers, document is fully approved
      if (pendingApprovers.length === 0) {
        return true;
      }

      // Check if all pending approvers are restricted users
      const allPendingAreRestricted = pendingApprovers.every((approver) =>
        restrictedUsers.includes(approver.username)
      );

      // Check if the current restricted user is among the pending approvers
      const currentUserIsPending = pendingUsernames.includes(username);

      // Check hierarchical approval constraints
      let hierarchyAllowsApproval = true;

      if (hierarchy[username]) {
        // For each user that must approve before the current user
        for (const requiredApprover of hierarchy[username]) {
          // Check if this user is an approver for this document
          const isApproverForDoc = allApproversWithUsernames.some(
            (approver) => approver.username === requiredApprover
          );

          // If they are an approver but haven't approved yet, block the current user
          if (
            isApproverForDoc &&
            !approvedUsernames.includes(requiredApprover)
          ) {
            hierarchyAllowsApproval = false;
            break;
          }
        }
      }

      // Only show document if:
      // 1. All pending approvers are restricted users
      // 2. The current user is among the pending approvers
      // 3. The hierarchical approval constraints are satisfied
      return (
        allPendingAreRestricted &&
        currentUserIsPending &&
        hierarchyAllowsApproval
      );
    });
  },

  // Parse custom date strings in format "DD-MM-YYYY HH:MM:SS"
  parseCustomDate: (dateStr) => {
    const [datePart, timePart] = dateStr.split(" ");
    const [day, month, year] = datePart.split("-");
    const [hour, minute, second] = timePart.split(":");
    // Month is 0-indexed in JavaScript Date constructor
    return new Date(year, month - 1, day, hour, minute, second);
  },

  // Get the latest approval date for a document
  getLatestApprovalDate: (doc) => {
    if (doc.approvedBy && doc.approvedBy.length > 0) {
      // Sort approval dates in descending order
      const sortedDates = [...doc.approvedBy].sort((x, y) => {
        return (
          documentUtils.parseCustomDate(y.approvalDate) -
          documentUtils.parseCustomDate(x.approvalDate)
        );
      });
      return sortedDates[0].approvalDate;
    }
    return "01-01-1970 00:00:00"; // Default date if no approvals
  },

  // Sort documents by status priority and approval date
  sortDocumentsByStatusAndDate: (documents) => {
    return documents.sort((a, b) => {
      // First, sort by status priority: Suspended > Pending > Approved
      const statusPriority = {
        Suspended: 1,
        Pending: 2,
        Approved: 3,
      };

      const statusComparison =
        statusPriority[a.status] - statusPriority[b.status];

      // If status is the same, sort by latest approval date (for Approved documents)
      if (statusComparison === 0 && a.status === "Approved") {
        const latestDateA = documentUtils.getLatestApprovalDate(a);
        const latestDateB = documentUtils.getLatestApprovalDate(b);

        // Sort by latest approval date (ascending order - oldest first)
        return (
          documentUtils.parseCustomDate(latestDateA) -
          documentUtils.parseCustomDate(latestDateB)
        );
      }

      return statusComparison;
    });
  },

  // Count approved and unapproved documents
  countDocumentsByStatus: (documents) => {
    let approvedDocument = 0;
    let unapprovedDocument = 0;

    documents.forEach((doc) => {
      if (doc.status === "Approved") {
        approvedDocument += 1;
      } else {
        unapprovedDocument += 1;
      }
    });

    return { approvedDocument, unapprovedDocument };
  },
};
async function sendChatfuelMessage(userId) {
  // Construct the full URL with required parameters
  const url = `https://api.chatfuel.com/bots/${CHATFUEL_BOT_ID}/users/${userId}/send?chatfuel_token=${CHATFUEL_TOKEN}&chatfuel_block_id=${CHATFUEL_BLOCK_ID}`;

  try {
    // Send a POST request with no body
    const response = await axios.post(url, null, {
      headers: {
        "Content-Type": "application/json", // Ensure the correct Content-Type
      },
    });
  } catch (error) {
    console.error(
      "Error sending Chatfuel message:",
      error.response ? error.response.data : error.message
    );
  }
}
exports.sendPendingApprovalChatfuelMessages = async (allDocuments) => {
  try {
    // Group documents by approver
    const documentsByApprover = groupDocumentsByApprover(allDocuments);

    // Fetch all relevant users at once
    const approverIds = Array.from(documentsByApprover.keys());
    const users = await User.find({ _id: { $in: approverIds } });

    // Send Chatfuel messages to each approver
    for (const user of users) {
      const userDocuments = documentsByApprover.get(user._id.toString());
      if (!userDocuments || userDocuments.length === 0) continue;

      // Send Chatfuel message (if Facebook user ID is available)
      if (user.facebookUserId) {
        await sendChatfuelMessage(user.facebookUserId);
      } else {
        console.warn(`No Facebook user ID found for user: ${user.username}`);
      }
    }
  } catch (error) {
    console.error("Error sending pending approval Chatfuel messages:", error);
  }
};

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
// Fetch all cost centers
exports.getCurrentUser = (req, res) => {
  if (req.user) {
    return res.json({ username: req.user.username });
  }
  res.send("Unauthorized");
};
exports.getCostCenters = async (req, res) => {
  try {
    // Get the current user's username from the authenticated request
    const currentUsername = req.user ? req.user.username : null;

    // Fetch cost centers that the current user is allowed to see
    const costCenters = await CostCenter.find({
      $or: [
        { allowedUsers: { $in: [currentUsername] } }, // Check if the user is in the allowedUsers array
        { allowedUsers: { $size: 0 } }, // If allowedUsers is empty, allow all users
      ],
    });

    // Sort the cost centers alphabetically by name
    // Assuming each cost center has a 'name' field - adjust if your field is named differently
    const sortedCostCenters = costCenters.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    // Send the sorted list of allowed cost centers as a response
    res.json(sortedCostCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.exportDocumentToDocx = async (req, res) => {
  const { id } = req.params;
  try {
    let doc =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await DeliveryDocument.findById(id)) ||
      (await PaymentDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id));

    if (!doc) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    let buffer;
    try {
      switch (doc.title) {
        case "Generic Document":
          buffer = await createGenericDocTemplate(doc);
          break;
        case "Proposal Document":
          buffer = await createProposalDocTemplate(doc);
          break;
        case "Purchasing Document":
          buffer = await createPurchasingDocTemplate(doc);
          break;
        case "Delivery Document":
          buffer = await createDeliveryDocTemplate(doc);
          break;
        case "Payment Document":
          buffer = await createPaymentDocTemplate(doc);
          break;
        case "Advance Payment Document":
          buffer = await createAdvancePaymentDocTemplate(doc);
          break;
        default:
          return res.send("Phiếu chưa được hỗ trợ.");
      }
    } catch (err) {
      console.error("Error creating document template:", err);
      return res.send("Lỗi tạo mẫu phiếu.");
    }

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${doc.title}.docx"`,
    });
    res.send(buffer);
  } catch (err) {
    console.error("Error in exportDocumentToDocx:", err);
    res.send("Lỗi xuất phiếu.");
  }
};
// Main export function that handles file upload and routes to specific document handlers
exports.submitDocument = async (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.send("Error uploading file.");
    }

    const { title } = req.body;

    try {
      // Process approvers data
      const approverDetails = await processApprovers(req);

      // Handle file upload if present
      const uploadedFileData = await handleFileUpload(req);

      // Route to appropriate document handler based on title
      let newDocument;

      switch (title) {
        case "Proposal Document":
          newDocument = await createProposalDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        case "Purchasing Document":
          newDocument = await createPurchasingDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        case "Delivery Document":
          newDocument = await createDeliveryDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        case "Payment Document":
          newDocument = await createPaymentDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        case "Advance Payment Document":
          newDocument = await createAdvancePaymentDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        case "Advance Payment Reclaim Document":
          newDocument = await createAdvancePaymentReclaimDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        case "Project Proposal Document":
          newDocument = await createProjectProposalDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
        default:
          newDocument = await createStandardDocument(
            req,
            approverDetails,
            uploadedFileData
          );
          break;
      }

      await newDocument.save();
      res.redirect("/documentMain");
    } catch (err) {
      console.error("Error submitting document:", err);
      if (!res.headersSent) {
        res.send("Lỗi nộp phiếu.");
      }
    }
  });
};

// Process approvers data from request
async function processApprovers(req) {
  const { approvers } = req.body;

  // Ensure approvers is always an array
  const approversArray = Array.isArray(approvers) ? approvers : [approvers];

  // Fetch approver details
  return Promise.all(
    approversArray.map(async (approverId) => {
      const approver = await User.findById(approverId);
      return {
        approver: approverId,
        username: approver.username,
        subRole: req.body[`subRole_${approverId}`],
      };
    })
  );
}

// Handle file upload to Google Drive
async function handleFileUpload(req) {
  if (!req.file) return null;

  const folderId = process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID;
  const fileMetadata = {
    name: req.file.originalname,
    parents: [folderId],
  };
  const media = {
    mimeType: req.file.mimetype,
    body: fs.createReadStream(req.file.path),
  };

  const driveResponse = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: "id, webViewLink, name",
  });

  // Cleanup: Remove the local file
  fs.unlinkSync(req.file.path);

  return {
    driveFileId: driveResponse.data.id,
    name: driveResponse.data.name,
    link: driveResponse.data.webViewLink,
  };
}

// Create a Proposal Document
async function createProposalDocument(req, approverDetails, uploadedFileData) {
  return new ProposalDocument({
    title: req.body.title,
    task: req.body.task,
    costCenter: req.body.costCenter,
    dateOfError: req.body.dateOfError,
    detailsDescription: req.body.detailsDescription,
    direction: req.body.direction,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Purchasing Document
async function createPurchasingDocument(
  req,
  approverDetails,
  uploadedFileData
) {
  const { products, approvedProposals } = req.body;

  // Process product entries
  const productEntries = processProducts(products);

  // Calculate grand total cost
  const grandTotalCost = parseFloat(
    productEntries.reduce((acc, product) => acc + product.totalCostAfterVat, 0)
  );

  // Process appended proposals
  const appendedProposals = await processAppendedProposals(approvedProposals);

  return new PurchasingDocument({
    title: req.body.title,
    name: req.body.name,
    costCenter: req.body.costCenter,
    products: productEntries,
    grandTotalCost,
    appendedProposals,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Delivery Document
async function createDeliveryDocument(req, approverDetails, uploadedFileData) {
  const { products, approvedProposals } = req.body;

  // Process product entries
  const productEntries = processProducts(products);

  // Calculate grand total cost
  const grandTotalCost = parseFloat(
    productEntries.reduce((acc, product) => acc + product.totalCostAfterVat, 0)
  );

  // Process appended proposals
  const appendedProposals = await processAppendedProposals(approvedProposals);

  return new DeliveryDocument({
    title: req.body.title,
    name: req.body.name,
    costCenter: req.body.costCenter,
    products: productEntries,
    grandTotalCost,
    appendedProposals,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Payment Document
async function createPaymentDocument(req, approverDetails, uploadedFileData) {
  // Process appended purchasing documents
  let appendedPurchasingDocuments = [];
  if (
    req.body.approvedPurchasingDocuments &&
    req.body.approvedPurchasingDocuments.length > 0
  ) {
    appendedPurchasingDocuments = await Promise.all(
      req.body.approvedPurchasingDocuments.map(async (docId) => {
        const purchasingDoc = await PurchasingDocument.findById(docId);
        return purchasingDoc ? purchasingDoc.toObject() : null;
      })
    );
    appendedPurchasingDocuments = appendedPurchasingDocuments.filter(
      (doc) => doc !== null
    );
  }

  // Format the submission date for both display and the tag
  const now = moment().tz("Asia/Bangkok");
  const submissionDateForTag = now.format("DDMMYYYYHHmmss");
  // Create the tag by combining name and formatted date
  const tag = `${req.body.name}${submissionDateForTag}`;

  return new PaymentDocument({
    tag,
    title: req.body.title,
    name: req.body.name,
    content: req.body.content,
    costCenter: req.body.costCenter,
    paymentMethod: req.body.paymentMethod,
    totalPayment: req.body.totalPayment,
    advancePayment: req.body.advancePayment || 0,
    paymentDeadline: req.body.paymentDeadline || "Not specified",
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    appendedPurchasingDocuments,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Payment Document
async function createAdvancePaymentDocument(
  req,
  approverDetails,
  uploadedFileData
) {
  // Process appended purchasing documents
  let appendedPurchasingDocuments = [];
  if (
    req.body.approvedPurchasingDocuments &&
    req.body.approvedPurchasingDocuments.length > 0
  ) {
    appendedPurchasingDocuments = await Promise.all(
      req.body.approvedPurchasingDocuments.map(async (docId) => {
        const purchasingDoc = await PurchasingDocument.findById(docId);
        return purchasingDoc ? purchasingDoc.toObject() : null;
      })
    );
    appendedPurchasingDocuments = appendedPurchasingDocuments.filter(
      (doc) => doc !== null
    );
  }

  // Format the submission date for both display and the tag
  const now = moment().tz("Asia/Bangkok");
  const submissionDateForTag = now.format("DDMMYYYYHHmmss");
  // Create the tag by combining name and formatted date
  const tag = `${req.body.name}${submissionDateForTag}`;

  return new AdvancePaymentDocument({
    tag,
    title: req.body.title,
    name: req.body.name,
    content: req.body.content,
    costCenter: req.body.costCenter,
    paymentMethod: req.body.paymentMethod,
    advancePayment: req.body.advancePayment || 0,
    paymentDeadline: req.body.paymentDeadline || "Not specified",
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    appendedPurchasingDocuments,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Payment Document
async function createAdvancePaymentReclaimDocument(
  req,
  approverDetails,
  uploadedFileData
) {
  // Process appended purchasing documents
  let appendedPurchasingDocuments = [];
  if (
    req.body.approvedPurchasingDocuments &&
    req.body.approvedPurchasingDocuments.length > 0
  ) {
    appendedPurchasingDocuments = await Promise.all(
      req.body.approvedPurchasingDocuments.map(async (docId) => {
        const purchasingDoc = await PurchasingDocument.findById(docId);
        return purchasingDoc ? purchasingDoc.toObject() : null;
      })
    );
    appendedPurchasingDocuments = appendedPurchasingDocuments.filter(
      (doc) => doc !== null
    );
  }

  // Format the submission date for both display and the tag
  const now = moment().tz("Asia/Bangkok");
  const submissionDateForTag = now.format("DDMMYYYYHHmmss");
  // Create the tag by combining name and formatted date
  const tag = `${req.body.name}${submissionDateForTag}`;

  return new AdvancePaymentReclaimDocument({
    tag,
    title: req.body.title,
    name: req.body.name,
    content: req.body.content,
    costCenter: req.body.costCenter,
    paymentMethod: req.body.paymentMethod,
    advancePaymentReclaim: req.body.advancePaymentReclaim || 0,
    paymentDeadline: req.body.paymentDeadline || "Not specified",
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    appendedPurchasingDocuments,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Project Proposal Document
async function createProjectProposalDocument(
  req,
  approverDetails,
  uploadedFileData
) {
  const { contentName, contentText, approvedDocuments } = req.body;

  // Process content array
  const contentArray = [];

  if (Array.isArray(contentName) && Array.isArray(contentText)) {
    contentName.forEach((name, index) => {
      contentArray.push({ name, text: contentText[index] });
    });
  } else {
    contentArray.push({ name: contentName, text: contentText });
  }

  // Append approved documents content
  if (approvedDocuments && approvedDocuments.length > 0) {
    const approvedDocs = await Document.find({
      _id: { $in: approvedDocuments },
    });
    approvedDocs.forEach((doc) => contentArray.push(...doc.content));
  }

  return new ProjectProposalDocument({
    title: req.body.title,
    name: req.body.name,
    content: contentArray,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Standard Document
async function createStandardDocument(req, approverDetails, uploadedFileData) {
  const { contentName, contentText, approvedDocuments } = req.body;

  // Process content array
  const contentArray = [];

  if (Array.isArray(contentName) && Array.isArray(contentText)) {
    contentName.forEach((name, index) => {
      contentArray.push({ name, text: contentText[index] });
    });
  } else {
    contentArray.push({ name: contentName, text: contentText });
  }

  // Append approved documents content
  if (approvedDocuments && approvedDocuments.length > 0) {
    const approvedDocs = await Document.find({
      _id: { $in: approvedDocuments },
    });
    approvedDocs.forEach((doc) => contentArray.push(...doc.content));
  }

  return new Document({
    title: req.body.title,
    content: contentArray,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFileData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Process product entries
function processProducts(products) {
  return products.map((product) => ({
    ...product,
    note: product.note || "",
    totalCost: parseFloat(product.costPerUnit * product.amount),
    totalCostAfterVat: parseFloat(
      product.costPerUnit * product.amount +
        product.costPerUnit * product.amount * (product.vat / 100)
    ),
  }));
}

// Process appended proposals
async function processAppendedProposals(approvedProposals) {
  if (!approvedProposals || approvedProposals.length === 0) {
    return [];
  }

  const appendedProposals = await Promise.all(
    approvedProposals.map(async (proposalId) => {
      const proposal = await ProposalDocument.findById(proposalId);
      if (proposal) {
        const proposalFileMetadata =
          proposal.fileMetadata && Object.keys(proposal.fileMetadata).length > 0
            ? {
                driveFileId: proposal.fileMetadata.driveFileId || "",
                name: proposal.fileMetadata.name || "",
                link: proposal.fileMetadata.link || "",
              }
            : undefined;

        return {
          task: proposal.task,
          costCenter: proposal.costCenter,
          dateOfError: proposal.dateOfError,
          detailsDescription: proposal.detailsDescription,
          direction: proposal.direction,
          fileMetadata: proposalFileMetadata,
          proposalId: proposal._id,
        };
      }
      return null;
    })
  );

  // Filter out any null values from failed lookups
  return appendedProposals.filter((proposal) => proposal !== null);
}
exports.getPendingDocument = async (req, res) => {
  try {
    const pendingPurchasingDocs = await PurchasingDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingProposalDocs = await ProposalDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingGenericDocs = await Document.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingPaymentDocs = await PaymentDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingAdvancePaymentDocs = await AdvancePaymentDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");

    res.sendFile(
      path.join(
        __dirname,
        "../views/approvals/documents/unifiedViewDocuments/approveDocument.html"
      ),
      {
        pendingGenericDocs: JSON.stringify(pendingGenericDocs),
        pendingProposalDocs: JSON.stringify(pendingProposalDocs),
        pendingPurchasingDocs: JSON.stringify(pendingPurchasingDocs),
        pendingPaymentDocs: JSON.stringify(pendingPaymentDocs),
        pendingAdvancePaymentDocs: JSON.stringify(pendingAdvancePaymentDocs),
      }
    );
  } catch (err) {
    console.error("Error fetching pending documents:", err);
    res.send("Lỗi lấy phiếu.");
  }
};
exports.approveDocument = async (req, res) => {
  const { id } = req.params;
  try {
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
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Check if the document is a Generic, Proposal, or Purchasing Document
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id)) ||
      (await AdvancePaymentReclaimDocument.findById(id)) ||
      (await ProjectProposalDocument.findById(id)) ||
      (await DeliveryDocument.findById(id));

    if (!document) {
      return res.send("Không tìm thấy phiếu.");
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
        "Truy cập bị từ chối. Bạn không có quyền phê duyệt phiếu này."
      );
    }

    const hasApproved = document.approvedBy.some(
      (approver) => approver.user.toString() === req.user.id
    );
    if (hasApproved) {
      return res.send("Bạn đã phê duyệt phiếu rồi.");
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
      document.status = "Approved"; // Update status to Approved
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
    } else if (document instanceof AdvancePaymentReclaimDocument) {
      await AdvancePaymentReclaimDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof DeliveryDocument) {
      await DeliveryDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProjectProposalDocument) {
      await ProjectProposalDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    const successMessage =
      document.status === "Approved"
        ? "Phiếu đã được phê duyệt hoàn toàn."
        : "Phiếu đã được phê duyệt thành công.";

    return res.send(successMessage);
  } catch (err) {
    console.error("Error approving document:", err);
    return res.send("Lỗi phê duyệt phiếu.");
  }
};
exports.deleteDocument = async (req, res) => {
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
      document = await AdvancePaymentReclaimDocument.findById(id);
      if (document) documentType = "AdvancePaymentReclaim";
    }
    if (!document && documentType === "Generic") {
      document = await DeliveryDocument.findById(id);
      if (document) documentType = "Delivery";
    }
    if (!document) {
      document = await ProjectProposalDocument.findById(id);
      if (document) documentType = "ProjectProposal";
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
    } else if (documentType === "AdvancePaymentReclaim") {
      await AdvancePaymentReclaimDocument.findByIdAndDelete(id);
    } else if (documentType === "Delivery") {
      await DeliveryDocument.findByIdAndDelete(id);
    } else if (documentType === "ProjectProposal") {
      await ProjectProposalDocument.findByIdAndDelete(id);
    } else {
      await Document.findByIdAndDelete(id);
    }

    // Send success message after deletion
    res.send(`Phiếu đã xóa thành công.`);
  } catch (err) {
    console.error("Error deleting document:", err);
    res.send("Lỗi xóa phiếu.");
  }
};
exports.suspendDocument = async (req, res) => {
  const { id } = req.params;
  const { suspendReason } = req.body;

  try {
    // Restrict access to only users with the role of "director" or "headOfPurchasing"
    if (req.user.role !== "director" && req.user.role !== "headOfPurchasing") {
      return res.send(
        "Truy cập bị từ chối. Chỉ giám đốc hoặc trưởng phòng mua hàng có quyền mở lại phiếu."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert and lock all approval progress
    document.approved = false;
    document.approvedBy = []; // Clear all approvals
    document.status = "Suspended"; // Add a new field for status
    document.suspendReason = suspendReason; // Add suspend reason

    // Save the document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof AdvancePaymentDocument) {
      await AdvancePaymentDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.send("Phiếu đã được tạm dừng thành công.");
  } catch (err) {
    console.error("Lỗi khi tạm dừng phiếu:", err);
    res.status(500).send("Lỗi khi tạm dừng phiếu.");
  }
};
exports.openDocument = async (req, res) => {
  const { id } = req.params;

  try {
    // Restrict access to only users with the role of "director" or "headOfPurchasing"
    if (req.user.role !== "director" && req.user.role !== "headOfPurchasing") {
      return res.send(
        "Truy cập bị từ chối. Chỉ giám đốc hoặc trưởng phòng mua hàng có quyền mở lại phiếu."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert the suspension
    document.status = "Pending"; // Change status back to pending
    document.suspendReason = ""; // Clear suspend reason

    // Save the document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof AdvancePaymentDocument) {
      await AdvancePaymentDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.send("Phiếu đã được mở lại thành công.");
  } catch (err) {
    console.error("Lỗi khi mở lại phiếu:", err);
    res.status(500).send("Lỗi khi mở lại phiếu.");
  }
};
//// END OF GENERAL CONTROLLER

//// PROPOSAL DOCUMENT CONTROLLER
exports.getApprovedProposalsForPurchasing = async (req, res) => {
  try {
    // Fetch all approved proposal documents
    const approvedProposals = await ProposalDocument.find({
      status: "Approved",
    }).populate("submittedBy approvers.approver approvedBy.user");

    // Fetch all purchasing documents to check which proposals are already attached
    const PurchasingDocument = require("../models/DocumentPurchasing.js");
    const purchasingDocuments = await PurchasingDocument.find({});

    // Extract all proposal IDs that are already attached to purchasing documents
    const attachedProposalIds = new Set();
    purchasingDocuments.forEach((doc) => {
      if (doc.appendedProposals && doc.appendedProposals.length > 0) {
        doc.appendedProposals.forEach((proposal) => {
          if (proposal.proposalId) {
            attachedProposalIds.add(proposal.proposalId.toString());
          }
        });
      }
    });

    // Filter out proposals that are already attached to purchasing documents
    const unattachedProposals = approvedProposals.filter(
      (proposal) => !attachedProposalIds.has(proposal._id.toString())
    );

    // Sort approved documents by latest approval date (newest first)
    const sortedDocuments = unattachedProposals.sort((a, b) => {
      // Get the latest approval date for each document
      const getLatestApprovalDate = (doc) => {
        if (doc.approvedBy && doc.approvedBy.length > 0) {
          // Sort approval dates in descending order
          const sortedDates = [...doc.approvedBy].sort((x, y) => {
            // Parse date strings in format "DD-MM-YYYY HH:MM:SS"
            const parseCustomDate = (dateStr) => {
              const [datePart, timePart] = dateStr.split(" ");
              const [day, month, year] = datePart.split("-");
              const [hour, minute, second] = timePart.split(":");
              // Month is 0-indexed in JavaScript Date constructor
              return new Date(year, month - 1, day, hour, minute, second);
            };
            return (
              parseCustomDate(y.approvalDate) - parseCustomDate(x.approvalDate)
            );
          });
          return sortedDates[0].approvalDate;
        }
        return "01-01-1970 00:00:00"; // Default date if no approvals
      };
      const latestDateA = getLatestApprovalDate(a);
      const latestDateB = getLatestApprovalDate(b);
      // Parse dates
      const parseCustomDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        const [day, month, year] = datePart.split("-");
        const [hour, minute, second] = timePart.split(":");
        // Month is 0-indexed in JavaScript Date constructor
        return new Date(year, month - 1, day, hour, minute, second);
      };
      // Sort by latest approval date in descending order (newest first)
      return parseCustomDate(latestDateB) - parseCustomDate(latestDateA);
    });

    res.json(sortedDocuments);
  } catch (err) {
    console.error("Error fetching unattached approved proposals:", err);
    res.status(500).send("Lỗi lấy phiếu đề xuất đã phê duyệt chưa được gắn.");
  }
};
exports.getApprovedProposalsForDelivery = async (req, res) => {
  try {
    // Fetch all approved proposal documents
    const approvedProposals = await ProposalDocument.find({
      status: "Approved",
    }).populate("submittedBy approvers.approver approvedBy.user");

    // Fetch all purchasing documents to check which proposals are already attached
    const DeliveryDocument = require("../models/DocumentDelivery.js");
    const deliveryDocuments = await DeliveryDocument.find({});

    // Extract all proposal IDs that are already attached to delivery documents
    const attachedProposalIds = new Set();
    deliveryDocuments.forEach((doc) => {
      if (doc.appendedProposals && doc.appendedProposals.length > 0) {
        doc.appendedProposals.forEach((proposal) => {
          if (proposal.proposalId) {
            attachedProposalIds.add(proposal.proposalId.toString());
          }
        });
      }
    });

    // Filter out proposals that are already attached to delivery documents
    const unattachedProposals = approvedProposals.filter(
      (proposal) => !attachedProposalIds.has(proposal._id.toString())
    );

    // Sort approved documents by latest approval date (newest first)
    const sortedDocuments = unattachedProposals.sort((a, b) => {
      // Get the latest approval date for each document
      const getLatestApprovalDate = (doc) => {
        if (doc.approvedBy && doc.approvedBy.length > 0) {
          // Sort approval dates in descending order
          const sortedDates = [...doc.approvedBy].sort((x, y) => {
            // Parse date strings in format "DD-MM-YYYY HH:MM:SS"
            const parseCustomDate = (dateStr) => {
              const [datePart, timePart] = dateStr.split(" ");
              const [day, month, year] = datePart.split("-");
              const [hour, minute, second] = timePart.split(":");
              // Month is 0-indexed in JavaScript Date constructor
              return new Date(year, month - 1, day, hour, minute, second);
            };
            return (
              parseCustomDate(y.approvalDate) - parseCustomDate(x.approvalDate)
            );
          });
          return sortedDates[0].approvalDate;
        }
        return "01-01-1970 00:00:00"; // Default date if no approvals
      };
      const latestDateA = getLatestApprovalDate(a);
      const latestDateB = getLatestApprovalDate(b);
      // Parse dates
      const parseCustomDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        const [day, month, year] = datePart.split("-");
        const [hour, minute, second] = timePart.split(":");
        // Month is 0-indexed in JavaScript Date constructor
        return new Date(year, month - 1, day, hour, minute, second);
      };
      // Sort by latest approval date in descending order (newest first)
      return parseCustomDate(latestDateB) - parseCustomDate(latestDateA);
    });

    res.json(sortedDocuments);
  } catch (err) {
    console.error("Error fetching unattached approved proposals:", err);
    res.status(500).send("Lỗi lấy phiếu đề xuất đã phê duyệt chưa được gắn.");
  }
};
exports.getDocumentsContainingProposal = async (req, res) => {
  try {
    const proposalId = req.params.proposalId;

    // Find all purchasing documents that reference this proposal
    const purchasingDocs = await PurchasingDocument.find({
      "appendedProposals.proposalId": proposalId,
    }).lean();

    // Find all delivery documents that reference this proposal
    const deliveryDocs = await DeliveryDocument.find({
      "appendedProposals.proposalId": proposalId,
    }).lean();

    res.json({
      success: true,
      purchasingDocuments: purchasingDocs,
      deliveryDocuments: deliveryDocs,
    });
  } catch (error) {
    console.error("Error finding documents containing proposal:", error);
    res.status(500).json({
      success: false,
      message: "Error finding documents containing proposal",
    });
  }
};
exports.getProposalDocumentById = async (req, res) => {
  try {
    const proposal = await ProposalDocument.findById(req.params.id);
    if (!proposal) return res.send("Proposal document not found");
    res.json(proposal);
  } catch (err) {
    console.error("Error fetching proposal document:", err);
    res.send("Lỗi lấy phiếu đề xuất.");
  }
};
exports.updateProposalDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { task, costCenter, dateOfError, detailsDescription, direction } =
      req.body;
    const file = req.file;

    const doc = await ProposalDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Fetch the current user
    const currentUser = req.user.username;

    // Fetch allowed cost centers for the current user
    const costCenters = await CostCenter.find({
      $or: [
        { allowedUsers: { $in: [currentUser] } },
        { allowedUsers: { $size: 0 } },
      ],
    });

    // Check if the new cost center is allowed for the user
    const isCostCenterAllowed = costCenters.some(
      (center) => center.name === costCenter
    );
    if (!isCostCenterAllowed) {
      return res.status(403).json({
        message: "You do not have permission to edit this cost center.",
      });
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    // Update the document
    doc.task = task;
    doc.costCenter = costCenter;
    doc.dateOfError = dateOfError;
    doc.detailsDescription = detailsDescription;
    doc.direction = direction;

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };
      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };
      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating proposal document:", error);
    res.status(500).json({ message: "Error updating document" });
  }
};
exports.getProposalDocumentForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const proposalDocuments = await ProposalDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      proposalDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    // Calculate counts for approved and unapproved documents
    const { approvedDocument, unapprovedDocument } =
      documentUtils.countDocumentsByStatus(sortedDocuments);

    res.json({
      proposalDocuments: sortedDocuments,
      approvedDocument,
      unapprovedDocument,
    });
  } catch (err) {
    console.error("Error fetching proposal documents:", err);
    res.status(500).send("Error fetching proposal documents");
  }
};
exports.getProposalDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await ProposalDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching proposal document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updateProposalDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const doc = await ProposalDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công.");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
exports.suspendProposalDocument = async (req, res) => {
  const { id } = req.params;
  const { suspendReason } = req.body;

  try {
    // Restrict access to only users with the role of "director"
    if (req.user.role !== "deputyDirector") {
      return res.send(
        "Truy cập bị từ chối. Chỉ phó giám đốc có quyền tạm dừng phiếu đề xuất."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert and lock all approval progress
    document.approved = false;
    document.approvedBy = []; // Clear all approvals
    document.status = "Suspended"; // Add a new field for status
    document.suspendReason = suspendReason; // Add suspend reason

    // Save the document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.send("Phiếu đã được tạm dừng thành công.");
  } catch (err) {
    console.error("Lỗi khi tạm dừng phiếu:", err);
    res.status(500).send("Lỗi khi tạm dừng phiếu.");
  }
};
exports.openProposalDocument = async (req, res) => {
  const { id } = req.params;

  try {
    // Restrict access to only users with the role of "director"
    if (req.user.role !== "deputyDirector") {
      return res.send(
        "Truy cập bị từ chối. Chỉ phó giám đốc có quyền mở lại phiếu đề xuất."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert the suspension
    document.status = "Pending"; // Change status back to pending
    document.suspendReason = ""; // Clear suspend reason

    // Save the document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.send("Phiếu đã được mở lại thành công.");
  } catch (err) {
    console.error("Lỗi khi mở lại phiếu:", err);
    res.status(500).send("Lỗi khi mở lại phiếu.");
  }
};
//// END OF PROPOSAL DOCUMENT CONTROLLER

//// PURCHASING DOCUMENT CONTROLLER
exports.getApprovedPurchasingDocumentsForPayment = async (req, res) => {
  try {
    // First get all approved purchasing documents
    const approvedPurchasingDocs = await PurchasingDocument.find({
      status: "Approved",
    }).populate("submittedBy approvers.approver approvedBy.user");

    // Then get all payment documents to check which purchasing documents are attached
    const paymentDocuments = await PaymentDocument.find({});

    // Create a Set of all purchasing document IDs that are attached to payment documents
    const attachedPurchasingDocIds = new Set();

    paymentDocuments.forEach((paymentDoc) => {
      if (
        paymentDoc.appendedPurchasingDocuments &&
        paymentDoc.appendedPurchasingDocuments.length > 0
      ) {
        paymentDoc.appendedPurchasingDocuments.forEach((purchDoc) => {
          // Check if the purchasing document is stored as an ID or as an object with _id
          if (typeof purchDoc === "string") {
            attachedPurchasingDocIds.add(purchDoc);
          } else if (purchDoc._id) {
            attachedPurchasingDocIds.add(purchDoc._id.toString());
          }
        });
      }
    });

    // Filter out purchasing documents that are already attached to payment documents
    const unattachedPurchasingDocs = approvedPurchasingDocs.filter(
      (doc) => !attachedPurchasingDocIds.has(doc._id.toString())
    );

    // Sort unattached documents by latest approval date (newest first)
    const sortedDocuments = unattachedPurchasingDocs.sort((a, b) => {
      // Get the latest approval date for each document
      const getLatestApprovalDate = (doc) => {
        if (doc.approvedBy && doc.approvedBy.length > 0) {
          // Sort approval dates in descending order
          const sortedDates = [...doc.approvedBy].sort((x, y) => {
            // Parse date strings in format "DD-MM-YYYY HH:MM:SS"
            const parseCustomDate = (dateStr) => {
              const [datePart, timePart] = dateStr.split(" ");
              const [day, month, year] = datePart.split("-");
              const [hour, minute, second] = timePart.split(":");
              // Month is 0-indexed in JavaScript Date constructor
              return new Date(year, month - 1, day, hour, minute, second);
            };
            return (
              parseCustomDate(y.approvalDate) - parseCustomDate(x.approvalDate)
            );
          });
          return sortedDates[0].approvalDate;
        }
        return "01-01-1970 00:00:00"; // Default date if no approvals
      };

      const latestDateA = getLatestApprovalDate(a);
      const latestDateB = getLatestApprovalDate(b);

      // Parse dates
      const parseCustomDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        const [day, month, year] = datePart.split("-");
        const [hour, minute, second] = timePart.split(":");
        // Month is 0-indexed in JavaScript Date constructor
        return new Date(year, month - 1, day, hour, minute, second);
      };

      // Sort by latest approval date in descending order (newest first)
      return parseCustomDate(latestDateB) - parseCustomDate(latestDateA);
    });

    res.json(sortedDocuments);
  } catch (err) {
    console.error("Error fetching unattached purchasing documents:", err);
    res.status(500).send("Lỗi lấy phiếu mua hàng chưa gắn với thanh toán.");
  }
};
exports.getApprovedPurchasingDocumentsForAdvancePayment = async (req, res) => {
  try {
    // First get all approved purchasing documents
    const approvedPurchasingDocs = await PurchasingDocument.find({
      status: "Approved",
    }).populate("submittedBy approvers.approver approvedBy.user");

    // Then get all payment documents to check which purchasing documents are attached
    const advancePaymentDocuments = await AdvancePaymentDocument.find({});

    // Create a Set of all purchasing document IDs that are attached to payment documents
    const attachedPurchasingDocIds = new Set();

    advancePaymentDocuments.forEach((advancePaymentDoc) => {
      if (
        advancePaymentDoc.appendedPurchasingDocuments &&
        advancePaymentDoc.appendedPurchasingDocuments.length > 0
      ) {
        advancePaymentDoc.appendedPurchasingDocuments.forEach((purchDoc) => {
          // Check if the purchasing document is stored as an ID or as an object with _id
          if (typeof purchDoc === "string") {
            attachedPurchasingDocIds.add(purchDoc);
          } else if (purchDoc._id) {
            attachedPurchasingDocIds.add(purchDoc._id.toString());
          }
        });
      }
    });

    // Filter out purchasing documents that are already attached to payment documents
    const unattachedPurchasingDocs = approvedPurchasingDocs.filter(
      (doc) => !attachedPurchasingDocIds.has(doc._id.toString())
    );

    // Sort unattached documents by latest approval date (newest first)
    const sortedDocuments = unattachedPurchasingDocs.sort((a, b) => {
      // Get the latest approval date for each document
      const getLatestApprovalDate = (doc) => {
        if (doc.approvedBy && doc.approvedBy.length > 0) {
          // Sort approval dates in descending order
          const sortedDates = [...doc.approvedBy].sort((x, y) => {
            // Parse date strings in format "DD-MM-YYYY HH:MM:SS"
            const parseCustomDate = (dateStr) => {
              const [datePart, timePart] = dateStr.split(" ");
              const [day, month, year] = datePart.split("-");
              const [hour, minute, second] = timePart.split(":");
              // Month is 0-indexed in JavaScript Date constructor
              return new Date(year, month - 1, day, hour, minute, second);
            };
            return (
              parseCustomDate(y.approvalDate) - parseCustomDate(x.approvalDate)
            );
          });
          return sortedDates[0].approvalDate;
        }
        return "01-01-1970 00:00:00"; // Default date if no approvals
      };

      const latestDateA = getLatestApprovalDate(a);
      const latestDateB = getLatestApprovalDate(b);

      // Parse dates
      const parseCustomDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        const [day, month, year] = datePart.split("-");
        const [hour, minute, second] = timePart.split(":");
        // Month is 0-indexed in JavaScript Date constructor
        return new Date(year, month - 1, day, hour, minute, second);
      };

      // Sort by latest approval date in descending order (newest first)
      return parseCustomDate(latestDateB) - parseCustomDate(latestDateA);
    });

    res.json(sortedDocuments);
  } catch (err) {
    console.error("Error fetching unattached purchasing documents:", err);
    res.status(500).send("Lỗi lấy phiếu mua hàng chưa gắn với thanh toán.");
  }
};
exports.getApprovedPurchasingDocumentsForAdvancePaymentReclaim = async (
  req,
  res
) => {
  try {
    // First get all approved purchasing documents
    const approvedPurchasingDocs = await PurchasingDocument.find({
      status: "Approved",
    }).populate("submittedBy approvers.approver approvedBy.user");

    // Then get all payment documents to check which purchasing documents are attached
    const advancePaymentReclaimDocuments =
      await AdvancePaymentReclaimDocument.find({});

    // Create a Set of all purchasing document IDs that are attached to payment documents
    const attachedPurchasingDocIds = new Set();

    advancePaymentReclaimDocuments.forEach((advancePaymentReclaimDoc) => {
      if (
        advancePaymentReclaimDoc.appendedPurchasingDocuments &&
        advancePaymentReclaimDoc.appendedPurchasingDocuments.length > 0
      ) {
        advancePaymentReclaimDoc.appendedPurchasingDocuments.forEach(
          (purchDoc) => {
            // Check if the purchasing document is stored as an ID or as an object with _id
            if (typeof purchDoc === "string") {
              attachedPurchasingDocIds.add(purchDoc);
            } else if (purchDoc._id) {
              attachedPurchasingDocIds.add(purchDoc._id.toString());
            }
          }
        );
      }
    });

    // Filter out purchasing documents that are already attached to payment documents
    const unattachedPurchasingDocs = approvedPurchasingDocs.filter(
      (doc) => !attachedPurchasingDocIds.has(doc._id.toString())
    );

    // Sort unattached documents by latest approval date (newest first)
    const sortedDocuments = unattachedPurchasingDocs.sort((a, b) => {
      // Get the latest approval date for each document
      const getLatestApprovalDate = (doc) => {
        if (doc.approvedBy && doc.approvedBy.length > 0) {
          // Sort approval dates in descending order
          const sortedDates = [...doc.approvedBy].sort((x, y) => {
            // Parse date strings in format "DD-MM-YYYY HH:MM:SS"
            const parseCustomDate = (dateStr) => {
              const [datePart, timePart] = dateStr.split(" ");
              const [day, month, year] = datePart.split("-");
              const [hour, minute, second] = timePart.split(":");
              // Month is 0-indexed in JavaScript Date constructor
              return new Date(year, month - 1, day, hour, minute, second);
            };
            return (
              parseCustomDate(y.approvalDate) - parseCustomDate(x.approvalDate)
            );
          });
          return sortedDates[0].approvalDate;
        }
        return "01-01-1970 00:00:00"; // Default date if no approvals
      };

      const latestDateA = getLatestApprovalDate(a);
      const latestDateB = getLatestApprovalDate(b);

      // Parse dates
      const parseCustomDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(" ");
        const [day, month, year] = datePart.split("-");
        const [hour, minute, second] = timePart.split(":");
        // Month is 0-indexed in JavaScript Date constructor
        return new Date(year, month - 1, day, hour, minute, second);
      };

      // Sort by latest approval date in descending order (newest first)
      return parseCustomDate(latestDateB) - parseCustomDate(latestDateA);
    });

    res.json(sortedDocuments);
  } catch (err) {
    console.error("Error fetching unattached purchasing documents:", err);
    res.status(500).send("Lỗi lấy phiếu mua hàng chưa gắn với thanh toán.");
  }
};
exports.getDocumentsContainingPurchasing = async (req, res) => {
  try {
    const purchasingId = req.params.purchasingId;

    // Handle both ObjectId format and string format
    const mongoose = require("mongoose");
    let purchasingObjectId;

    // Check if the ID is a valid ObjectId
    try {
      purchasingObjectId = new mongoose.Types.ObjectId(purchasingId);
    } catch (err) {
      // ID is not in valid ObjectId format, continue with string ID
    }

    // Create a query that handles multiple formats of IDs
    const query = {
      $or: [
        // Case 1: ID is stored as ObjectId directly
        { "appendedPurchasingDocuments._id": purchasingObjectId },

        // Case 2: ID is stored in Extended JSON format with $oid
        { "appendedPurchasingDocuments._id.$oid": purchasingId },

        // Case 3: ID is stored as a string
        { "appendedPurchasingDocuments._id": purchasingId },

        // Case 4: ID is stored in a nested object with id property
        { "appendedPurchasingDocuments.id": purchasingId },

        // Case 5: ID might be stored in the document field of purchasing document
        { "appendedPurchasingDocuments._doc._id": purchasingObjectId },
        { "appendedPurchasingDocuments._doc._id": purchasingId },
      ],
    };

    // Find all payment documents that reference this purchasing document
    const paymentDocs = await PaymentDocument.find(query).lean();

    // Find all advance payment documents that reference this purchasing document
    const advancePaymentDocs = await AdvancePaymentDocument.find(query).lean();

    // Find all advance payment reclaim documents that reference this purchasing document
    const reclaimDocs = await AdvancePaymentReclaimDocument.find(query).lean();

    res.json({
      success: true,
      paymentDocuments: paymentDocs,
      advancePaymentDocuments: advancePaymentDocs,
      advancePaymentReclaimDocuments: reclaimDocs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error finding related financial documents",
    });
  }
};
exports.getPurchasingDocumentById = async (req, res) => {
  try {
    const purchasingDoc = await PurchasingDocument.findById(req.params.id);
    if (!purchasingDoc) return res.send("Không tìm thấy phiếu mua hàng.");
    res.json(purchasingDoc);
  } catch (err) {
    console.error("Error fetching purchasing document:", err);
    res.send("Lỗi lấy phiếu mua hàng/Error fetching purchasing document");
  }
};
// Fetch all Purchasing Documents
exports.getPurchasingDocumentsForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const purchasingDocuments = await PurchasingDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      purchasingDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    // Calculate counts for approved and unapproved documents
    const { approvedDocument, unapprovedDocument } =
      documentUtils.countDocumentsByStatus(sortedDocuments);

    // Calculate sums for approved and unapproved documents
    let approvedSum = 0;
    let unapprovedSum = 0;

    sortedDocuments.forEach((doc) => {
      if (doc.status === "Approved") {
        approvedSum += doc.grandTotalCost;
      } else {
        unapprovedSum += doc.grandTotalCost;
      }
    });

    res.json({
      purchasingDocuments: sortedDocuments,
      approvedSum,
      unapprovedSum,
      approvedDocument,
      unapprovedDocument,
    });
  } catch (err) {
    console.error("Error fetching purchasing documents:", err);
    res.status(500).send("Error fetching purchasing documents");
  }
};
// Fetch a specific Purchasing Document by ID
exports.getPurchasingDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PurchasingDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching purchasing document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
// Update a Purchasing Document
exports.updatePurchasingDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    // Parse the products JSON string into an object
    let products;
    try {
      products = JSON.parse(req.body.products);
    } catch (error) {
      return res.status(400).json({ message: "Invalid products data format" });
    }

    // Parse grandTotalCost as a number
    const grandTotalCost = parseFloat(req.body.grandTotalCost);
    const name = req.body.name;
    const costCenter = req.body.costCenter;

    // Parse appendedProposals if it exists
    let appendedProposals;
    if (req.body.appendedProposals) {
      try {
        appendedProposals = JSON.parse(req.body.appendedProposals);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid appendedProposals data format" });
      }
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    const doc = await PurchasingDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update basic fields
    doc.products = products;
    doc.grandTotalCost = grandTotalCost;
    doc.name = name;
    doc.costCenter = costCenter;
    if (appendedProposals) {
      doc.appendedProposals = appendedProposals;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
          // Continue execution even if file deletion fails
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };
      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };

      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    await doc.save();
    res.json({
      message: "Document updated successfully",
      document: doc,
    });
  } catch (error) {
    console.error("Error updating purchasing document:", error);
    res.status(500).json({
      message: "Error updating document",
      error: error.message,
    });
  }
};
exports.updatePurchasingDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const doc = await PurchasingDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công.");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
exports.suspendPurchasingDocument = async (req, res) => {
  const { id } = req.params;
  const { suspendReason } = req.body;

  try {
    // Restrict access to only users with the role of "director"
    if (req.user.role !== "headOfPurchasing") {
      return res.send(
        "Truy cập bị từ chối. Chỉ trưởng phòng mua hàng có quyền tạm dừng phiếu mua hàng."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert and lock all approval progress
    document.approved = false;
    document.approvedBy = []; // Clear all approvals
    document.status = "Suspended"; // Add a new field for status
    document.suspendReason = suspendReason; // Add suspend reason

    // Save the document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.send("Phiếu đã được tạm dừng thành công.");
  } catch (err) {
    console.error("Lỗi khi tạm dừng phiếu:", err);
    res.status(500).send("Lỗi khi tạm dừng phiếu.");
  }
};
exports.openPurchasingDocument = async (req, res) => {
  const { id } = req.params;

  try {
    // Restrict access to only users with the role of "director"
    if (req.user.role !== "headOfPurchasing") {
      return res.send(
        "Truy cập bị từ chối. Chỉ trưởng phòng mua hàng có quyền mở lại phiếu mua hàng."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert the suspension
    document.status = "Pending"; // Change status back to pending
    document.suspendReason = ""; // Clear suspend reason

    // Save the document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.send("Phiếu đã được mở lại thành công.");
  } catch (err) {
    console.error("Lỗi khi mở lại phiếu:", err);
    res.status(500).send("Lỗi khi mở lại phiếu.");
  }
};
exports.exportPurchasingDocumentsToExcel = async (req, res) => {
  try {
    const { documentIds } = req.body;
    const ids = JSON.parse(documentIds);

    // Fetch documents with all necessary relationships
    const documents = await PurchasingDocument.find({ _id: { $in: ids } })
      .populate("submittedBy")
      .populate("approvers.approver")
      .populate("approvedBy.user")
      .populate("appendedProposals");

    // Create workbook with enhanced styling
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Document Management System";
    workbook.lastModifiedBy = "Document Management System";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = true;

    // Add worksheet with improved page setup
    const worksheet = workbook.addWorksheet("Purchasing Documents", {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        horizontalCentered: true,
        verticalCentered: true,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0, // Auto fit to height
        printArea: "A1:L1000", // Dynamic print area
        margins: {
          top: 0.7,
          left: 0.7,
          bottom: 0.7,
          right: 0.7,
          header: 0.3,
          footer: 0.3,
        },
      },
      properties: {
        tabColor: { argb: "4F81BD" },
      },
    });

    // Define comprehensive styling system
    const styles = {
      header: {
        font: {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 11,
          name: "Calibri",
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F81BD" },
        },
        border: {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        },
        alignment: {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
          shrinkToFit: false,
        },
      },
      sectionHeader: {
        font: {
          bold: true,
          color: { argb: "FF000000" },
          size: 12,
          name: "Calibri",
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9D9D9" },
        },
        border: {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        },
        alignment: { vertical: "middle", horizontal: "left" },
      },
      currency: {
        numFmt: '"$"#,##0.00',
        alignment: { horizontal: "right" },
      },
      percentage: {
        numFmt: '0.00"%"',
        alignment: { horizontal: "right" },
      },
      date: {
        numFmt: "dd-mmm-yyyy hh:mm:ss",
        alignment: { horizontal: "left" },
      },
      rowEven: {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        },
      },
      rowOdd: {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        },
      },
      cellBorder: {
        border: {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        },
      },
      status: {
        approved: {
          font: { bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC6EFCE" },
          },
          alignment: { horizontal: "center" },
        },
        suspended: {
          font: { bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" },
          },
          alignment: { horizontal: "center" },
        },
        pending: {
          font: { bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFEB9C" },
          },
          alignment: { horizontal: "center" },
        },
      },
      documentTitle: {
        font: {
          bold: true,
          color: { argb: "FF0000" },
          size: 14,
          name: "Calibri",
        },
        alignment: { horizontal: "left" },
      },
    };

    // Add company logo placeholder
    // worksheet.addImage({
    //   base64: companyLogoBase64,
    //   extension: 'png',
    //   tl: { col: 0, row: 0 },
    //   ext: { width: 150, height: 50 }
    // });

    // Main document columns with auto-width settings
    worksheet.columns = [
      {
        header: "Mã",
        key: "id",
        width: 18,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Tên",
        key: "name",
        width: 30,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Trạm",
        key: "costCenter",
        width: 15,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Nhóm",
        key: "groupName",
        width: 15,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Dự án",
        key: "projectName",
        width: 18,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Tổng tiền",
        key: "grandTotalCost",
        width: 15,
        style: {
          ...styles.currency,
          alignment: { wrapText: true, horizontal: "right" },
        },
      },
      {
        header: "Tình trạng",
        key: "status",
        width: 12,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Nộp bởi",
        key: "submittedBy",
        width: 20,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Ngày nộp",
        key: "submissionDate",
        width: 20,
        style: {
          ...styles.date,
          alignment: { wrapText: true, horizontal: "left" },
        },
      },
      {
        header: "Tệp tin đính kèm",
        key: "fileAttachment",
        width: 30,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Kê khai",
        key: "declaration",
        width: 30,
        style: { alignment: { wrapText: true } },
      },
      {
        header: "Lý do từ chối",
        key: "suspendReason",
        width: 30,
        style: { alignment: { wrapText: true } },
      },
    ];

    // Apply header style and adjust row height
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = styles.header;
    });
    worksheet.getRow(1).height = 25; // Increase header height for better readability

    // Add report title and generation timestamp
    const titleRow = worksheet.addRow([]);
    titleRow.height = 30;
    const reportTitle = `Purchasing Documents Export - Generated on ${new Date().toLocaleDateString()}`;
    worksheet.mergeCells("A1:L1");
    worksheet.getCell("A1").value = reportTitle;
    worksheet.getCell("A1").style = styles.documentTitle;

    // Get today's date for the report title
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Add data with alternating row colors and borders
    let currentRow = 3; // Start from row 3 due to title

    // Add document main info header row
    const docMainInfoHeaderRow = worksheet.addRow([""]);
    worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
    docMainInfoHeaderRow.eachCell((cell) => {
      cell.style = styles.sectionHeader;
    });
    docMainInfoHeaderRow.height = 22;
    currentRow++;

    // Add document columns header row
    const docColumnsHeaderRow = worksheet.addRow([
      "Mã",
      "Tên",
      "Trạm",
      "Nhóm",
      "Dự án",
      "Tổng tiền",
      "Tình trạng",
      "Nộp bởi",
      "Ngày nộp",
      "Tệp tin đính kèm",
      "Kê khai",
      "Lý do từ chối",
    ]);
    docColumnsHeaderRow.eachCell((cell) => {
      cell.style = styles.header;
    });
    currentRow++;

    documents.forEach((doc, docIndex) => {
      // Section header for each document
      const docHeaderRow = worksheet.addRow([
        `Document #${docIndex + 1}: ${doc.name} (${doc._id.toString()})`,
      ]);
      worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
      docHeaderRow.eachCell((cell) => {
        cell.style = styles.documentTitle;
      });
      docHeaderRow.height = 25;
      currentRow++;

      // Add main document info
      const mainRow = worksheet.addRow({
        id: doc._id.toString(),
        name: doc.name,
        costCenter: doc.costCenter,
        groupName: doc.groupName,
        projectName: doc.projectName,
        grandTotalCost: doc.grandTotalCost,
        status: doc.status,
        submittedBy: doc.submittedBy?.username || "",
        submissionDate: doc.submissionDate,
        fileAttachment: doc.fileMetadata?.link
          ? {
              text: doc.fileMetadata.name,
              hyperlink: doc.fileMetadata.link,
            }
          : "None",
        declaration: doc.declaration || "None",
        suspendReason: doc.suspendReason || "None",
      });

      // Apply general styling
      mainRow.eachCell((cell) => {
        cell.style = { ...styles.cellBorder, ...styles.rowEven };
      });

      // Style status cell based on value
      const statusCell = mainRow.getCell("status");
      if (doc.status === "Approved") {
        statusCell.style = { ...statusCell.style, ...styles.status.approved };
      } else if (doc.status === "Suspended") {
        statusCell.style = { ...statusCell.style, ...styles.status.suspended };
      } else {
        statusCell.style = { ...statusCell.style, ...styles.status.pending };
      }

      // Apply currency formatting
      mainRow.getCell("grandTotalCost").style = {
        ...mainRow.getCell("grandTotalCost").style,
        ...styles.currency,
      };

      // Apply date formatting
      mainRow.getCell("submissionDate").style = {
        ...mainRow.getCell("submissionDate").style,
        ...styles.date,
      };

      currentRow++;

      // Add Products section
      if (doc.products && doc.products.length > 0) {
        const productSectionRow = worksheet.addRow(["PRODUCTS"]);
        worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
        productSectionRow.eachCell((cell) => {
          cell.style = styles.sectionHeader;
        });
        productSectionRow.height = 22;
        currentRow++;

        // Define product column widths and headers BEFORE using them
        const productColumnWidths = [
          { min: 5, max: 10 }, // No
          { min: 20, max: 50 }, // Product Name
          { min: 15, max: 20 }, // Cost Per Unit
          { min: 10, max: 15 }, // Amount
          { min: 10, max: 15 }, // VAT %
          { min: 15, max: 20 }, // Total Cost
          { min: 15, max: 20 }, // Total After VAT
          { min: 15, max: 40 }, // Note
        ];

        // Product headers
        const productHeaders = [
          "No.",
          "Tên",
          "Đơn giá",
          "Số lượng",
          "VAT %",
          "Thành tiền",
          "Thành tiền sau VAT",
          "Ghi chú",
        ];

        const productHeaderRow = worksheet.addRow(productHeaders);
        productHeaderRow.eachCell((cell) => {
          cell.style = styles.header;
        });
        currentRow++;

        // Track maximum content lengths for auto-sizing
        const contentLengths = [0, 0, 0, 0, 0, 0, 0, 0];

        // Product data with alternating colors
        doc.products.forEach((product, idx) => {
          const productRow = worksheet.addRow([
            idx + 1,
            product.productName,
            product.costPerUnit,
            product.amount,
            product.vat,
            product.totalCost,
            product.totalCostAfterVat,
            product.note || "",
          ]);

          // Apply row styling (alternating colors)
          const rowStyle = idx % 2 === 0 ? styles.rowEven : styles.rowOdd;
          productRow.eachCell((cell) => {
            cell.style = { ...styles.cellBorder, ...rowStyle };
          });

          // Apply currency formatting
          [3, 6, 7].forEach((colIndex) => {
            productRow.getCell(colIndex).style = {
              ...productRow.getCell(colIndex).style,
              ...styles.currency,
            };
          });

          // Apply percentage formatting
          productRow.getCell(5).style = {
            ...productRow.getCell(5).style,
            ...styles.percentage,
          };

          // Track content lengths for auto-sizing
          const rowValues = [
            String(idx + 1),
            product.productName || "",
            String(product.costPerUnit || ""),
            String(product.amount || ""),
            String(product.vat || ""),
            String(product.totalCost || ""),
            String(product.totalCostAfterVat || ""),
            product.note || "",
          ];

          rowValues.forEach((value, i) => {
            contentLengths[i] = Math.max(contentLengths[i], value.length);
          });

          currentRow++;
        });

        // Auto-adjust column widths for this product table AFTER collecting content lengths
        for (let i = 0; i < productColumnWidths.length; i++) {
          const columnIndex = i + 1; // 1-based index for Excel
          const column = worksheet.getColumn(columnIndex);
          const headerLength = productHeaders[i]?.length || 0;
          const contentLength = Math.max(contentLengths[i], headerLength);
          const finalWidth = Math.min(
            Math.max(contentLength + 2, productColumnWidths[i].min),
            productColumnWidths[i].max
          );
          column.width = finalWidth;
        }

        // Add totals row
        const totalCost = doc.products.reduce(
          (sum, product) => sum + product.totalCostAfterVat,
          0
        );
        const totalsRow = worksheet.addRow([
          "",
          "TOTAL",
          "",
          "",
          "",
          "",
          totalCost,
          "",
        ]);

        totalsRow.getCell(2).style = {
          font: { bold: true },
          alignment: { horizontal: "right" },
        };

        totalsRow.getCell(7).style = {
          ...styles.currency,
          font: { bold: true },
          border: {
            top: { style: "double", color: { argb: "FF000000" } },
          },
        };

        currentRow++;
      }

      // Add Appended Proposals section
      if (doc.appendedProposals && doc.appendedProposals.length > 0) {
        const proposalSectionRow = worksheet.addRow(["APPENDED PROPOSALS"]);
        worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
        proposalSectionRow.eachCell((cell) => {
          cell.style = styles.sectionHeader;
        });
        proposalSectionRow.height = 22;
        currentRow++;

        // Calculate column widths for proposals table based on content
        const proposalColumnWidths = [
          { min: 5, max: 10 }, // No
          { min: 15, max: 40 }, // Task
          { min: 15, max: 20 }, // Cost Center
          { min: 15, max: 20 }, // Date of Error
          { min: 20, max: 50 }, // Description
          { min: 15, max: 20 }, // Direction
          { min: 15, max: 40 }, // File
        ];

        // Proposal headers
        const proposalHeaders = [
          "No.",
          "Công việc",
          "Trạm",
          "Ngày xảy ra lỗi",
          "Mô tả",
          "Hướng xử lý",
          "Tệp tin đính kèm",
        ];
        const proposalHeaderRow = worksheet.addRow(proposalHeaders);
        proposalHeaderRow.eachCell((cell) => {
          cell.style = styles.header;
        });
        currentRow++;

        // Track maximum content lengths for auto-sizing
        const proposalContentLengths = [0, 0, 0, 0, 0, 0, 0];

        // Proposal data with improved formatting
        doc.appendedProposals.forEach((proposal, idx) => {
          const fileLink = proposal.fileMetadata?.link;
          const fileName = proposal.fileMetadata?.name || "None";

          const fileCellValue = fileLink
            ? { text: fileName, hyperlink: fileLink }
            : fileName;

          const proposalRow = worksheet.addRow([
            idx + 1,
            proposal.task,
            proposal.costCenter,
            proposal.dateOfError,
            proposal.detailsDescription,
            proposal.direction,
            fileCellValue,
          ]);

          // Apply row styling (alternating colors)
          const rowStyle = idx % 2 === 0 ? styles.rowEven : styles.rowOdd;
          proposalRow.eachCell((cell) => {
            cell.style = { ...styles.cellBorder, ...rowStyle };
          });

          // Ensure date formatting if available
          if (proposal.dateOfError) {
            proposalRow.getCell(4).style = {
              ...proposalRow.getCell(4).style,
              ...styles.date,
            };
          }

          // Track content lengths for auto-sizing
          const rowValues = [
            String(idx + 1),
            proposal.task || "",
            proposal.costCenter || "",
            proposal.dateOfError
              ? new Date(proposal.dateOfError).toLocaleDateString()
              : "",
            proposal.detailsDescription || "",
            proposal.direction || "",
            proposal.fileMetadata?.name || "None",
          ];

          rowValues.forEach((value, i) => {
            proposalContentLengths[i] = Math.max(
              proposalContentLengths[i],
              value.length
            );
          });

          currentRow++;
        });

        // Auto-adjust column widths for this proposals table
        for (let i = 0; i < proposalColumnWidths.length; i++) {
          const columnIndex = i + 1; // 1-based index for Excel
          const column = worksheet.getColumn(columnIndex);
          const headerLength = proposalHeaders[i]?.length || 0;
          const contentLength = Math.max(
            proposalContentLengths[i],
            headerLength
          );
          const finalWidth = Math.min(
            Math.max(contentLength + 2, proposalColumnWidths[i].min),
            proposalColumnWidths[i].max
          );
          column.width = finalWidth;
        }
      }

      // Add Approvers section with improved styling
      if (doc.approvers && doc.approvers.length > 0) {
        const approverSectionRow = worksheet.addRow(["APPROVERS"]);
        worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
        approverSectionRow.eachCell((cell) => {
          cell.style = styles.sectionHeader;
        });
        approverSectionRow.height = 22;
        currentRow++;

        // Calculate column widths for approvers table based on content
        const approverColumnWidths = [
          { min: 5, max: 10 }, // No
          { min: 20, max: 30 }, // Approver
          { min: 15, max: 25 }, // Sub Role
          { min: 15, max: 20 }, // Status
          { min: 20, max: 25 }, // Approval Date
        ];

        // Approver headers
        const approverHeaders = [
          "No.",
          "Người phê duyệt",
          "Vai trò",
          "Tình trạng",
          "Ngày phê duyệt",
        ];
        const approverHeaderRow = worksheet.addRow(approverHeaders);
        approverHeaderRow.eachCell((cell) => {
          cell.style = styles.header;
        });
        currentRow++;

        // Track maximum content lengths for auto-sizing
        const approverContentLengths = [0, 0, 0, 0, 0];

        // Approver data with improved styling
        doc.approvers.forEach((approver, idx) => {
          const approval = doc.approvedBy.find(
            (a) =>
              a.user && a.user._id.toString() === approver.approver.toString()
          );

          const approverRow = worksheet.addRow([
            idx + 1,
            approver.username,
            approver.subRole,
            approval ? "Approved" : "Pending",
            approval?.approvalDate || "",
          ]);

          // Apply row styling (alternating colors)
          const rowStyle = idx % 2 === 0 ? styles.rowEven : styles.rowOdd;
          approverRow.eachCell((cell) => {
            cell.style = { ...styles.cellBorder, ...rowStyle };
          });

          // Style status cell
          const statusCell = approverRow.getCell(4);
          if (approval) {
            statusCell.style = {
              ...statusCell.style,
              ...styles.status.approved,
            };
          } else {
            statusCell.style = {
              ...statusCell.style,
              ...styles.status.pending,
            };
          }

          // Apply date formatting if available
          if (approval?.approvalDate) {
            approverRow.getCell(5).style = {
              ...approverRow.getCell(5).style,
              ...styles.date,
            };
          }

          // Track content lengths for auto-sizing
          const rowValues = [
            String(idx + 1),
            approver.username || "",
            approver.subRole || "",
            approval ? "Approved" : "Pending",
            approval?.approvalDate
              ? new Date(approval.approvalDate).toLocaleDateString()
              : "",
          ];

          rowValues.forEach((value, i) => {
            approverContentLengths[i] = Math.max(
              approverContentLengths[i],
              value.length
            );
          });

          currentRow++;
        });

        // Auto-adjust column widths for this approvers table
        for (let i = 0; i < approverColumnWidths.length; i++) {
          const columnIndex = i + 1; // 1-based index for Excel
          const column = worksheet.getColumn(columnIndex);
          const headerLength = approverHeaders[i]?.length || 0;
          const contentLength = Math.max(
            approverContentLengths[i],
            headerLength
          );
          const finalWidth = Math.min(
            Math.max(contentLength + 2, approverColumnWidths[i].min),
            approverColumnWidths[i].max
          );
          column.width = finalWidth;
        }
      }

      // Add separator between documents
      if (docIndex < documents.length - 1) {
        const spacerRow = worksheet.addRow([]);
        spacerRow.height = 20;
        currentRow++;
      }
    });

    // Add summary information at the bottom
    currentRow += 2;
    const summaryTitleRow = worksheet.addRow(["EXPORT SUMMARY"]);
    worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
    summaryTitleRow.eachCell((cell) => {
      cell.style = styles.sectionHeader;
    });
    summaryTitleRow.height = 22;
    currentRow++;

    // Add summary data
    worksheet.addRow(["Total Documents", documents.length]);
    currentRow++;

    const approvedCount = documents.filter(
      (doc) => doc.status === "Approved"
    ).length;
    worksheet.addRow(["Approved Documents", approvedCount]);
    currentRow++;

    const pendingCount = documents.filter(
      (doc) => doc.status !== "Approved" && doc.status !== "Suspended"
    ).length;
    worksheet.addRow(["Pending Documents", pendingCount]);
    currentRow++;

    const suspendedCount = documents.filter(
      (doc) => doc.status === "Suspended"
    ).length;
    worksheet.addRow(["Suspended Documents", suspendedCount]);
    currentRow++;

    const totalAmount = documents.reduce(
      (sum, doc) => sum + doc.grandTotalCost,
      0
    );
    const totalRow = worksheet.addRow(["Total Amount", totalAmount]);
    totalRow.getCell(2).style = styles.currency;
    currentRow++;

    // Add export information
    currentRow += 2;
    worksheet.addRow(["Generated By", "Document Management System"]);
    currentRow++;
    worksheet.addRow(["Date", new Date().toLocaleString()]);
    currentRow++;

    // Freeze headers for better navigation
    worksheet.views = [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: 5, // Freeze after title, main document header, and document column headers
        activeCell: "A6",
        showGridLines: true,
      },
    ];

    // Auto filter
    worksheet.autoFilter = {
      from: "A4",
      to: `${String.fromCharCode(64 + worksheet.columns.length)}4`,
    };

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=purchasing_documents_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );

    // Auto-fit columns based on content
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      // Add a buffer for padding
      column.width = Math.min(maxLength + 2, 50); // Cap width at 50 to avoid excessive width
    });

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting documents:", err);
    res.status(500).json({
      success: false,
      message: "Error exporting documents",
      error: err.message,
    });
  }
};
//// END OF PURCHASING DOCUMENT CONTROLLER

//// PAYMENT DOCUMENT CONTROLLER
exports.getPaymentDocumentForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const paymentDocuments = await PaymentDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      paymentDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    res.json({
      paymentDocuments: sortedDocuments,
    });
  } catch (err) {
    console.error("Error fetching payment documents:", err);
    res.status(500).send("Error fetching payment documents");
  }
};
exports.getPaymentDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PaymentDocument.findById(id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching payment document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updatePaymentDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      totalPayment,
      paymentDeadline,
    } = req.body;
    const file = req.file;

    const doc = await PaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    // Check if the name has changed and update the tag if needed
    if (name && name !== doc.name) {
      // Format the update date for the tag
      const now = moment().tz("Asia/Bangkok");
      const updateDateForTag = now.format("DDMMYYYYHHmmss");
      // Create the new tag by combining name and formatted date
      doc.tag = `${name}${updateDateForTag}`;
    }

    // Update basic fields
    doc.name = name;
    doc.content = content;
    doc.costCenter = costCenter;
    doc.paymentMethod = paymentMethod;
    doc.totalPayment = parseFloat(totalPayment);
    doc.paymentDeadline = paymentDeadline;

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };
      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };
      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating payment document:", error);
    res.status(500).json({ message: "Error updating document" });
  }
};
exports.updatePaymentDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const doc = await PaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công.");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
exports.massUpdatePaymentDocumentDeclaration = async (req, res) => {
  const { documentIds, declaration } = req.body;

  try {
    // Check user role
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Validate input
    if (
      !documentIds ||
      !Array.isArray(documentIds) ||
      documentIds.length === 0
    ) {
      return res.status(400).json({ message: "Invalid document IDs provided" });
    }

    if (!declaration || typeof declaration !== "string") {
      return res.status(400).json({ message: "Invalid declaration provided" });
    }

    // Update all documents
    const result = await PaymentDocument.updateMany(
      { _id: { $in: documentIds } }, // Filter by document IDs
      { declaration } // Update declaration field
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "No documents found or updated" });
    }

    res.send(`Kê khai cập nhật thành công cho ${result.modifiedCount} phiếu.`);
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
//// END OF PAYMENT DOCUMENT CONTROLLER

//// ADVANCE PAYMENT DOCUMENT CONTROLLER
exports.getAdvancePaymentDocumentForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const advancePaymentDocuments = await AdvancePaymentDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      advancePaymentDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    res.json({
      advancePaymentDocuments: sortedDocuments,
    });
  } catch (err) {
    console.error("Error fetching advance payment documents:", err);
    res.status(500).send("Error fetching advance payment documents");
  }
};
exports.getAdvancePaymentDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await AdvancePaymentDocument.findById(id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching payment document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updateAdvancePaymentDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      advancePayment,
      paymentDeadline,
    } = req.body;
    const file = req.file;

    const doc = await AdvancePaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    // Check if the name has changed and update the tag if needed
    if (name && name !== doc.name) {
      // Format the update date for the tag
      const now = moment().tz("Asia/Bangkok");
      const updateDateForTag = now.format("DDMMYYYYHHmmss");
      // Create the new tag by combining name and formatted date
      doc.tag = `${name}${updateDateForTag}`;
    }

    // Update basic fields
    doc.name = name;
    doc.content = content;
    doc.costCenter = costCenter;
    doc.paymentMethod = paymentMethod;
    doc.advancePayment = parseFloat(advancePayment);
    doc.paymentDeadline = paymentDeadline;

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };
      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };
      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating payment document:", error);
    res.status(500).json({ message: "Error updating document" });
  }
};
exports.updateAdvancePaymentDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const doc = await AdvancePaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công.");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
exports.massUpdateAdvancePaymentDocumentDeclaration = async (req, res) => {
  const { documentIds, declaration } = req.body;

  try {
    // Check user role
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Validate input
    if (
      !documentIds ||
      !Array.isArray(documentIds) ||
      documentIds.length === 0
    ) {
      return res.status(400).json({ message: "Invalid document IDs provided" });
    }

    if (!declaration || typeof declaration !== "string") {
      return res.status(400).json({ message: "Invalid declaration provided" });
    }

    // Update all documents
    const result = await AdvancePaymentDocument.updateMany(
      { _id: { $in: documentIds } }, // Filter by document IDs
      { declaration } // Update declaration field
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "No documents found or updated" });
    }

    res.send(`Kê khai cập nhật thành công cho ${result.modifiedCount} phiếu.`);
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
//// END OF ADVANCE PAYMENT DOCUMENT CONTROLLER

//// ADVANCE PAYMENT RECLAIM DOCUMENT CONTROLLER
exports.getAdvancePaymentReclaimDocumentForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const advancePaymentReclaimDocuments =
      await AdvancePaymentReclaimDocument.find(
        documentUtils.filterDocumentsByUserAccess(userId, userRole)
      ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      advancePaymentReclaimDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    res.json({
      advancePaymentReclaimDocuments: sortedDocuments,
    });
  } catch (err) {
    console.error("Error fetching advance payment documents:", err);
    res.status(500).send("Error fetching advance payment documents");
  }
};
exports.getAdvancePaymentReclaimDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await AdvancePaymentReclaimDocument.findById(id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching payment document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updateAdvancePaymentReclaimDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      advancePaymentReclaim,
      paymentDeadline,
    } = req.body;
    const file = req.file;

    const doc = await AdvancePaymentReclaimDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    // Check if the name has changed and update the tag if needed
    if (name && name !== doc.name) {
      // Format the update date for the tag
      const now = moment().tz("Asia/Bangkok");
      const updateDateForTag = now.format("DDMMYYYYHHmmss");
      // Create the new tag by combining name and formatted date
      doc.tag = `${name}${updateDateForTag}`;
    }

    // Update basic fields
    doc.name = name;
    doc.content = content;
    doc.costCenter = costCenter;
    doc.paymentMethod = paymentMethod;
    doc.advancePaymentReclaim = parseFloat(advancePaymentReclaim);
    doc.paymentDeadline = paymentDeadline;

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };
      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };
      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating payment document:", error);
    res.status(500).json({ message: "Error updating document" });
  }
};
exports.updateAdvancePaymentReclaimDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const doc = await AdvancePaymentReclaimDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công.");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
exports.massUpdateAdvancePaymentReclaimDocumentDeclaration = async (
  req,
  res
) => {
  const { documentIds, declaration } = req.body;

  try {
    // Check user role
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Validate input
    if (
      !documentIds ||
      !Array.isArray(documentIds) ||
      documentIds.length === 0
    ) {
      return res.status(400).json({ message: "Invalid document IDs provided" });
    }

    if (!declaration || typeof declaration !== "string") {
      return res.status(400).json({ message: "Invalid declaration provided" });
    }

    // Update all documents
    const result = await AdvancePaymentReclaimDocument.updateMany(
      { _id: { $in: documentIds } }, // Filter by document IDs
      { declaration } // Update declaration field
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "No documents found or updated" });
    }

    res.send(`Kê khai cập nhật thành công cho ${result.modifiedCount} phiếu.`);
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};
//// END OF ADVANCE PAYMENT RECLAIM DOCUMENT CONTROLLER

//// DELIVERY DOCUMENT CONTROLLER
// Fetch all Delivery Documents
exports.getDeliveryDocumentsForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const deliveryDocuments = await DeliveryDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      deliveryDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    // Calculate counts for approved and unapproved documents
    const { approvedDocument, unapprovedDocument } =
      documentUtils.countDocumentsByStatus(sortedDocuments);

    res.json({
      deliveryDocuments: sortedDocuments,
      approvedDocument,
      unapprovedDocument,
    });
  } catch (err) {
    console.error("Error fetching delivery documents:", err);
    res.status(500).send("Error fetching delivery documents");
  }
};
// Fetch a specific Delivery Document by ID
exports.getDeliveryDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await DeliveryDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching delivery document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
// Update a Delivery Document
exports.updateDeliveryDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    // Parse the products JSON string into an object
    let products;
    try {
      products = JSON.parse(req.body.products);
    } catch (error) {
      return res.status(400).json({ message: "Invalid products data format" });
    }

    // Parse grandTotalCost as a number
    const grandTotalCost = parseFloat(req.body.grandTotalCost);
    const name = req.body.name;
    const costCenter = req.body.costCenter;

    // Parse appendedProposals if it exists
    let appendedProposals;
    if (req.body.appendedProposals) {
      try {
        appendedProposals = JSON.parse(req.body.appendedProposals);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid appendedProposals data format" });
      }
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    const doc = await DeliveryDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update basic fields
    doc.products = products;
    doc.grandTotalCost = grandTotalCost;
    doc.name = name;
    doc.costCenter = costCenter;
    if (appendedProposals) {
      doc.appendedProposals = appendedProposals;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
          // Continue execution even if file deletion fails
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };
      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };

      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    await doc.save();
    res.json({
      message: "Document updated successfully",
      document: doc,
    });
  } catch (error) {
    console.error("Error updating delivery document:", error);
    res.status(500).json({
      message: "Error updating document",
      error: error.message,
    });
  }
};
//// END OF DELIVERY DOCUMENT CONTROLLER

//// PROJECT PROPOSAL DOCUMENT CONTROLLER
// Get all approved project proposals
exports.getApprovedProjectProposals = async (req, res) => {
  try {
    const approvedProposals = await ProjectProposalDocument.find({
      status: "Approved",
    });
    res.json(approvedProposals);
  } catch (err) {
    console.error("Error fetching approved project proposals:", err);
    res.send("Error fetching approved project proposals");
  }
};

// Get project proposal by ID
exports.getProjectProposalById = async (req, res) => {
  try {
    const proposal = await ProjectProposalDocument.findById(req.params.id);
    if (!proposal) return res.send("Project proposal not found");
    res.json(proposal);
  } catch (err) {
    console.error("Error fetching project proposal:", err);
    res.send("Error fetching project proposal");
  }
};

// Get project proposals for separated view
exports.getProjectProposalsForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username; // Get username from request

    // Find documents that the user has access to
    const projectProposals = await ProjectProposalDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    ).populate("submittedBy approvers.approver approvedBy.user");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      projectProposals,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    // Calculate counts for approved and unapproved documents
    const { approvedDocument, unapprovedDocument } =
      documentUtils.countDocumentsByStatus(sortedDocuments);

    res.json({
      projectProposals: sortedDocuments,
      approvedDocument,
      unapprovedDocument,
    });
  } catch (err) {
    console.error("Error fetching project proposals:", err);
    res.status(500).send("Error fetching project proposals");
  }
};

// Get specific project proposal by ID
exports.getProjectProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await ProjectProposalDocument.findById(id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching project proposal:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};

// Update a project proposal
exports.updateProjectProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    // Parse the content JSON string into an object
    let content;
    try {
      content = JSON.parse(req.body.content);
    } catch (error) {
      return res.status(400).json({ message: "Invalid content data format" });
    }

    // Parse approvers if it exists
    let approvers;
    if (req.body.approvers) {
      try {
        approvers = JSON.parse(req.body.approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    const doc = await ProjectProposalDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update basic fields
    doc.title = req.body.title;
    doc.name = req.body.name;
    doc.content = content;
    doc.groupName = req.body.groupName;
    doc.projectName = req.body.projectName;

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Handle file update if provided
    if (file) {
      // Delete old file from Google Drive if it exists
      if (doc.fileMetadata?.driveFileId) {
        try {
          await drive.files.delete({
            fileId: doc.fileMetadata.driveFileId,
          });
        } catch (error) {
          console.error("Error deleting old file:", error);
        }
      }

      // Upload new file
      const fileMetadata = {
        name: file.originalname,
        parents: [process.env.GOOGLE_DRIVE_DOCUMENT_ATTACHED_FOLDER_ID],
      };

      const media = {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      };

      const driveResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      // Update file permissions
      await drive.permissions.create({
        fileId: driveResponse.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Update document with new file metadata
      doc.fileMetadata = {
        driveFileId: driveResponse.data.id,
        name: file.originalname,
        link: driveResponse.data.webViewLink,
      };
    }

    await doc.save();
    res.json({
      message: "Document updated successfully",
      document: doc,
    });
  } catch (error) {
    console.error("Error updating project proposal:", error);
    res.status(500).json({
      message: "Error updating document",
      error: error.message,
    });
  }
};

// Update project proposal declaration
exports.updateProjectProposalDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (
      !["approver", "headOfAccounting", "headOfPurchasing"].includes(
        req.user.role
      )
    ) {
      return res.send("Access denied. You don't have permission to access.");
    }

    const doc = await ProjectProposalDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();
    res.send("Declaration updated successfully");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};

// Suspend project proposal
exports.suspendProjectProposal = async (req, res) => {
  const { id } = req.params;
  const { suspendReason } = req.body;

  try {
    if (req.user.role !== "director") {
      return res.send(
        "Access denied. Only director can suspend project proposals."
      );
    }

    const document = await ProjectProposalDocument.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Revert and lock all approval progress
    document.approved = false;
    document.approvedBy = [];
    document.status = "Suspended";
    document.suspendReason = suspendReason;

    await ProjectProposalDocument.findByIdAndUpdate(id, document);
    res.send("Document has been suspended successfully.");
  } catch (err) {
    console.error("Error suspending document:", err);
    res.status(500).send("Error suspending document");
  }
};

// Open project proposal
exports.openProjectProposal = async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user.role !== "director") {
      return res.send(
        "Access denied. Only director can reopen project proposals."
      );
    }

    const document = await ProjectProposalDocument.findById(id);
    if (!document) {
      return res.status(404).send("Document not found");
    }

    // Revert the suspension
    document.status = "Pending";
    document.suspendReason = "";

    await ProjectProposalDocument.findByIdAndUpdate(id, document);
    res.send("Document has been reopened successfully.");
  } catch (err) {
    console.error("Error reopening document:", err);
    res.status(500).send("Error reopening document");
  }
};
//// END OF PROJECT PROPOSAL DOCUMENT CONTROLLER
