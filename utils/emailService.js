// utils/emailService.js
const nodemailer = require("nodemailer");
const User = require("../models/User");

// Configure the transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Function to send an email
const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Helper function to get document type name
const getDocumentTypeName = (document) => {
  // Map model names to display names
  const typeMap = {
    Document: "Tài liệu chung",
    ProposalDocument: "Phiếu đề xuất",
    ProjectProposalDocument: "Phiếu đề nghị mở dự án",
    PurchasingDocument: "Phiếu mua hàng",
    DeliveryDocument: "Phiếu xuất kho",
    PaymentDocument: "Phiếu thanh toán",
    AdvancePaymentDocument: "Phiếu tạm ứng",
    // Add other document types as needed
  };
  return (
    typeMap[document.constructor.modelName] || document.title || "Tài liệu"
  );
};

// Enhanced filtering function that works with the specific document structure
const filterDocumentsByUsername = (documents, username) => {
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

  // Define the hierarchy: HoangNam → PhongTran → NguyenHongNhuThuy → HoaVu → HoangLong
  const hierarchy = {
    PhongTran: ["HoangNam"],
    NguyenHongNhuThuy: ["HoangNam", "PhongTran"],
    HoaVu: ["HoangNam", "PhongTran", "NguyenHongNhuThuy"],
    HoangLong: ["HoangNam", "PhongTran", "NguyenHongNhuThuy", "HoaVu"],
  };

  return documents.filter((doc) => {
    // Get all approver usernames
    const approverUsernames = doc.approvers.map(
      (approver) => approver.username
    );

    // Get all approved usernames
    const approvedUsernames = doc.approvedBy.map(
      (approval) => approval.username
    );

    // Check if current user has already approved this document
    if (approvedUsernames.includes(username)) {
      return true;
    }

    // Find pending approvers (those not in approvedBy)
    const pendingApprovers = doc.approvers.filter(
      (approver) => !approvedUsernames.includes(approver.username)
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
      for (const requiredApprover of hierarchy[username]) {
        // Check if this user is an approver for this document
        const isApproverForDoc = approverUsernames.includes(requiredApprover);

        // If they are an approver but haven't approved yet, block the current user
        if (isApproverForDoc && !approvedUsernames.includes(requiredApprover)) {
          hierarchyAllowsApproval = false;
          break;
        }
      }
    }

    return (
      allPendingAreRestricted && currentUserIsPending && hierarchyAllowsApproval
    );
  });
};

// Enhanced document grouping function
const groupDocumentsByApprover = (documents, username) => {
  const filteredDocuments = filterDocumentsByUsername(documents, username);
  const approverMap = new Map();

  filteredDocuments.forEach((document) => {
    // Only consider documents that are still pending
    if (document.status !== "Pending") return;

    const pendingApprovers = document.approvers.filter(
      (approver) =>
        !document.approvedBy.some(
          (approved) => approved.username === approver.username
        )
    );

    pendingApprovers.forEach((approver) => {
      if (!approverMap.has(approver.approver.toString())) {
        approverMap.set(approver.approver.toString(), []);
      }
      approverMap.get(approver.approver.toString()).push({
        title: document.title,
        type: getDocumentTypeName(document),
        id: document._id,
        submissionDate: document.submissionDate,
        amount: document.advancePayment, // Specific to AdvancePayment documents
        submittedBy: document.submittedBy,
      });
    });
  });

  return approverMap;
};

// Main function to send pending approval emails
const sendPendingApprovalEmails = async (allDocuments) => {
  try {
    // Get all unique approver IDs from all documents
    const allApproverIds = [
      ...new Set(
        allDocuments.flatMap((doc) =>
          doc.approvers.map((approver) => approver.approver.toString())
        )
      ),
    ];

    // Fetch all approver users with their email addresses
    const users = await User.find({
      _id: { $in: allApproverIds },
      email: { $exists: true, $ne: null }, // Only users with email
    });

    // Process each approver
    for (const user of users) {
      // Group documents by approver after applying filters
      const documentsByApprover = groupDocumentsByApprover(
        allDocuments,
        user.username
      );
      const userDocuments = documentsByApprover.get(user._id.toString());

      if (!userDocuments || userDocuments.length === 0) continue;

      // Create the email content
      const subject = "Danh sách tài liệu cần phê duyệt";
      let text = `Kính gửi ${user.username},\n\n`;
      text += `Bạn có ${userDocuments.length} tài liệu đang chờ phê duyệt:\n\n`;

      // Group documents by type
      const documentsByType = userDocuments.reduce((acc, doc) => {
        if (!acc[doc.type]) acc[doc.type] = [];
        acc[doc.type].push(doc);
        return acc;
      }, {});

      // Add documents to email, grouped by type
      Object.entries(documentsByType).forEach(([type, docs]) => {
        text += `=== ${type.toUpperCase()} ===\n`;
        docs.forEach((doc) => {
          text += `- Tiêu đề: ${doc.title}\n`;
          text += `  ID: ${doc.id}\n`;
          text += `  Ngày gửi: ${doc.submissionDate}\n`;
          if (doc.amount) {
            text += `  Số tiền: ${doc.amount.toLocaleString()} VND\n`;
          }
          text += `\n`;
        });
      });

      text += `\nVui lòng truy cập hệ thống để thực hiện phê duyệt.\n`;
      text += `\nTrân trọng,\nHệ thống quản lý tài liệu Kỳ Long`;

      // Send email if the user has an email address
      if (user.email) {
        await sendEmail(user.email, subject, text);
      }
    }
  } catch (error) {
    console.error("Error sending pending approval emails:", error);
    throw error; // Re-throw to handle in calling function
  }
};

module.exports = {
  sendEmail,
  groupDocumentsByApprover,
  filterDocumentsByUsername,
  sendPendingApprovalEmails,
};
