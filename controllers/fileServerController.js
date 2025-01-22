const { Client } = require("ssh2");
const archiver = require("archiver"); // Add this dependency for zipping folders
const path = require("path");

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

// Serve the HTML
exports.serveHTML = (req, res) => {
  res.sendFile("fileServer.html", { root: "./views/transfer/fileServer" });
};

// List files
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

// Create nested folders
exports.createFolder = async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).send("Path is required");

  try {
    const conn = await connectSSH();

    // Execute the mkdir command with the '-p' option to ensure all folders are created
    conn.exec(`mkdir -p "${path}"`, (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).send("Error executing mkdir command");
      }

      // Handle the stream close event
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
          // Optionally log output to debug
          console.log("STDOUT: " + data);
        })
        .stderr.on("data", (data) => {
          // Log stderr output for debugging
          console.error("STDERR: " + data);
        });
    });
  } catch (err) {
    console.error("Connection error: ", err);
    return res.status(500).send("Error connecting to the SSH server");
  }
};

// Delete file/folder
exports.deleteFile = async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).send("Path is required");

  try {
    const conn = await connectSSH();
    conn.sftp((err, sftp) => {
      if (err) return res.status(500).send("Error opening SFTP session");

      sftp.unlink(path, (err) => {
        conn.end();
        if (err) return res.status(500).send("Error deleting file");
        res.send("File deleted");
      });
    });
  } catch (err) {
    res.status(500).send("Error connecting to SSH server");
  }
};

// Download file
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

      // Check if the path is a file or directory
      sftp.stat(path, (err, stats) => {
        if (err) {
          conn.end();
          return res.status(500).send("Error checking file/directory");
        }

        if (stats.isDirectory()) {
          // Handle directory download: create a zip archive
          res.attachment(`${path.split("/").pop()}.zip`);

          const archive = archiver("zip", { zlib: { level: 9 } });
          archive.on("error", (err) => {
            console.error("Archive Error:", err);
            if (!res.headersSent) {
              res.status(500).send("Error creating archive");
            }
            conn.end();
          });

          // Pipe the archive to the response
          archive.pipe(res);

          // Add the folder to the archive
          archive.directory(path, false);

          archive.finalize();
          archive.on("end", () => {
            conn.end(); // Clean up the connection after archiving
          });
        } else {
          // Handle file download
          const stream = sftp.createReadStream(path);

          stream.on("error", (err) => {
            console.error("Stream Error:", err);
            if (!res.headersSent) {
              res.status(500).send("Error downloading file");
            }
            conn.end(); // Clean up the connection
          });

          res.attachment(path.split("/").pop());
          stream.pipe(res).on("close", () => {
            conn.end(); // Clean up the connection after streaming
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
