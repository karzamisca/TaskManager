const drive = require("../middlewares/googleAuthMiddleware");
const File = require("../models/GoogleDriveFile");
const streamifier = require("streamifier");
const moment = require("moment-timezone");

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    // Create file metadata
    const fileMetadata = { name: req.file.originalname };
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
