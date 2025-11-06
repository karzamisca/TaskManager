// controllers/fileApprovalController.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const FileApproval = require("../models/FileApproval");
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

      console.log("All category folders initialized successfully");
    } catch (error) {
      console.error("Error initializing category folders:", error);
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
      console.log(`Directory created/exists: ${dirPath}`);
      return true;
    } catch (error) {
      if (error.response && error.response.status === 405) {
        // Directory already exists
        console.log(`Directory already exists: ${dirPath}`);
        return true;
      }
      console.error(
        "Error creating directory:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async uploadToNextcloud(localFilePath, remoteFolder, fileName) {
    try {
      console.log(
        `Uploading file to NextCloud: ${localFilePath} -> ${remoteFolder}/${fileName}`
      );

      // Ensure directory exists
      await this.ensureDirectoryExists(remoteFolder);

      const fileData = fs.readFileSync(localFilePath);
      const remotePath = `${remoteFolder}/${fileName}`;

      console.log(`Uploading to: ${this.baseUrl}/${remotePath}`);

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
      console.error(
        "Failed to upload file to Nextcloud:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async moveFileInNextcloud(sourcePath, destinationPath) {
    try {
      console.log(
        `Moving file in NextCloud: ${sourcePath} -> ${destinationPath}`
      );

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
      console.error(
        "Failed to move file in Nextcloud:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async deleteFromNextcloud(filePath) {
    try {
      console.log(`Deleting file from NextCloud: ${filePath}`);

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
          console.log(`Created share link: ${shareData.url}`);
          return shareData.url;
        }
      }

      // Fallback to direct URL
      return this.getDirectDownloadUrl(filePath);
    } catch (error) {
      console.error(
        "Failed to create public share:",
        error.response?.data || error.message
      );
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

  // Controller Methods
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { category, year, month } = req.body;

      if (
        !category ||
        !["Công ty", "Đối tác", "Ngân hàng", "Pháp lý"].includes(category)
      ) {
        return res.status(400).json({ error: "Valid category is required" });
      }

      if (!year || !month) {
        return res.status(400).json({ error: "Year and month are required" });
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      // Remove year limits - allow any valid year
      if (isNaN(yearNum) || yearNum < 0) {
        return res
          .status(400)
          .json({ error: "Year must be a valid positive number" });
      }

      if (monthNum < 1 || monthNum > 12) {
        return res
          .status(400)
          .json({ error: "Month must be between 1 and 12" });
      }

      console.log("File upload request:", {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        size: req.file.size,
        path: req.file.path,
        category: category,
        year: yearNum,
        month: monthNum,
      });

      const categoryFolder = this.getCategoryFolderName(category);
      const pendingPath = `Pending/${categoryFolder}`;

      await this.ensureDirectoryExists(pendingPath);

      const uploadResult = await this.uploadToNextcloud(
        req.file.path,
        pendingPath,
        req.file.filename
      );

      // Store user-selected year and month in database
      const fileApproval = new FileApproval({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        category: category,
        year: yearNum,
        month: monthNum,
        nextcloudPath: uploadResult.path,
        shareUrl: uploadResult.downloadUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: "pending",
        ipAddress: req.ip,
        uploadedBy: req.user ? req.user.username : "anonymous",
      });

      await fileApproval.save();

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log(
        "File uploaded to NextCloud Pending folder with ID:",
        fileApproval._id
      );

      res.json({
        success: true,
        message: `File uploaded successfully to ${category} category for ${monthNum}/${yearNum}`,
        fileId: fileApproval._id,
        fileName: req.file.originalname,
        category: category,
        year: yearNum,
        month: monthNum,
        shareUrl: uploadResult.downloadUrl,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res
        .status(500)
        .json({ error: "Failed to upload file: " + error.message });
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
      console.error("Error fetching pending files:", error);
      res.status(500).json({ error: "Failed to fetch pending files" });
    }
  }

  async approveFile(req, res) {
    try {
      const fileApproval = await FileApproval.findById(req.params.id);

      if (!fileApproval) {
        return res.status(404).json({ error: "File not found" });
      }

      if (fileApproval.status !== "pending") {
        return res.status(400).json({ error: "File already processed" });
      }

      console.log("Approving file:", {
        id: fileApproval._id,
        fileName: fileApproval.fileName,
        category: fileApproval.category,
        year: fileApproval.year,
        month: fileApproval.month,
        nextcloudPath: fileApproval.nextcloudPath,
      });

      const categoryFolder = this.getCategoryFolderName(fileApproval.category);
      const approvedCategoryPath = `Approved/${categoryFolder}/${fileApproval.year}/${fileApproval.month}`;

      // Ensure the specific year/month directory exists
      await this.ensureDirectoryExists(`Approved/${categoryFolder}`);
      await this.ensureDirectoryExists(
        `Approved/${categoryFolder}/${fileApproval.year}`
      );
      await this.ensureDirectoryExists(approvedCategoryPath);

      const sourcePath = fileApproval.nextcloudPath;
      const destinationPath = `${approvedCategoryPath}/${fileApproval.fileName}`;

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
        message: `File approved and moved to ${fileApproval.category} category in ${fileApproval.month}/${fileApproval.year} folder`,
        shareUrl: moveResult.downloadUrl,
        file: fileApproval,
      });
    } catch (error) {
      console.error("Approve error:", error);
      res
        .status(500)
        .json({ error: "Failed to approve file: " + error.message });
    }
  }

  async rejectFile(req, res) {
    try {
      const fileApproval = await FileApproval.findById(req.params.id);

      if (!fileApproval) {
        return res.status(404).json({ error: "File not found" });
      }

      if (fileApproval.status !== "pending") {
        return res.status(400).json({ error: "File already processed" });
      }

      console.log("Rejecting file:", {
        id: fileApproval._id,
        fileName: fileApproval.fileName,
        nextcloudPath: fileApproval.nextcloudPath,
      });

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
      console.error("Reject error:", error);
      res
        .status(500)
        .json({ error: "Failed to reject file: " + error.message });
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
      console.error("Error fetching history:", error);
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
      console.error("Error fetching file:", error);
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
      console.error("Error fetching files by category:", error);
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
      console.error("Error fetching files by category/year/month:", error);
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
      console.error("Error fetching category counts:", error);
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
      console.error("Error fetching available years:", error);
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
      console.error("Error fetching available months:", error);
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
      console.error("Error fetching category structure:", error);
      res.status(500).json({ error: "Failed to fetch category structure" });
    }
  }
}

module.exports = new NextcloudController();
