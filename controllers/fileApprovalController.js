// controllers/fileApprovalController.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const FileApproval = require("../models/FileApproval");
const User = require("../models/User");
require("dotenv").config();

// Configuration
const baseUrl =
  process.env.NEXTCLOUD_BASE_URL +
  "/remote.php/dav/files/" +
  process.env.NEXTCLOUD_USERNAME;
const username = process.env.NEXTCLOUD_USERNAME;
const password = process.env.NEXTCLOUD_PASSWORD;
const auth = Buffer.from(`${username}:${password}`).toString("base64");

// Upload folder from environment variable - default to "Pending" if not set
const UPLOAD_FOLDER = process.env.NEXTCLOUD_FILE_APPROVAL_UPLOAD_FOLDER;

// State management
let cookies = {};

// Helper: Store cookies from responses
const storeCookies = (response) => {
  const setCookieHeader = response.headers["set-cookie"];
  if (setCookieHeader) {
    setCookieHeader.forEach((cookie) => {
      const [nameValue] = cookie.split(";");
      const [name, value] = nameValue.split("=");
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
  }
};

// Helper: Get cookie header
const getCookieHeader = () => {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
};

// Helper: Ensure directory exists in Nextcloud
const ensureDirectoryExists = async (dirPath) => {
  try {
    const response = await axios.request({
      method: "MKCOL",
      url: `${baseUrl}/${dirPath}`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/xml",
        ...(Object.keys(cookies).length > 0 && {
          Cookie: getCookieHeader(),
        }),
      },
    });
    storeCookies(response);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 405) {
      // Directory already exists
      return true;
    }
    throw error;
  }
};

// Helper: Get share ID from file path
const getShareId = async (filePath) => {
  const apiBaseUrl = baseUrl.replace("/remote.php/dav/files/" + username, "");

  try {
    const response = await axios.get(
      `${apiBaseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "OCS-APIRequest": "true",
          Accept: "application/json",
          ...(Object.keys(cookies).length > 0 && {
            Cookie: getCookieHeader(),
          }),
        },
        params: {
          path: filePath,
        },
      },
    );

    storeCookies(response);

    if (response.data?.ocs?.data && Array.isArray(response.data.ocs.data)) {
      const publicShares = response.data.ocs.data.filter(
        (share) => share.share_type === 3,
      );

      if (publicShares.length > 0) {
        return publicShares.map((share) => share.id);
      }
    }

    return [];
  } catch (error) {
    console.warn("Failed to get share IDs:", error.message);
    return [];
  }
};

// Helper: Delete existing share link
const deleteShare = async (shareId) => {
  const apiBaseUrl = baseUrl.replace("/remote.php/dav/files/" + username, "");

  try {
    const response = await axios.delete(
      `${apiBaseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares/${shareId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "OCS-APIRequest": "true",
          Accept: "application/json",
          ...(Object.keys(cookies).length > 0 && {
            Cookie: getCookieHeader(),
          }),
        },
      },
    );

    storeCookies(response);
    return { success: true };
  } catch (error) {
    console.warn("Failed to delete share:", error.message);
    return { success: false, error: error.message };
  }
};

// Helper: Move file only (without creating share)
const moveFileOnly = async (sourcePath, destinationPath) => {
  try {
    const response = await axios.request({
      method: "MOVE",
      url: `${baseUrl}/${sourcePath}`,
      headers: {
        Authorization: `Basic ${auth}`,
        Destination: `${baseUrl}/${destinationPath}`,
        ...(Object.keys(cookies).length > 0 && {
          Cookie: getCookieHeader(),
        }),
      },
    });

    storeCookies(response);

    return {
      success: true,
      newPath: destinationPath,
    };
  } catch (error) {
    throw error;
  }
};

