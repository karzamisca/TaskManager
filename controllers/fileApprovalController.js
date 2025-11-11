// controllers/fileApprovalController.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const FileApproval = require("../models/FileApproval");
const User = require("../models/User");
require("dotenv").config();

class NextcloudController {
  constructor() {
    this.baseUrl =
      process.env.NEXTCLOUD_BASE_URL +
      "/remote.php/dav/files/" +
      process.env.NEXTCLOUD_USERNAME;
    this.username = process.env.NEXTCLOUD_USERNAME;
    this.password = process.env.NEXTCLOUD_PASSWORD;
    this.auth = Buffer.from(`${this.username}:${this.password}`).toString(
      "base64"
    );
    this.cookies = {};

    // Bind all methods to the instance
    this.storeCookies = this.storeCookies.bind(this);
    this.getCookieHeader = this.getCookieHeader.bind(this);
    this.ensureDirectoryExists = this.ensureDirectoryExists.bind(this);
    this.uploadToNextcloud = this.uploadToNextcloud.bind(this);
    this.createPublicShare = this.createPublicShare.bind(this);
    this.getDirectDownloadUrl = this.getDirectDownloadUrl.bind(this);
    this.getMimeType = this.getMimeType.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.getPendingFiles = this.getPendingFiles.bind(this);
    this.approveFile = this.approveFile.bind(this);
    this.rejectFile = this.rejectFile.bind(this);
    this.getFileHistory = this.getFileHistory.bind(this);
    this.getFileById = this.getFileById.bind(this);
    this.moveFileInNextcloud = this.moveFileInNextcloud.bind(this);
    this.deleteFromNextcloud = this.deleteFromNextcloud.bind(this);
    this.getFilesByCategory = this.getFilesByCategory.bind(this);
    this.getCategoriesWithCounts = this.getCategoriesWithCounts.bind(this);
    this.getCategoryFolderName = this.getCategoryFolderName.bind(this);
    this.initializeCategoryFolders = this.initializeCategoryFolders.bind(this);
    this.getAvailableYears = this.getAvailableYears.bind(this);
    this.getAvailableMonths = this.getAvailableMonths.bind(this);
    this.getFilesByCategoryYearMonth =
      this.getFilesByCategoryYearMonth.bind(this);
    this.getCategoryStructure = this.getCategoryStructure.bind(this);
    this.getMonthName = this.getMonthName.bind(this);
    this.getSubcategoryFolderName = this.getSubcategoryFolderName.bind(this);
    this.getSubcategoryPath = this.getSubcategoryPath.bind(this);
    this.convertToAsciiFolderName = this.convertToAsciiFolderName.bind(this);
    this.isMonthlyDocument = this.isMonthlyDocument.bind(this);

    // New methods for approved file viewing
    this.getApprovedFiles = this.getApprovedFiles.bind(this);
    this.setFilePermissions = this.setFilePermissions.bind(this);
    this.getEligibleUsers = this.getEligibleUsers.bind(this);
  }

  // Helper method to convert Vietnamese categories to ASCII folder names
  getCategoryFolderName(category) {
    const folderMap = {
      "Công ty": "Company",
      "Đối tác": "Partner",
      "Ngân hàng": "Bank",
      "Pháp lý": "Legal",
    };
    return folderMap[category] || category;
  }

