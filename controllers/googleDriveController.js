// controllers/googleDriveController.js
const drive = require("../middlewares/googleAuthMiddleware");
const File = require("../models/GoogleDriveFile");
const Folder = require("../models/GoogleDriveFolder");
const streamifier = require("streamifier");
const moment = require("moment-timezone");
require("dotenv").config();

//Serve view
exports.getFileAndFolder = (req, res) => {
  if (req.user.role !== "approver") {
    return res.send(
      "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied.You do not have permission to access."
    );
  }
  res.sendFile("googleDriveFileTransfer.html", {
    root: "./views/transfer/googleDrive",
  });
};

// Upload file to a folder
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { parentFolderId } = req.body; // Retrieve parent folder ID from the request body

    // Create file metadata
    const fileMetadata = {
      name: req.file.originalname,
      ...(parentFolderId && { parents: [parentFolderId] }), // Include parent folder ID if provided
    };

    const media = {
      mimeType: req.file.mimetype,
      body: streamifier.createReadStream(req.file.buffer), // Convert buffer to stream
    };

    // Upload the file to Google Drive
    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id",
    });

    // Save file data to MongoDB
    const newFile = new File({
      name: req.file.originalname,
      googleDriveId: response.data.id,
      mimeType: req.file.mimetype,
      parentFolderId: parentFolderId || null, // Store the parent folder ID in the database
      uploadedAt: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    await newFile.save();

    res.json({
      message: "Tệp tin tải lên thành công / File uploaded successfully",
      file: newFile,
    });
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create a folder on Google Drive
exports.createFolder = async (req, res) => {
  try {
    const { name, parentFolderId } = req.body;

    // Set the parent ID for Google Drive
    const folderMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : [], // Assign parent if provided
    };

    // Create folder on Google Drive
    const driveResponse = await drive.files.create({
      resource: folderMetadata,
      fields: "id, name",
    });

    const googleDriveId = driveResponse.data.id;

    // Save folder metadata in MongoDB
    const newFolder = new Folder({
      name,
      googleDriveId,
      parentFolderId: parentFolderId || null, // Store parentFolderId or null
      createdAt: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
    });

    await newFolder.save();

    res.status(201).json({
      message: "Thư mục tạo thành công / Folder created successfully.",
      folder: newFolder,
    });
  } catch (error) {
    console.error("Error during folder creation:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getFolders = async (req, res) => {
  const parentFolderId = req.query.parentFolderId; // Get the parentFolderId from query parameters

  try {
    let folders;
    if (parentFolderId) {
      // Fetch subfolders for a specific parent folder from MongoDB
      folders = await Folder.find({ parentFolderId: parentFolderId });
    } else {
      // Fetch root-level folders if no parentFolderId is specified
      folders = await Folder.find(); // Assuming root folders have null parentFolderId
    }

    res.status(200).json(folders);
  } catch (error) {
    console.error("Error fetching folders:", error);
    res.status(500).json({ error: error.message });
  }
};

// Download file from Google Drive
exports.downloadFile = async (req, res) => {
  try {
    const { id } = req.params;

    // Get file metadata from MongoDB
    const file = await File.findOne({ googleDriveId: id });
    if (!file) {
      return res
        .status(404)
        .json({ message: "File not found in the database." });
    }

    // Check if the file is a Google Workspace document (e.g., Google Docs, Sheets)
    const fileMetadata = await drive.files.get({
      fileId: id,
      fields: "mimeType",
    });

    let response;
    if (fileMetadata.data.mimeType.startsWith("application/vnd.google-apps")) {
      // For Google Workspace files, export them in a suitable format
      const exportMimeType = getExportMimeType(fileMetadata.data.mimeType);
      if (!exportMimeType) {
        return res
          .status(400)
          .json({ message: "Unsupported file type for export." });
      }

      response = await drive.files.export(
        { fileId: id, mimeType: exportMimeType },
        { responseType: "stream" }
      );

      res.setHeader("Content-Type", exportMimeType);
    } else {
      // Fetch the file as binary content
      response = await drive.files.get(
        { fileId: id, alt: "media" },
        { responseType: "stream" }
      );

      const mimeType = file.mimeType || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
    }

    // Escape the file name for safe use in the header
    const escapedFileName = encodeURIComponent(file.name)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${escapedFileName}`
    );

    // Pipe the file stream to the response
    response.data.pipe(res);
  } catch (error) {
    console.error("Error during file download:", error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get export MIME type for Google Workspace files
const getExportMimeType = (googleMimeType) => {
  const exportMimeTypes = {
    "application/vnd.google-apps.document": "application/pdf", // Google Docs -> PDF
    "application/vnd.google-apps.spreadsheet":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // Google Sheets -> XLSX
    "application/vnd.google-apps.presentation":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // Google Slides -> PPTX
  };

  return exportMimeTypes[googleMimeType] || null;
};

// Get all files or files for a specific folder from MongoDB
exports.getFiles = async (req, res) => {
  const folderId = req.query.folderId; // Get the folderId from query parameters

  try {
    let files;
    if (folderId) {
      // Fetch files for the specific folder from MongoDB
      files = await File.find({ parentFolderId: folderId });
    } else {
      // Fetch all files if no folderId is specified
      files = await File.find();
    }

    res.status(200).json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ error: error.message });
  }
};

// Fetch files without a parent folder (root-level files)
exports.getRootFiles = async (req, res) => {
  try {
    const rootFiles = await File.find({ parentFolderId: null });
    res.status(200).json(rootFiles);
  } catch (error) {
    console.error("Error fetching root files:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a file from Google Drive and MongoDB
exports.deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the file in MongoDB
    const file = await File.findOne({ googleDriveId: id });
    if (!file) {
      return res
        .status(404)
        .json({ message: "File not found in the database." });
    }

    // Delete the file from Google Drive
    await drive.files.delete({ fileId: id });

    // Remove the file metadata from MongoDB
    await File.deleteOne({ googleDriveId: id });

    res.json({
      message: "Tệp tin xóa thành công / File deleted successfully.",
    });
  } catch (error) {
    console.error("Error during file deletion:", error);
    res.status(500).json({ error: error.message });
  }
};

// Updated deleteFolder controller
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    // Recursive function to delete a folder and its contents
    const deleteFolderAndContents = async (folderId) => {
      // Find all subfolders in the database
      const subFolders = await Folder.find({ parentFolderId: folderId });

      for (const subFolder of subFolders) {
        // Recursively delete subfolders and their contents
        await deleteFolderAndContents(subFolder.googleDriveId);
      }

      // Delete all files in the folder
      const filesInFolder = await File.find({ parentFolderId: folderId });

      for (const file of filesInFolder) {
        await drive.files.delete({ fileId: file.googleDriveId }); // Delete file from Google Drive
        await File.deleteOne({ googleDriveId: file.googleDriveId }); // Delete file record from the database
      }

      // Delete the folder from Google Drive
      await drive.files.delete({ fileId: folderId });

      // Remove the folder record from the database
      await Folder.deleteOne({ googleDriveId: folderId });
    };

    // Start deletion with the root folder
    await deleteFolderAndContents(id);

    res.json({
      message:
        "Thư mục và nội dung bên trong xóa thành công / Folder and its contents deleted successfully.",
    });
  } catch (error) {
    console.error("Error during folder deletion:", error);
    res.status(500).json({ error: error.message });
  }
};

// Sync files from Google Drive to MongoDB
exports.syncFiles = async () => {
  try {
    let allFiles = [];
    let pageToken = null;

    // Fetch files with pagination
    do {
      const response = await drive.files.list({
        q: "mimeType!='application/vnd.google-apps.folder' and trashed=false",
        fields:
          "files(id, name, mimeType, parents, createdTime, owners), nextPageToken",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: pageToken, // For pagination
      });

      allFiles = [...allFiles, ...response.data.files];
      pageToken = response.data.nextPageToken; // Get the next page token if available
    } while (pageToken);

    // Sync: Update or add files in MongoDB
    const updatePromises = allFiles.map(async (file) => {
      const isRootFile =
        file.parents && file.parents[0] === process.env.MY_DRIVE_ID;

      const existingFile = await File.findOne({ googleDriveId: file.id });

      // Format the createdTime to "HH:mm:ss DD-MM-YYYY"
      const formattedCreatedTime = moment(file.createdTime).format(
        "HH:mm:ss DD-MM-YYYY"
      );

      if (existingFile) {
        // Update existing file if necessary
        existingFile.name = file.name;
        existingFile.mimeType = file.mimeType;
        existingFile.parentFolderId = isRootFile ? null : file.parents?.[0];
        await existingFile.save();
      } else {
        // Add new file to MongoDB
        const newFile = new File({
          name: file.name,
          googleDriveId: file.id,
          mimeType: file.mimeType,
          parentFolderId: isRootFile ? null : file.parents?.[0],
          uploadedAt: formattedCreatedTime,
        });
        await newFile.save();
      }
    });

    // Wait for all promises to resolve
    await Promise.all(updatePromises);

    // Remove files from MongoDB that are no longer on Google Drive
    const driveFileIds = allFiles.map((file) => file.id);
    await File.deleteMany({ googleDriveId: { $nin: driveFileIds } });

    return { success: true, message: "Files synchronized successfully." };
  } catch (error) {
    console.error("Error during file synchronization:", error);
    return { success: false, message: error.message };
  }
};

// Sync folders from Google Drive to MongoDB
exports.syncFolders = async () => {
  try {
    let allFolders = [];
    let pageToken = null;

    // Fetch folders with pagination
    do {
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "files(id, name, parents, createdTime), nextPageToken",
        pageToken: pageToken, // For pagination
      });

      allFolders = [...allFolders, ...response.data.files];
      pageToken = response.data.nextPageToken; // Get the next page token if available
    } while (pageToken);

    // Sync: Update or add folders in MongoDB
    const updatePromises = allFolders.map(async (folder) => {
      const isRootFolder =
        folder.parents && folder.parents[0] === process.env.MY_DRIVE_ID;

      const existingFolder = await Folder.findOne({ googleDriveId: folder.id });

      // Format the createdTime to "HH:mm:ss DD-MM-YYYY"
      const formattedCreatedTime = moment(folder.createdTime).format(
        "HH:mm:ss DD-MM-YYYY"
      );

      if (existingFolder) {
        // Update existing folder if necessary
        existingFolder.name = folder.name;
        existingFolder.parentFolderId = isRootFolder
          ? null
          : folder.parents?.[0];
        await existingFolder.save();
      } else {
        // Add new folder to MongoDB
        const newFolder = new Folder({
          name: folder.name,
          googleDriveId: folder.id,
          parentFolderId: isRootFolder ? null : folder.parents?.[0],
          createdAt: formattedCreatedTime,
        });
        await newFolder.save();
      }
    });

    // Wait for all promises to resolve
    await Promise.all(updatePromises);

    // Remove folders from MongoDB that are no longer on Google Drive
    const driveFolderIds = allFolders.map((folder) => folder.id);
    await Folder.deleteMany({ googleDriveId: { $nin: driveFolderIds } });

    return { success: true, message: "Folders synchronized successfully." };
  } catch (error) {
    console.error("Error during folder synchronization:", error);
    return { success: false, message: error.message };
  }
};

// Fetch and Sync Endpoint
exports.fetchAndSync = async (req, res) => {
  try {
    const filesResult = await this.syncFiles();
    const foldersResult = await this.syncFolders();

    // Collect results and respond once
    const results = {
      files: filesResult,
      folders: foldersResult,
    };

    if (filesResult.success && foldersResult.success) {
      res.status(200).json({
        message: "Files and folders synchronized successfully.",
        results,
      });
    } else {
      res.status(500).json({
        message: "Some synchronization tasks failed.",
        results,
      });
    }
  } catch (error) {
    console.error("Error during fetch and sync:", error);
    res.status(500).json({ error: error.message });
  }
};