// Helper: Create public share link
const createPublicShare = async (filePath) => {
  const apiBaseUrl = baseUrl.replace("/remote.php/dav/files/" + username, "");

  const shareParams = new URLSearchParams({
    path: filePath,
    shareType: "3",
    permissions: "1",
    publicUpload: "false",
  });

  const headers = {
    Authorization: `Basic ${auth}`,
    "OCS-APIRequest": "true",
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    ...(Object.keys(cookies).length > 0 && {
      Cookie: getCookieHeader(),
    }),
  };

  const attempts = [{ timeout: 5000 }, { timeout: 10000 }, { timeout: 15000 }];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await axios.post(
        `${apiBaseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
        shareParams.toString(),
        {
          headers,
          timeout: attempts[i].timeout,
        },
      );

      storeCookies(response);

      if (response.data?.ocs?.data?.url) {
        return response.data.ocs.data.url;
      }

      throw new Error("No share URL in response");
    } catch (attemptError) {
      console.warn(`Share attempt ${i + 1} failed:`, attemptError.message);

      if (i === attempts.length - 1) {
        throw new Error(
          `Failed to create public share after ${attempts.length} attempts: ${attemptError.message}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

// Helper: Get MIME type
const getMimeType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    ".txt": "text/plain",
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
};

// Helper: Convert Vietnamese categories to ASCII folder names
const getCategoryFolderName = (category) => {
  const folderMap = {
    "Công ty": "Company",
    "Đối tác": "Partner",
    "Ngân hàng": "Bank",
    "Pháp lý": "Legal",
  };
  return folderMap[category] || category;
};

// Helper: Convert Vietnamese subcategories to ASCII folder names
const getSubcategoryFolderName = (subcategory) => {
  const folderMap = {
    "Quản lý chung": "General_Management",
    "Giấy đăng ký kinh doanh": "Business_Registration",
    "Sơ đồ tổ chức": "Organization_Chart",
    "Brochure / Hồ sơ năng lực": "Brochure_Capability",
    "Quy trình & Quy định": "Processes_Regulations",
    "Điều lệ công ty": "Company_Charter",
    "Quy chế tài chính": "Financial_Regulations",
    "Quyết định công ty": "Company_Decisions",
    "Phòng ban": "Departments",
    "Quyết định cấp phòng": "Department_Decisions",
    "Quy trình riêng": "Specific_Procedures",
    "Nhân sự": "Human_Resources",
    "Hợp đồng lao động": "Labor_Contracts",
    "Quyết định nhân sự": "HR_Decisions",
    "Chứng chỉ / Bằng cấp": "Certificates_Degrees",
    "Hồ sơ cá nhân": "Personal_Records",
    "Phiếu lương": "Payroll_Sheets",
    "Tài sản & Thiết bị": "Assets_Equipment",
    Trạm: "Stations",
    "Bồn chứa": "Storage_Tanks",
    "Thiết bị khác": "Other_Equipment",
    "Hồ sơ pháp lý": "Legal_Records",
    "Hồ sơ vận hành": "Operation_Records",
    "CO, CQ & Manual": "CO_CQ_Manual",
    "CO (Chứng nhận xuất xứ)": "CO",
    "CQ (Chứng nhận chất lượng)": "CQ",
    Manual: "Manual",
    "Báo cáo tài chính": "Financial_Reports",
    "Báo cáo tài chính năm": "Annual_Financial_Reports",
    "Thuyết minh BCTC": "Financial_Statement_Notes",
    "Báo cáo kiểm toán": "Audit_Reports",
    "Hợp đồng mua": "Purchase_Contract",
    "Hợp đồng bán": "Sales_Contract",
    "Bảo hành & Khiếu nại": "Warranty_Claims",
    "Phụ lục hợp đồng": "Contract_Appendix",
    "Hóa đơn mua": "Purchase_Invoice",
    "Hóa đơn bán": "Sales_Invoice",
    "Chứng từ thanh toán": "Payment_Documents",
    "Chứng từ vận chuyển": "Shipping_Documents",
    "Bảng nhiệt trị": "Calorific_Statement",
    "Hồ sơ mở & quản lý tài khoản": "Account_Opening_Management",
    "Sao kê & giao dịch thường kỳ": "Statements_Regular_Transactions",
    "Ủy nhiệm chi & chứng từ thanh toán": "Payment_Orders_Documents",
    "Đối soát & xác nhận số dư": "Reconciliation_Balance_Confirmation",
    "Hạn mức tín dụng & vay vốn": "Credit_Limit_Loan",
    "Bảo lãnh & LC": "Guarantee_LC",
    "Biểu phí & thông báo": "Fee_Schedule_Notifications",
    "Tuân thủ & KYC": "Compliance_KYC",
    Thuế: "Tax",
    "Bảo hiểm xã hội": "Social_Insurance",
    "Hải quan": "Customs",
    "Thanh tra / Kiểm tra": "Inspection_Audit",
    "Tranh chấp pháp lý": "Legal_Disputes",
    "Tờ khai GTGT": "VAT_Declaration",
    "Tờ khai TNDN tạm tính": "Provisional_CIT_Declaration",
    "Tờ khai TNCN": "PIT_Declaration",
    "Chứng từ nộp thuế": "Tax_Payment_Documents",
    "Báo tăng lao động": "Labor_Increase_Report",
    "Báo giảm lao động": "Labor_Decrease_Report",
    "Bảng đóng BHXH": "Social_Insurance_Payment_Table",
    "Tờ khai hải quan": "Customs_Declaration",
    "Hồ sơ ấn định/hoàn thuế": "Tax_Determination_Refund",
    "Biên bản làm việc": "Working_Minutes",
    "Quyết định xử phạt": "Penalty_Decision",
    "Hồ sơ giải trình": "Explanation_Records",
    "Hợp đồng liên quan": "Related_Contracts",
    "Hồ sơ khởi kiện": "Lawsuit_Records",
    "Văn bản pháp luật liên quan": "Related_Legal_Documents",
    "Phán quyết / quyết định cuối": "Final_Decision_Ruling",
  };
  return folderMap[subcategory] || subcategory;
};

// Helper: Get month name
const getMonthName = (month) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "Unknown";
};