  // Helper method to convert Vietnamese subcategories to ASCII folder names
  getSubcategoryFolderName(subcategory) {
    const folderMap = {
      // Company subcategories
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

      // Partner subcategories
      "Hợp đồng mua": "Purchase_Contract",
      "Hợp đồng bán": "Sales_Contract",
      "Bảo hành & Khiếu nại": "Warranty_Claims",
      "Phụ lục hợp đồng": "Contract_Appendix",
      "Hóa đơn mua": "Purchase_Invoice",
      "Hóa đơn bán": "Sales_Invoice",
      "Chứng từ thanh toán": "Payment_Documents",
      "Chứng từ vận chuyển": "Shipping_Documents",
      "Bảng nhiệt trị": "Calorific_Statement",

      // Bank subcategories
      "Hồ sơ mở & quản lý tài khoản": "Account_Opening_Management",
      "Sao kê & giao dịch thường kỳ": "Statements_Regular_Transactions",
      "Ủy nhiệm chi & chứng từ thanh toán": "Payment_Orders_Documents",
      "Đối soát & xác nhận số dư": "Reconciliation_Balance_Confirmation",
      "Hạn mức tín dụng & vay vốn": "Credit_Limit_Loan",
      "Bảo lãnh & LC": "Guarantee_LC",
      "Biểu phí & thông báo": "Fee_Schedule_Notifications",
      "Tuân thủ & KYC": "Compliance_KYC",

      // Legal subcategories
      Thuế: "Tax",
      "Bảo hiểm xã hội": "Social_Insurance",
      "Hải quan": "Customs",
      "Thanh tra / Kiểm tra": "Inspection_Audit",
      "Tranh chấp pháp lý": "Legal_Disputes",

      // Document types
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
  }

  // Helper method to get month name
  getMonthName(month) {
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
  }

  // Helper method to convert Vietnamese text to ASCII folder name
  convertToAsciiFolderName(text) {
    if (!text) return "";

    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase();
  }

  // Helper to check if document type requires monthly folders
  isMonthlyDocument(documentType) {
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
  }

  // Helper method to get subcategory folder structure with ASCII names
  getSubcategoryPath(category, subcategoryData) {
    const categoryFolder = this.getCategoryFolderName(category);

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

      const asciiSubcategory =
        this.getSubcategoryFolderName(companySubcategory);
      let path = `${categoryFolder}/${asciiSubcategory}`;

      // General Management
      if (companySubcategory === "Quản lý chung") {
        if (documentSubtype) {
          const asciiDocType = this.getSubcategoryFolderName(documentSubtype);
          path += `/${asciiDocType}`;
        }
      }
      // Processes & Regulations
      else if (companySubcategory === "Quy trình & Quy định") {
        if (documentSubtype) {
          const asciiDocType = this.getSubcategoryFolderName(documentSubtype);
          path += `/${asciiDocType}`;

          if (department) {
            const asciiDept = this.convertToAsciiFolderName(department);
            path += `/${asciiDept}`;
          }
        }
      }
      // Human Resources
      else if (companySubcategory === "Nhân sự") {
        if (department) {
          const asciiDept = this.convertToAsciiFolderName(department);
          path += `/${asciiDept}`;

          if (employeeName) {
            const asciiEmployee = this.convertToAsciiFolderName(employeeName);
            path += `/${asciiEmployee}`;

            if (documentSubtype) {
              const asciiDocType =
                this.getSubcategoryFolderName(documentSubtype);
              path += `/${asciiDocType}`;

              if (documentSubtype === "Phiếu lương" && year && month) {
                path += `/${year}/${this.getMonthName(month)}`;
              }
            }
          }
        }
      }
      // Assets & Equipment
      else if (companySubcategory === "Tài sản & Thiết bị") {
        if (assetType) {
          const asciiAssetType = this.getSubcategoryFolderName(assetType);
          path += `/${asciiAssetType}`;

          if (assetName) {
            const asciiAssetName = this.convertToAsciiFolderName(assetName);
            path += `/${asciiAssetName}`;

            if (documentSubtype) {
              const asciiDocType =
                this.getSubcategoryFolderName(documentSubtype);
              path += `/${asciiDocType}`;
            }
          }
        }
      }
      // CO, CQ & Manual
      else if (companySubcategory === "CO, CQ & Manual") {
        if (documentSubtype) {
          const asciiDocType = this.getSubcategoryFolderName(documentSubtype);
          path += `/${asciiDocType}`;
        }
      }
      // Financial Reports
      else if (companySubcategory === "Báo cáo tài chính") {
        if (year) {
          path += `/${year}`;

          if (documentSubtype) {
            const asciiDocType = this.getSubcategoryFolderName(documentSubtype);
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

      const asciiPartnerName = this.convertToAsciiFolderName(partnerName);
      let path = `${categoryFolder}/${asciiPartnerName}`;

      if (contractType) {
        const asciiContractType = this.getSubcategoryFolderName(contractType);
        path += `/${asciiContractType}`;

        if (contractNumber) {
          const asciiContractNumber =
            this.convertToAsciiFolderName(contractNumber);
          path += `/${asciiContractNumber}`;

          if (documentType) {
            const asciiDocumentType =
              this.getSubcategoryFolderName(documentType);
            path += `/${asciiDocumentType}`;

            if (year && month && this.isMonthlyDocument(documentType)) {
              path += `/${year}/${this.getMonthName(month)}`;
            }
          }
        }
      } else if (documentType === "Bảo hành & Khiếu nại") {
        const asciiDocumentType = this.getSubcategoryFolderName(documentType);
        path += `/${asciiDocumentType}`;
      }

      return path;
    }

    if (category === "Ngân hàng") {
      const { bankName, documentType, year, month } = subcategoryData;

      if (!bankName) {
        return `${categoryFolder}`;
      }

      const asciiBankName = this.convertToAsciiFolderName(bankName);
      let path = `${categoryFolder}/${asciiBankName}`;

      if (documentType) {
        const asciiDocumentType = this.getSubcategoryFolderName(documentType);
        path += `/${asciiDocumentType}`;

        if (year && month && this.isMonthlyDocument(documentType)) {
          path += `/${year}/${this.getMonthName(month)}`;
        }
      }

      return path;
    }

    if (category === "Pháp lý") {
      const { legalDocumentType, year, month } = subcategoryData;

      let path = `${categoryFolder}`;

      if (legalDocumentType) {
        const asciiDocumentType =
          this.getSubcategoryFolderName(legalDocumentType);
        path += `/${asciiDocumentType}`;

        if (year && month && this.isMonthlyDocument(legalDocumentType)) {
          path += `/${year}/${this.getMonthName(month)}`;
        }
      }

      return path;
    }

    return `${categoryFolder}`;
  }

  // Initialize category folders
  async initializeCategoryFolders() {
    try {
      const categories = ["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"];

      for (const category of categories) {
        const folderName = this.getCategoryFolderName(category);

        // Create Pending category folder
        await this.ensureDirectoryExists(`Pending/${folderName}`);

        // Create Approved category folder base
        await this.ensureDirectoryExists(`Approved/${folderName}`);
      }
    } catch (error) {
      throw error;
    }
  }

  // NextCloud Client Methods
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

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async ensureDirectoryExists(dirPath) {
    try {
      const response = await axios.request({
        method: "MKCOL",
        url: `${this.baseUrl}/${dirPath}`,
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
      throw error;
    }
  }

  async uploadToNextcloud(localFilePath, remoteFolder, fileName) {
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(remoteFolder);

      const fileData = fs.readFileSync(localFilePath);
      const remotePath = `${remoteFolder}/${fileName}`;

      const response = await axios.put(
        `${this.baseUrl}/${remotePath}`,
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

      // Create share link
      const shareLink = await this.createPublicShare(remotePath);

      return {
        success: true,
        fileName: fileName,
        path: remotePath,
        downloadUrl: shareLink,
        size: fs.statSync(localFilePath).size,
        mimeType: this.getMimeType(fileName),
      };
    } catch (error) {
      throw error;
    }
  }

  async moveFileInNextcloud(sourcePath, destinationPath) {
    try {
      const response = await axios.request({
        method: "MOVE",
        url: `${this.baseUrl}/${sourcePath}`,
        headers: {
          Authorization: `Basic ${this.auth}`,
          Destination: `${this.baseUrl}/${destinationPath}`,
          ...(Object.keys(this.cookies).length > 0 && {
            Cookie: this.getCookieHeader(),
          }),
        },
      });

      this.storeCookies(response);

      // Create new share link for the moved file
      const shareLink = await this.createPublicShare(destinationPath);

      return {
        success: true,
        newPath: destinationPath,
        downloadUrl: shareLink,
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteFromNextcloud(filePath) {
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
      throw error;
    }
  }

  async createPublicShare(filePath) {
    try {
      const shareParams = new URLSearchParams({
        path: filePath,
        shareType: "3",
        permissions: "1",
        publicUpload: "false",
        password: "",
        expireDate: "",
      });

      const baseUrl = this.baseUrl.replace(
        "/remote.php/dav/files/" + this.username,
        ""
      );

      const response = await axios.post(
        `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
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

      if (response.data && response.data.ocs && response.data.ocs.data) {
        const shareData = response.data.ocs.data;
        if (shareData.url) {
          return shareData.url;
        }
      }

      // Fallback to direct URL
      return this.getDirectDownloadUrl(filePath);
    } catch (error) {
      return this.getDirectDownloadUrl(filePath);
    }
  }

  getDirectDownloadUrl(filePath) {
    const encodedPath = encodeURIComponent(filePath);
    return `${this.baseUrl}/${encodedPath}`;
  }

  getMimeType(fileName) {
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
  }

  // NEW METHODS FOR APPROVED FILE VIEWING

  // Get approved files with permission filtering
  async getApprovedFiles(req, res) {
    try {
      // Get user info from the auth middleware
      const userId = req.user.id; // From JWT token
      const userRole = req.user.role;

      const { category, year, month } = req.query;

      const userRoles = ["superAdmin", "deputyDirector", "director"];

      let query = { status: "approved" };

      // Add category filter if provided
      if (category && category !== "all") {
        query.category = category;
      }

      // Add year filter if provided
      if (year && year !== "") {
        query.year = parseInt(year);
      }

      // Add month filter if provided
      if (month && month !== "") {
        query.month = parseInt(month);
      }

      // If user is not superAdmin, deputyDirector, or director, filter by permissions
      if (!userRoles.includes(userRole)) {
        // Use the actual user ID from the token
        query.$or = [
          { viewableBy: { $in: [userId] } }, // userId is already a string from JWT
          { viewableBy: { $exists: true, $size: 0 } }, // Files with no restrictions (empty array)
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
  }

  // Set file viewing permissions
  async setFilePermissions(req, res) {
    try {
      if (
        !["superAdmin", "director", "deputyDirector"].includes(req.user.role)
      ) {
        return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập");
      }
      const { fileId } = req.params;
      const { viewableBy } = req.body;

      const fileApproval = await FileApproval.findById(fileId);

      if (!fileApproval) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check if user has permission to set permissions
      const userRoles = ["superAdmin", "deputyDirector", "director"];
      if (!userRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Ensure viewableBy contains valid user IDs
      fileApproval.viewableBy = viewableBy || [];
      fileApproval.permissionsSetBy = req.user._id;
      fileApproval.permissionsSetAt = new Date();

      await fileApproval.save();

      // Populate the response for better frontend display
      await fileApproval.populate(
        "viewableBy",
        "username realName role department"
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
  }

  // Get eligible users for permission assignment (excluding high-level roles)
  async getEligibleUsers(req, res) {
    try {
      const users = await User.find({
        role: { $nin: ["superAdmin", "deputyDirector", "director"] },
      }).select("username realName role department");

      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  async uploadFile(req, res) {
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
        return res
          .status(400)
          .json({ error: "Month must be between 1 and 12" });
      }

      // Validate category-specific required fields
      if (category === "Công ty" && !companySubcategory) {
        return res
          .status(400)
          .json({ error: "Company subcategory is required" });
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

      const categoryFolder = this.getCategoryFolderName(category);
      const pendingPath = `Pending/${categoryFolder}`;

      await this.ensureDirectoryExists(pendingPath);

      const uploadResult = await this.uploadToNextcloud(
        req.file.path,
        pendingPath,
        req.file.filename
      );

      // Store file approval with all data
      const fileApproval = new FileApproval({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        category: category,
        year: yearNum,
        month: monthNum,
        // Company fields
        companySubcategory: companySubcategory,
        department: department,
        employeeName: employeeName,
        assetType: assetType,
        assetName: assetName,
        documentSubtype: documentSubtype,
        // Partner fields
        partnerName: partnerName,
        contractType: contractType,
        contractNumber: contractNumber,
        documentType: documentType,
        // Bank fields
        bankName: bankName,
        // Legal fields
        legalDocumentType: legalDocumentType,
        // Common fields
        nextcloudPath: uploadResult.path,
        shareUrl: uploadResult.downloadUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: "pending",
        ipAddress: req.ip,
        uploadedBy: req.user ? req.user.username : "anonymous",
        // Initialize viewableBy as empty array (visible to all)
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
      res
        .status(500)
        .json({ error: "Failed to upload file: " + error.message });
    }
  }

  async approveFile(req, res) {
    try {
      if (
        !["superAdmin", "director", "deputyDirector"].includes(req.user.role)
      ) {
        return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập");
      }
      const fileApproval = await FileApproval.findById(req.params.id);

      if (!fileApproval) {
        return res.status(404).json({ error: "File not found" });
      }

      if (fileApproval.status !== "pending") {
        return res.status(400).json({ error: "File already processed" });
      }

      const categoryFolder = this.getCategoryFolderName(fileApproval.category);

      // Build the approved path using subcategory structure
      const subcategoryData = {
        // Company data
        companySubcategory: fileApproval.companySubcategory,
        department: fileApproval.department,
        employeeName: fileApproval.employeeName,
        assetType: fileApproval.assetType,
        assetName: fileApproval.assetName,
        documentSubtype: fileApproval.documentSubtype,
        // Partner data
        partnerName: fileApproval.partnerName,
        contractType: fileApproval.contractType,
        contractNumber: fileApproval.contractNumber,
        documentType: fileApproval.documentType,
        // Bank data
        bankName: fileApproval.bankName,
        documentType: fileApproval.documentType,
        // Legal data
        legalDocumentType: fileApproval.legalDocumentType,
        // Common data
        year: fileApproval.year,
        month: fileApproval.month,
      };

      const subcategoryPath = this.getSubcategoryPath(
        fileApproval.category,
        subcategoryData
      );
      const approvedPath = `Approved/${subcategoryPath}`;

      // Ensure all directories in the path exist
      const pathParts = approvedPath.split("/");
      let currentPath = "";

      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        await this.ensureDirectoryExists(currentPath);
      }

      const sourcePath = fileApproval.nextcloudPath;
      const destinationPath = `${approvedPath}/${fileApproval.fileName}`;

      const moveResult = await this.moveFileInNextcloud(
        sourcePath,
        destinationPath
      );

      fileApproval.status = "approved";
      fileApproval.nextcloudPath = moveResult.newPath;
      fileApproval.shareUrl = moveResult.downloadUrl;
      fileApproval.actionTakenAt = new Date();
      fileApproval.actionTakenBy = req.user ? req.user.username : "system";

      await fileApproval.save();

      res.json({
        success: true,
        message: `File approved and moved to ${fileApproval.category} category`,
        shareUrl: moveResult.downloadUrl,
        file: fileApproval,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to approve file: " + error.message });
    }
  }

  async rejectFile(req, res) {
    try {
      if (
        !["superAdmin", "director", "deputyDirector"].includes(req.user.role)
      ) {
        return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập");
      }
      const fileApproval = await FileApproval.findById(req.params.id);

      if (!fileApproval) {
        return res.status(404).json({ error: "File not found" });
      }

      if (fileApproval.status !== "pending") {
        return res.status(400).json({ error: "File already processed" });
      }

      // Delete file from NextCloud Pending folder
      await this.deleteFromNextcloud(fileApproval.nextcloudPath);

      // Update MongoDB record
      fileApproval.status = "rejected";
      fileApproval.actionTakenAt = new Date();
      fileApproval.actionTakenBy = req.user ? req.user.username : "system";

      await fileApproval.save();

      res.json({
        success: true,
        message: "File rejected and deleted from NextCloud",
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to reject file: " + error.message });
    }
  }

  async getPendingFiles(req, res) {
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
  }

  async getFileHistory(req, res) {
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
  }

  async getFileById(req, res) {
    try {
      const fileApproval = await FileApproval.findById(req.params.id);

      if (!fileApproval) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json(fileApproval);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file" });
    }
  }

  async getFilesByCategory(req, res) {
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

      // Add year/month filtering if provided
      if (year) query.year = parseInt(year);
      if (month) query.month = parseInt(month);

      const files = await FileApproval.find(query).sort({
        uploadedAt: -1,
      });

      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  }

  async getFilesByCategoryYearMonth(req, res) {
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
  }

  async getCategoriesWithCounts(req, res) {
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
  }

  async getAvailableYears(req, res) {
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
  }

  async getAvailableMonths(req, res) {
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
                    $arrayElemAt: ["$$months", { $subtract: ["$month", 1] }],
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
  }

  async getCategoryStructure(req, res) {
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

      // Add month names and sort months
      structure.forEach((year) => {
        year.months.forEach((monthData) => {
          monthData.monthName = this.getMonthName(monthData.month);
        });
        year.months.sort((a, b) => b.month - a.month);
      });

      res.json(structure);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category structure" });
    }
  }
}

module.exports = new NextcloudController();
