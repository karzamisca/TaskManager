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
const uploadDir = "uploads/"; // Define the upload directory

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Ensure the original filename is properly decoded
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + originalName);
  },
});

const upload = multer({
  storage: storage,
  // Add file filter to handle encoding
  fileFilter: function (req, file, cb) {
    // Ensure proper encoding handling
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    cb(null, true);
  },
});
require("dotenv").config();
const axios = require("axios");

const CHATFUEL_BOT_ID = process.env.CHATFUEL_BOT_ID;
const CHATFUEL_TOKEN = process.env.CHATFUEL_TOKEN;
const CHATFUEL_BLOCK_ID = process.env.CHATFUEL_BLOCK_ID;

const DOCUMENT_TYPE_FOLDERS = {
  "Generic Document": process.env.FILEBROWSER_DOCUMENT_GENERIC_UPLOAD_FOLDER,
  "Proposal Document": process.env.FILEBROWSER_DOCUMENT_PROPOSAL_UPLOAD_FOLDER,
  "Purchasing Document":
    process.env.FILEBROWSER_DOCUMENT_PURCHASING_UPLOAD_FOLDER,
  "Delivery Document": process.env.FILEBROWSER_DOCUMENT_DELIVERY_UPLOAD_FOLDER,
  "Payment Document": process.env.FILEBROWSER_DOCUMENT_PAYMENT_UPLOAD_FOLDER,
  "Advance Payment Document":
    process.env.FILEBROWSER_DOCUMENT_PAYMENT_ADVANCE_UPLOAD_FOLDER,
  "Advance Payment Reclaim Document":
    process.env.FILEBROWSER_DOCUMENT_PAYMENT_ADVANCE_RECLAIM_UPLOAD_FOLDER,
  "Project Proposal Document":
    process.env.FILEBROWSER_DOCUMENT_PROPOSAL_PROJECT_UPLOAD_FOLDER,
};

