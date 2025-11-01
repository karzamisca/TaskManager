// controllers/fileApprovalController.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const FileApproval = require("../models/FileApproval");
const Project = require("../models/Project");
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
    this.getProjects = this.getProjects.bind(this);
    this.encodePath = this.encodePath.bind(this);
  }

  // Encode path for URL and headers
  encodePath(path) {
    // Encode each segment of the path separately
    return path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  // Get all projects for dropdown
  async getProjects(req, res) {
    try {
      const projects = await Project.find({}).sort({ name: 1 });
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
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
      const encodedPath = this.encodePath(dirPath);
      console.log(`Ensuring directory exists: ${dirPath} -> ${encodedPath}`);

      const response = await axios.request({
        method: "MKCOL",
        url: `${this.baseUrl}/${encodedPath}`,
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/xml",
          ...(Object.keys(this.cookies).length > 0 && {
            Cookie: this.getCookieHeader(),
          }),
        },
      });
      this.storeCookies(response);
      console.log(`Directory created or already exists: ${dirPath}`);
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
      const encodedRemotePath = this.encodePath(remotePath);

      console.log(`Uploading to: ${this.baseUrl}/${encodedRemotePath}`);

      const response = await axios.put(
        `${this.baseUrl}/${encodedRemotePath}`,
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

      // Ensure the destination directory exists
      const destinationDir = path.dirname(destinationPath);
      await this.ensureDirectoryExists(destinationDir);

      // Encode both source and destination paths
      const encodedSourcePath = this.encodePath(sourcePath);
      const encodedDestinationPath = this.encodePath(destinationPath);

      console.log(`Encoded source: ${encodedSourcePath}`);
      console.log(`Encoded destination: ${encodedDestinationPath}`);

      const response = await axios.request({
        method: "MOVE",
        url: `${this.baseUrl}/${encodedSourcePath}`,
        headers: {
          Authorization: `Basic ${this.auth}`,
          Destination: `${this.baseUrl}/${encodedDestinationPath}`,
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

      const encodedPath = this.encodePath(filePath);

      const response = await axios.delete(`${this.baseUrl}/${encodedPath}`, {
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
      const encodedPath = this.encodePath(filePath);
      const shareParams = new URLSearchParams({
        path: filePath, // Keep original path for NextCloud API
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
    const encodedPath = this.encodePath(filePath);
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

      const { projectName } = req.body;

      if (!projectName) {
        return res.status(400).json({ error: "Project name is required" });
      }

      // Check if project exists
      const project = await Project.findOne({ name: projectName });
      if (!project) {
        return res.status(400).json({ error: "Project does not exist" });
      }

      console.log("File upload request:", {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        size: req.file.size,
        path: req.file.path,
        projectName: projectName,
      });

      // Create project folder in Pending directory
      const pendingProjectPath = `Pending/${projectName}`;

      // Upload to NextCloud Pending/Project folder
      const uploadResult = await this.uploadToNextcloud(
        req.file.path,
        pendingProjectPath,
        req.file.filename
      );

      // Log to MongoDB
      const fileApproval = new FileApproval({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        nextcloudPath: uploadResult.path,
        shareUrl: uploadResult.downloadUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        projectName: projectName,
        status: "pending",
        ipAddress: req.ip,
        uploadedBy: req.user ? req.user.username : "anonymous",
      });

      await fileApproval.save();

      // Remove local file after successful upload to NextCloud
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.log(
        `File uploaded to NextCloud Pending/${projectName} folder with ID:`,
        fileApproval._id
      );

      res.json({
        success: true,
        message: `File uploaded successfully to ${projectName} project in Pending folder`,
        fileId: fileApproval._id,
        fileName: req.file.originalname,
        projectName: projectName,
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
      const pendingFiles = await FileApproval.find({ status: "pending" }).sort({
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
        nextcloudPath: fileApproval.nextcloudPath,
        projectName: fileApproval.projectName,
      });

      // Create Approved project folder if it doesn't exist
      const approvedProjectPath = `Approved/${fileApproval.projectName}`;

      console.log(`Ensuring Approved folder exists: ${approvedProjectPath}`);

      // Ensure the Approved project folder exists
      await this.ensureDirectoryExists(approvedProjectPath);

      // Move file from Pending/Project to Approved/Project folder in NextCloud
      const sourcePath = fileApproval.nextcloudPath;
      const destinationPath = `${approvedProjectPath}/${fileApproval.fileName}`;

      console.log(`Source: ${sourcePath}`);
      console.log(`Destination: ${destinationPath}`);

      const moveResult = await this.moveFileInNextcloud(
        sourcePath,
        destinationPath
      );

      // Update MongoDB record
      fileApproval.status = "approved";
      fileApproval.nextcloudPath = moveResult.newPath;
      fileApproval.shareUrl = moveResult.downloadUrl;
      fileApproval.actionTakenAt = new Date();
      fileApproval.actionTakenBy = req.user ? req.user.username : "system";

      await fileApproval.save();

      res.json({
        success: true,
        message: `File approved and moved to ${fileApproval.projectName} project in Approved folder`,
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
        projectName: fileApproval.projectName,
      });

      // Delete file from NextCloud Pending/Project folder
      await this.deleteFromNextcloud(fileApproval.nextcloudPath);

      // Update MongoDB record
      fileApproval.status = "rejected";
      fileApproval.actionTakenAt = new Date();
      fileApproval.actionTakenBy = req.user ? req.user.username : "system";

      await fileApproval.save();

      res.json({
        success: true,
        message: `File rejected and deleted from ${fileApproval.projectName} project`,
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
        .limit(50);
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
}

module.exports = new NextcloudController();
