// controllers/fileServerController.js
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

// Normalize paths for cross-platform compatibility
function normalizePath(inputPath) {
  return inputPath.split(path.sep).join(path.posix.sep);
}

exports.serveHTML = (req, res) => {
  if (
    ![
      "approver",
      "headOfMechanical",
      "headOfAccounting",
      "headOfPurchasing",
      "director",
    ].includes(req.user.role)
  ) {
    return res.send(
      "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
    );
  }
  res.sendFile("fileServer.html", { root: "./views/transfer/fileServer" });
};

exports.listFiles = async (req, res) => {
  const rawPath = req.query.path || ".";
  const normalizedPath = normalizePath(rawPath);

  try {
    const conn = await connectSSH();
    conn.sftp((err, sftp) => {
      if (err) {
        conn.end();
        return res.status(500).send("Error opening SFTP session");
      }

      sftp.readdir(normalizedPath, (err, files) => {
        conn.end();
        if (err) {
          return res.status(500).send("Error reading directory");
        }

        const fileList = files.map((file) => ({
          name: file.filename,
          type: file.longname.startsWith("d") ? "folder" : "file",
        }));

        res.json(fileList);
      });
    });
  } catch (err) {
    console.error("Connection error:", err);
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

      sftp.stat(path, async (err, stats) => {
        if (err) {
          conn.end();
          return res.status(500).send("Error checking file/directory");
        }

        if (stats.isDirectory()) {
          // Set the response headers for a zip file
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

          // Recursively add directory contents to the archive
          const addDirectoryToArchive = async (dirPath, archivePath = "") => {
            const files = await new Promise((resolve, reject) => {
              sftp.readdir(dirPath, (err, files) => {
                if (err) return reject(err);
                resolve(files);
              });
            });

            for (const file of files) {
              const filePath = `${dirPath}/${file.filename}`;
              const fileStats = await new Promise((resolve, reject) => {
                sftp.stat(filePath, (err, stats) => {
                  if (err) return reject(err);
                  resolve(stats);
                });
              });

              if (fileStats.isDirectory()) {
                // Recursively add subdirectories
                await addDirectoryToArchive(
                  filePath,
                  `${archivePath}/${file.filename}`
                );
              } else {
                // Add files to the archive
                const readStream = sftp.createReadStream(filePath);
                archive.append(readStream, {
                  name: `${archivePath}/${file.filename}`,
                });
              }
            }
          };

          await addDirectoryToArchive(path);

          archive.finalize();
          archive.on("end", () => {
            conn.end();
          });
        } else {
          // Handle single file download
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

    const rawUploadPath = req.body.path || ".";
    const uploadPath = normalizePath(rawUploadPath); // Normalize the path
    const fileName = req.file.originalname;
    const fullPath = path.posix.join(uploadPath, fileName); // Use path.posix.join for Linux compatibility

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
