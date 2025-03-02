// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const CostCenter = require("../models/CostCenter");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const ProposalDocument = require("../models/ProposalDocument");
const PurchasingDocument = require("../models/PurchasingDocument.js");
const DeliveryDocument = require("../models/DeliveryDocument");
const PaymentDocument = require("../models/PaymentDocument.js");
const drive = require("../middlewares/googleAuthMiddleware.js");
const { Readable } = require("stream");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  sendEmail,
  groupDocumentsByApprover,
} = require("../utils/emailService");
const {
  createGenericDocTemplate,
  createProposalDocTemplate,
  createPurchasingDocTemplate,
  createDeliveryDocTemplate,
  createPaymentDocTemplate,
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

    // Send the list of allowed cost centers as a response
    res.json(costCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.sendPendingApprovalEmails = async (allDocuments) => {
  try {
    // Group documents by approver
    const documentsByApprover = groupDocumentsByApprover(allDocuments);

    // Fetch all relevant users at once
    const approverIds = Array.from(documentsByApprover.keys());
    const users = await User.find({ _id: { $in: approverIds } });

    // Send consolidated emails to each approver
    for (const user of users) {
      const userDocuments = documentsByApprover.get(user._id.toString());
      if (!userDocuments || userDocuments.length === 0) continue;

      // Create the email content
      const subject = "Danh sách phiếu cần phê duyệt";
      let text = `Xin chào ${user.username},\n\n`;
      text += `Bạn có ${userDocuments.length} phiếu đang chờ phê duyệt:\n\n`;

      // Group documents by type
      const documentsByType = userDocuments.reduce((acc, doc) => {
        if (!acc[doc.type]) acc[doc.type] = [];
        acc[doc.type].push(doc);
        return acc;
      }, {});

      // Add documents grouped by type to the email
      Object.entries(documentsByType).forEach(([type, docs]) => {
        text += `${type}:\n`;
        docs.forEach((doc) => {
          text += `ID: ${doc.id}\n`;
        });
        text += "\n";
      });

      text += `\nXin cảm ơn,\nHệ thống quản lý tác vụ tự động Kỳ Long.`;

      await sendEmail(user.email, subject, text);
    }
  } catch (error) {
    console.error("Error sending pending approval emails:", error);
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
      (await PaymentDocument.findById(id));

    if (!doc) {
      return res.status(404).send("Không tìm thấy tài liệu/Document not found");
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
        default:
          return res.send(
            "Tài liệu chưa được hỗ trợ/Unsupported document type"
          );
      }
    } catch (err) {
      console.error("Error creating document template:", err);
      return res.send("Lỗi tạo mẫu tài liệu/Error creating document template");
    }

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${doc.title}.docx"`,
    });
    res.send(buffer);
  } catch (err) {
    console.error("Error in exportDocumentToDocx:", err);
    res.send("Lỗi xuất tài liệu/Error exporting document");
  }
};

