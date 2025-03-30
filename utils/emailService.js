// utils/emailService.js
const nodemailer = require("nodemailer");

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
  const typeMap = {
    Document: "Tài liệu chung",
    ProposalDocument: "Đề xuất",
    PurchasingDocument: "Phiếu mua hàng",
    PaymentDocument: "Phiếu thanh toán",
  };
  return typeMap[document.constructor.modelName] || "Tài liệu";
};

// Function to group documents by approver
const groupDocumentsByApprover = (documents) => {
  const approverMap = new Map();

  documents.forEach((document) => {
    const pendingApprovers = document.approvers.filter(
      (approver) =>
        !document.approvedBy.some(
          (approved) =>
            approved.user.toString() === approver.approver.toString()
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
      });
    });
  });

  return approverMap;
};

module.exports = { sendEmail, groupDocumentsByApprover };