// Helper: Convert Vietnamese text to ASCII folder name
const convertToAsciiFolderName = (text) => {
  if (!text) return "";

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
};

// Helper: Check if document type requires monthly folders
const isMonthlyDocument = (documentType) => {
  const monthlyDocuments = [
    "Hóa đơn mua",
    "Chứng từ thanh toán",
    "Hóa đơn bán",
    "Sao kê & giao dịch thường kỳ",
    "Ủy nhiệm chi & chứng từ thanh toán",
    "Thuế",
    "Bảo hiểm xã hội",
    "Phiếu lương",
  ];
  return monthlyDocuments.includes(documentType);
};

// Helper: Get subcategory folder structure with ASCII names
const getSubcategoryPath = (category, subcategoryData) => {
  const categoryFolder = getCategoryFolderName(category);

  if (category === "Công ty") {
    const {
      companySubcategory,
      department,
      employeeName,
      assetType,
      assetName,
      documentSubtype,
      year,
      month,
    } = subcategoryData;

    if (!companySubcategory) {
      return `${categoryFolder}`;
    }

    const asciiSubcategory = getSubcategoryFolderName(companySubcategory);
    let path = `${categoryFolder}/${asciiSubcategory}`;

    if (companySubcategory === "Quản lý chung") {
      if (documentSubtype) {
        const asciiDocType = getSubcategoryFolderName(documentSubtype);
        path += `/${asciiDocType}`;
      }
    } else if (companySubcategory === "Quy trình & Quy định") {
      if (documentSubtype) {
        const asciiDocType = getSubcategoryFolderName(documentSubtype);
        path += `/${asciiDocType}`;

        if (department) {
          const asciiDept = convertToAsciiFolderName(department);
          path += `/${asciiDept}`;
        }
      }
    } else if (companySubcategory === "Nhân sự") {
      if (department) {
        const asciiDept = convertToAsciiFolderName(department);
        path += `/${asciiDept}`;

        if (employeeName) {
          const asciiEmployee = convertToAsciiFolderName(employeeName);
          path += `/${asciiEmployee}`;

          if (documentSubtype) {
            const asciiDocType = getSubcategoryFolderName(documentSubtype);
            path += `/${asciiDocType}`;

            if (documentSubtype === "Phiếu lương" && year && month) {
              path += `/${year}/${getMonthName(month)}`;
            }
          }
        }
      }
    } else if (companySubcategory === "Tài sản & Thiết bị") {
      if (assetType) {
        const asciiAssetType = getSubcategoryFolderName(assetType);
        path += `/${asciiAssetType}`;

        if (assetName) {
          const asciiAssetName = convertToAsciiFolderName(assetName);
          path += `/${asciiAssetName}`;

          if (documentSubtype) {
            const asciiDocType = getSubcategoryFolderName(documentSubtype);
            path += `/${asciiDocType}`;
          }
        }
      }
    } else if (companySubcategory === "CO, CQ & Manual") {
      if (documentSubtype) {
        const asciiDocType = getSubcategoryFolderName(documentSubtype);
        path += `/${asciiDocType}`;
      }
    } else if (companySubcategory === "Báo cáo tài chính") {
      if (year) {
        path += `/${year}`;

        if (documentSubtype) {
          const asciiDocType = getSubcategoryFolderName(documentSubtype);
          path += `/${asciiDocType}`;
        }
      }
    }

    return path;
  }

  if (category === "Đối tác") {
    const {
      partnerName,
      contractType,
      contractNumber,
      documentType,
      year,
      month,
    } = subcategoryData;

    if (!partnerName) {
      return `${categoryFolder}`;
    }

    const asciiPartnerName = convertToAsciiFolderName(partnerName);
    let path = `${categoryFolder}/${asciiPartnerName}`;

    if (contractType) {
      const asciiContractType = getSubcategoryFolderName(contractType);
      path += `/${asciiContractType}`;

      if (contractNumber) {
        const asciiContractNumber = convertToAsciiFolderName(contractNumber);
        path += `/${asciiContractNumber}`;

        if (documentType) {
          const asciiDocumentType = getSubcategoryFolderName(documentType);
          path += `/${asciiDocumentType}`;

          if (year && month && isMonthlyDocument(documentType)) {
            path += `/${year}/${getMonthName(month)}`;
          }
        }
      }
    } else if (documentType === "Bảo hành & Khiếu nại") {
      const asciiDocumentType = getSubcategoryFolderName(documentType);
      path += `/${asciiDocumentType}`;
    }

    return path;
  }

  if (category === "Ngân hàng") {
    const { bankName, documentType, year, month } = subcategoryData;

    if (!bankName) {
      return `${categoryFolder}`;
    }

    const asciiBankName = convertToAsciiFolderName(bankName);
    let path = `${categoryFolder}/${asciiBankName}`;

    if (documentType) {
      const asciiDocumentType = getSubcategoryFolderName(documentType);
      path += `/${asciiDocumentType}`;

      if (year && month && isMonthlyDocument(documentType)) {
        path += `/${year}/${getMonthName(month)}`;
      }
    }

    return path;
  }

  if (category === "Pháp lý") {
    const { legalDocumentType, year, month } = subcategoryData;

    let path = `${categoryFolder}`;

    if (legalDocumentType) {
      const asciiDocumentType = getSubcategoryFolderName(legalDocumentType);
      path += `/${asciiDocumentType}`;

      if (year && month && isMonthlyDocument(legalDocumentType)) {
        path += `/${year}/${getMonthName(month)}`;
      }
    }

    return path;
  }

  return `${categoryFolder}`;
};

