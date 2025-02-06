// controllers/documentController.js
const Document = require("../models/Document");
const User = require("../models/User");
const CostCenter = require("../models/CostCenter");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const ProposalDocument = require("../models/ProposalDocument");
const PurchasingDocument = require("../models/PurchasingDocument.js");
const PaymentDocument = require("../models/PaymentDocument.js");
const drive = require("../middlewares/googleAuthMiddleware.js");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  createGenericDocTemplate,
  createProposalDocTemplate,
  createPurchasingDocTemplate,
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

// Serve the cost center admin page
exports.getCostCenterAdminPage = (req, res) => {
  try {
    if (
      ![
        "approver",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "captainOfMech",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send(
          "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
        );
    }
    // Serve the HTML file
    res.sendFile(
      path.join(__dirname, "../views/approvals/documents/costCenterAdmin.html")
    );
  } catch (error) {
    console.error("Error serving the cost center admin page:", error);
    res.status(500).send("Server error");
  }
};
// API to fetch all cost centers
exports.getCostCenters = async (req, res) => {
  try {
    if (
      ![
        "approver",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "captainOfMech",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send(
          "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
        );
    }
    const costCenters = await CostCenter.find();
    res.json(costCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// Add a new cost center
exports.addCostCenter = async (req, res) => {
  const { name, allowedUsers } = req.body;

  try {
    const newCostCenter = new CostCenter({
      name,
      allowedUsers: allowedUsers ? allowedUsers.split(",") : [],
    });

    await newCostCenter.save();
    res.redirect("/costCenterAdmin"); // Redirect to the cost center page after adding
  } catch (error) {
    console.error("Error adding cost center:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// Edit an existing cost center
exports.editCostCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, allowedUsers } = req.body;

    // Ensure allowedUsers is a string
    let usersArray = [];

    if (typeof allowedUsers === "string") {
      usersArray = allowedUsers.split(",").map((user) => user.trim());
    } else if (Array.isArray(allowedUsers)) {
      usersArray = allowedUsers;
    }

    // Update cost center with the new allowed users list
    const updatedCostCenter = await CostCenter.findByIdAndUpdate(
      id,
      { name, allowedUsers: usersArray },
      { new: true }
    );

    if (!updatedCostCenter) {
      return res.status(404).json({ message: "Cost center not found" });
    }
    res.redirect("/costCenterAdmin");
  } catch (error) {
    console.error("Error editing cost center:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// Delete a cost center
exports.deleteCostCenter = async (req, res) => {
  try {
    const { id } = req.params;
    await CostCenter.findByIdAndDelete(id);
    res.json({ message: "Cost Center deleted successfully" });
  } catch (error) {
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
          task: req.body.task,
          costCenter: req.body.costCenter,
          dateOfError: req.body.dateOfError,
          detailsDescription: req.body.detailsDescription,
          direction: req.body.direction,
          groupName: req.body.groupName,
          submittedBy: req.user.id,
          approvers: approverDetails,
          fileMetadata: uploadedFileData, // Attach file data
          submissionDate: moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss"),
        });
      } else if (title === "Purchasing Document") {
        const productEntries = products.map((product) => ({
          ...product,
          note: product.note || "",
          totalCost: parseFloat(product.costPerUnit * product.amount),
        }));

        const grandTotalCost = parseFloat(
          productEntries.reduce((acc, product) => acc + product.totalCost, 0)
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
          fileMetadata: uploadedFileData || undefined,
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

        newDocument = new PaymentDocument({
          title,
          name: req.body.name,
          content: req.body.content,
          paymentMethod: req.body.paymentMethod,
          amountOfMoney: req.body.amountOfMoney,
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
    const pendingPurchasingDocs = await PurchasingDocument.find({
      approved: false,
    }).populate("submittedBy", "username");
    const pendingProposalDocs = await ProposalDocument.find({
      approved: false,
    }).populate("submittedBy", "username");
    const pendingGenericDocs = await Document.find({
      approved: false,
    }).populate("submittedBy", "username");
    const pendingPaymentDocs = await Document.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Serve the static HTML file and pass documents as JSON
    res.sendFile(
      path.join(__dirname, "../views/approvals/documents/unifiedViewDocuments/approveDocument.html"),
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
      (await PaymentDocument.findById(id));

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
    } else {
      await Document.findByIdAndUpdate(id, document);
    }

    const successMessage = document.approved
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
      approved: true,
    }).populate("submittedBy", "username");
    const approvedProposalDocs = await ProposalDocument.find({
      approved: true,
    }).populate("submittedBy", "username");
    const approvedPurchasingDocs = await PurchasingDocument.find({
      approved: true,
    }).populate("submittedBy", "username");
    const approvedPaymentDocs = await PaymentDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Serve the static HTML file and pass documents as JSON
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
    // Fetch pending generic documents
    const pendingGenericDocs = await Document.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Fetch pending proposal documents
    const pendingProposalDocs = await ProposalDocument.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Fetch pending purchasing documents
    const pendingPurchasingDocs = await PurchasingDocument.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Fetch pending payment documents
    const pendingPaymentDocs = await PaymentDocument.find({
      approved: false,
    }).populate("submittedBy", "username");

    // Combine both document types into a single array
    const pendingDocuments = [
      ...pendingGenericDocs,
      ...pendingProposalDocs,
      ...pendingPurchasingDocs,
      ...pendingPaymentDocs,
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
    const approvedPurchasingDocs = await PurchasingDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Fetch approved payment documents
    const approvedPaymentDocs = await PaymentDocument.find({
      approved: true,
    }).populate("submittedBy", "username");

    // Combine both document types into a single array
    const approvedDocuments = [
      ...approvedGenericDocs,
      ...approvedProposalDocs,
      ...approvedPurchasingDocs,
      ...approvedPaymentDocs,
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
      document = await PurchasingDocument.findById(id);
      if (document) documentType = "Purchasing";
    }
    if (!document && documentType === "Generic") {
      document = await PaymentDocument.findById(id);
      if (document) documentType = "Payment";
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

exports.getApprovedPurchasingDocuments = async (req, res) => {
  try {
    const approvedPurchasingDocs = await PurchasingDocument.find({
      approved: true,
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

    // Calculate the sum of amountOfMoney for approved and unapproved documents
    let approvedSum = 0;
    let unapprovedSum = 0;

    paymentDocuments.forEach((doc) => {
      if (doc.approved) {
        approvedSum += doc.amountOfMoney;
      } else {
        unapprovedSum += doc.amountOfMoney;
      }
    });

    res.json({
      paymentDocuments,
      approvedSum,
      unapprovedSum,
    });
  } catch (err) {
    console.error("Error fetching payment documents:", err);
    res.status(500).send("Error fetching payment documents");
  }
};
