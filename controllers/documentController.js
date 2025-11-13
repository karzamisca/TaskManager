// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const CostCenter = require("../models/CostCenter");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const ProposalDocument = require("../models/DocumentProposal.js");
const PurchasingDocument = require("../models/DocumentPurchasing.js");
const DeliveryDocument = require("../models/DocumentDelivery.js");
const ReceiptDocument = require("../models/DocumentReceipt.js");
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
  createReceiptDocTemplate,
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

// Nextcloud configuration
const NEXTCLOUD_BASE_URL = process.env.NEXTCLOUD_BASE_URL;
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME;
const NEXTCLOUD_PASSWORD = process.env.NEXTCLOUD_PASSWORD;
const NEXTCLOUD_WEBDAV_URL = `${NEXTCLOUD_BASE_URL}/remote.php/dav/files/${NEXTCLOUD_USERNAME}`;

// Document type to Nextcloud folder mapping
const DOCUMENT_TYPE_FOLDERS = {
  "Generic Document": process.env.NEXTCLOUD_DOCUMENT_GENERIC_UPLOAD_FOLDER,
  "Proposal Document": process.env.NEXTCLOUD_DOCUMENT_PROPOSAL_UPLOAD_FOLDER,
  "Purchasing Document":
    process.env.NEXTCLOUD_DOCUMENT_PURCHASING_UPLOAD_FOLDER,
  "Delivery Document": process.env.NEXTCLOUD_DOCUMENT_DELIVERY_UPLOAD_FOLDER,
  "Receipt Document": process.env.NEXTCLOUD_DOCUMENT_RECEIPT_UPLOAD_FOLDER,
  "Payment Document": process.env.NEXTCLOUD_DOCUMENT_PAYMENT_UPLOAD_FOLDER,
  "Advance Payment Document":
    process.env.NEXTCLOUD_DOCUMENT_PAYMENT_ADVANCE_UPLOAD_FOLDER,
  "Advance Payment Reclaim Document":
    process.env.NEXTCLOUD_DOCUMENT_PAYMENT_ADVANCE_RECLAIM_UPLOAD_FOLDER,
  "Project Proposal Document":
    process.env.NEXTCLOUD_DOCUMENT_PROPOSAL_PROJECT_UPLOAD_FOLDER,
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
        ...(userRole === "superAdmin" ||
        userRole === "director" ||
        userRole === "deputyDirector" ||
        userRole === "headOfPurchasing" ||
        userRole === "headOfAccounting" ||
        userRole === "captainOfPurchasing" ||
        userRole === "captainOfFinance" ||
        userRole === "captainOfAccounting"
          ? [{}] // Include all documents if user has included roles
          : []),
      ],
    };
  },

  // Filter documents based on username constraints with hierarchy
  filterDocumentsByUsername: (documents, username) => {
    // Who can see everything
    if (["HoangLong", "QuangKimNgan"].includes(username)) return documents;

    // If username is not one of the restricted users, return all documents
    const restrictedUsers = [
      "QuangKimNgan",
      "HoangNam",
      "PhongTran",
      "HoangLong",
    ];

    if (!restrictedUsers.includes(username)) {
      return documents;
    }

    // Define who must approve BEFORE each user
    const prerequisiteApprovers = {
      PhongTran: ["HoangNam"],
      QuangKimNgan: ["HoangNam", "PhongTran"],
      HoangLong: ["HoangNam", "PhongTran", "QuangKimNgan"],
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
      (await ReceiptDocument.findById(id)) ||
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
        case "Receipt Document":
          buffer = await createReceiptDocTemplate(doc);
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
  // Change from upload.single to upload.array
  upload.array("files", 10)(req, res, async (err) => {
    if (err) {
      console.error("Error uploading files:", err);
      return res.send("Error uploading files.");
    }

    const { title } = req.body;

    try {
      // Process approvers data
      const approverDetails = await processApprovers(req);

      // Handle multiple file uploads
      const uploadedFilesData = await handleMultipleFileUploads(req);

      // Route to appropriate document handler based on title
      let newDocument;

      switch (title) {
        case "Proposal Document":
          newDocument = await createProposalDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Purchasing Document":
          newDocument = await createPurchasingDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Delivery Document":
          newDocument = await createDeliveryDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Receipt Document":
          newDocument = await createReceiptDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Payment Document":
          newDocument = await createPaymentDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Advance Payment Document":
          newDocument = await createAdvancePaymentDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Advance Payment Reclaim Document":
          newDocument = await createAdvancePaymentReclaimDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        case "Project Proposal Document":
          newDocument = await createProjectProposalDocument(
            req,
            approverDetails,
            uploadedFilesData
          );
          break;
        default:
          newDocument = await createStandardDocument(
            req,
            approverDetails,
            uploadedFilesData
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

async function handleMultipleFileUploads(req) {
  if (!req.files || req.files.length === 0) return [];

  try {
    const client = getNextcloudClient();
    const title = req.body.title;
    const targetFolder = DOCUMENT_TYPE_FOLDERS[title] || "/Documents";

    const uploadPromises = req.files.map(async (file) => {
      // Validate file exists
      if (!fs.existsSync(file.path)) {
        throw new Error(`Uploaded file not found: ${file.originalname}`);
      }

      // Create unique filename with timestamp
      const originalFilename = file.originalname;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -1);
      const fileExtension = path.extname(originalFilename);
      const baseName = path.basename(originalFilename, fileExtension);
      const uniqueFilename = `${baseName}_${timestamp}${fileExtension}`;

      // Upload to Nextcloud
      const uploadResult = await client.uploadFile(
        file.path,
        targetFolder,
        uniqueFilename
      );

      // Cleanup local file
      fs.unlinkSync(file.path);

      return {
        driveFileId: uniqueFilename,
        name: originalFilename,
        displayName: originalFilename,
        actualFilename: uniqueFilename,
        link: uploadResult.downloadUrl,
        path: uploadResult.path,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType,
        uploadTimestamp: timestamp,
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    return uploadedFiles;
  } catch (error) {
    // Cleanup all local files on error
    if (req.files) {
      req.files.forEach((file) => {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    console.error("Nextcloud multiple file upload failed:", error.message);
    throw new Error(`File upload failed: ${error.message}`);
  }
}

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

class NextcloudClient {
  constructor(baseUrl, username, password) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.auth = Buffer.from(`${username}:${password}`).toString("base64");
    // Store cookies for session management
    this.cookies = {};
  }

  // Extract and store cookies from response
  storeCookies(response) {
    const setCookieHeader = response.headers["set-cookie"];
    if (setCookieHeader) {
      setCookieHeader.forEach((cookie) => {
        const [nameValue] = cookie.split(";");
        const [name, value] = nameValue.split("=");
        if (name && value) {
          this.cookies[name.trim()] = value.trim();
        }
      });
    }
  }

  // Get cookie header string
  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  // Create directory if it doesn't exist
  async ensureDirectoryExists(path) {
    try {
      const response = await axios.request({
        method: "MKCOL",
        url: `${this.baseUrl}/${path}`,
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/xml",
          ...(Object.keys(this.cookies).length > 0 && {
            Cookie: this.getCookieHeader(),
          }),
        },
      });
      this.storeCookies(response);
      return true;
    } catch (error) {
      if (error.response && error.response.status === 405) {
        // Directory already exists
        return true;
      }
      console.error(
        "Error creating directory:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Upload file to Nextcloud
  async uploadFile(localFilePath, remotePath, customFileName = null) {
    try {
      // Ensure directory exists
      const remoteDir = path.dirname(remotePath);
      await this.ensureDirectoryExists(remoteDir);

      const fileName = customFileName || path.basename(localFilePath);
      const fullRemotePath = remotePath.endsWith("/")
        ? `${remotePath}${fileName}`
        : `${remotePath}/${fileName}`;

      const fileData = fs.readFileSync(localFilePath);

      const response = await axios.put(
        `${this.baseUrl}/${fullRemotePath}`,
        fileData,
        {
          headers: {
            Authorization: `Basic ${this.auth}`,
            "Content-Type": "application/octet-stream",
            ...(Object.keys(this.cookies).length > 0 && {
              Cookie: this.getCookieHeader(),
            }),
          },
        }
      );

      this.storeCookies(response);

      // Get permanent share link - use enhanced method
      const shareLink = await this.ensurePermanentShare(fullRemotePath);

      return {
        success: true,
        fileName: fileName,
        path: fullRemotePath,
        downloadUrl: shareLink,
        size: fs.statSync(localFilePath).size,
        mimeType: this.getMimeType(fileName),
      };
    } catch (error) {
      console.error(
        "Failed to upload file to Nextcloud:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Method 1: Create permanent public share link with proper authentication
  async createPublicShare(filePath) {
    try {
      // First, try to get CSRF token if needed
      await this.initializeSession();

      // Create permanent share with no expiration date
      const shareParams = new URLSearchParams({
        path: filePath,
        shareType: "3", // Public link
        permissions: "1", // Read permission
        publicUpload: "false", // Disable upload
        password: "", // No password protection
        expireDate: "", // No expiration date (permanent)
      });

      const response = await axios.post(
        `${this.baseUrl.replace(
          "/remote.php/dav/files/" + this.username,
          ""
        )}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
        shareParams.toString(),
        {
          headers: {
            Authorization: `Basic ${this.auth}`,
            "OCS-APIRequest": "true",
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            ...(Object.keys(this.cookies).length > 0 && {
              Cookie: this.getCookieHeader(),
            }),
          },
        }
      );

      this.storeCookies(response);

      // Handle JSON response
      if (response.data && response.data.ocs && response.data.ocs.data) {
        const shareData = response.data.ocs.data;
        if (shareData.url) {
          console.log(`Created permanent share link: ${shareData.url}`);
          return shareData.url;
        }
      }

      // Handle XML response
      if (typeof response.data === "string") {
        const shareUrlMatch = response.data.match(/<url>(.*?)<\/url>/);
        if (shareUrlMatch) {
          console.log(`Created permanent share link: ${shareUrlMatch[1]}`);
          return shareUrlMatch[1];
        }
      }

      throw new Error("No share URL found in response");
    } catch (error) {
      console.error(
        "Failed to create public share:",
        error.response?.data || error.message
      );

      // Try alternative methods
      return await this.getAlternativeShareLink(filePath);
    }
  }

  // Method 2: Initialize session to get proper cookies
  async initializeSession() {
    try {
      const response = await axios.get(
        `${this.baseUrl.replace(
          "/remote.php/dav/files/" + this.username,
          ""
        )}/login`,
        {
          headers: {
            Authorization: `Basic ${this.auth}`,
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400,
        }
      );
      this.storeCookies(response);
    } catch (error) {
      // Ignore errors, this is just for session initialization
    }
  }

  // Method 3: Alternative share link approaches
  async getAlternativeShareLink(filePath) {
    const alternatives = [
      // Try with different API versions
      () => this.createShareV1(filePath),
      () => this.createShareDirect(filePath),
      // Fallback to direct download
      () => Promise.resolve(this.getDirectDownloadUrl(filePath)),
    ];

    for (const alternative of alternatives) {
      try {
        const result = await alternative();
        if (result) return result;
      } catch (error) {
        console.log(`Alternative method failed: ${error.message}`);
      }
    }

    // Final fallback
    return this.getDirectDownloadUrl(filePath);
  }

  // Alternative API v1 approach for permanent shares
  async createShareV1(filePath) {
    const shareParams = new URLSearchParams({
      path: filePath,
      shareType: "3", // Public link
      permissions: "1", // Read permission
      publicUpload: "false", // No upload
      password: "", // No password
      expireDate: "", // No expiration (permanent)
    });

    const response = await axios.post(
      `${this.baseUrl.replace(
        "/remote.php/dav/files/" + this.username,
        ""
      )}/ocs/v1.php/apps/files_sharing/api/v1/shares`,
      shareParams,
      {
        headers: {
          Authorization: `Basic ${this.auth}`,
          "OCS-APIRequest": "true",
          "Content-Type": "application/x-www-form-urlencoded",
          ...(Object.keys(this.cookies).length > 0 && {
            Cookie: this.getCookieHeader(),
          }),
        },
      }
    );

    this.storeCookies(response);

    // Parse response
    if (response.data) {
      const urlMatch = response.data.toString().match(/<url>(.*?)<\/url>/);
      if (urlMatch) {
        console.log(`Created permanent share link (v1): ${urlMatch[1]}`);
        return urlMatch[1];
      }
    }
    throw new Error("No share URL in v1 response");
  }

  // Direct share creation for permanent links
  async createShareDirect(filePath) {
    const baseNextcloudUrl = this.baseUrl.replace(
      "/remote.php/dav/files/" + this.username,
      ""
    );

    const shareParams = new URLSearchParams({
      action: "share",
      itemSource: filePath,
      itemType: "file",
      shareType: 3, // Public link
      permissions: 1, // Read permission
      publicUpload: false, // No upload
      password: "", // No password
      expiration: "", // No expiration (permanent)
    });

    const response = await axios({
      method: "POST",
      url: `${baseNextcloudUrl}/index.php/apps/files_sharing/ajax/share.php`,
      data: shareParams,
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        ...(Object.keys(this.cookies).length > 0 && {
          Cookie: this.getCookieHeader(),
        }),
      },
    });

    this.storeCookies(response);

    if (response.data && response.data.data && response.data.data.url) {
      console.log(
        `Created permanent share link (direct): ${response.data.data.url}`
      );
      return response.data.data.url;
    }

    throw new Error("No share URL in direct response");
  }

  // Check if share link exists and is permanent, create if not
  async ensurePermanentShare(filePath) {
    try {
      // First check if file already has a public share
      const existingShares = await this.getExistingShares(filePath);

      // Look for permanent public shares
      const permanentShare = existingShares.find(
        (share) =>
          share.share_type === 3 && // Public link
          (!share.expiration ||
            share.expiration === null ||
            share.expiration === "")
      );

      if (permanentShare) {
        console.log(`Found existing permanent share: ${permanentShare.url}`);
        return permanentShare.url;
      }

      // No permanent share found, create one
      return await this.createPublicShare(filePath);
    } catch (error) {
      console.log(
        "Error checking existing shares, creating new one:",
        error.message
      );
      return await this.createPublicShare(filePath);
    }
  }

  // Get existing shares for a file
  async getExistingShares(filePath) {
    try {
      const response = await axios.get(
        `${this.baseUrl.replace(
          "/remote.php/dav/files/" + this.username,
          ""
        )}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
        {
          params: {
            path: filePath,
            format: "json",
          },
          headers: {
            Authorization: `Basic ${this.auth}`,
            "OCS-APIRequest": "true",
            Accept: "application/json",
            ...(Object.keys(this.cookies).length > 0 && {
              Cookie: this.getCookieHeader(),
            }),
          },
        }
      );

      this.storeCookies(response);

      if (response.data && response.data.ocs && response.data.ocs.data) {
        return Array.isArray(response.data.ocs.data)
          ? response.data.ocs.data
          : [response.data.ocs.data];
      }

      return [];
    } catch (error) {
      console.log("Could not get existing shares:", error.message);
      return [];
    }
  }
  getDirectDownloadUrl(filePath) {
    // Create a direct download URL that includes authentication
    const encodedPath = encodeURIComponent(filePath);
    return `${this.baseUrl}/${encodedPath}`;
  }

  // Delete file from Nextcloud
  async deleteFile(filePath) {
    try {
      const response = await axios.delete(`${this.baseUrl}/${filePath}`, {
        headers: {
          Authorization: `Basic ${this.auth}`,
          ...(Object.keys(this.cookies).length > 0 && {
            Cookie: this.getCookieHeader(),
          }),
        },
      });
      this.storeCookies(response);
      return { success: true };
    } catch (error) {
      console.error(
        "Failed to delete file from Nextcloud:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // Get MIME type
  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      ".txt": "text/plain",
      ".json": "application/json",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".zip": "application/zip",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}

// Enhanced client factory with session management
function getNextcloudClient() {
  return new NextcloudClient(
    NEXTCLOUD_WEBDAV_URL,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD
  );
}

// Enhanced file upload handler
async function handleFileUpload(req) {
  if (!req.file) return null;

  try {
    // Validate file exists
    if (!fs.existsSync(req.file.path)) {
      throw new Error("Uploaded file not found");
    }

    // Get Nextcloud client
    const client = getNextcloudClient();

    // Determine target folder based on document type
    const title = req.body.title;
    const targetFolder = DOCUMENT_TYPE_FOLDERS[title] || "/Documents";

    // Create unique filename with timestamp
    const originalFilename = req.file.originalname;
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -1);
    const fileExtension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, fileExtension);
    const uniqueFilename = `${baseName}_${timestamp}${fileExtension}`;

    // Upload to Nextcloud
    const uploadResult = await client.uploadFile(
      req.file.path,
      targetFolder,
      uniqueFilename
    );

    // Cleanup local file
    fs.unlinkSync(req.file.path);

    return {
      driveFileId: uniqueFilename,
      name: originalFilename,
      displayName: originalFilename,
      actualFilename: uniqueFilename,
      link: uploadResult.downloadUrl,
      path: uploadResult.path,
      size: uploadResult.size,
      mimeType: uploadResult.mimeType,
      uploadTimestamp: timestamp,
    };
  } catch (error) {
    // Cleanup local file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Nextcloud file upload failed:", error.message);
    throw new Error(`File upload failed: ${error.message}`);
  }
}

// Create a Proposal Document
async function createProposalDocument(req, approverDetails, uploadedFilesData) {
  // Format the submission date for both display and the tag
  const now = moment().tz("Asia/Bangkok");
  const submissionDateForTag = now.format("DDMMYYYYHHmmss");
  // Create the tag by combining name and formatted date
  const tag = `${req.body.task}${submissionDateForTag}`;

  return new ProposalDocument({
    tag,
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
    fileMetadata: uploadedFilesData, // This should now be an array
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Purchasing Document
async function createPurchasingDocument(
  req,
  approverDetails,
  uploadedFilesData
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
      const amount = parseFloat(product.amount) || 0;
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
        costCenter: product.costCenter,
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

    // 4. Process appended proposals with multiple file support
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
        fileMetadata: doc.fileMetadata || [],
        proposalId: doc._id,
        submissionDate: doc.submissionDate,
        submittedBy: doc.submittedBy,
        approvers: doc.approvers,
        approvedBy: doc.approvedBy,
        status: doc.status,
        declaration: doc.declaration,
        suspendReason: doc.suspendReason,
        projectName: doc.projectName,
      }));
    }

    // Format the submission date for both display and the tag
    const now = moment().tz("Asia/Bangkok");
    const submissionDateForTag = now.format("DDMMYYYYHHmmss");
    const tag = `${req.body.name}${submissionDateForTag}`;

    const documentData = {
      tag,
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
      fileMetadata: uploadedFilesData, // Array of files for main document
      submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
      status: "Pending",
    };

    processedProposals.forEach((proposal, index) => {
      console.log(
        `  Proposal ${index + 1}: ${proposal.task} with ${
          proposal.fileMetadata?.length || 0
        } files`
      );
    });

    return new PurchasingDocument(documentData);
  } catch (error) {
    console.error("Error creating purchasing document:", error);
    throw error;
  }
}

// Create a Delivery Document
async function createDeliveryDocument(req, approverDetails, uploadedFilesData) {
  const { products, approvedProposals } = req.body;

  // Process product entries
  const productEntries = processProducts(products);

  // Calculate grand total cost
  const grandTotalCost = parseFloat(
    productEntries.reduce((acc, product) => acc + product.totalCostAfterVat, 0)
  );

  // Process appended proposals with multiple file support
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
      fileMetadata: doc.fileMetadata || [],
      proposalId: doc._id,
      submissionDate: doc.submissionDate,
      submittedBy: doc.submittedBy,
      approvers: doc.approvers,
      approvedBy: doc.approvedBy,
      status: doc.status,
      declaration: doc.declaration,
      suspendReason: doc.suspendReason,
      projectName: doc.projectName,
    }));
  }

  // Format the submission date for both display and the tag
  const now = moment().tz("Asia/Bangkok");
  const submissionDateForTag = now.format("DDMMYYYYHHmmss");
  const tag = `${req.body.name}${submissionDateForTag}`;

  const documentData = {
    tag,
    title: req.body.title,
    name: req.body.name,
    costCenter: req.body.costCenter,
    products: productEntries,
    grandTotalCost,
    appendedProposals: processedProposals,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.body.user ? req.body.user.id : req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFilesData, // Array of files for main document
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  };

  processedProposals.forEach((proposal, index) => {
    console.log(
      `  Proposal ${index + 1}: ${proposal.task} with ${
        proposal.fileMetadata?.length || 0
      } files`
    );
  });

  return new DeliveryDocument(documentData);
}

// Create a Receipt Document
async function createReceiptDocument(req, approverDetails, uploadedFilesData) {
  const { products, approvedProposals } = req.body;

  // Process product entries
  const productEntries = processProducts(products);

  // Calculate grand total cost
  const grandTotalCost = parseFloat(
    productEntries.reduce((acc, product) => acc + product.totalCostAfterVat, 0)
  );

  // Process appended proposals with multiple file support
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
      fileMetadata: doc.fileMetadata || [],
      proposalId: doc._id,
      submissionDate: doc.submissionDate,
      submittedBy: doc.submittedBy,
      approvers: doc.approvers,
      approvedBy: doc.approvedBy,
      status: doc.status,
      declaration: doc.declaration,
      suspendReason: doc.suspendReason,
      projectName: doc.projectName,
    }));
  }

  // Format the submission date for both display and the tag
  const now = moment().tz("Asia/Bangkok");
  const submissionDateForTag = now.format("DDMMYYYYHHmmss");
  const tag = `${req.body.name}${submissionDateForTag}`;

  const documentData = {
    tag,
    title: req.body.title,
    name: req.body.name,
    costCenter: req.body.costCenter,
    products: productEntries,
    grandTotalCost,
    appendedProposals: processedProposals,
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.body.user ? req.body.user.id : req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFilesData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  };

  return new ReceiptDocument(documentData);
}

// Create a Payment Document
async function createPaymentDocument(req, approverDetails, uploadedFilesData) {
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
    priority: req.body.priority || "Thấp",
    groupName: req.body.groupName,
    projectName: req.body.projectName,
    submittedBy: req.user.id,
    approvers: approverDetails,
    fileMetadata: uploadedFilesData,
    appendedPurchasingDocuments,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    notes: req.body.notes || "",
  });
}

// Create a Payment Document
async function createAdvancePaymentDocument(
  req,
  approverDetails,
  uploadedFilesData
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
    fileMetadata: uploadedFilesData,
    appendedPurchasingDocuments,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Payment Document
async function createAdvancePaymentReclaimDocument(
  req,
  approverDetails,
  uploadedFilesData
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
    fileMetadata: uploadedFilesData,
    appendedPurchasingDocuments,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Project Proposal Document
async function createProjectProposalDocument(
  req,
  approverDetails,
  uploadedFilesData
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
    fileMetadata: uploadedFilesData,
    submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
  });
}

// Create a Standard Document
async function createStandardDocument(req, approverDetails, uploadedFilesData) {
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
    fileMetadata: uploadedFilesData,
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
        "captainOfBusiness",
        "captainOfFinance",
        "transporterOfAccounting",
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
      (await DeliveryDocument.findById(id)) ||
      (await ReceiptDocument.findById(id));

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
    } else if (document instanceof ReceiptDocument) {
      await ReceiptDocument.findByIdAndUpdate(id, document);
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
    if (!document && documentType === "Generic") {
      document = await ReceiptDocument.findById(id);
      if (document) documentType = "Receipt";
    }
    if (!document) {
      document = await ProjectProposalDocument.findById(id);
      if (document) documentType = "ProjectProposal";
    }

    if (!document) {
      return res.send("Document not found");
    }

    // Delete associated files from Nextcloud if they exist
    if (document.fileMetadata && document.fileMetadata.length > 0) {
      try {
        const client = getNextcloudClient();

        // Delete all files in the fileMetadata array
        for (const fileMeta of document.fileMetadata) {
          if (fileMeta.path) {
            await client.deleteFile(fileMeta.path);
          }
        }
      } catch (fileError) {
        console.error(
          "Warning: Could not delete associated files from Nextcloud:",
          fileError
        );
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
    } else if (documentType === "Receipt") {
      await ReceiptDocument.findByIdAndDelete(id);
    } else if (documentType === "ProjectProposal") {
      await ProjectProposalDocument.findByIdAndDelete(id);
    } else {
      await Document.findByIdAndDelete(id);
    }

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
    // Restrict access
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Check each collection
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id)) ||
      (await AdvancePaymentReclaimDocument.findById(id)) ||
      (await PaymentDocument.findById(id)) ||
      (await DeliveryDocument.findById(id)) ||
      (await ReceiptDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu.");
    }

    // Revert and lock all approval progress
    document.approvedBy = []; // Clear all approvals
    document.status = "Suspended"; // Add a new field for status
    document.suspendReason = suspendReason; // Add suspend reason

    // Save back to correct collection
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
    // Restrict access
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await AdvancePaymentDocument.findById(id)) ||
      (await AdvancePaymentReclaimDocument.findById(id)) ||
      (await PaymentDocument.findById(id)) ||
      (await DeliveryDocument.findById(id)) ||
      (await ReceiptDocument.findById(id));

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
    } else if (document instanceof AdvancePaymentReclaimDocument) {
      await AdvancePaymentReclaimDocument.findByIdAndUpdate(id, document);
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
exports.getApprovedProposalsForReceipt = async (req, res) => {
  try {
    // Fetch all approved proposal documents
    const approvedProposals = await ProposalDocument.find({
      status: "Approved",
    })
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

    // Fetch all purchasing documents to check which proposals are already attached
    const ReceiptDocument = require("../models/DocumentReceipt.js");
    const receiptDocuments = await ReceiptDocument.find({});

    // Extract all proposal IDs that are already attached to receipt documents
    const attachedProposalIds = new Set();
    receiptDocuments.forEach((doc) => {
      if (doc.appendedProposals && doc.appendedProposals.length > 0) {
        doc.appendedProposals.forEach((proposal) => {
          if (proposal.proposalId) {
            attachedProposalIds.add(proposal.proposalId.toString());
          }
        });
      }
    });

    // Filter out proposals that are already attached to receipt documents
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
    const proposal = await ProposalDocument.findById(req.params.id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");
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
    const {
      task,
      costCenter,
      dateOfError,
      detailsDescription,
      direction,
      groupName,
    } = req.body;
    const files = req.files;

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

    // Handle multiple file uploads if new files provided
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;

      // Upload new files - they will be added to existing files
      uploadedFilesData = await handleMultipleFileUploads(req);
    }

    // Update the document
    doc.task = task;
    doc.costCenter = costCenter;
    doc.dateOfError = dateOfError;
    doc.detailsDescription = detailsDescription;
    doc.direction = direction;
    doc.groupName = groupName;

    // Update file metadata - add new files to existing ones
    // Note: Files deleted via the UI are already removed from the document
    // by the deleteProposalDocumentFile function
    if (uploadedFilesData.length > 0) {
      // Add new files to existing files
      doc.fileMetadata = [...doc.fileMetadata, ...uploadedFilesData];
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
exports.deleteProposalDocumentFile = async (req, res) => {
  try {
    const { docId, fileId } = req.params;

    const doc = await ProposalDocument.findById(docId);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Find the file to delete
    const fileToDelete = doc.fileMetadata.find(
      (file) => file._id.toString() === fileId || file.driveFileId === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "File not found" });
    }

    // Delete file from Nextcloud
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (error) {
        console.error("Warning: Could not delete file from storage", error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Remove file from document's fileMetadata array
    doc.fileMetadata = doc.fileMetadata.filter(
      (file) => file._id.toString() !== fileId && file.driveFileId !== fileId
    );

    await doc.save();

    res.json({
      success: true,
      message: "File deleted successfully",
      remainingFiles: doc.fileMetadata.length,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Error deleting file" });
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
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
      ].includes(req.user.role)
    ) {
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
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
      ].includes(req.user.role)
    ) {
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
      .populate("approvedBy.user", "username")
      .populate("appendedProposals.submittedBy", "username");

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
      .populate("approvedBy.user", "username")
      .populate("appendedProposals.submittedBy", "username");
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
    const files = req.files;

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

    // Handle multiple file uploads if new files provided - ADD TO EXISTING FILES
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;

      // Upload new files - they will be ADDED to existing files
      uploadedFilesData = await handleMultipleFileUploads(req);
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

    // Handle proposal documents - replace with new list
    if (appendedProposals) {
      doc.appendedProposals = appendedProposals;
    }

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    // UPDATE FILE METADATA - ADD NEW FILES TO EXISTING ONES (NOT REPLACE)
    if (uploadedFilesData.length > 0) {
      // Add new files to existing files instead of replacing
      doc.fileMetadata = [...doc.fileMetadata, ...uploadedFilesData];
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
exports.deletePurchasingDocumentFile = async (req, res) => {
  try {
    const { docId, fileId } = req.params;

    const doc = await PurchasingDocument.findById(docId);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Find the file to delete
    const fileToDelete = doc.fileMetadata.find(
      (file) => file._id.toString() === fileId || file.driveFileId === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "File not found" });
    }

    // Delete file from Nextcloud
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (error) {
        console.error("Warning: Could not delete file from storage", error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Remove file from document's fileMetadata array
    doc.fileMetadata = doc.fileMetadata.filter(
      (file) => file._id.toString() !== fileId && file.driveFileId !== fileId
    );

    await doc.save();

    res.json({
      success: true,
      message: "File deleted successfully",
      remainingFiles: doc.fileMetadata.length,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Error deleting file" });
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
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfPurchasing",
      ].includes(req.user.role)
    ) {
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
      .populate("approvedBy.user", "username")
      .populate("stages.approvers.approver", "username role")
      .populate("stages.approvedBy.user", "username role");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      paymentDocuments,
      username
    );

    // Helper function to get effective priority for sorting
    const getEffectivePriority = (doc) => {
      const priorityOrder = { Cao: 1, "Trung bình": 2, Thấp: 3 };

      // Check if document has unapproved stages
      const unapprovedStages = doc.stages
        ? doc.stages.filter((stage) => stage.status !== "Approved")
        : [];

      if (unapprovedStages.length > 0) {
        // Use the highest priority (lowest number) from unapproved stages
        const highestStagePriority = Math.min(
          ...unapprovedStages.map(
            (stage) => priorityOrder[stage.priority] || 999
          )
        );
        return highestStagePriority;
      } else {
        // Use document's own priority if no unapproved stages
        return priorityOrder[doc.priority] || 999;
      }
    };

    // Separate approved and non-approved documents
    const approvedDocuments = filteredDocuments.filter(
      (doc) => doc.status === "Approved"
    );

    const nonApprovedDocuments = filteredDocuments.filter(
      (doc) => doc.status !== "Approved"
    );

    // Sort non-approved documents by effective priority (stage priority if unapproved stages exist, otherwise document priority)
    const sortedNonApproved = nonApprovedDocuments.sort((a, b) => {
      const priorityA = getEffectivePriority(a);
      const priorityB = getEffectivePriority(b);
      return priorityA - priorityB;
    });

    // Apply existing sort function to both groups
    const finalNonApproved =
      documentUtils.sortDocumentsByStatusAndDate(sortedNonApproved);
    const finalApproved =
      documentUtils.sortDocumentsByStatusAndDate(approvedDocuments);

    // Combine: non-approved first (with effective priority sorting), then approved
    const sortedDocuments = [...finalNonApproved, ...finalApproved];

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

    // First, get the document with basic population
    const document = await PaymentDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    //Properly populate appendedPurchasingDocuments and their submittedBy fields
    if (
      document.appendedPurchasingDocuments &&
      document.appendedPurchasingDocuments.length > 0
    ) {
      // Create a new array with properly populated documents
      const populatedPurchasingDocs = await Promise.all(
        document.appendedPurchasingDocuments.map(async (purchasingDoc) => {
          // If it's already an object with _id, use it directly
          if (purchasingDoc._id && typeof purchasingDoc._id === "object") {
            return purchasingDoc;
          }

          // If it's just an ID string, fetch the full document
          let docId = purchasingDoc;
          if (typeof purchasingDoc === "object" && purchasingDoc._id) {
            docId = purchasingDoc._id;
          }

          const populatedDoc = await PurchasingDocument.findById(docId)
            .populate("submittedBy", "username")
            .populate("appendedProposals.submittedBy", "username");

          return populatedDoc ? populatedDoc.toObject() : purchasingDoc;
        })
      );

      document.appendedPurchasingDocuments = populatedPurchasingDocs;
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching payment document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updatePaymentDocument = async (req, res) => {
  let tempFilePaths = [];
  try {
    const { id } = req.params;
    const {
      name,
      content,
      costCenter,
      paymentMethod,
      totalPayment,
      paymentDeadline,
      priority,
      approvers,
      stages,
      groupName,
      currentFileMetadata,
      appendedPurchasingDocuments,
      notes,
    } = req.body;
    const files = req.files;

    // Store temp file paths for cleanup
    if (files && files.length > 0) {
      files.forEach((file) => {
        tempFilePaths.push(file.path);
        if (!fs.existsSync(file.path)) {
          throw new Error(`Uploaded file not found at: ${file.path}`);
        }
      });
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

            // Only prevent edits if stage is fully approved
            if (
              existingStage.approvedBy?.length ===
              existingStage.approvers?.length
            ) {
              const criticalFields = [
                "name",
                "amount",
                "deadline",
                "paymentMethod",
                "priority",
                "approvers",
              ];
              for (const field of criticalFields) {
                if (
                  JSON.stringify(existingStage[field]) !==
                  JSON.stringify(newStage[field])
                ) {
                  return res.status(400).json({
                    message: `Không thể chỉnh sửa giai đoạn đã được phê duyệt hoàn toàn (Giai đoạn ${
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

    // Parse current file metadata
    let currentFiles = [];
    if (currentFileMetadata) {
      try {
        currentFiles = JSON.parse(currentFileMetadata);
      } catch (error) {
        console.error("Error parsing current file metadata:", error);
      }
    }

    // Parse purchasing documents if provided
    let parsedPurchasingDocs = [];
    if (appendedPurchasingDocuments) {
      try {
        parsedPurchasingDocs = JSON.parse(appendedPurchasingDocuments);
      } catch (error) {
        console.error("Error parsing purchasing documents:", error);
      }
    }

    // Handle file upload if new files provided
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;
      uploadedFilesData = await handleMultipleFileUploads(req);
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
    doc.priority = priority;
    doc.groupName = groupName;
    doc.notes = notes || "";

    // Update file metadata
    doc.fileMetadata = [...currentFiles, ...uploadedFilesData];

    // Update purchasing documents if provided
    if (parsedPurchasingDocs) {
      doc.appendedPurchasingDocuments = parsedPurchasingDocs;
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
  } finally {
    // Clean up temp files
    tempFilePaths.forEach((tempFilePath) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up temp file:", cleanupError);
        }
      }
    });
  }
};
exports.deletePaymentDocumentFile = async (req, res) => {
  const { docId, fileId } = req.params;

  try {
    // Find the payment document
    const document = await PaymentDocument.findById(docId);
    if (!document) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phiếu thanh toán" });
    }

    // Check if document is approved - prevent deletion if approved
    if (document.status === "Approved") {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã được phê duyệt",
      });
    }

    // Check if document has any approvals - prevent deletion if partially approved
    if (document.approvedBy && document.approvedBy.length > 0) {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã có người phê duyệt",
      });
    }

    // Find the file to delete
    const fileToDelete = document.fileMetadata.find(
      (file) => file.driveFileId === fileId || file._id.toString() === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "Không tìm thấy tệp tin" });
    }

    // Delete the file from Nextcloud storage
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Remove the file from the document's fileMetadata array
    document.fileMetadata = document.fileMetadata.filter(
      (file) => file.driveFileId !== fileId && file._id.toString() !== fileId
    );

    // Save the updated document
    await document.save();

    res.json({
      success: true,
      message: "Tệp tin đã được xóa thành công",
      remainingFiles: document.fileMetadata.length,
    });
  } catch (error) {
    console.error("Error deleting payment document file:", error);
    res.status(500).json({
      message: "Lỗi khi xóa tệp tin",
      error: error.message,
    });
  }
};
exports.uploadStageFile = async (req, res) => {
  const { docId, stageIndex } = req.params;

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Find the payment document
    const doc = await PaymentDocument.findById(docId);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if stage exists
    if (!doc.stages || doc.stages.length <= stageIndex) {
      return res.status(404).json({ message: "Stage not found" });
    }

    // Handle file upload
    let uploadedFileData = null;
    if (req.file) {
      req.body.title = "Payment Document";
      uploadedFileData = await handleFileUpload(req);
    }

    // Update the stage with file metadata
    doc.stages[stageIndex].fileMetadata = uploadedFileData;
    await doc.save();

    res.json({
      success: true,
      message: "File uploaded successfully",
      fileMetadata: uploadedFileData,
    });
  } catch (error) {
    console.error("Error uploading stage file:", error);
    res.status(500).json({
      message: "Error uploading file",
      error: error.message, // Add error details for debugging
    });
  }
};
exports.removeStageFile = async (req, res) => {
  const { docId, stageIndex } = req.params;

  try {
    // Find the payment document
    const document = await PaymentDocument.findById(docId);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if the stage exists
    if (!document.stages || document.stages.length <= stageIndex) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const stage = document.stages[stageIndex];

    // Check if there's a file to remove
    if (!stage.fileMetadata?.path) {
      return res.status(400).json({ message: "No file to remove" });
    }

    // Check if the stage has been approved
    if (stage.status == "Approved") {
      return res.status(403).json({
        message:
          "Không được phép xóa tệp tin trong giai đoạn đã phê duyệt hoàn toàn",
      });
    }

    // Delete the file from Nextcloud
    const client = getNextcloudClient();
    await client.deleteFile(stage.fileMetadata.path);

    // Remove the file metadata from the stage
    document.stages[stageIndex].fileMetadata = null;
    await document.save();

    res.json({
      success: true,
      message: "Tệp tin trong giai đoạn đã xóa thành công",
    });
  } catch (error) {
    console.error("Error removing stage file:", error);
    res.status(500).json({
      message: "Error removing stage file",
      error: error.message,
    });
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
exports.updatePaymentDocumentPriority = async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;

  try {
    // Check user permissions - adjust roles as needed
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
        "captainOfAccounting",
        "captainOfPurchasing",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const doc = await PaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Không tìm thấy tài liệu" });
    }

    // Check if document is partially approved
    const approvedCount = doc.approvedBy.length;
    const totalApprovers = doc.approvers.length;

    if (
      doc.status !== "Pending" ||
      approvedCount === 0 ||
      approvedCount >= totalApprovers
    ) {
      return res.status(400).json({
        message:
          "Chỉ có thể cập nhật ưu tiên cho tài liệu đang được phê duyệt một phần",
      });
    }

    // Update priority
    doc.priority = priority;
    await doc.save();

    res.send("Mức độ ưu tiên cập nhật thành công.");
  } catch (error) {
    console.error("Error updating document priority:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật mức độ ưu tiên" });
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
        "captainOfBusiness",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res.status(403).json({
        message: "Truy cập bị từ chối. Bạn không có quyền truy cập.",
      });
    }

    const document = await PaymentDocument.findById(docId);
    if (!document) {
      return res.status(404).json({
        message: "Không tìm thấy phiếu thanh toán.",
      });
    }

    // Check if stage exists
    if (!document.stages || document.stages.length <= stageIndex) {
      return res.status(404).json({
        message: "Không tìm thấy giai đoạn thanh toán.",
      });
    }

    const stage = document.stages[stageIndex];
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng.",
      });
    }

    // Check if user is an approver for this stage
    const isStageApprover = stage.approvers.some(
      (approver) => approver.approver.toString() === req.user.id
    );

    if (!isStageApprover) {
      return res.status(403).json({
        message:
          "Truy cập bị từ chối. Bạn không có quyền phê duyệt giai đoạn này.",
      });
    }

    // Check if user has already approved this stage
    const hasApproved = stage.approvedBy.some(
      (approver) => approver.user.toString() === req.user.id
    );

    if (hasApproved) {
      return res.status(400).json({
        message: "Bạn đã phê duyệt giai đoạn này rồi.",
      });
    }

    // Define the approval hierarchy based on stage payment amount
    const getStageApprovalOrder = async (
      approvers,
      approvedBy,
      stageAmount
    ) => {
      // Get all approver details from the stage's approvers list
      const approverDetails = [];
      for (const app of approvers) {
        const approverUser = await User.findById(app.approver);
        if (approverUser) {
          approverDetails.push({
            id: approverUser._id.toString(),
            role: approverUser.role,
            username: approverUser.username,
          });
        }
      }

      const approvedRoles = approvedBy.map((app) => app.role);
      const approvedUserIds = approvedBy.map((app) => app.user.toString());

      // Dynamic hierarchy order based on stage payment amount
      let hierarchyOrder;
      if (stageAmount < 100000000) {
        // For stage amounts < 100M: deputyDirector -> director -> captainOfAccounting
        hierarchyOrder = ["deputyDirector", "captainOfAccounting", "director"];
      } else {
        // For stage amounts >= 100M: director -> captainOfAccounting -> deputyDirector
        hierarchyOrder = ["director", "deputyDirector", "captainOfAccounting"];
      }

      // Get only the hierarchy roles that are actually assigned to this stage
      const assignedHierarchyRoles = hierarchyOrder.filter((role) =>
        approverDetails.some((approver) => approver.role === role)
      );

      // Get other approvers (not in hierarchy)
      const otherApprovers = approverDetails.filter(
        (approver) => !hierarchyOrder.includes(approver.role)
      );

      return {
        otherApprovers,
        assignedHierarchyRoles,
        approvedRoles,
        approvedUserIds,
        approverDetails,
      };
    };

    // Check if current user can approve this stage based on the sequential order
    const canApproveStageNow = async (userRole, userId, stage, stageAmount) => {
      const {
        otherApprovers,
        assignedHierarchyRoles,
        approvedRoles,
        approvedUserIds,
        approverDetails,
      } = await getStageApprovalOrder(
        stage.approvers,
        stage.approvedBy,
        stageAmount
      );

      // Special rule: Director and deputyDirector can approve anytime for amounts under 100M
      if (
        (userRole === "director" || userRole === "deputyDirector") &&
        stageAmount < 100000000
      ) {
        return { canApprove: true };
      }

      // Special rule: deputyDirector can approve anytime for amounts over 100M
      if (userRole === "deputyDirector" && stageAmount > 100000000) {
        return { canApprove: true };
      }

      // If user is not in the approval hierarchy, they can approve anytime (other approvers)
      if (!assignedHierarchyRoles.includes(userRole)) {
        return { canApprove: true };
      }

      // For hierarchy roles, check if all other approvers are done first
      const otherApproversCompleted = otherApprovers.every((approver) =>
        approvedUserIds.includes(approver.id)
      );

      if (!otherApproversCompleted) {
        const pendingOthers = otherApprovers
          .filter((approver) => !approvedUserIds.includes(approver.id))
          .map((approver) => approver.username || approver.role);
        return {
          canApprove: false,
          waitingFor: `các approver khác (${pendingOthers.join(", ")})`,
        };
      }

      // Find the current user's position in the assigned hierarchy
      const userHierarchyIndex = assignedHierarchyRoles.indexOf(userRole);

      // Check if all previous hierarchy role groups have ALL members approved
      for (let i = 0; i < userHierarchyIndex; i++) {
        const requiredRole = assignedHierarchyRoles[i];

        // Get all users from this role group
        const roleGroupMembers = approverDetails.filter(
          (approver) => approver.role === requiredRole
        );

        // Check if ALL members from this role group have approved
        const allRoleGroupMembersApproved = roleGroupMembers.every((member) =>
          approvedUserIds.includes(member.id)
        );

        if (!allRoleGroupMembersApproved) {
          // Get pending users from this role group
          const pendingFromRole = roleGroupMembers
            .filter((member) => !approvedUserIds.includes(member.id))
            .map((member) => member.username || member.role);

          return {
            canApprove: false,
            waitingFor: `tất cả ${requiredRole} (${pendingFromRole.join(
              ", "
            )})`,
          };
        }
      }

      return { canApprove: true };
    };

    // Check if the current user can approve this stage now
    const stageApprovalCheck = await canApproveStageNow(
      user.role,
      user.id,
      stage,
      stage.amount
    );
    if (!stageApprovalCheck.canApprove) {
      return res.status(400).json({
        message: `Bạn chưa thể phê duyệt giai đoạn này${
          stageApprovalCheck.waitingFor
            ? `. Đang chờ phê duyệt từ: ${stageApprovalCheck.waitingFor}`
            : ""
        }`,
      });
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
      return res.status(200).json({
        message:
          "Giai đoạn đã được phê duyệt. Bạn có thể phê duyệt toàn bộ phiếu thanh toán.",
        canApproveDocument: true,
      });
    }

    return res.status(200).json({
      message:
        stage.status === "Approved"
          ? "Giai đoạn đã được phê duyệt hoàn toàn."
          : "Giai đoạn đã được phê duyệt thành công.",
      canApproveDocument: false,
    });
  } catch (err) {
    console.error("Error approving payment stage:", err);
    return res.status(500).json({
      message: "Lỗi phê duyệt giai đoạn thanh toán.",
    });
  }
};
exports.approvePaymentDocument = async (req, res) => {
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
        "captainOfBusiness",
        "captainOfFinance",
        "transporterOfAccounting",
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

    // Define the approval hierarchy with conditional order for payment documents
    const getApprovalOrder = async (approvers, approvedBy, document) => {
      // Get all approver details from the document's approvers list
      const approverDetails = [];
      for (const app of approvers) {
        const approverUser = await User.findById(app.approver);
        if (approverUser) {
          approverDetails.push({
            id: approverUser._id.toString(),
            role: approverUser.role,
            username: approverUser.username,
          });
        }
      }

      const approvedRoles = approvedBy.map((app) => app.role);
      const approvedUserIds = approvedBy.map((app) => app.user.toString());

      // Determine hierarchy order based on document type and payment amount
      let hierarchyOrder;

      if (
        document instanceof PaymentDocument &&
        document.totalPayment < 100000000
      ) {
        // For payment documents under 100,000,000: deputyDirector comes before director
        hierarchyOrder = ["deputyDirector", "captainOfAccounting", "director"];
      } else {
        // Default hierarchy: director -> captainOfAccounting -> deputyDirector
        hierarchyOrder = ["director", "deputyDirector", "captainOfAccounting"];
      }

      // Get only the hierarchy roles that are actually assigned to this document
      const assignedHierarchyRoles = hierarchyOrder.filter((role) =>
        approverDetails.some((approver) => approver.role === role)
      );

      // Get other approvers (not in hierarchy)
      const otherApprovers = approverDetails.filter(
        (approver) => !hierarchyOrder.includes(approver.role)
      );

      return {
        otherApprovers,
        assignedHierarchyRoles,
        approvedRoles,
        approvedUserIds,
        approverDetails,
      };
    };

    // Check if current user can approve based on the sequential order
    const canApproveNow = async (userRole, userId, document) => {
      const {
        otherApprovers,
        assignedHierarchyRoles,
        approvedRoles,
        approvedUserIds,
        approverDetails,
      } = await getApprovalOrder(
        document.approvers,
        document.approvedBy,
        document
      );

      // Special rule: Director and deputyDirector can approve anytime for payment documents under 100M
      if (
        userRole === "director" ||
        (userRole === "deputyDirector" &&
          document instanceof PaymentDocument &&
          document.totalPayment < 100000000)
      ) {
        return { canApprove: true };
      }

      // Special rule: deputyDirector can approve anytime for payment documents over 100M
      if (
        userRole === "deputyDirector" &&
        document instanceof PaymentDocument &&
        document.totalPayment > 100000000
      ) {
        return { canApprove: true };
      }

      // If user is not in the approval hierarchy, they can approve anytime (other approvers)
      if (!assignedHierarchyRoles.includes(userRole)) {
        return { canApprove: true };
      }

      // For hierarchy roles, check if all other approvers are done first
      const otherApproversCompleted = otherApprovers.every((approver) =>
        approvedUserIds.includes(approver.id)
      );

      if (!otherApproversCompleted) {
        const pendingOthers = otherApprovers
          .filter((approver) => !approvedUserIds.includes(approver.id))
          .map((approver) => approver.username || approver.role);
        return {
          canApprove: false,
          waitingFor: `các approver khác (${pendingOthers.join(", ")})`,
        };
      }

      // Find the current user's position in the assigned hierarchy
      const userHierarchyIndex = assignedHierarchyRoles.indexOf(userRole);

      // Check if all previous hierarchy role groups have ALL members approved
      for (let i = 0; i < userHierarchyIndex; i++) {
        const requiredRole = assignedHierarchyRoles[i];

        // Get all users from this role group
        const roleGroupMembers = approverDetails.filter(
          (approver) => approver.role === requiredRole
        );

        // Check if ALL members from this role group have approved
        const allRoleGroupMembersApproved = roleGroupMembers.every((member) =>
          approvedUserIds.includes(member.id)
        );

        if (!allRoleGroupMembersApproved) {
          // Get pending users from this role group
          const pendingFromRole = roleGroupMembers
            .filter((member) => !approvedUserIds.includes(member.id))
            .map((member) => member.username || member.role);

          return {
            canApprove: false,
            waitingFor: `tất cả ${requiredRole} (${pendingFromRole.join(
              ", "
            )})`,
          };
        }
      }

      return { canApprove: true };
    };

    // Check if the current user can approve now
    const approvalCheck = await canApproveNow(user.role, user.id, document);
    if (!approvalCheck.canApprove) {
      return res.send(`Bạn chưa thể phê duyệt`);
    }

    // Add the current approver to the list of approvedBy
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
// Suspend a payment stage
exports.suspendPaymentStage = async (req, res) => {
  const { docId, stageIndex } = req.params;
  const { suspendReason } = req.body;

  try {
    // Restrict access
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const document = await PaymentDocument.findById(docId);
    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu thanh toán.");
    }

    // Check if stage exists
    if (!document.stages || document.stages.length <= stageIndex) {
      return res.status(404).send("Không tìm thấy giai đoạn thanh toán.");
    }

    const stage = document.stages[stageIndex];

    // Check if stage is already suspended
    if (stage.status === "Suspended") {
      return res.status(400).send("Giai đoạn này đã được từ chối trước đó.");
    }

    // Check if stage is already approved
    if (stage.status === "Approved") {
      return res
        .status(400)
        .send("Không thể từ chối giai đoạn đã được phê duyệt.");
    }

    // Suspend the stage
    stage.status = "Suspended";
    stage.suspendReason = suspendReason;

    // Clear any existing approvals for this stage
    stage.approvedBy = [];

    await document.save();

    res.send("Giai đoạn thanh toán đã được từ chối thành công.");
  } catch (err) {
    console.error("Lỗi khi từ chối giai đoạn thanh toán:", err);
    res.status(500).send("Lỗi khi từ chối giai đoạn thanh toán.");
  }
};
// Open a suspended payment stage
exports.openPaymentStage = async (req, res) => {
  const { docId, stageIndex } = req.params;

  try {
    // Restrict access
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
        "headOfPurchasing",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const document = await PaymentDocument.findById(docId);
    if (!document) {
      return res.status(404).send("Không tìm thấy phiếu thanh toán.");
    }

    // Check if stage exists
    if (!document.stages || document.stages.length <= stageIndex) {
      return res.status(404).send("Không tìm thấy giai đoạn thanh toán.");
    }

    const stage = document.stages[stageIndex];

    // Check if stage is actually suspended
    if (stage.status !== "Suspended") {
      return res.status(400).send("Giai đoạn này không ở trạng thái từ chối.");
    }

    // Reopen the stage
    stage.status = "Pending";
    stage.suspendReason = "";

    await document.save();

    res.send("Giai đoạn thanh toán đã được mở lại thành công.");
  } catch (err) {
    console.error("Lỗi khi mở lại giai đoạn thanh toán:", err);
    res.status(500).send("Lỗi khi mở lại giai đoạn thanh toán.");
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

    // First, get the document with basic population
    const document = await AdvancePaymentDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Manually populate submittedBy for appendedPurchasingDocuments and their appendedProposals
    if (
      document.appendedPurchasingDocuments &&
      document.appendedPurchasingDocuments.length > 0
    ) {
      for (let purchasingDoc of document.appendedPurchasingDocuments) {
        // Populate submittedBy for the purchasing document
        if (purchasingDoc.submittedBy) {
          const submittedByUser = await mongoose
            .model("User")
            .findById(purchasingDoc.submittedBy)
            .select("username");
          if (submittedByUser) {
            purchasingDoc.submittedBy = {
              _id: purchasingDoc.submittedBy,
              username: submittedByUser.username,
            };
          }
        }

        // Populate submittedBy for appendedProposals within the purchasing document
        if (
          purchasingDoc.appendedProposals &&
          purchasingDoc.appendedProposals.length > 0
        ) {
          for (let proposal of purchasingDoc.appendedProposals) {
            if (proposal.submittedBy) {
              const proposalSubmittedBy = await mongoose
                .model("User")
                .findById(proposal.submittedBy)
                .select("username");
              if (proposalSubmittedBy) {
                proposal.submittedBy = {
                  _id: proposal.submittedBy,
                  username: proposalSubmittedBy.username,
                };
              }
            }
          }
        }
      }
    }

    // Populate submittedBy for appendedProposals (if they exist directly on advance document)
    if (document.appendedProposals && document.appendedProposals.length > 0) {
      for (let proposal of document.appendedProposals) {
        if (proposal.submittedBy) {
          const proposalSubmittedBy = await mongoose
            .model("User")
            .findById(proposal.submittedBy)
            .select("username");
          if (proposalSubmittedBy) {
            proposal.submittedBy = {
              _id: proposal.submittedBy,
              username: proposalSubmittedBy.username,
            };
          }
        }
      }
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching advance payment document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updateAdvancePaymentDocument = async (req, res) => {
  let tempFilePaths = [];
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
      currentFileMetadata,
    } = req.body;
    const files = req.files; // Change from req.file to req.files for multiple files

    // Store temp file paths for cleanup
    if (files && files.length > 0) {
      files.forEach((file) => {
        tempFilePaths.push(file.path);
        if (!fs.existsSync(file.path)) {
          throw new Error(`Uploaded file not found at: ${file.path}`);
        }
      });
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

    // Parse current file metadata
    let currentFiles = [];
    if (currentFileMetadata) {
      try {
        currentFiles = JSON.parse(currentFileMetadata);
      } catch (error) {
        console.error("Error parsing current file metadata:", error);
        // Continue with empty array
      }
    }

    // Handle multiple file uploads if new files provided
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;

      // Upload new files - they will be ADDED to existing files
      uploadedFilesData = await handleMultipleFileUploads(req);
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
    doc.advancePayment = parseFloat(advancePayment);
    doc.paymentDeadline = paymentDeadline;
    doc.groupName = groupName;

    // UPDATE FILE METADATA - COMBINE EXISTING (AFTER DELETIONS) WITH NEW FILES
    doc.fileMetadata = [...currentFiles, ...uploadedFilesData];

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating advance payment document:", error);
    res.status(500).json({ message: "Error updating document" });
  } finally {
    // Clean up temp files
    tempFilePaths.forEach((tempFilePath) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up temp file:", cleanupError);
        }
      }
    });
  }
};
exports.deleteAdvancePaymentDocumentFile = async (req, res) => {
  const { docId, fileId } = req.params;

  try {
    // Find the advance payment document
    const document = await AdvancePaymentDocument.findById(docId);
    if (!document) {
      return res.status(404).json({ message: "Không tìm thấy phiếu tạm ứng" });
    }

    // Check if document is approved - prevent deletion if approved
    if (document.status === "Approved") {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã được phê duyệt",
      });
    }

    // Check if document has any approvals - prevent deletion if partially approved
    if (document.approvedBy && document.approvedBy.length > 0) {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã có người phê duyệt",
      });
    }

    // Find the file to delete
    const fileToDelete = document.fileMetadata.find(
      (file) => file.driveFileId === fileId || file._id.toString() === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "Không tìm thấy tệp tin" });
    }

    // Delete the file from Nextcloud storage
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Remove the file from the document's fileMetadata array
    document.fileMetadata = document.fileMetadata.filter(
      (file) => file.driveFileId !== fileId && file._id.toString() !== fileId
    );

    // Save the updated document
    await document.save();

    res.json({
      success: true,
      message: "Tệp tin đã được xóa thành công",
      remainingFiles: document.fileMetadata.length,
    });
  } catch (error) {
    console.error("Error deleting advance payment document file:", error);
    res.status(500).json({
      message: "Lỗi khi xóa tệp tin",
      error: error.message,
    });
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

    // First, get the document with basic population
    const document = await AdvancePaymentReclaimDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Populate submittedBy for appendedAdvanceDocuments
    if (
      document.appendedAdvanceDocuments &&
      document.appendedAdvanceDocuments.length > 0
    ) {
      for (let advanceDoc of document.appendedAdvanceDocuments) {
        // Populate submittedBy for the advance document
        if (advanceDoc.submittedBy) {
          const submittedByUser = await mongoose
            .model("User")
            .findById(advanceDoc.submittedBy)
            .select("username");
          if (submittedByUser) {
            advanceDoc.submittedBy = {
              _id: advanceDoc.submittedBy,
              username: submittedByUser.username,
            };
          }
        }

        // Populate submittedBy for appendedPurchasingDocuments within the advance document
        if (
          advanceDoc.appendedPurchasingDocuments &&
          advanceDoc.appendedPurchasingDocuments.length > 0
        ) {
          for (let purchasingDoc of advanceDoc.appendedPurchasingDocuments) {
            // Populate submittedBy for the purchasing document
            if (purchasingDoc.submittedBy) {
              const purchasingSubmittedBy = await mongoose
                .model("User")
                .findById(purchasingDoc.submittedBy)
                .select("username");
              if (purchasingSubmittedBy) {
                purchasingDoc.submittedBy = {
                  _id: purchasingDoc.submittedBy,
                  username: purchasingSubmittedBy.username,
                };
              }
            }

            // Populate submittedBy for appendedProposals within the purchasing document
            if (
              purchasingDoc.appendedProposals &&
              purchasingDoc.appendedProposals.length > 0
            ) {
              for (let proposal of purchasingDoc.appendedProposals) {
                if (proposal.submittedBy) {
                  const proposalSubmittedBy = await mongoose
                    .model("User")
                    .findById(proposal.submittedBy)
                    .select("username");
                  if (proposalSubmittedBy) {
                    proposal.submittedBy = {
                      _id: proposal.submittedBy,
                      username: proposalSubmittedBy.username,
                    };
                  }
                }
              }
            }
          }
        }

        // Populate submittedBy for appendedProposals directly on advance document
        if (
          advanceDoc.appendedProposals &&
          advanceDoc.appendedProposals.length > 0
        ) {
          for (let proposal of advanceDoc.appendedProposals) {
            if (proposal.submittedBy) {
              const proposalSubmittedBy = await mongoose
                .model("User")
                .findById(proposal.submittedBy)
                .select("username");
              if (proposalSubmittedBy) {
                proposal.submittedBy = {
                  _id: proposal.submittedBy,
                  username: proposalSubmittedBy.username,
                };
              }
            }
          }
        }
      }
    }

    // Populate submittedBy for appendedPurchasingDocuments (if they exist directly on reclaim document)
    if (
      document.appendedPurchasingDocuments &&
      document.appendedPurchasingDocuments.length > 0
    ) {
      for (let purchasingDoc of document.appendedPurchasingDocuments) {
        // Populate submittedBy for the purchasing document
        if (purchasingDoc.submittedBy) {
          const submittedByUser = await mongoose
            .model("User")
            .findById(purchasingDoc.submittedBy)
            .select("username");
          if (submittedByUser) {
            purchasingDoc.submittedBy = {
              _id: purchasingDoc.submittedBy,
              username: submittedByUser.username,
            };
          }
        }

        // Populate submittedBy for appendedProposals within the purchasing document
        if (
          purchasingDoc.appendedProposals &&
          purchasingDoc.appendedProposals.length > 0
        ) {
          for (let proposal of purchasingDoc.appendedProposals) {
            if (proposal.submittedBy) {
              const proposalSubmittedBy = await mongoose
                .model("User")
                .findById(proposal.submittedBy)
                .select("username");
              if (proposalSubmittedBy) {
                proposal.submittedBy = {
                  _id: proposal.submittedBy,
                  username: proposalSubmittedBy.username,
                };
              }
            }
          }
        }
      }
    }

    // Populate submittedBy for appendedProposals (if they exist directly on reclaim document)
    if (document.appendedProposals && document.appendedProposals.length > 0) {
      for (let proposal of document.appendedProposals) {
        if (proposal.submittedBy) {
          const proposalSubmittedBy = await mongoose
            .model("User")
            .findById(proposal.submittedBy)
            .select("username");
          if (proposalSubmittedBy) {
            proposal.submittedBy = {
              _id: proposal.submittedBy,
              username: proposalSubmittedBy.username,
            };
          }
        }
      }
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching advance payment reclaim document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};
exports.updateAdvancePaymentReclaimDocument = async (req, res) => {
  let tempFilePaths = [];
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
      currentFileMetadata,
    } = req.body;
    const files = req.files; // Change from req.file to req.files for multiple files

    // Store temp file paths for cleanup
    if (files && files.length > 0) {
      files.forEach((file) => {
        tempFilePaths.push(file.path);
        if (!fs.existsSync(file.path)) {
          throw new Error(`Uploaded file not found at: ${file.path}`);
        }
      });
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

    // Parse current file metadata
    let currentFiles = [];
    if (currentFileMetadata) {
      try {
        currentFiles = JSON.parse(currentFileMetadata);
      } catch (error) {
        console.error("Error parsing current file metadata:", error);
        // Continue with empty array
      }
    }

    // Handle multiple file uploads if new files provided
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;

      // Upload new files - they will be ADDED to existing files
      uploadedFilesData = await handleMultipleFileUploads(req);
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
    doc.advancePaymentReclaim = parseFloat(advancePaymentReclaim);
    doc.paymentDeadline = paymentDeadline;
    doc.groupName = groupName;

    // UPDATE FILE METADATA - COMBINE EXISTING (AFTER DELETIONS) WITH NEW FILES
    doc.fileMetadata = [...currentFiles, ...uploadedFilesData];

    // Update approvers if provided
    if (approvers) {
      doc.approvers = approvers;
    }

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating advance payment reclaim document:", error);
    res.status(500).json({ message: "Error updating document" });
  } finally {
    // Clean up temp files
    tempFilePaths.forEach((tempFilePath) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up temp file:", cleanupError);
        }
      }
    });
  }
};
exports.deleteAdvancePaymentReclaimDocumentFile = async (req, res) => {
  const { docId, fileId } = req.params;

  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Find the advance payment reclaim document
    const document = await AdvancePaymentReclaimDocument.findById(docId);
    if (!document) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy phiếu thu hồi tạm ứng" });
    }

    // Check if document is approved - prevent deletion if approved
    if (document.status === "Approved") {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã được phê duyệt",
      });
    }

    // Check if document has any approvals - prevent deletion if partially approved
    if (document.approvedBy && document.approvedBy.length > 0) {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã có người phê duyệt",
      });
    }

    // Find the file to delete
    const fileToDelete = document.fileMetadata.find(
      (file) => file.driveFileId === fileId || file._id.toString() === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "Không tìm thấy tệp tin" });
    }

    // Delete the file from Nextcloud storage
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Remove the file from the document's fileMetadata array
    document.fileMetadata = document.fileMetadata.filter(
      (file) => file.driveFileId !== fileId && file._id.toString() !== fileId
    );

    // Save the updated document
    await document.save();

    res.json({
      success: true,
      message: "Tệp tin đã được xóa thành công",
      remainingFiles: document.fileMetadata.length,
    });
  } catch (error) {
    console.error(
      "Error deleting advance payment reclaim document file:",
      error
    );
    res.status(500).json({
      message: "Lỗi khi xóa tệp tin",
      error: error.message,
    });
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
      .populate("approvedBy.user", "username")
      .populate("appendedProposals.submittedBy", "username");
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
  let tempFilePaths = []; // Store temp file paths for cleanup
  try {
    const { id } = req.params;
    const files = req.files; // This will be an array now

    // Store temp file paths for cleanup
    if (files && files.length > 0) {
      files.forEach((file) => {
        tempFilePaths.push(file.path);
        if (!fs.existsSync(file.path)) {
          throw new Error(`Uploaded file not found at: ${file.path}`);
        }
      });
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

    // Parse current file metadata
    let currentFiles = [];
    if (req.body.currentFileMetadata) {
      try {
        currentFiles = JSON.parse(req.body.currentFileMetadata);
      } catch (error) {
        console.error("Error parsing current file metadata:", error);
        // Continue with empty array
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

    // Handle multiple file uploads if new files provided - ADD TO EXISTING FILES
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;

      // Upload new files - they will be ADDED to existing files
      uploadedFilesData = await handleMultipleFileUploads(req);
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

    // UPDATE FILE METADATA - COMBINE EXISTING (AFTER DELETIONS) WITH NEW FILES
    doc.fileMetadata = [...currentFiles, ...uploadedFilesData];

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
  } finally {
    // Clean up temp files
    tempFilePaths.forEach((tempFilePath) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up temp file:", cleanupError);
        }
      }
    });
  }
};
exports.deleteDeliveryDocumentFile = async (req, res) => {
  const { docId, fileId } = req.params;

  try {
    // Find the delivery document
    const document = await DeliveryDocument.findById(docId);
    if (!document) {
      return res.status(404).json({ message: "Không tìm thấy phiếu xuất kho" });
    }

    // Check if document is approved - prevent deletion if approved
    if (document.status === "Approved") {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã được phê duyệt",
      });
    }

    // Check if document has any approvals - prevent deletion if partially approved
    if (document.approvedBy && document.approvedBy.length > 0) {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã có người phê duyệt",
      });
    }

    // Find the file to delete
    const fileToDelete = document.fileMetadata.find(
      (file) => file.driveFileId === fileId || file._id.toString() === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "Không tìm thấy tệp tin" });
    }

    // Delete the file from Nextcloud storage
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Remove the file from the document's fileMetadata array
    document.fileMetadata = document.fileMetadata.filter(
      (file) => file.driveFileId !== fileId && file._id.toString() !== fileId
    );

    // Save the updated document
    await document.save();

    res.json({
      success: true,
      message: "Tệp tin đã được xóa thành công",
      remainingFiles: document.fileMetadata.length,
    });
  } catch (error) {
    console.error("Error deleting delivery document file:", error);
    res.status(500).json({
      message: "Lỗi khi xóa tệp tin",
      error: error.message,
    });
  }
};
exports.exportDeliveryDocumentsToExcel = async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).send("Invalid document IDs");
    }

    const documents = await DeliveryDocument.find({
      _id: { $in: documentIds },
    })
      .populate("submittedBy")
      .populate("approvers.approver")
      .populate("approvedBy.user")
      .populate("appendedProposals.submittedBy")
      .populate("appendedProposals.approvers.approver")
      .populate("appendedProposals.approvedBy.user")
      .populate("stages.approvers.approver")
      .populate("stages.approvedBy.user");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Phiếu xuất kho");

    worksheet.columns = [
      { header: "Mã phiếu", key: "tag", width: 15 },
      { header: "Tiêu đề", key: "title", width: 25 },
      { header: "Tên phiếu", key: "name", width: 30 },
      { header: "Trạm", key: "costCenter", width: 20 },
      { header: "Nhóm", key: "groupName", width: 20 },
      { header: "Tên khai báo nhóm", key: "groupDeclarationName", width: 25 },
      { header: "Tên dự án", key: "projectName", width: 25 },
      { header: "Tổng chi phí", key: "grandTotalCost", width: 18 },
      { header: "Tình trạng", key: "status", width: 15 },
      { header: "Lý do từ chối", key: "suspendReason", width: 30 },
      { header: "Người nộp", key: "submittedBy", width: 20 },
      { header: "Ngày nộp", key: "submissionDate", width: 15 },
      { header: "Người phê duyệt", key: "approvers", width: 35 },
      { header: "Đã phê duyệt bởi", key: "approvedBy", width: 35 },
      { header: "Số lượng sản phẩm", key: "productCount", width: 18 },
      { header: "Chi tiết sản phẩm", key: "productsList", width: 50 },
      { header: "Tổng tiền sản phẩm", key: "totalProductsCost", width: 20 },
      { header: "Tổng tiền sau VAT", key: "totalAfterVat", width: 20 },
      { header: "Số phiếu đề xuất", key: "proposalCount", width: 18 },
      { header: "Công việc đề xuất", key: "proposalTasks", width: 40 },
      { header: "Mô tả đề xuất", key: "proposalDescriptions", width: 50 },
      { header: "Trạng thái đề xuất", key: "proposalStatuses", width: 25 },
      { header: "Số file đính kèm", key: "fileCount", width: 18 },
      { header: "Danh sách file", key: "filesList", width: 40 },
    ];

    documents.forEach((doc) => {
      // --- People lists ---
      const approversList = doc.approvers
        .map((a) => `${a.approver?.username || a.username} (${a.subRole})`)
        .join("\n");

      const approvedByList = doc.approvedBy
        .map((a) => {
          const date = a.approvalDate || ""; // no new Date()
          return `${a.user?.username || a.username} - ${date}`;
        })
        .join("\n");

      // --- Products list with line breaks ---
      const productList =
        doc.products
          ?.map((p) => {
            const vatInfo = p.vat ? ` | VAT: ${p.vat}%` : "";
            const noteInfo = p.note ? ` | Ghi chú: ${p.note}` : "";
            return `${p.productName} (SL: ${
              p.amount
            } x ${p.costPerUnit?.toLocaleString()} = ${p.totalCost?.toLocaleString()}${vatInfo}${noteInfo})`;
          })
          .join("\n") || "";

      const totalProductsCost =
        doc.products?.reduce((sum, p) => sum + (p.totalCost || 0), 0) || 0;
      const totalAfterVat =
        doc.products?.reduce((sum, p) => sum + (p.totalCostAfterVat || 0), 0) ||
        0;

      // --- Appended proposals ---
      const proposalCount = doc.appendedProposals?.length || 0;
      const proposalTasks =
        doc.appendedProposals
          ?.map((p) => p.task)
          .filter(Boolean)
          .join("; ") || "";
      const proposalDescriptions =
        doc.appendedProposals
          ?.map((p) => p.detailsDescription)
          .filter(Boolean)
          .join("; ") || "";
      const proposalStatuses =
        doc.appendedProposals
          ?.map((p) => {
            const status =
              p.status === "Approved"
                ? "Đã duyệt"
                : p.status === "Suspended"
                ? "Từ chối"
                : "Chờ duyệt";
            return `${p.task || "N/A"}: ${status}`;
          })
          .join("; ") || "";

      // --- Files ---
      const fileCount = doc.fileMetadata?.length || 0;
      const filesList =
        doc.fileMetadata
          ?.map((f) => {
            const fileName = f.displayName || f.name || "Unknown";
            const fileSize = f.size || "N/A";
            const link = f.link || "";
            return link
              ? `${fileName} (${fileSize}) - ${link}`
              : `${fileName} (${fileSize})`;
          })
          .join("; ") || "";

      const statusVietnamese =
        doc.status === "Approved"
          ? "Đã phê duyệt"
          : doc.status === "Suspended"
          ? "Từ chối"
          : "Chờ phê duyệt";

      worksheet.addRow({
        tag: doc.tag || "",
        title: doc.title || "Delivery Document",
        name: doc.name,
        costCenter: doc.costCenter,
        groupName: doc.groupName || "",
        groupDeclarationName: doc.groupDeclarationName || "",
        projectName: doc.projectName || "",
        grandTotalCost: doc.grandTotalCost || 0,
        status: statusVietnamese,
        suspendReason: doc.suspendReason || "",
        submittedBy: doc.submittedBy?.username || "",
        submissionDate: doc.submissionDate || "", // no new Date()
        approvers: approversList,
        approvedBy: approvedByList,
        productCount: doc.products?.length || 0,
        productsList: productList,
        totalProductsCost,
        totalAfterVat,
        proposalCount,
        proposalTasks,
        proposalDescriptions,
        proposalStatuses,
        fileCount,
        filesList,
      });
    });

    // --- Formatting and styling remain the same ---
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF000000" },
    };
    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    headerRow.height = 30;

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        if (rowNumber > 1) cell.alignment = { vertical: "top", wrapText: true };
      });
    });

    const currencyCols = [
      "grandTotalCost",
      "totalProductsCost",
      "totalAfterVat",
    ];
    currencyCols.forEach((key) => {
      worksheet.getColumn(key).numFmt = "#,##0 ₫";
      worksheet.getColumn(key).alignment = {
        horizontal: "right",
        vertical: "top",
      };
    });

    const countCols = ["productCount", "proposalCount", "fileCount"];
    countCols.forEach((key) => {
      worksheet.getColumn(key).alignment = {
        horizontal: "center",
        vertical: "top",
      };
    });

    worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length },
    };

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `phieu_xuat_kho_${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).send("Lỗi khi xuất dữ liệu");
  }
};

//// END OF DELIVERY DOCUMENT CONTROLLER

//// RECEIPT DOCUMENT CONTROLLER
// Fetch all Receipt Documents
exports.getReceiptDocumentsForSeparatedView = async (req, res) => {
  try {
    // Get user info from authMiddleware
    const userId = req._id;
    const userRole = req.role;
    const username = req.user.username;

    // Find documents that the user has access to
    const receiptDocuments = await ReceiptDocument.find(
      documentUtils.filterDocumentsByUserAccess(userId, userRole)
    )
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username");

    // Apply username-specific filtering for restricted users
    const filteredDocuments = documentUtils.filterDocumentsByUsername(
      receiptDocuments,
      username
    );

    // Sort the documents by status priority and approval date
    const sortedDocuments =
      documentUtils.sortDocumentsByStatusAndDate(filteredDocuments);

    // Calculate counts for approved and unapproved documents
    const { approvedDocument, unapprovedDocument } =
      documentUtils.countDocumentsByStatus(sortedDocuments);

    res.json({
      receiptDocuments: sortedDocuments,
      approvedDocument,
      unapprovedDocument,
    });
  } catch (err) {
    console.error("Error fetching receipt documents:", err);
    res.status(500).send("Error fetching receipt documents");
  }
};

// Fetch a specific Receipt Document by ID
exports.getReceiptDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await ReceiptDocument.findById(id)
      .populate("submittedBy", "username")
      .populate("approvers.approver", "username role")
      .populate("approvedBy.user", "username")
      .populate("appendedProposals.submittedBy", "username");
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json(document);
  } catch (error) {
    console.error("Error fetching receipt document:", error);
    res.status(500).json({ message: "Error fetching document" });
  }
};

// Update a Receipt Document
exports.updateReceiptDocument = async (req, res) => {
  let tempFilePaths = [];
  try {
    const { id } = req.params;
    const files = req.files;

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

    // Parse current file metadata
    let currentFiles = [];
    if (req.body.currentFileMetadata) {
      try {
        currentFiles = JSON.parse(req.body.currentFileMetadata);
      } catch (error) {
        console.error("Error parsing current file metadata:", error);
      }
    }

    const doc = await ReceiptDocument.findById(id);
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

    // Handle multiple file uploads if new files provided
    let uploadedFilesData = [];
    if (files && files.length > 0) {
      req.body.title = doc.title;
      uploadedFilesData = await handleMultipleFileUploads(req);
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

    // Update file metadata
    doc.fileMetadata = [...currentFiles, ...uploadedFilesData];

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
    console.error("Error updating receipt document:", error);
    res.status(500).json({
      message: "Error updating document",
      error: error.message,
    });
  } finally {
    // Clean up temp files
    tempFilePaths.forEach((tempFilePath) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up temp file:", cleanupError);
        }
      }
    });
  }
};

exports.deleteReceiptDocumentFile = async (req, res) => {
  const { docId, fileId } = req.params;

  try {
    const document = await ReceiptDocument.findById(docId);
    if (!document) {
      return res.status(404).json({ message: "Không tìm thấy phiếu nhập kho" });
    }

    // Check if document is approved
    if (document.status === "Approved") {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã được phê duyệt",
      });
    }

    // Check if document has any approvals
    if (document.approvedBy && document.approvedBy.length > 0) {
      return res.status(400).json({
        message: "Không thể xóa tệp tin của phiếu đã có người phê duyệt",
      });
    }

    // Find the file to delete
    const fileToDelete = document.fileMetadata.find(
      (file) => file.driveFileId === fileId || file._id.toString() === fileId
    );

    if (!fileToDelete) {
      return res.status(404).json({ message: "Không tìm thấy tệp tin" });
    }

    // Delete the file from Nextcloud storage
    if (fileToDelete.path) {
      try {
        const client = getNextcloudClient();
        await client.deleteFile(fileToDelete.path);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
      }
    }

    // Remove the file from the document's fileMetadata array
    document.fileMetadata = document.fileMetadata.filter(
      (file) => file.driveFileId !== fileId && file._id.toString() !== fileId
    );

    await document.save();

    res.json({
      success: true,
      message: "Tệp tin đã được xóa thành công",
      remainingFiles: document.fileMetadata.length,
    });
  } catch (error) {
    console.error("Error deleting receipt document file:", error);
    res.status(500).json({
      message: "Lỗi khi xóa tệp tin",
      error: error.message,
    });
  }
};

exports.exportReceiptDocumentsToExcel = async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).send("Invalid document IDs");
    }

    const documents = await ReceiptDocument.find({
      _id: { $in: documentIds },
    })
      .populate("submittedBy")
      .populate("approvers.approver")
      .populate("approvedBy.user")
      .populate("appendedProposals.submittedBy")
      .populate("appendedProposals.approvers.approver")
      .populate("appendedProposals.approvedBy.user")
      .populate("stages.approvers.approver")
      .populate("stages.approvedBy.user");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Phiếu xuất kho");

    worksheet.columns = [
      { header: "Mã phiếu", key: "tag", width: 15 },
      { header: "Tiêu đề", key: "title", width: 25 },
      { header: "Tên phiếu", key: "name", width: 30 },
      { header: "Trạm", key: "costCenter", width: 20 },
      { header: "Nhóm", key: "groupName", width: 20 },
      { header: "Tên khai báo nhóm", key: "groupDeclarationName", width: 25 },
      { header: "Tên dự án", key: "projectName", width: 25 },
      { header: "Tổng chi phí", key: "grandTotalCost", width: 18 },
      { header: "Tình trạng", key: "status", width: 15 },
      { header: "Lý do từ chối", key: "suspendReason", width: 30 },
      { header: "Người nộp", key: "submittedBy", width: 20 },
      { header: "Ngày nộp", key: "submissionDate", width: 15 },
      { header: "Người phê duyệt", key: "approvers", width: 35 },
      { header: "Đã phê duyệt bởi", key: "approvedBy", width: 35 },
      { header: "Số lượng sản phẩm", key: "productCount", width: 18 },
      { header: "Chi tiết sản phẩm", key: "productsList", width: 50 },
      { header: "Tổng tiền sản phẩm", key: "totalProductsCost", width: 20 },
      { header: "Tổng tiền sau VAT", key: "totalAfterVat", width: 20 },
      { header: "Số phiếu đề xuất", key: "proposalCount", width: 18 },
      { header: "Công việc đề xuất", key: "proposalTasks", width: 40 },
      { header: "Mô tả đề xuất", key: "proposalDescriptions", width: 50 },
      { header: "Trạng thái đề xuất", key: "proposalStatuses", width: 25 },
      { header: "Số file đính kèm", key: "fileCount", width: 18 },
      { header: "Danh sách file", key: "filesList", width: 40 },
    ];

    documents.forEach((doc) => {
      // --- People lists ---
      const approversList = doc.approvers
        .map((a) => `${a.approver?.username || a.username} (${a.subRole})`)
        .join("\n");

      const approvedByList = doc.approvedBy
        .map((a) => {
          const date = a.approvalDate || ""; // no new Date()
          return `${a.user?.username || a.username} - ${date}`;
        })
        .join("\n");

      // --- Products list with line breaks ---
      const productList =
        doc.products
          ?.map((p) => {
            const vatInfo = p.vat ? ` | VAT: ${p.vat}%` : "";
            const noteInfo = p.note ? ` | Ghi chú: ${p.note}` : "";
            return `${p.productName} (SL: ${
              p.amount
            } x ${p.costPerUnit?.toLocaleString()} = ${p.totalCost?.toLocaleString()}${vatInfo}${noteInfo})`;
          })
          .join("\n") || "";

      const totalProductsCost =
        doc.products?.reduce((sum, p) => sum + (p.totalCost || 0), 0) || 0;
      const totalAfterVat =
        doc.products?.reduce((sum, p) => sum + (p.totalCostAfterVat || 0), 0) ||
        0;

      // --- Appended proposals ---
      const proposalCount = doc.appendedProposals?.length || 0;
      const proposalTasks =
        doc.appendedProposals
          ?.map((p) => p.task)
          .filter(Boolean)
          .join("; ") || "";
      const proposalDescriptions =
        doc.appendedProposals
          ?.map((p) => p.detailsDescription)
          .filter(Boolean)
          .join("; ") || "";
      const proposalStatuses =
        doc.appendedProposals
          ?.map((p) => {
            const status =
              p.status === "Approved"
                ? "Đã duyệt"
                : p.status === "Suspended"
                ? "Từ chối"
                : "Chờ duyệt";
            return `${p.task || "N/A"}: ${status}`;
          })
          .join("; ") || "";

      // --- Files ---
      const fileCount = doc.fileMetadata?.length || 0;
      const filesList =
        doc.fileMetadata
          ?.map((f) => {
            const fileName = f.displayName || f.name || "Unknown";
            const fileSize = f.size || "N/A";
            const link = f.link || "";
            return link
              ? `${fileName} (${fileSize}) - ${link}`
              : `${fileName} (${fileSize})`;
          })
          .join("; ") || "";

      const statusVietnamese =
        doc.status === "Approved"
          ? "Đã phê duyệt"
          : doc.status === "Suspended"
          ? "Từ chối"
          : "Chờ phê duyệt";

      worksheet.addRow({
        tag: doc.tag || "",
        title: doc.title || "Receipt Document",
        name: doc.name,
        costCenter: doc.costCenter,
        groupName: doc.groupName || "",
        groupDeclarationName: doc.groupDeclarationName || "",
        projectName: doc.projectName || "",
        grandTotalCost: doc.grandTotalCost || 0,
        status: statusVietnamese,
        suspendReason: doc.suspendReason || "",
        submittedBy: doc.submittedBy?.username || "",
        submissionDate: doc.submissionDate || "", // no new Date()
        approvers: approversList,
        approvedBy: approvedByList,
        productCount: doc.products?.length || 0,
        productsList: productList,
        totalProductsCost,
        totalAfterVat,
        proposalCount,
        proposalTasks,
        proposalDescriptions,
        proposalStatuses,
        fileCount,
        filesList,
      });
    });

    // --- Formatting and styling remain the same ---
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF000000" },
    };
    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    headerRow.height = 30;

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        if (rowNumber > 1) cell.alignment = { vertical: "top", wrapText: true };
      });
    });

    const currencyCols = [
      "grandTotalCost",
      "totalProductsCost",
      "totalAfterVat",
    ];
    currencyCols.forEach((key) => {
      worksheet.getColumn(key).numFmt = "#,##0 ₫";
      worksheet.getColumn(key).alignment = {
        horizontal: "right",
        vertical: "top",
      };
    });

    const countCols = ["productCount", "proposalCount", "fileCount"];
    countCols.forEach((key) => {
      worksheet.getColumn(key).alignment = {
        horizontal: "center",
        vertical: "top",
      };
    });

    worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length },
    };

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `phieu_xuat_kho_${timestamp}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).send("Lỗi khi xuất dữ liệu");
  }
};
//// END OF RECEIPT DOCUMENT CONTROLLER

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
          const client = await getNextcloudClient();
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
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
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

    // Helper function to get priority order for sorting
    const getPriorityOrder = (priority) => {
      const priorityMap = {
        Cao: 1, // High priority
        "Trung bình": 2, // Medium priority
        Thấp: 3, // Low priority
      };
      return priorityMap[priority] || 4; // Unknown priorities go last
    };

    // Helper function to get effective priority for sorting (stage priority if unapproved stages exist, otherwise document priority)
    const getEffectivePriority = (doc) => {
      // Check if document has unapproved stages
      const unapprovedStages = doc.stages
        ? doc.stages.filter((stage) => stage.status !== "Approved")
        : [];

      if (unapprovedStages.length > 0) {
        // Use the highest priority (lowest number) from unapproved stages
        const highestStagePriority = Math.min(
          ...unapprovedStages.map((stage) => getPriorityOrder(stage.priority))
        );
        return highestStagePriority;
      } else {
        // Use document's own priority if no unapproved stages
        return getPriorityOrder(doc.priority);
      }
    };

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
      let filteredDocs = documentUtils
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

      // Sort by effective priority (stage priority if unapproved stages exist, otherwise document priority)
      filteredDocs = filteredDocs.sort((a, b) => {
        const priorityA = getEffectivePriority(a);
        const priorityB = getEffectivePriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB; // Sort by effective priority first
        }

        // If priorities are the same, sort by submission date (newest first)
        return new Date(b.submissionDate) - new Date(a.submissionDate);
      });

      return {
        count: filteredDocs.length,
        documents: filteredDocs.map((doc) => ({
          id: doc._id,
          title: doc.title || type,
          tag: doc.tag ?? null,
          name: doc.name ?? null,
          task: doc.task ?? null,
          priority: doc.priority ?? null, // Include priority in response
          effectivePriority: getEffectivePriority(doc), // Include effective priority for debugging
          submittedBy: doc.submittedBy?.username || "Unknown",
          submissionDate: doc.submissionDate,
          stages: doc.stages?.map((stage) => ({
            name: stage.name,
            amount: stage.amount,
            status: stage.status,
            priority: stage.priority, // Include stage priority
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
      getUnapprovedDocs(ReceiptDocument, "Receipt"),
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
