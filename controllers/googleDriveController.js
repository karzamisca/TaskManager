const drive = require("../middlewares/googleAuthMiddleware");
const File = require("../models/GoogleDriveFile");
const Folder = require("../models/GoogleDriveFolder");
const streamifier = require("streamifier");
const moment = require("moment-timezone");

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

    res.status(200).json({
      message: "File uploaded successfully",
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
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Folder name is required." });
    }

    // Create a folder on Google Drive
    const folderMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };

    const response = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    // Save folder metadata to MongoDB
    const newFolder = new Folder({
      name,
      googleDriveId: response.data.id,
    });

    await newFolder.save();

    res.status(200).json({
      message: "Folder created successfully.",
      folder: newFolder,
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getFolders = async (req, res) => {
  try {
    const foldersInDB = await Folder.find();
    const driveResponse = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder'",
      fields: "files(id, name)",
    });

    const existingFolderIds = driveResponse.data.files.map(
      (folder) => folder.id
    );

    // Filter out folders no longer existing on Google Drive
    const validFolders = foldersInDB.filter((folder) =>
      existingFolderIds.includes(folder.googleDriveId)
    );

    res.status(200).json(validFolders);
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

    // Fetch the file from Google Drive
    const response = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "stream" }
    );

    // Use a fallback MIME type if undefined
    const mimeType = file.mimeType || "application/octet-stream";

    // Set headers and pipe the file stream to the response
    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.setHeader("Content-Type", mimeType);
    response.data.pipe(res);
  } catch (error) {
    console.error("Error during file download:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all files from MongoDB
exports.getFiles = async (req, res) => {
  try {
    const files = await File.find();
    res.status(200).json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
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

    res.status(200).json({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Error during file deletion:", error);
    res.status(500).json({ error: error.message });
  }
};

// Updated deleteFolder controller
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the folder in MongoDB
    const folder = await Folder.findOne({ googleDriveId: id });
    if (!folder) {
      return res
        .status(404)
        .json({ message: "Folder not found in the database." });
    }

    // Get a list of all files in the folder
    const fileList = await drive.files.list({
      q: `'${id}' in parents and trashed=false`,
      fields: "files(id, name)",
    });

    const filesInFolder = fileList.data.files;

    // Delete files inside the folder from Google Drive
    for (const file of filesInFolder) {
      await drive.files.delete({ fileId: file.id });

      // Remove file records from the database
      await File.deleteOne({ googleDriveId: file.id });
    }

    // Delete the folder from Google Drive
    await drive.files.delete({ fileId: id });

    // Remove the folder metadata from MongoDB
    await Folder.deleteOne({ googleDriveId: id });

    res
      .status(200)
      .json({ message: "Folder and its contents deleted successfully." });
  } catch (error) {
    console.error("Error during folder deletion:", error);
    res.status(500).json({ error: error.message });
  }
};