// Document type to share code mapping
const DOCUMENT_TYPE_SHARE_CODES = {
  "Generic Document":
    process.env.FILEBROWSER_DOCUMENT_GENERIC_UPLOAD_FOLDER_SHARE_CODE,
  "Proposal Document":
    process.env.FILEBROWSER_DOCUMENT_PROPOSAL_UPLOAD_FOLDER_SHARE_CODE,
  "Purchasing Document":
    process.env.FILEBROWSER_DOCUMENT_PURCHASING_UPLOAD_FOLDER_SHARE_CODE,
  "Delivery Document":
    process.env.FILEBROWSER_DOCUMENT_DELIVERY_UPLOAD_FOLDER_SHARE_CODE,
  "Payment Document":
    process.env.FILEBROWSER_DOCUMENT_PAYMENT_UPLOAD_FOLDER_SHARE_CODE,
  "Advance Payment Document":
    process.env.FILEBROWSER_DOCUMENT_PAYMENT_ADVANCE_UPLOAD_FOLDER_SHARE_CODE,
  "Advance Payment Reclaim Document":
    process.env
      .FILEBROWSER_DOCUMENT_PAYMENT_ADVANCE_RECLAIM_UPLOAD_FOLDER_SHARE_CODE,
  "Project Proposal Document":
    process.env.FILEBROWSER_DOCUMENT_PROPOSAL_PROJECT_UPLOAD_FOLDER_SHARE_CODE,
};

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
        userRole === "director" ||
        userRole === "deputyDirector" ||
        userRole === "headOfPurchasing" ||
        userRole === "captainOfPurchasing"
          ? [{}] // Include all documents if user is headOfAccounting or superAdmin
          : []),
      ],
    };
  },

  // New function to filter documents based on username constraints with hierarchy
  filterDocumentsByUsername: (documents, username) => {
    // HoangLong can see everything
    if (username === "HoangLong") {
      return documents;
    }
    // If username is not one of the restricted users, return all documents
    const restrictedUsers = [
      "NguyenHongNhuThuy",
      "HoangNam",
      "PhongTran",
      "HoaVu",
      "HoangLong",
    ];

    if (!restrictedUsers.includes(username)) {
      return documents;
    }

    // Define who must approve BEFORE each user
    const prerequisiteApprovers = {
      PhongTran: ["HoangNam"],
      NguyenHongNhuThuy: ["HoangNam", "PhongTran"],
      HuynhDiep: ["HoangNam", "PhongTran", "NguyenHongNhuThuy"],
      HoaVu: ["HoangNam", "PhongTran", "NguyenHongNhuThuy"],
      HoangLong: ["HoangNam", "PhongTran", "NguyenHongNhuThuy", "HoaVu"],
    };

    return documents.filter((doc) => {
      // Safely get approvers with null checks
      const allApprovers = doc.approvers || [];
      const approvedBy = doc.approvedBy || [];

      // Get usernames of approvers (with null checks)
      const allApproverUsernames = allApprovers
        .map((approver) => {
          if (!approver || !approver.approver) return null;
          return typeof approver.approver === "object"
            ? approver.approver.username
            : approver.approver.toString();
        })
        .filter(Boolean);

      // Get usernames of approved users (with null checks)
      const approvedUsernames = approvedBy
        .map((approval) => {
          if (!approval || !approval.user) return null;
          return typeof approval.user === "object"
            ? approval.user.username
            : approval.user.toString();
        })
        .filter(Boolean);

      // Check if current user submitted this document
      let currentUserIsSubmitter = false;
      if (doc.submittedBy) {
        if (typeof doc.submittedBy === "object" && doc.submittedBy.username) {
          currentUserIsSubmitter = doc.submittedBy.username === username;
        } else if (typeof doc.submittedBy === "string") {
          // If submittedBy is just an ID string, we can't compare usernames
          // You might need to modify this part if you need to handle this case
        }
      }

      if (currentUserIsSubmitter) {
        return true;
      }

      // Check if current user has already approved
      if (approvedUsernames.includes(username)) {
        return true;
      }

      // Check stages if they exist
      if (doc.stages && doc.stages.length > 0) {
        const isStageApprover = doc.stages.some((stage) => {
          const stageApprovers = stage.approvers || [];
          const stageApprovedBy = stage.approvedBy || [];

          const isApprover = stageApprovers.some(
            (a) => a.username === username
          );
          const hasApproved = stageApprovedBy.some(
            (a) => a.username === username
          );
          return isApprover && !hasApproved;
        });

        if (isStageApprover) {
          return true;
        }
      }

      // Find pending approvers (those not in approvedBy)
      const pendingApprovers = allApprovers.filter((approver) => {
        if (!approver || !approver.approver) return false;
        const approverUsername =
          typeof approver.approver === "object"
            ? approver.approver.username
            : approver.approver.toString();
        return !approvedUsernames.includes(approverUsername);
      });

      const pendingUsernames = pendingApprovers
        .map((approver) => {
          if (!approver || !approver.approver) return null;
          return typeof approver.approver === "object"
            ? approver.approver.username
            : approver.approver.toString();
        })
        .filter(Boolean);

      if (pendingApprovers.length === 0) {
        return true;
      }

      const allPendingAreRestricted = pendingApprovers.every((approver) => {
        if (!approver || !approver.approver) return false;
        const approverUsername =
          typeof approver.approver === "object"
            ? approver.approver.username
            : approver.approver.toString();
        return restrictedUsers.includes(approverUsername);
      });

      const currentUserIsPending = pendingUsernames.includes(username);

      // Check hierarchical approval constraints
      let hierarchyAllowsApproval = true;
      const requiredPredecessors = prerequisiteApprovers[username] || [];

      for (const requiredApprover of requiredPredecessors) {
        const isApproverForDoc =
          allApproverUsernames.includes(requiredApprover);
        if (isApproverForDoc && !approvedUsernames.includes(requiredApprover)) {
          hierarchyAllowsApproval = false;
          break;
        }
      }

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
      res.redirect("/documentSummaryUnapproved");
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

class FileBrowserClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  // Authenticate and get JWT token
  async authenticate(username, password) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/login`, {
        username: username,
        password: password,
      });

      this.token = response.data.token || response.data;
      return this.token;
    } catch (error) {
      console.error(
        "Authentication failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Upload a file from local path with custom filename
  async uploadFile(
    destinationPath,
    filePath,
    customFileName = null,
    override = true
  ) {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      // Use custom filename if provided, otherwise use the file's basename
      const fileName = customFileName || path.basename(filePath);
      const fullPath = destinationPath.endsWith("/")
        ? `${destinationPath}${fileName}`
        : `${destinationPath}/${fileName}`;

      const uploadUrl = `${this.baseUrl}/api/resources${fullPath}${
        override ? "?override=true" : ""
      }`;

      // Create a read stream instead of reading entire file into memory
      const fileStream = fs.createReadStream(filePath);
      const mimeType = this.getMimeType(fileName);

      const response = await axios.post(uploadUrl, fileStream, {
        headers: {
          "X-Auth": this.token,
          "Content-Type": mimeType,
          // Add content length if needed
          "Content-Length": fs.statSync(filePath).size,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        // Important: Don't let axios transform the data
        transformRequest: [(data) => data],
      });

      return {
        success: true,
        fileName: fileName,
        path: fullPath,
        downloadUrl: `${this.baseUrl}/api/raw${fullPath}`,
        size: fs.statSync(filePath).size,
      };
    } catch (error) {
      console.error(
        "Failed to upload file:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Alternative method using form data with custom filename
  async uploadFileWithFormData(
    destinationPath,
    filePath,
    customFileName = null,
    override = true
  ) {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const FormData = require("form-data");
      // Ensure destination path starts with a slash
      const normalizedPath = destinationPath.startsWith("/")
        ? destinationPath
        : `/${destinationPath}`;

      const fileName = customFileName || path.basename(filePath);
      const fullPath = normalizedPath.endsWith("/")
        ? `${normalizedPath}${fileName}`
        : `${normalizedPath}/${fileName}`;

      const uploadUrl = `${this.baseUrl}/api/resources${fullPath}${
        override ? "?override=true" : ""
      }`;

      const form = new FormData();
      form.append("file", fs.createReadStream(filePath), {
        filename: fileName,
        contentType: this.getMimeType(fileName),
      });

      const response = await axios.post(uploadUrl, form, {
        headers: {
          "X-Auth": this.token,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return {
        success: true,
        fileName: fileName,
        path: fullPath,
        downloadUrl: `${this.baseUrl}/api/raw${fullPath}`,
        size: fs.statSync(filePath).size,
      };
    } catch (error) {
      console.error(
        "Failed to upload file with form data:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Delete a file
  async deleteFile(filePath) {
    if (!this.token) {
      throw new Error("Not authenticated. Call authenticate() first.");
    }

    try {
      const response = await axios.delete(
        `${this.baseUrl}/api/resources${filePath}`,
        {
          headers: {
            "X-Auth": this.token,
          },
        }
      );
      return { success: true };
    } catch (error) {
      console.error(
        "Failed to delete file:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Enhanced MIME type detection
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      ".txt": "text/plain",
      ".json": "application/json",
      ".js": "text/javascript",
      ".html": "text/html",
      ".css": "text/css",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".pdf": "application/pdf",
      ".zip": "application/zip",
      ".mp4": "video/mp4",
      ".mp3": "audio/mpeg",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}

// Always create a fresh client - simple and reliable
async function getFileBrowserClient() {
  const client = new FileBrowserClient(process.env.FILEBROWSER_URL);
  await client.authenticate(
    process.env.FILEBROWSER_USERNAME,
    process.env.FILEBROWSER_PASSWORD
  );
  return client;
}
// Enhanced file upload handler that preserves original filename with timestamp
async function handleFileUpload(req) {
  if (!req.file) return null;

  try {
    // Validate file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      throw new Error("Uploaded file not found");
    }

    // Get file stats for validation
    const fileStats = fs.statSync(req.file.path);

    // Get authenticated FileBrowser client
    const client = await getFileBrowserClient();

    // Determine target folder based on document type
    const title = req.body.title;
    const targetFolder =
      DOCUMENT_TYPE_FOLDERS[title] ||
      process.env.FILEBROWSER_DEFAULT_UPLOAD_FOLDER;

    // Create unique filename with timestamp while preserving original name
    const originalFilename = req.file.originalname;
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -1); // Format: 2024-12-29T10-30-45-123
    const fileExtension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, fileExtension);
    const uniqueFilename = `${baseName}_${timestamp}${fileExtension}`;

    let uploadResult;
    try {
      // Try the stream method first with unique filename
      uploadResult = await client.uploadFile(
        targetFolder,
        req.file.path,
        uniqueFilename
      );
    } catch (streamError) {
      // If stream method fails, try form data method with unique filename
      uploadResult = await client.uploadFileWithFormData(
        targetFolder,
        req.file.path,
        uniqueFilename
      );
    }

    // Cleanup: Remove the local temp file
    fs.unlinkSync(req.file.path);

    // Generate public download URL using environment variable
    const shareCode = DOCUMENT_TYPE_SHARE_CODES[title];
    const publicDownloadUrl = shareCode
      ? `${client.baseUrl}/api/public/dl/${shareCode}/${uniqueFilename}`
      : uploadResult.downloadUrl;

    return {
      driveFileId: uniqueFilename,
      name: originalFilename,
      displayName: originalFilename,
      actualFilename: uniqueFilename,
      link: publicDownloadUrl,
      path: uploadResult.path,
      size: uploadResult.size,
      mimeType: req.file.mimetype,
      uploadTimestamp: timestamp,
    };
  } catch (error) {
    // Cleanup local file even if upload fails
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("File upload failed:", error.message);
    throw new Error(`File upload failed: ${error.message}`);
  }
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
  try {
    const { products, approvedProposals, costCenter } = req.body;
    const currentUser = req.user.username;

    // 1. Validate cost centers (document and product levels)
    const allowedCostCenters = await CostCenter.find({
      $or: [
        { allowedUsers: { $in: [currentUser] } },
        { allowedUsers: { $size: 0 } },
      ],
    }).lean();

    // Validate document cost center
    if (!allowedCostCenters.some((center) => center.name === costCenter)) {
      throw new Error(
        `You don't have permission to use cost center ${costCenter}`
      );
    }

    // 2. Process products with cost center validation
    if (!products || !Array.isArray(products)) {
      throw new Error("Invalid products data");
    }

    const allowedCenterNames = allowedCostCenters.map((center) => center.name);
    const processedProducts = products.map((product, index) => {
      // Validate product cost center
      if (
        !product.costCenter ||
        !allowedCenterNames.includes(product.costCenter)
      ) {
        throw new Error(
          `Invalid or unauthorized cost center '${
            product.costCenter
          }' for product ${index + 1}`
        );
      }

      const costPerUnit = parseFloat(product.costPerUnit) || 0;
      const amount = parseInt(product.amount) || 0;
      const vat = parseFloat(product.vat) || 0;
      const totalCost = costPerUnit * amount;
      const totalCostAfterVat = totalCost * (1 + vat / 100);

      return {
        productName: product.productName,
        costPerUnit,
        amount,
        vat,
        totalCost,
        totalCostAfterVat,
        costCenter: product.costCenter, // Store product-level cost center
        note: product.note || "",
      };
    });

    // 3. Calculate grand total
    const grandTotalCost = parseFloat(
      processedProducts.reduce(
        (acc, product) => acc + product.totalCostAfterVat,
        0
      )
    );

    // 4. Process appended proposals
    let processedProposals = [];
    if (approvedProposals && Array.isArray(approvedProposals)) {
      const proposalDocs = await ProposalDocument.find({
        _id: { $in: approvedProposals },
      }).lean();

      processedProposals = proposalDocs.map((doc) => ({
        task: doc.task,
        costCenter: doc.costCenter,
        groupName: doc.groupName,
        dateOfError: doc.dateOfError,
        detailsDescription: doc.detailsDescription,
        direction: doc.direction,
        fileMetadata: doc.fileMetadata,
        proposalId: doc._id,
      }));
    }

    // 5. Create and return the document
    return new PurchasingDocument({
      title: req.body.title || "Purchasing Document",
      name: req.body.name,
      costCenter,
      products: processedProducts,
      grandTotalCost,
      appendedProposals: processedProposals,
      groupName: req.body.groupName,
      projectName: req.body.projectName,
      submittedBy: req.user.id,
      approvers: approverDetails,
      fileMetadata: uploadedFileData,
      submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
      status: "Pending",
    });
  } catch (error) {
    console.error("Error creating purchasing document:", error);
    throw error; // Re-throw for route handler to catch
  }
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
          groupName: proposal.groupName,
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
        "captainOfAccounting",
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

      // Check if this is an AdvancePaymentDocument that needs a reclaim document
      if (document instanceof AdvancePaymentDocument) {
        await createAdvancePaymentReclaimAfterAdvancePaymentApproval(document);
      }
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
async function createAdvancePaymentReclaimAfterAdvancePaymentApproval(
  advancePaymentDoc
) {
  try {
    // Find deputy director user to set as approver
    const deputyDirector = await User.findOne({ role: "deputyDirector" });
    if (!deputyDirector) {
      console.error("Deputy director user not found");
      return;
    }

    // Calculate payment deadline 30 days from now
    const paymentDeadline = moment()
      .tz("Asia/Bangkok")
      .add(30, "days")
      .format("DD-MM-YYYY");

    // Prepare fileMetadata object - handle null case
    const fileMetadata = advancePaymentDoc.fileMetadata
      ? {
          driveFileId: advancePaymentDoc.fileMetadata.driveFileId || null,
          name: advancePaymentDoc.fileMetadata.name || null,
          link: advancePaymentDoc.fileMetadata.link || null,
          path: advancePaymentDoc.fileMetadata.path || null,
        }
      : undefined; // Use undefined instead of null to avoid validation error

    // Create the reclaim document
    const reclaimDoc = new AdvancePaymentReclaimDocument({
      tag: `Hoàn ứng_${advancePaymentDoc.tag}`,
      title: "Advance Payment Reclaim Document",
      name: `Hoàn ứng cho phiếu ${advancePaymentDoc.name}`,
      costCenter: advancePaymentDoc.costCenter || "Không có",
      content: `Hoàn ứng cho nội dung ${advancePaymentDoc.content}`,
      paymentMethod: advancePaymentDoc.paymentMethod,
      advancePaymentReclaim: advancePaymentDoc.advancePayment,
      paymentDeadline: paymentDeadline,
      extendedPaymentDeadline: paymentDeadline,
      fileMetadata: fileMetadata, // This will be undefined if no file was attached
      submittedBy: advancePaymentDoc.submittedBy,
      approvers: [
        {
          approver: deputyDirector._id,
          username: deputyDirector.username,
          subRole: "Thủ quỹ",
        },
      ],
      appendedPurchasingDocuments:
        advancePaymentDoc.appendedPurchasingDocuments,
      submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
      status: "Pending",
      groupName: advancePaymentDoc.groupName,
      projectName: advancePaymentDoc.projectName,
    });

    await reclaimDoc.save();
  } catch (err) {
    console.error("Error creating advance payment reclaim document:", err);
  }
}
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

    // Delete associated file if it exists
    if (document.fileMetadata?.path) {
      try {
        const client = await getFileBrowserClient();
        await client.deleteFile(document.fileMetadata.path);
      } catch (fileError) {
        console.error("Warning: Could not delete associated file:", fileError);
        // Continue with document deletion even if file deletion fails
      }
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
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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
        "Truy cập bị từ chối. Chỉ giám đốc mới có quyền mở lại phiếu."
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
    })
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    })
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
  let tempFilePath = null;

  try {
    const { id } = req.params;
    const {
      task,
      costCenter,
      dateOfError,
      detailsDescription,
      direction,
      groupName,
    } = req.body;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;

      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

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

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title;
      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
    }

    // Update the document
    doc.task = task;
    doc.costCenter = costCenter;
    doc.dateOfError = dateOfError;
    doc.detailsDescription = detailsDescription;
    doc.direction = direction;
    doc.groupName = groupName;

    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    await doc.save();
    res.json({ message: "Phiếu được cập nhật thành công." });
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
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    const document = await ProposalDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");
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
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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
    })
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    })
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    })
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    const document = await PurchasingDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");
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
  let tempFilePath = null;
  try {
    const { id } = req.params;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;
      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

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
    const groupName = req.body.groupName;

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

    // Fetch the current user
    const currentUser = req.user.username;

    // Fetch allowed cost centers for the current user
    const costCenters = await CostCenter.find({
      $or: [
        { allowedUsers: { $in: [currentUser] } },
        { allowedUsers: { $size: 0 } },
      ],
    });

    // Check if the document cost center is allowed for the user
    const isDocCostCenterAllowed = costCenters.some(
      (center) => center.name === costCenter
    );

    if (!isDocCostCenterAllowed) {
      return res.status(403).json({
        message: "You do not have permission to edit this cost center.",
      });
    }

    // Validate product cost centers
    const allowedCostCenters = costCenters.map((center) => center.name);
    for (const product of products) {
      if (
        product.costCenter &&
        !allowedCostCenters.includes(product.costCenter)
      ) {
        return res.status(403).json({
          message: `You don't have permission to use cost center ${product.costCenter} for products.`,
        });
      }
    }

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title;

      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
          // Continue execution even if file deletion fails
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
    }

    // Update basic fields
    doc.products = products.map((product) => ({
      ...product,
      totalCost: product.costPerUnit * product.amount,
      totalCostAfterVat:
        product.costPerUnit * product.amount * (1 + (product.vat || 0) / 100),
    }));
    doc.grandTotalCost = doc.products.reduce(
      (sum, product) => sum + product.totalCostAfterVat,
      0
    );
    doc.name = name;
    doc.costCenter = costCenter;
    doc.groupName = groupName;

    if (appendedProposals) {
      doc.appendedProposals = appendedProposals;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // Update file metadata if new file was uploaded
    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
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
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    const document = await PaymentDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
  let tempFilePath = null;
  try {
    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      totalPayment,
      paymentDeadline,
      approvers,
      stages,
      groupName,
    } = req.body;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;
      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

    const doc = await PaymentDocument.findById(id);
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

    // Parse approvers and stages if they exist
    let parsedApprovers = [];
    if (approvers) {
      try {
        parsedApprovers = JSON.parse(approvers);
      } catch (error) {
        return res
          .status(400)
          .json({ message: "Invalid approvers data format" });
      }
    }

    // Parse stages if it exists
    let parsedStages = [];
    if (stages) {
      try {
        parsedStages = JSON.parse(stages);

        // Verify no partially approved stages are being modified
        const existingDoc = await PaymentDocument.findById(id);
        if (existingDoc.stages) {
          for (let i = 0; i < existingDoc.stages.length; i++) {
            const existingStage = existingDoc.stages[i];
            const newStage = parsedStages[i];

            if (
              existingStage.approvedBy &&
              existingStage.approvedBy.length > 0
            ) {
              // Check if any critical fields are being modified
              const criticalFields = [
                "name",
                "amount",
                "deadline",
                "paymentMethod",
                "approvers",
              ];
              for (const field of criticalFields) {
                if (
                  JSON.stringify(existingStage[field]) !==
                  JSON.stringify(newStage[field])
                ) {
                  return res.status(400).json({
                    message: `Không thể chỉnh sửa giai đoạn đã có người phê duyệt (Giai đoạn ${
                      i + 1
                    })`,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid stages data format" });
      }
    }

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title; // Use document name as title for file upload

      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
    }

    // Check if the name has changed and update the tag if needed
    if (name && name !== doc.name) {
      const now = moment().tz("Asia/Bangkok");
      const updateDateForTag = now.format("DDMMYYYYHHmmss");
      doc.tag = `${name}${updateDateForTag}`;
    }

    // Update basic fields
    doc.name = name;
    doc.content = content;
    doc.costCenter = costCenter;
    doc.paymentMethod = paymentMethod;
    doc.totalPayment = parseFloat(totalPayment);
    doc.paymentDeadline = paymentDeadline;
    doc.groupName = groupName;

    // Update file metadata if new file uploaded
    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
    }

    // Update approvers if provided
    if (parsedApprovers) {
      doc.approvers = parsedApprovers;
    }

    // Update stages if provided
    if (parsedStages) {
      doc.stages = parsedStages;
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
      !["superAdmin", "headOfAccounting", "headOfPurchasing"].includes(
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
      !["superAdmin", "headOfAccounting", "headOfPurchasing"].includes(
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
exports.approvePaymentStage = async (req, res) => {
  const { docId, stageIndex } = req.params;

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
        "captainOfAccounting",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const document = await PaymentDocument.findById(docId);
    if (!document) {
      return res.send("Không tìm thấy phiếu thanh toán.");
    }

    // Check if stage exists
    if (!document.stages || document.stages.length <= stageIndex) {
      return res.send("Không tìm thấy giai đoạn thanh toán.");
    }

    const stage = document.stages[stageIndex];
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.send("Không tìm thấy người dùng.");
    }

    // Check if user is an approver for this stage
    const isStageApprover = stage.approvers.some(
      (approver) => approver.approver.toString() === req.user.id
    );

    if (!isStageApprover) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền phê duyệt giai đoạn này."
      );
    }

    // Check if user has already approved this stage
    const hasApproved = stage.approvedBy.some(
      (approver) => approver.user.toString() === req.user.id
    );

    if (hasApproved) {
      return res.send("Bạn đã phê duyệt giai đoạn này rồi.");
    }

    // Add approval
    stage.approvedBy.push({
      user: user.id,
      username: user.username,
      role: user.role,
      approvalDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    // Check if all stage approvers have approved
    if (stage.approvedBy.length === stage.approvers.length) {
      stage.status = "Approved";
    }

    await document.save();

    // Check if all stages are approved
    const allStagesApproved = document.stages.every(
      (s) => s.status === "Approved"
    );

    // If all stages are approved and document has approvers, allow document approval
    if (allStagesApproved && document.approvers.length > 0) {
      return res.send({
        message:
          "Giai đoạn đã được phê duyệt. Bạn có thể phê duyệt toàn bộ phiếu thanh toán.",
        canApproveDocument: true,
      });
    }

    return res.send({
      message:
        stage.status === "Approved"
          ? "Giai đoạn đã được phê duyệt hoàn toàn."
          : "Giai đoạn đã được phê duyệt thành công.",
      canApproveDocument: false,
    });
  } catch (err) {
    console.error("Error approving payment stage:", err);
    return res.send("Lỗi phê duyệt giai đoạn thanh toán.");
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
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    const document = await AdvancePaymentDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
  let tempFilePath = null;
  try {
    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      advancePayment,
      paymentDeadline,
      groupName,
    } = req.body;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;
      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

    const doc = await AdvancePaymentDocument.findById(id);
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

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title; // Use document name as title for file upload

      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
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
    doc.groupName = groupName;

    // Update file metadata if new file uploaded
    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating advance payment document:", error);
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
      )
        .populate("submittedBy", "username")
        .populate("approvers.approver", "username role")
        .populate("approvedBy.user", "username");

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
    const document = await AdvancePaymentReclaimDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
  let tempFilePath = null;
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      advancePaymentReclaim,
      paymentDeadline,
      groupName,
    } = req.body;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;
      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

    const doc = await AdvancePaymentReclaimDocument.findById(id);
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

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title; // Use document name as title for file upload

      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
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
    doc.groupName = groupName;

    // Update file metadata if new file uploaded
    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating advance payment reclaim document:", error);
    res.status(500).json({ message: "Error updating document" });
  }
};
exports.updateAdvancePaymentReclaimDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
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
exports.extendAdvancePaymentReclaimDeadline = async (req, res) => {
  const { id } = req.params;

  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const document = await AdvancePaymentReclaimDocument.findById(id);
    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu thu lại tạm ứng.");
    }

    // Determine which deadline to extend from
    const baseDeadline =
      document.extendedPaymentDeadline || document.paymentDeadline;

    if (!baseDeadline || baseDeadline === "Not specified") {
      return res
        .status(400)
        .send("Không thể gia hạn vì không có hạn trả hợp lệ.");
    }

    // Parse the base deadline (format DD-MM-YYYY)
    const baseDate = moment.tz(baseDeadline, "DD-MM-YYYY", "Asia/Bangkok");

    if (!baseDate.isValid()) {
      return res
        .status(400)
        .send(`Định dạng hạn trả không hợp lệ: ${baseDeadline}`);
    }

    // Calculate new deadline (30 days from base deadline)
    const newDeadline = baseDate.add(30, "days").format("DD-MM-YYYY");

    // Update the extended deadline
    document.extendedPaymentDeadline = newDeadline;
    await document.save();

    res.send(`Đã gia hạn hạn trả từ ${baseDeadline} đến ${newDeadline}`);
  } catch (err) {
    console.error("Error extending deadline:", err);
    res.status(500).send("Lỗi khi gia hạn hạn trả");
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
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    const document = await DeliveryDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");
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
  let tempFilePath = null;
  try {
    const { id } = req.params;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;
      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

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
    const groupName = req.body.groupName;

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

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title; // Use document name as title for file upload

      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
    }

    // Update basic fields
    doc.products = products;
    doc.grandTotalCost = grandTotalCost;
    doc.name = name;
    doc.costCenter = costCenter;
    doc.groupName = groupName;
    if (appendedProposals) {
      doc.appendedProposals = appendedProposals;
    }

    // Update file metadata if new file uploaded
    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
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
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

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
    const document = await ProjectProposalDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");
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
  let tempFilePath = null;
  try {
    const { id } = req.params;
    const file = req.file;

    // Store temp file path for cleanup
    if (file) {
      tempFilePath = file.path;
      // Verify file exists immediately
      if (!fs.existsSync(tempFilePath)) {
        throw new Error(`Uploaded file not found at: ${tempFilePath}`);
      }
    }

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

    // Handle file upload if new file provided
    let uploadedFileData = null;
    if (file) {
      req.body.title = doc.title;

      // Delete old file if exists
      if (doc.fileMetadata?.path) {
        try {
          const client = await getFileBrowserClient();
          await client.deleteFile(doc.fileMetadata.path);
        } catch (error) {
          console.error("Warning: Could not delete old file", error);
        }
      }

      // Upload new file
      uploadedFileData = await handleFileUpload(req);
    }

    // Update basic fields
    doc.name = req.body.name;
    doc.content = content;
    doc.groupName = req.body.groupName;
    doc.projectName = req.body.projectName;

    // Update file metadata if new file uploaded
    if (uploadedFileData) {
      doc.fileMetadata = uploadedFileData;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
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

//// SUMMARY CONTROLLER
exports.getUnapprovedDocumentsSummary = async (req, res) => {
  try {
    const userId = req._id;
    const username = req.user.username;
    const userRole = req.user.role;

    // Enhanced helper function to get unapproved documents with more details
    const getUnapprovedDocs = async (model, type) => {
      let queryConditions = {
        status: "Pending",
        $or: [
          { "approvers.approver": userId },
          { "stages.approvers.approver": userId },
        ],
        approvedBy: { $not: { $elemMatch: { user: userId } } },
      };

      const docs = await model
        .find(queryConditions)
        .populate("submittedBy", "username")
        .populate("approvers.approver", "username role")
        .populate("approvedBy.user", "username")
        .populate("stages.approvers.approver", "username role")
        .populate("stages.approvedBy.user", "username");

      // Apply username-specific filtering for restricted users
      const filteredDocs = documentUtils
        .filterDocumentsByUsername(docs, username, userRole)
        .filter((doc) => {
          // Additional filtering for stage approvers
          if (doc.stages && doc.stages.length > 0) {
            // Check if user is a pending stage approver
            const hasPendingStageApproval = doc.stages.some((stage) => {
              const isStageApprover = stage.approvers.some(
                (a) =>
                  a.approver._id.equals(userId) ||
                  (typeof a.approver === "string" &&
                    a.approver === userId.toString())
              );
              const hasApproved = stage.approvedBy.some(
                (a) =>
                  a.user._id.equals(userId) ||
                  (typeof a.user === "string" && a.user === userId.toString())
              );
              return isStageApprover && !hasApproved;
            });

            return (
              hasPendingStageApproval ||
              doc.approvers.some(
                (a) =>
                  a.approver._id.equals(userId) ||
                  (typeof a.approver === "string" &&
                    a.approver === userId.toString())
              )
            );
          }
          return true;
        });

      return {
        count: filteredDocs.length,
        documents: filteredDocs.map((doc) => ({
          id: doc._id,
          title: doc.title || type,
          tag: doc.tag ?? null,
          name: doc.name ?? null,
          task: doc.task ?? null,
          submittedBy: doc.submittedBy?.username || "Unknown",
          submissionDate: doc.submissionDate,
          stages: doc.stages?.map((stage) => ({
            name: stage.name,
            amount: stage.amount,
            status: stage.status,
            approvers: stage.approvers.map((a) => ({
              username:
                typeof a.approver === "object"
                  ? a.approver.username
                  : a.username,
              role: typeof a.approver === "object" ? a.approver.role : a.role,
            })),
            approvedBy: stage.approvedBy.map((a) => ({
              username:
                typeof a.user === "object" ? a.user.username : a.username,
              role: typeof a.user === "object" ? a.user.role : a.role,
            })),
          })),
        })),
        type,
      };
    };

    // Get unapproved documents for each type
    const summaries = await Promise.all([
      getUnapprovedDocs(Document, "Generic"),
      getUnapprovedDocs(ProposalDocument, "Proposal"),
      getUnapprovedDocs(PurchasingDocument, "Purchasing"),
      getUnapprovedDocs(DeliveryDocument, "Delivery"),
      getUnapprovedDocs(PaymentDocument, "Payment"),
      getUnapprovedDocs(AdvancePaymentDocument, "Advance Payment"),
      getUnapprovedDocs(AdvancePaymentReclaimDocument, "Advance Reclaim"),
      getUnapprovedDocs(ProjectProposalDocument, "Project Proposal"),
    ]);

    // Transform into a more usable format
    const result = summaries.reduce((acc, { type, count, documents }) => {
      acc[type.toLowerCase().replace(" ", "_")] = { count, documents };
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        summaries: result,
        user: {
          id: userId,
          username,
          role: userRole,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Error fetching unapproved documents summary:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching unapproved documents summary",
    });
  }
};
