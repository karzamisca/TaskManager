const { Client } = require("ssh2");
const archiver = require("archiver");
const path = require("path");
const multer = require("multer"); // Add this for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Connect to SSH
const connectSSH = () => {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn
      .on("ready", () => resolve(conn))
      .on("error", reject)
      .connect({
        host: process.env.FILE_SERVER_HOST,
        port: process.env.FILE_SERVER_PORT,
        username: process.env.FILE_SERVER_USER,
        password: process.env.FILE_SERVER_PASS,
      });
  });
};

exports.serveHTML = (req, res) => {
  res.sendFile("fileServer.html", { root: "./views/transfer/fileServer" });
};

exports.listFiles = async (req, res) => {
  const { path = "." } = req.query;
  try {
    const conn = await connectSSH();
    conn.sftp((err, sftp) => {
      if (err) return res.status(500).send("Error opening SFTP session");

      sftp.readdir(path, (err, list) => {
        conn.end();
        if (err) return res.status(500).send("Error reading directory");
        res.json(
          list.map((item) => ({
            name: item.filename,
            type: item.longname[0] === "d" ? "folder" : "file",
          }))
        );
      });
    });
  } catch (err) {
    res.status(500).send("Error connecting to SSH server");
  }
};

exports.createFolder = async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).send("Path is required");

  try {
    const conn = await connectSSH();
    conn.exec(`mkdir -p "${path}"`, (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).send("Error executing mkdir command");
      }

      stream
        .on("close", (code) => {
          conn.end();
          if (code === 0) {
            return res.send("Folder(s) created successfully");
          } else {
            return res.status(500).send("Error creating folder(s)");
          }
        })
        .on("data", (data) => {
          console.log("STDOUT: " + data);
        })
        .stderr.on("data", (data) => {
          console.error("STDERR: " + data);
        });
    });
  } catch (err) {
    console.error("Connection error: ", err);
    return res.status(500).send("Error connecting to the SSH server");
  }
};

exports.deleteFile = async (req, res) => {
  const { path, type } = req.body;
  if (!path) return res.status(400).send("Path is required");

  try {
    const conn = await connectSSH();

    if (type === "folder") {
      // Delete folder and its contents recursively
      conn.exec(`rm -rf "${path}"`, (err, stream) => {
        if (err) {
          conn.end();
          return res.status(500).send("Error deleting folder");
        }

        stream
          .on("close", (code) => {
            conn.end();
            if (code === 0) {
              return res.send("Folder deleted successfully");
            } else {
              return res.status(500).send("Error deleting folder");
            }
          })
          .on("data", (data) => {
            console.log("STDOUT: " + data);
          })
          .stderr.on("data", (data) => {
            console.error("STDERR: " + data);
          });
      });
    } else {
      // Delete single file
      conn.sftp((err, sftp) => {
        if (err) return res.status(500).send("Error opening SFTP session");

        sftp.unlink(path, (err) => {
          conn.end();
          if (err) return res.status(500).send("Error deleting file");
          res.send("File deleted");
        });
      });
    }
  } catch (err) {
    res.status(500).send("Error connecting to SSH server");
  }
};

exports.downloadFile = async (req, res) => {
  const { path } = req.query;
  if (!path) return res.status(400).send("Path is required");

  try {
    const conn = await connectSSH();
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return res.status(500).send("Error opening SFTP session");
      }

      sftp.stat(path, (err, stats) => {
        if (err) {
          conn.end();
          return res.status(500).send("Error checking file/directory");
        }

        if (stats.isDirectory()) {
          res.attachment(`${path.split("/").pop()}.zip`);
          const archive = archiver("zip", { zlib: { level: 9 } });

          archive.on("error", (err) => {
            console.error("Archive Error:", err);
            if (!res.headersSent) {
              res.status(500).send("Error creating archive");
            }
            conn.end();
          });

          archive.pipe(res);
          archive.directory(path, false);
          archive.finalize();
          archive.on("end", () => {
            conn.end();
          });
        } else {
          const stream = sftp.createReadStream(path);

          stream.on("error", (err) => {
            console.error("Stream Error:", err);
            if (!res.headersSent) {
              res.status(500).send("Error downloading file");
            }
            conn.end();
          });

          res.attachment(path.split("/").pop());
          stream.pipe(res).on("close", () => {
            conn.end();
          });
        }
      });
    });
  } catch (err) {
    console.error("Connection error:", err);
    if (!res.headersSent) {
      res.status(500).send("Error connecting to SSH server");
    }
  }
};

// New file upload handler
exports.uploadFile = [
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const uploadPath = req.body.path || ".";
    const fileName = req.file.originalname;
    const fullPath = path.join(uploadPath, fileName);

    try {
      const conn = await connectSSH();
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return res.status(500).send("Error opening SFTP session");
        }

        const writeStream = sftp.createWriteStream(fullPath);

        writeStream.on("close", () => {
          conn.end();
          res.send("File uploaded successfully");
        });

        writeStream.on("error", (err) => {
          conn.end();
          console.error("Write stream error:", err);
          res.status(500).send("Error uploading file");
        });

        // Write the file buffer to the remote server
        writeStream.end(req.file.buffer);
      });
    } catch (err) {
      console.error("Connection error:", err);
      res.status(500).send("Error connecting to SSH server");
    }
  },
];
