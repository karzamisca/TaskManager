// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const ProposalDocument = require("../models/ProposalDocument");
const ProcessingDocument = require("../models/ProcessingDocument");
const ReportDocument = require("../models/ReportDocument");
const drive = require("../middlewares/googleAuthMiddleware.js");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  createGenericDocTemplate,
  createProposalDocTemplate,
  createProcessingDocTemplate,
  createReportDocTemplate,
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

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// For restricting cost center
exports.getCurrentUser = (req, res) => {
  if (req.user) {
    return res.json({ username: req.user.username });
  }
  res.send("Unauthorized");
};
exports.getCostCenterRestrictions = (req, res) => {
  const costCenterRestrictions = {
    "Bình An 1": ["VuongVanBe", "BuiTheVinh"],
    "Trần Quang": ["PhamLeTam", "LeVanTuan", "PhamLeThanh"],
    "Châu Pha": ["NguyenTrongNghia"],
    GTSG: ["LeQuangThanh"],
    "Phú Mỹ 3": ["PhamVanDung", "PhanVanLong"],
    Sentai: ["NguyenVanKy"],
    "Tiến Đạt": ["LuongDucMinh", "VoThanhPhuoc", "VoThanhDuc"],
    "Núi Sò": ["PhamAnhTuan", "VoThanhTrung"],
    "T&T": ["BuiVanQuyet", "DuongDucChanh"],
  };

  res.json(costCenterRestrictions);
};

