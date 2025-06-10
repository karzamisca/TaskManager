// config/sftpConfig.js
const sftpConfig = {
  connection: {
    host: process.env.FILE_SERVER_HOST,
    port: process.env.FILE_SERVER_PORT || 22,
    username: process.env.FILE_SERVER_USER,
    password: process.env.FILE_SERVER_PASS,
    readyTimeout: 30000,
  },
  upload: {
    dest: "uploads/",
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  },
  paths: {
    tempDir: "temp",
    uploadsDir: "uploads",
  },
};

module.exports = sftpConfig;
