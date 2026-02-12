// utils/emailService.js
const nodemailer = require("nodemailer");
const User = require("../models/User");

// Configure the Gmail transporter for non-salary emails
const gmailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Configure the Mailcow transporter specifically for salary emails
const mailcowTransporter = nodemailer.createTransport({
  host: process.env.MAILCOW_HOST || "mail.yourdomain.com",
  port: process.env.MAILCOW_PORT || 587,
  secure: process.env.MAILCOW_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.MAILCOW_USER,
    pass: process.env.MAILCOW_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.MAILCOW_REJECT_UNAUTHORIZED !== "false",
  },
});

// Function to send a general email using Gmail
const sendEmail = async (to, subject, text) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
    };
    const info = await gmailTransporter.sendMail(mailOptions);
    console.log("Email sent via Gmail:", info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email via Gmail:", error);
    return { success: false, error: error.message };
  }
};

// Function to send salary calculation email using Mailcow
const sendSalaryEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: process.env.MAILCOW_FROM || process.env.MAILCOW_USER,
      to,
      subject,
      html: htmlContent,
    };
    const info = await mailcowTransporter.sendMail(mailOptions);
    console.log("Salary email sent via Mailcow:", info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending salary email via Mailcow:", error);

    // Fallback to Gmail if Mailcow fails
    console.log("Attempting to send salary email via Gmail as fallback...");
    try {
      const fallbackMailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject,
        html: htmlContent,
      };
      const fallbackInfo = await gmailTransporter.sendMail(fallbackMailOptions);
      console.log(
        "Salary email sent via Gmail (fallback):",
        fallbackInfo.response,
      );
      return {
        success: true,
        messageId: fallbackInfo.messageId,
        fallback: true,
      };
    } catch (fallbackError) {
      console.error(
        "Error sending salary email via Gmail fallback:",
        fallbackError,
      );
      return {
        success: false,
        error: error.message,
        fallbackError: fallbackError.message,
      };
    }
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
      (approver) => approver.username,
    );

    // Get all approved usernames
    const approvedUsernames = doc.approvedBy.map(
      (approval) => approval.username,
    );

    // Check if current user has already approved this document
    if (approvedUsernames.includes(username)) {
      return true;
    }

    // Find pending approvers (those not in approvedBy)
    const pendingApprovers = doc.approvers.filter(
      (approver) => !approvedUsernames.includes(approver.username),
    );

    const pendingUsernames = pendingApprovers.map(
      (approver) => approver.username,
    );

    // If there are no pending approvers, document is fully approved
    if (pendingApprovers.length === 0) {
      return true;
    }

    // Check if all pending approvers are restricted users
    const allPendingAreRestricted = pendingApprovers.every((approver) =>
      restrictedUsers.includes(approver.username),
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
          (approved) => approved.username === approver.username,
        ),
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

// Main function to send pending approval emails (uses Gmail)
const sendPendingApprovalEmails = async (allDocuments) => {
  try {
    // Get all unique approver IDs from all documents
    const allApproverIds = [
      ...new Set(
        allDocuments.flatMap((doc) =>
          doc.approvers.map((approver) => approver.approver.toString()),
        ),
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
        user.username,
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

      // Send email using Gmail
      if (user.email) {
        await sendEmail(user.email, subject, text);
      }
    }
  } catch (error) {
    console.error("Error sending pending approval emails:", error);
    throw error; // Re-throw to handle in calling function
  }
};

// Function to generate salary calculation HTML content
const generateSalaryEmailContent = (user, salaryData) => {
  const formatNumber = (num) => {
    return num ? num.toLocaleString("vi-VN") : "0";
  };

  // Calculate previous month and year correctly
  let previousMonth, year;
  if (salaryData.month === 1) {
    previousMonth = 12;
    year = salaryData.year - 1;
  } else {
    previousMonth = salaryData.month - 1;
    year = salaryData.year;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .salary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .salary-table th, .salary-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        .salary-table th { background-color: #f2f2f2; font-weight: bold; }
        .highlight { background-color: #e8f5e8; font-weight: bold; }
        .note { background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>BẢNG LƯƠNG THÁNG ${previousMonth}/${year}</h2>
        </div>
        <div class="content">
          
          <p>Kính gửi <strong>${user.realName}</strong>,</p>
          <p>Dưới đây là bảng lương chi tiết của bạn tháng ${previousMonth}/${year}:</p>
          
          <table class="salary-table">
            <tr>
              <th>STT</th>
              <th>Mục</th>
              <th>Số tiền (VND)</th>
            </tr>
            <tr>
              <td>1</td>
              <td>Lương cơ bản</td>
              <td>${formatNumber(salaryData.baseSalary)}</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Hoa hồng</td>
              <td>${formatNumber(salaryData.commissionBonus)}</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Trách nhiệm</td>
              <td>${formatNumber(salaryData.responsibility)}</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Thưởng khác</td>
              <td>${formatNumber(salaryData.otherBonus)}</td>
            </tr>
            <tr>
              <td>5</td>
              <td>Phụ cấp chung</td>
              <td>${formatNumber(salaryData.allowanceGeneral)}</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Lương tăng ca</td>
              <td>${formatNumber(salaryData.overtimePay)}</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Công tác phí</td>
              <td>${formatNumber(salaryData.travelExpense)}</td>
            </tr>
            <tr class="highlight">
              <td colspan="2"><strong>Tổng lương gộp</strong></td>
              <td><strong>${formatNumber(salaryData.grossSalary)}</strong></td>
            </tr>
            <tr>
              <td>8</td>
              <td>Bảo hiểm bắt buộc</td>
              <td>-${formatNumber(salaryData.mandatoryInsurance)}</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Thuế thu nhập</td>
              <td>-${formatNumber(salaryData.tax)}</td>
            </tr>
            <tr class="highlight">
              <td colspan="2"><strong>Lương thực lĩnh</strong></td>
              <td><strong>${formatNumber(salaryData.currentSalary)}</strong></td>
            </tr>
          </table>
          
          <p><strong>Thông tin chuyển khoản:</strong></p>
          <ul>
            <li>Ngân hàng: ${user.beneficiaryBank || "N/A"}</li>
            <li>Số tài khoản: ${user.bankAccountNumber || "N/A"}</li>
            <li>Số tiền: ${formatNumber(salaryData.currentSalary)} VND</li>
            <li>Kỳ thanh toán: Lương tháng ${previousMonth}/${year}</li>
          </ul>
          
          <p>Mọi thắc mắc vui lòng liên hệ bộ phận kế toán.</p>
          <p>Trân trọng,</p>
          <p><strong>Phòng Kế Toán<br>Công ty TNHH Đầu Tư Thương Mại Dịch Vụ Kỳ Long</strong></p>
        </div>
        <div class="footer">
          <p>Đây là email tự động, vui lòng không trả lời email này.</p>
          <p>© ${new Date().getFullYear()} Công ty TNHH Đầu Tư Thương Mại Dịch Vụ Kỳ Long</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  groupDocumentsByApprover,
  filterDocumentsByUsername,
  sendPendingApprovalEmails,
  sendSalaryEmail,
  generateSalaryEmailContent,
};