exports.exportDocumentToDocx = async (req, res) => {
  const { id } = req.params;
  try {
    let doc =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await ProcessingDocument.findById(id)) ||
      (await ReportDocument.findById(id));

    if (!doc) {
      return res.send("Không tìm thấy tài liệu/Document not found");
    }

    let buffer;
    switch (doc.title) {
      case "Generic Document":
        buffer = await createGenericDocTemplate(doc);
        break;
      case "Proposal Document":
        buffer = await createProposalDocTemplate(doc);
        break;
      case "Processing Document":
        buffer = await createProcessingDocTemplate(doc);
        break;
      case "Report Document":
        buffer = await createReportDocTemplate(doc);
        break;
      default:
        return res.send("Tài liệu chưa được hỗ trợ/Unsupported document type");
    }

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${doc.title}.docx"`,
    });
    res.send(buffer);
  } catch (err) {
    console.error(err);
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
      approvedProposal,
      approvedProcessingDocument,
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
          parents: [folderId], // Replace with your Google Drive folder ID
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
          maintenance: req.body.maintenance,
          costCenter: req.body.costCenter,
          dateOfError: req.body.dateOfError,
          errorDescription: req.body.errorDescription,
          direction: req.body.direction,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData, // Attach file data
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else if (title === "Processing Document") {
        const productEntries = products.map((product) => ({
          ...product,
          note: product.note || "",
          totalCost: parseFloat(product.costPerUnit * product.amount),
        }));

        const grandTotalCost = parseFloat(
          productEntries.reduce((acc, product) => acc + product.totalCost, 0)
        );

        let appendedContent = [];

        if (approvedProposal) {
          const proposal = await ProposalDocument.findById(approvedProposal);
          if (proposal) {
            // Create a valid fileMetadata object or set to undefined if no file exists
            const proposalFileMetadata =
              proposal.fileMetadata &&
              Object.keys(proposal.fileMetadata).length > 0
                ? {
                    driveFileId: proposal.fileMetadata.driveFileId || "",
                    name: proposal.fileMetadata.name || "",
                    link: proposal.fileMetadata.link || "",
                  }
                : undefined;

            appendedContent.push({
              maintenance: proposal.maintenance,
              costCenter: proposal.costCenter,
              dateOfError: proposal.dateOfError,
              errorDescription: proposal.errorDescription,
              direction: proposal.direction,
              fileMetadata: proposalFileMetadata, // Use the properly formatted fileMetadata
            });
          }
        }

        newDocument = new ProcessingDocument({
          title,
          products: productEntries,
          grandTotalCost,
          appendedContent,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData || undefined, // Use undefined instead of null
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else if (title === "Report Document") {
        const randomString = generateRandomString(24);
        const tags = `${randomString}- ${req.user.id}- ${
          req.user.department
        }- ${moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss")}`;

        newDocument = new ReportDocument({
          title,
          tags,
          postProcessingReport: req.body.postProcessingReport,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData, // Attach file data
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });

        if (approvedProcessingDocument) {
          const processingDoc = await ProcessingDocument.findById(
            approvedProcessingDocument
          );
          if (processingDoc) {
            newDocument.appendedProcessingDocument = processingDoc;
          }
        }
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
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData, // Attach file data
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
    const pendingProcessingDocs = await ProcessingDocument.find({
      approved: false,
    }).populate("submittedBy", "username");
    const pendingProposalDocs = await ProposalDocument.find({
      approved: false,
    }).populate("submittedBy", "username");
    const pendingGenericDocs = await Document.find({
      approved: false,
    }).populate("submittedBy", "username");
    const pendingReportDocs = await Document.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Serve the static HTML file and pass documents as JSON
    res.sendFile(
      path.join(__dirname, "../views/approvals/documents/approveDocument.html"),
      {
        pendingGenericDocs: JSON.stringify(pendingGenericDocs),
        pendingProposalDocs: JSON.stringify(pendingProposalDocs),
        pendingProcessingDocs: JSON.stringify(pendingProcessingDocs),
        pendingReportDocs: JSON.stringify(pendingReportDocs),
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
    if (req.user.role !== "approver") {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền phê duyệt tài liệu./Access denied. You don't have permission to approve document."
      );
    }

    // Check if the document is a Generic, Proposal, or Processing Document
    let document =
      (await Document.findById(id)) ||
      (await ProposalDocument.findById(id)) ||
      (await ProcessingDocument.findById(id)) ||
      (await ReportDocument.findById(id));

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
    if (document instanceof ProcessingDocument) {
      await ProcessingDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ProposalDocument) {
      await ProposalDocument.findByIdAndUpdate(id, document);
    } else if (document instanceof ReportDocument) {
      await ReportDocument.findByIdAndUpdate(id, document);
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    res.redirect("/approveDocument");
  } catch (err) {
    console.error("Error approving document:", err);
    res.send("Lỗi phê duyệt tài liệu/Error approving document");
  }
};

exports.getApprovedDocument = async (req, res) => {
  try {
    const approvedGenericDocs = await Document.find({
      approved: true,
    }).populate("submittedBy", "username");
    const approvedProposalDocs = await ProposalDocument.find({
      approved: true,
    }).populate("submittedBy", "username");
    const approvedProcessingDocs = await ProcessingDocument.find({
      approved: true,
    }).populate("submittedBy", "username");
    const approvedReportDocs = await ReportDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Serve the static HTML file and pass documents as JSON
    res.sendFile(
      path.join(
        __dirname,
        "../views/approvals/documents/viewApprovedDocument.html"
      ),
      {
        approvedGenericDocs: JSON.stringify(approvedGenericDocs),
        approvedProposalDocs: JSON.stringify(approvedProposalDocs),
        approvedProcessingDocs: JSON.stringify(approvedProcessingDocs),
        approvedReportDocs: JSON.stringify(approvedReportDocs),
      }
    );
  } catch (err) {
    console.error("Error fetching approved documents:", err);
    res.send("Lỗi lấy tài liệu đã phê duyệt/Error fetching approved documents");
  }
};

exports.getPendingDocumentApi = async (req, res) => {
  try {
    // Fetch pending generic documents
    const pendingGenericDocs = await Document.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Fetch pending proposal documents
    const pendingProposalDocs = await ProposalDocument.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Fetch pending processing documents
    const pendingProcessingDocs = await ProcessingDocument.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Fetch pending report documents
    const pendingReportDocs = await ReportDocument.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Combine both document types into a single array
    const pendingDocuments = [
      ...pendingGenericDocs,
      ...pendingProposalDocs,
      ...pendingProcessingDocs,
      ...pendingReportDocs,
    ];

    // Return combined pending documents as JSON
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
    // Fetch approved generic documents
    const approvedGenericDocs = await Document.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Fetch approved proposal documents
    const approvedProposalDocs = await ProposalDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Fetch approved proposal documents
    const approvedProcessingDocs = await ProcessingDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Fetch approved report documents
    const approvedReportDocs = await ReportDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Combine both document types into a single array
    const approvedDocuments = [
      ...approvedGenericDocs,
      ...approvedProposalDocs,
      ...approvedProcessingDocs,
      ...approvedReportDocs,
    ];

    // Return combined approved documents as JSON
    res.json(approvedDocuments);
  } catch (err) {
    console.error("Error fetching approved documents:", err);
    res.send("Lỗi lấy tài liệu đang chờ/Error fetching approved documents");
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
      document = await ProcessingDocument.findById(id);
      if (document) documentType = "Processing";
    }

    if (!document && documentType === "Generic") {
      document = await ReportDocument.findById(id);
      if (document) documentType = "Report";
    }

    if (!document) {
      return res.send("Document not found");
    }

    // Delete the document based on its type
    if (documentType === "Proposal") {
      await ProposalDocument.findByIdAndDelete(id);
    } else if (documentType === "Processing") {
      await ProcessingDocument.findByIdAndDelete(id);
    } else if (documentType === "Report") {
      await ReportDocument.findByIdAndDelete(id);
    } else {
      await Document.findByIdAndDelete(id);
    }

    res.redirect("/approveDocument"); // Redirect after deletion
  } catch (err) {
    console.error("Error deleting document:", err);
    res.send("Lỗi xóa tài liệu/Error deleting document");
  }
};

exports.getApprovedProposalDocuments = async (req, res) => {
  try {
    const approvedProposals = await ProposalDocument.find({ approved: true });
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

exports.getApprovedProcessingDocuments = async (req, res) => {
  try {
    const approvedProcessingDocs = await ProcessingDocument.find({
      approved: true,
    });
    res.json(approvedProcessingDocs);
  } catch (err) {
    console.error("Error fetching approved processing documents:", err);
    res.send(
      "Lỗi lấy tài liệu xử lý đã phê duyệt/Error fetching approved processing documents"
    );
  }
};

exports.getProcessingDocumentById = async (req, res) => {
  try {
    const processingDoc = await ProcessingDocument.findById(req.params.id);
    if (!processingDoc)
      return res.send(
        "Không tìm thấy tài liệu xử lý/Processing document not found"
      );
    res.json(processingDoc);
  } catch (err) {
    console.error("Error fetching processing document:", err);
    res.send("Lỗi lấy tài liệu xử lý/Error fetching processing document");
  }
};
