const drive = require("../middlewares/googleAuthMiddleware");
const File = require("../models/GoogleDriveFile");
const streamifier = require("streamifier");

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

exports.downloadFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await drive.files.get(
      { fileId: id, alt: "media" },
      { responseType: "stream" }
    );

    file.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