exports.submitDocument = async (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.send("Error uploading file.");
    }

    const {
      title,
      contentName,
      contentText,
      products,
      approvers,
      approvedDocuments,
      approvedProposals,
      approvedPurchasingDocument,
    } = req.body;

    try {
      // Ensure approvers is always an array
      const approversArray = Array.isArray(approvers) ? approvers : [approvers];

      // Fetch approver details
      const approverDetails = await Promise.all(
        approversArray.map(async (approverId) => {
          const approver = await User.findById(approverId);
          return {
            approver: approverId,
            username: approver.username,
            subRole: req.body[`subRole_${approverId}`],
          };
        })
      );

      let newDocument;

      // Handle file upload to Google Drive if a file is attached
      let uploadedFileData = null;
      if (req.file) {
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

        uploadedFileData = {
          driveFileId: driveResponse.data.id,
          name: driveResponse.data.name,
          link: driveResponse.data.webViewLink,
        };

        // Cleanup: Remove the local file
        fs.unlinkSync(req.file.path);
      }

      // Document creation logic
      if (title === "Proposal Document") {
        newDocument = new ProposalDocument({
          title,
          task: req.body.task,
          costCenter: req.body.costCenter,
          dateOfError: req.body.dateOfError,
          detailsDescription: req.body.detailsDescription,
          direction: req.body.direction,
          groupName: req.body.groupName,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData,
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else if (title === "Purchasing Document") {
        const productEntries = products.map((product) => ({
          ...product,
          note: product.note || "",
          totalCost: parseFloat(product.costPerUnit * product.amount),
          totalCostAfterVat: parseFloat(
            product.costPerUnit * product.amount +
              product.costPerUnit * product.amount * (product.vat / 100)
          ),
        }));

        const grandTotalCost = parseFloat(
          productEntries.reduce(
            (acc, product) => acc + product.totalCostAfterVat,
            0
          )
        );

        // Handle multiple proposal documents
        let appendedProposals = [];
        if (approvedProposals && approvedProposals.length > 0) {
          appendedProposals = await Promise.all(
            approvedProposals.map(async (proposalId) => {
              const proposal = await ProposalDocument.findById(proposalId);
              if (proposal) {
                const proposalFileMetadata =
                  proposal.fileMetadata &&
                  Object.keys(proposal.fileMetadata).length > 0
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
        }

        // Filter out any null values from failed lookups
        appendedProposals = appendedProposals.filter(
          (proposal) => proposal !== null
        );

        newDocument = new PurchasingDocument({
          title,
          products: productEntries,
          grandTotalCost,
          appendedProposals,
          groupName: req.body.groupName,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData,
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else if (title === "Delivery Document") {
        const productEntries = products.map((product) => ({
          ...product,
          note: product.note || "",
          totalCost: parseFloat(product.costPerUnit * product.amount),
          totalCostAfterVat: parseFloat(
            product.costPerUnit * product.amount +
              product.costPerUnit * product.amount * (product.vat / 100)
          ),
        }));

        const grandTotalCost = parseFloat(
          productEntries.reduce(
            (acc, product) => acc + product.totalCostAfterVat,
            0
          )
        );

        let appendedProposals = [];
        if (approvedProposals && approvedProposals.length > 0) {
          appendedProposals = await Promise.all(
            approvedProposals.map(async (proposalId) => {
              const proposal = await ProposalDocument.findById(proposalId);
              if (proposal) {
                const proposalFileMetadata =
                  proposal.fileMetadata &&
                  Object.keys(proposal.fileMetadata).length > 0
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
        }

        appendedProposals = appendedProposals.filter(
          (proposal) => proposal !== null
        );

        newDocument = new DeliveryDocument({
          title,
          name: req.body.name,
          costCenter: req.body.costCenter,
          products: productEntries,
          grandTotalCost,
          appendedProposals,
          groupName: req.body.groupName,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData,
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else if (title === "Payment Document") {
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

        newDocument = new PaymentDocument({
          tag,
          title,
          name: req.body.name,
          content: req.body.content,
          paymentMethod: req.body.paymentMethod,
          totalPayment: req.body.totalPayment,
          advancePayment: req.body.advancePayment || 0,
          paymentDeadline: req.body.paymentDeadline,
          groupName: req.body.groupName,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData,
          appendedPurchasingDocuments,
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else {
        const contentArray = [];

        if (Array.isArray(contentName) && Array.isArray(contentText)) {
          contentName.forEach((name, index) => {
            contentArray.push({ name, text: contentText[index] });
          });
        } else {
          contentArray.push({ name: contentName, text: contentText });
        }

        if (approvedDocuments && approvedDocuments.length > 0) {
          const approvedDocs = await Document.find({
            _id: { $in: approvedDocuments },
          });
          approvedDocs.forEach((doc) => contentArray.push(...doc.content));
        }

        newDocument = new Document({
          title,
          content: contentArray,
          groupName: req.body.groupName,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData,
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      }

      await newDocument.save();
      res.redirect("/mainDocument");
    } catch (err) {
      console.error("Error submitting document:", err);
      if (!res.headersSent) {
        res.send("Lỗi nộp tài liệu/Error submitting document");
      }
    }
  });
};

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
      }
    );
  } catch (err) {
    console.error("Error fetching pending documents:", err);
    res.send("Lỗi lấy tài liệu/Error fetching pending documents");
  }
};

exports.approveDocument = async (req, res) => {
  const { id } = req.params;
  try {
    if (
      ![
        "approver",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    // Check if the document is a Generic, Proposal, or Purchasing Document
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id)) ||
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
      document.status = "Approved"; // Update status to Approved
    }

    // Save document in the correct collection
    if (document instanceof PurchasingDocument) {
      await PurchasingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof PaymentDocument) {
      await PaymentDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof DeliveryDocument) {
      await DeliveryDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    const successMessage =
      document.status === "Approved"
        ? "Tài liệu đã được phê duyệt hoàn toàn./Document has been fully approved."
        : "Tài liệu đã được phê duyệt thành công./Document has been successfully approved.";

    return res.send(successMessage);
  } catch (err) {
    console.error("Error approving document:", err);
    return res.send("Lỗi phê duyệt tài liệu/Error approving document");
  }
};

exports.getApprovedDocument = async (req, res) => {
  try {
    const approvedGenericDocs = await Document.find({
      status: "Approved",
    }).populate("submittedBy", "username");
    const approvedProposalDocs = await ProposalDocument.find({
      status: "Approved",
    }).populate("submittedBy", "username");
    const approvedPurchasingDocs = await PurchasingDocument.find({
      status: "Approved",
    }).populate("submittedBy", "username");
    const approvedPaymentDocs = await PaymentDocument.find({
      status: "Approved",
    }).populate("submittedBy", "username");

    res.sendFile(
      path.join(
        __dirname,
        "../views/approvals/documents/unifiedViewDocuments/viewApprovedDocument.html"
      ),
      {
        approvedGenericDocs: JSON.stringify(approvedGenericDocs),
        approvedProposalDocs: JSON.stringify(approvedProposalDocs),
        approvedPurchasingDocs: JSON.stringify(approvedPurchasingDocs),
        approvedPaymentDocs: JSON.stringify(approvedPaymentDocs),
      }
    );
  } catch (err) {
    console.error("Error fetching approved documents:", err);
    res.send("Lỗi lấy tài liệu đã phê duyệt/Error fetching approved documents");
  }
};

exports.getPendingDocumentApi = async (req, res) => {
  try {
    const pendingGenericDocs = await Document.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingProposalDocs = await ProposalDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingPurchasingDocs = await PurchasingDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");
    const pendingPaymentDocs = await PaymentDocument.find({
      status: "Pending",
    }).populate("submittedBy", "username");

    const pendingDocuments = [
      ...pendingGenericDocs,
      ...pendingProposalDocs,
      ...pendingPurchasingDocs,
      ...pendingPaymentDocs,
    ];

    res.json(pendingDocuments);
  } catch (err) {
    console.error("Error fetching pending documents:", err);
    res.send(
      "Lỗi lấy tài liệu đang chờ phê duyệt/Error fetching pending documents"
    );
  }
};

exports.getApprovedDocumentApi = async (req, res) => {
  try {
    const approvedGenericDocs = await Document.find({
      status: "Approved",
    }).populate("submittedBy", "username");
    const approvedProposalDocs = await ProposalDocument.find({
      status: "Approved",
    }).populate("submittedBy", "username");
    const approvedPurchasingDocs = await PurchasingDocument.find({
      status: "Approved",
    }).populate("submittedBy", "username");
    const approvedPaymentDocs = await PaymentDocument.find({
      status: "Approved",
    }).populate("submittedBy", "username");

    const approvedDocuments = [
      ...approvedGenericDocs,
      ...approvedProposalDocs,
      ...approvedPurchasingDocs,
      ...approvedPaymentDocs,
    ];

    res.json(approvedDocuments);
  } catch (err) {
    console.error("Error fetching approved documents:", err);
    res.send("Lỗi lấy tài liệu đã phê duyệt/Error fetching approved documents");
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
    } else if (documentType === "Delivery") {
      await DeliveryDocument.findByIdAndDelete(id);
    } else {
      await Document.findByIdAndDelete(id);
    }

    // Send success message after deletion
    res.send(`Document of type ${documentType} has been successfully deleted`);
  } catch (err) {
    console.error("Error deleting document:", err);
    res.send("Lỗi xóa tài liệu/Error deleting document");
  }
};

exports.suspendDocument = async (req, res) => {
  const { id } = req.params;
  const { suspendReason } = req.body;

  try {
    // Restrict access to only users with the role of "director"
    if (req.user.role !== "director") {
      return res.send(
        "Truy cập bị từ chối. Chỉ giám đốc có quyền tạm dừng tài liệu./Access denied. Only directors can suspend documents."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy tài liệu/Document not found");
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

    res.send(
      "Tài liệu đã được tạm dừng thành công./Document has been suspended successfully."
    );
  } catch (err) {
    console.error("Lỗi khi tạm dừng tài liệu/Error suspending document:", err);
    res.status(500).send("Lỗi khi tạm dừng tài liệu/Error suspending document");
  }
};

exports.openDocument = async (req, res) => {
  const { id } = req.params;

  try {
    // Restrict access to only users with the role of "director"
    if (req.user.role !== "director") {
      return res.send(
        "Truy cập bị từ chối. Chỉ giám đốc có quyền mở lại tài liệu./Access denied. Only directors can reopen documents."
      );
    }

    // Find the document in any of the collections
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await PurchasingDocument.findById(id)) ||
      (await PaymentDocument.findById(id));

    if (!document) {
      return res.status(404).send("Không tìm thấy tài liệu/Document not found");
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

    res.send(
      "Tài liệu đã được mở lại thành công./Document has been reopened successfully."
    );
  } catch (err) {
    console.error("Lỗi khi mở lại tài liệu/Error reopening document:", err);
    res.status(500).send("Lỗi khi mở lại tài liệu/Error reopening document");
  }
};

exports.getApprovedProposalDocuments = async (req, res) => {
  try {
    const approvedProposals = await ProposalDocument.find({
      status: "Approved",
    });
    res.json(approvedProposals);
  } catch (err) {
    console.error("Error fetching approved proposals:", err);
    res.send(
      "Lỗi lấy tài liệu đề xuất đã phê duyệt/Error fetching approved proposals"
    );
  }
};

exports.getProposalDocumentById = async (req, res) => {
  try {
    const proposal = await ProposalDocument.findById(req.params.id);
    if (!proposal) return res.send("Proposal document not found");
    res.json(proposal);
  } catch (err) {
    console.error("Error fetching proposal document:", err);
    res.send("Lỗi lấy tài liệu đề xuất/Error fetching proposal document");
  }
};

exports.getApprovedPurchasingDocuments = async (req, res) => {
  try {
    const approvedPurchasingDocs = await PurchasingDocument.find({
      status: "Approved",
    });
    res.json(approvedPurchasingDocs);
  } catch (err) {
    console.error("Error fetching approved purchasing documents:", err);
    res.send(
      "Lỗi lấy tài liệu mua hàng đã phê duyệt/Error fetching approved purchasing documents"
    );
  }
};

exports.getPurchasingDocumentById = async (req, res) => {
  try {
    const purchasingDoc = await PurchasingDocument.findById(req.params.id);
    if (!purchasingDoc)
      return res.send(
        "Không tìm thấy tài liệu mua hàng/Purchasing document not found"
      );
    res.json(purchasingDoc);
  } catch (err) {
    console.error("Error fetching purchasing document:", err);
    res.send("Lỗi lấy tài liệu mua hàng/Error fetching purchasing document");
  }
};

exports.getPaymentDocumentForSeparatedView = async (req, res) => {
  try {
    const paymentDocuments = await PaymentDocument.find({});
    // Calculate the sum of totalPayment for approved and unapproved documents
    let approvedSum = 0; // Sum for documents with only one approver left
    let paidSum = 0; // Sum for fully approved documents
    let unapprovedSum = 0;
    let approvedDocument = 0;
    let unapprovedDocument = 0;

    paymentDocuments.forEach((doc) => {
      // Calculate paidSum based on the new logic
      if (doc.status === "Approved") {
        // If advance payment equals 0, then paid sum equals total payment
        if (doc.advancePayment === 0) {
          paidSum += doc.totalPayment;
        }
        // If total payment equals 0, then paid sum equals advance payment
        else if (doc.totalPayment === 0) {
          paidSum += doc.advancePayment;
        }
        // Otherwise, paid sum equals total payment minus advance payment
        else {
          paidSum += doc.totalPayment - doc.advancePayment;
        }

        approvedDocument += 1;
      } else if (doc.approvers.length - doc.approvedBy.length === 1) {
        approvedSum += doc.totalPayment; // Only one approver left
        unapprovedDocument += 1;
      } else {
        unapprovedSum += doc.totalPayment; // More than one approver left
        unapprovedDocument += 1;
      }
    });

    res.json({
      paymentDocuments,
      approvedSum,
      paidSum,
      unapprovedSum,
      approvedDocument,
      unapprovedDocument,
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
      paymentMethod,
      totalPayment,
      advancePayment,
      paymentDeadline,
    } = req.body;
    const file = req.file;

    const doc = await PaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update basic fields
    doc.name = name;
    doc.content = content;
    doc.paymentMethod = paymentMethod;
    doc.totalPayment = parseFloat(totalPayment);
    doc.advancePayment = parseFloat(advancePayment);
    doc.paymentDeadline = paymentDeadline;

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
    if (!["approver", "headOfAccounting"].includes(req.user.role)) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    const doc = await PaymentDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công/Declaration updated successfully");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
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

    await doc.save();
    res.json({ message: "Document updated successfully" });
  } catch (error) {
    console.error("Error updating proposal document:", error);
    res.status(500).json({ message: "Error updating document" });
  }
};
exports.getProposalDocumentForSeparatedView = async (req, res) => {
  try {
    const proposalDocuments = await ProposalDocument.find({});
    let approvedDocument = 0;
    let unapprovedDocument = 0;
    proposalDocuments.forEach((doc) => {
      if (doc.status === "Approved") {
        approvedDocument += 1;
      } else {
        unapprovedDocument += 1;
      }
    });
    res.json({
      proposalDocuments,
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
    if (!["approver", "headOfAccounting"].includes(req.user.role)) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    const doc = await ProposalDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công/Declaration updated successfully");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};

// Fetch all Purchasing Documents
exports.getPurchasingDocumentsForSeparatedView = async (req, res) => {
  try {
    const purchasingDocuments = await PurchasingDocument.find({}).populate(
      "submittedBy",
      "username"
    );

    // Calculate sums for approved and unapproved documents
    let approvedSum = 0;
    let unapprovedSum = 0;
    let approvedDocument = 0;
    let unapprovedDocument = 0;

    purchasingDocuments.forEach((doc) => {
      if (doc.status === "Approved") {
        approvedSum += doc.grandTotalCost;
        approvedDocument += 1;
      } else {
        unapprovedSum += doc.grandTotalCost;
        unapprovedDocument += 1;
      }
    });

    res.json({
      purchasingDocuments,
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

    const doc = await PurchasingDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Update basic fields
    doc.products = products;
    doc.grandTotalCost = grandTotalCost;
    if (appendedProposals) {
      doc.appendedProposals = appendedProposals;
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
      document: doc, // Return the updated document
    });
  } catch (error) {
    console.error("Error updating purchasing document:", error);
    res.status(500).json({
      message: "Error updating document",
      error: error.message, // Include error message for debugging
    });
  }
};
exports.updatePurchasingDocumentDeclaration = async (req, res) => {
  const { id } = req.params;
  const { declaration } = req.body;

  try {
    if (!["approver", "headOfAccounting"].includes(req.user.role)) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }

    const doc = await PurchasingDocument.findById(id);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    doc.declaration = declaration;
    await doc.save();

    res.send("Kê khai cập nhật thành công/Declaration updated successfully");
  } catch (error) {
    console.error("Error updating declaration:", error);
    res.status(500).json({ message: "Error updating declaration" });
  }
};

// Fetch all Delivery Documents
exports.getDeliveryDocumentsForSeparatedView = async (req, res) => {
  try {
    const deliveryDocuments = await DeliveryDocument.find({}).populate(
      "submittedBy",
      "username"
    );

    // Calculate sums for approved and unapproved documents
    let approvedSum = 0;
    let unapprovedSum = 0;
    let approvedDocument = 0;
    let unapprovedDocument = 0;

    deliveryDocuments.forEach((doc) => {
      if (doc.status === "Approved") {
        approvedSum += doc.grandTotalCost;
        approvedDocument += 1;
      } else {
        unapprovedSum += doc.grandTotalCost;
        unapprovedDocument += 1;
      }
    });

    res.json({
      deliveryDocuments,
      approvedSum,
      unapprovedSum,
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