// Helper: Upload to Nextcloud - using environment variable for folder name
const uploadToNextcloud = async (localFilePath, fileName) => {
  try {
    // Upload to folder specified by environment variable
    await ensureDirectoryExists(UPLOAD_FOLDER);

    const fileData = fs.readFileSync(localFilePath);
    const remotePath = `${UPLOAD_FOLDER}/${fileName}`;

    const response = await axios.put(`${baseUrl}/${remotePath}`, fileData, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/octet-stream",
        ...(Object.keys(cookies).length > 0 && {
          Cookie: getCookieHeader(),
        }),
      },
    });

    storeCookies(response);

    // Create share link
    const shareLink = await createPublicShare(remotePath);

    return {
      success: true,
      fileName: fileName,
      path: remotePath,
      downloadUrl: shareLink,
      size: fs.statSync(localFilePath).size,
      mimeType: getMimeType(fileName),
    };
  } catch (error) {
    throw error;
  }
};

// Helper: Delete from Nextcloud
const deleteFromNextcloud = async (filePath) => {
  try {
    const response = await axios.delete(`${baseUrl}/${filePath}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        ...(Object.keys(cookies).length > 0 && {
          Cookie: getCookieHeader(),
        }),
      },
    });
    storeCookies(response);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// ==================== CONTROLLER FUNCTIONS ====================

// Upload file
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const {
      category,
      year,
      month,
      companySubcategory,
      department,
      employeeName,
      assetType,
      assetName,
      documentSubtype,
      partnerName,
      contractType,
      contractNumber,
      documentType,
      bankName,
      legalDocumentType,
    } = req.body;

    if (
      !category ||
      !["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)
    ) {
      return res.status(400).json({ error: "Valid category is required" });
    }

    const yearNum = parseInt(year);
    let monthNum = month ? parseInt(month) : null;

    if (isNaN(yearNum) || yearNum < 0) {
      return res
        .status(400)
        .json({ error: "Year must be a valid positive number" });
    }

    if (monthNum && (monthNum < 1 || monthNum > 12)) {
      return res.status(400).json({ error: "Month must be between 1 and 12" });
    }

    // Validate category-specific required fields
    if (category === "Công ty" && !companySubcategory) {
      return res.status(400).json({ error: "Company subcategory is required" });
    }

    if (category === "Đối tác" && !partnerName) {
      return res
        .status(400)
        .json({ error: "Partner name is required for Đối tác category" });
    }

    if (category === "Ngân hàng" && !bankName) {
      return res
        .status(400)
        .json({ error: "Bank name is required for Ngân hàng category" });
    }

    if (category === "Pháp lý" && !legalDocumentType) {
      return res.status(400).json({
        error: "Legal document type is required for Pháp lý category",
      });
    }

    // Upload to single location (from environment variable)
    const uploadResult = await uploadToNextcloud(
      req.file.path,
      req.file.filename,
    );

    // Store file approval with all data
    const fileApproval = new FileApproval({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      category: category,
      year: yearNum,
      month: monthNum,
      companySubcategory: companySubcategory,
      department: department,
      employeeName: employeeName,
      assetType: assetType,
      assetName: assetName,
      documentSubtype: documentSubtype,
      partnerName: partnerName,
      contractType: contractType,
      contractNumber: contractNumber,
      documentType: documentType,
      bankName: bankName,
      legalDocumentType: legalDocumentType,
      nextcloudPath: uploadResult.path,
      shareUrl: uploadResult.downloadUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: "pending",
      ipAddress: req.ip,
      uploadedBy: req.user ? req.user.username : "anonymous",
      viewableBy: [],
    });

    await fileApproval.save();

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: `File uploaded successfully to ${category} category`,
      fileId: fileApproval._id,
      fileName: req.file.originalname,
      category: category,
      year: yearNum,
      month: monthNum,
      shareUrl: uploadResult.downloadUrl,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload file: " + error.message });
  }
};

// Approve file - just change status, no moving files
const approveFile = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied. Insufficient permissions" });
    }

    const fileApproval = await FileApproval.findById(req.params.id);

    if (!fileApproval) {
      return res.status(404).json({ error: "File not found" });
    }

    if (fileApproval.status !== "pending") {
      return res.status(400).json({ error: "File already processed" });
    }

    // Just update the status - no file movement
    fileApproval.status = "approved";
    fileApproval.actionTakenAt = new Date();
    fileApproval.actionTakenBy = req.user ? req.user.username : "system";

    await fileApproval.save();

    res.json({
      success: true,
      message: `File approved successfully`,
      shareUrl: fileApproval.shareUrl,
      file: fileApproval,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve file: " + error.message });
  }
};

// Reject file - delete from Nextcloud and update status
const rejectFile = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "submitterOfAccounting",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ error: "Access denied. Insufficient permissions" });
    }

    const fileApproval = await FileApproval.findById(req.params.id);

    if (!fileApproval) {
      return res.status(404).json({ error: "File not found" });
    }

    if (fileApproval.status !== "pending") {
      return res.status(400).json({ error: "File already processed" });
    }

    // Delete file from NextCloud upload folder
    await deleteFromNextcloud(fileApproval.nextcloudPath);

    // Update status to rejected
    fileApproval.status = "rejected";
    fileApproval.actionTakenAt = new Date();
    fileApproval.actionTakenBy = req.user ? req.user.username : "system";

    await fileApproval.save();

    res.json({
      success: true,
      message: "File rejected and deleted from NextCloud",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject file: " + error.message });
  }
};

// Get pending files
const getPendingFiles = async (req, res) => {
  try {
    const { category } = req.query;
    let query = { status: "pending" };

    if (category && category !== "all") {
      query.category = category;
    }

    const pendingFiles = await FileApproval.find(query).sort({
      uploadedAt: -1,
    });
    res.json(pendingFiles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending files" });
  }
};

// Get approved files with permission filtering
const getApprovedFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const { category, year, month } = req.query;

    const adminRoles = ["superAdmin", "deputyDirector", "director"];

    let query = { status: "approved" };

    if (category && category !== "all") {
      query.category = category;
    }

    if (year && year !== "") {
      query.year = parseInt(year);
    }

    if (month && month !== "") {
      query.month = parseInt(month);
    }

    if (!adminRoles.includes(userRole)) {
      query.$or = [
        { viewableBy: { $in: [userId] } },
        { viewableBy: { $exists: true, $size: 0 } },
      ];
    }

    const approvedFiles = await FileApproval.find(query)
      .populate("viewableBy", "username realName role department")
      .populate("permissionsSetBy", "username realName")
      .sort({ actionTakenAt: -1 });

    res.json(approvedFiles);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch approved files: " + error.message });
  }
};

// Set file viewing permissions
const setFilePermissions = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied. Insufficient permissions" });
    }

    const { fileId } = req.params;
    const { viewableBy } = req.body;

    const fileApproval = await FileApproval.findById(fileId);

    if (!fileApproval) {
      return res.status(404).json({ error: "File not found" });
    }

    fileApproval.viewableBy = viewableBy || [];
    fileApproval.permissionsSetBy = req.user._id;
    fileApproval.permissionsSetAt = new Date();

    await fileApproval.save();

    await fileApproval.populate(
      "viewableBy",
      "username realName role department",
    );
    await fileApproval.populate("permissionsSetBy", "username realName");

    res.json({
      success: true,
      message: "File viewing permissions updated successfully",
      file: fileApproval,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to set file permissions: " + error.message });
  }
};

// Get eligible users for permission assignment
const getEligibleUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $nin: ["superAdmin", "deputyDirector", "director"] },
    }).select("username realName role department");

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// Get file history
const getFileHistory = async (req, res) => {
  try {
    const history = await FileApproval.find({
      status: { $in: ["approved", "rejected"] },
    })
      .sort({ actionTakenAt: -1 })
      .limit(100);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

// Get file by ID
const getFileById = async (req, res) => {
  try {
    const fileApproval = await FileApproval.findById(req.params.id);

    if (!fileApproval) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json(fileApproval);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
};

// Get files by category
const getFilesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { year, month, status } = req.query;

    if (!["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const query = { category };

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);

    const files = await FileApproval.find(query).sort({
      uploadedAt: -1,
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
};

// Get files by category, year, month
const getFilesByCategoryYearMonth = async (req, res) => {
  try {
    const { category, year, month, status } = req.params;

    if (!["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const query = {
      category,
      year: parseInt(year),
      month: parseInt(month),
    };

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    const files = await FileApproval.find(query).sort({
      uploadedAt: -1,
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
};

// Get categories with counts
const getCategoriesWithCounts = async (req, res) => {
  try {
    const categories = await FileApproval.aggregate([
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
        },
      },
    ]);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch category counts" });
  }
};

// Get available years for a category
const getAvailableYears = async (req, res) => {
  try {
    const { category } = req.params;

    if (!["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const years = await FileApproval.aggregate([
      { $match: { category: category, status: "approved" } },
      {
        $group: {
          _id: "$year",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json(years);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch available years" });
  }
};

// Get available months for a category and year
const getAvailableMonths = async (req, res) => {
  try {
    const { category, year } = req.params;

    if (!["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const months = await FileApproval.aggregate([
      {
        $match: {
          category: category,
          year: parseInt(year),
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$month",
          count: { $sum: 1 },
          monthName: {
            $first: {
              $let: {
                vars: {
                  months: [
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ],
                },
                in: {
                  $arrayElemAt: ["$months", { $subtract: ["$month", 1] }],
                },
              },
            },
          },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json(months);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch available months" });
  }
};

// Get category structure
const getCategoryStructure = async (req, res) => {
  try {
    const { category } = req.params;

    if (!["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const structure = await FileApproval.aggregate([
      { $match: { category: category, status: "approved" } },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.year",
          months: {
            $push: {
              month: "$_id.month",
              monthName: { $literal: null },
              count: "$count",
            },
          },
          yearCount: { $sum: "$count" },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    structure.forEach((year) => {
      year.months.forEach((monthData) => {
        monthData.monthName = getMonthName(monthData.month);
      });
      year.months.sort((a, b) => b.month - a.month);
    });

    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch category structure" });
  }
};

// Initialize upload folder (from environment variable)
const initializeUploadFolder = async (req, res) => {
  try {
    await ensureDirectoryExists(UPLOAD_FOLDER);

    res.json({
      success: true,
      message: `Upload folder '${UPLOAD_FOLDER}' initialized successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize upload folder" });
  }
};

// Get current upload folder setting
const getUploadFolder = (req, res) => {
  res.json({
    success: true,
    uploadFolder: UPLOAD_FOLDER,
  });
};

// Export all functions
module.exports = {
  uploadFile,
  approveFile,
  rejectFile,
  getPendingFiles,
  getApprovedFiles,
  setFilePermissions,
  getEligibleUsers,
  getFileHistory,
  getFileById,
  getFilesByCategory,
  getFilesByCategoryYearMonth,
  getCategoriesWithCounts,
  getAvailableYears,
  getAvailableMonths,
  getCategoryStructure,
  initializeUploadFolder,
  getUploadFolder,
};
