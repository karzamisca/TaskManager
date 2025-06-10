// utils/sftpService.js
const { Client } = require("ssh2");

class SFTPManager {
  constructor() {
    this.client = null;
    this.sftp = null;
    this.connected = false;
    this.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.config = null; // Store config for reconnection
  }

  async connect(config) {
    this.config = config; // Store config for reconnection
    return new Promise((resolve, reject) => {
      this.client = new Client();

      this.client.on("ready", () => {
        this.client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }

          this.sftp = sftp;
          this.connected = true;
          this.reconnectAttempts = 0; // Reset on successful connection
          resolve();
        });
      });

      this.client.on("error", (err) => {
        console.error("SSH connection error:", err);
        this.connected = false;
        if (
          this.autoReconnect &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          setTimeout(() => this.connect(this.config), 5000); // Retry after 5 seconds
        } else {
          reject(err);
        }
      });

      this.client.on("close", () => {
        console.log("SSH connection closed");
        this.connected = false;
        this.sftp = null;
        if (
          this.autoReconnect &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          setTimeout(() => this.connect(this.config), 5000); // Retry after 5 seconds
        }
      });

      this.client.connect(config);
    });
  }

  async disconnect() {
    this.autoReconnect = false; // Disable auto-reconnect when manually disconnecting
    if (this.client) {
      this.client.end();
      this.connected = false;
      this.sftp = null;
      this.reconnectAttempts = 0;
    }
  }

  async listFiles(remotePath) {
    if (!this.connected || !this.sftp) {
      throw new Error("Not connected to SFTP server");
    }

    return new Promise((resolve, reject) => {
      this.sftp.readdir(remotePath, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        const fileList = files.map((file) => ({
          name: file.filename,
          type: file.attrs.isDirectory() ? "directory" : "file",
          size: file.attrs.size,
          modifyTime: file.attrs.mtime * 1000, // Convert to milliseconds
          permissions: file.attrs.mode,
          owner: file.attrs.uid,
          group: file.attrs.gid,
        }));

        // Sort directories first, then files
        fileList.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        resolve(fileList);
      });
    });
  }

  async uploadFile(localPath, remotePath) {
    if (!this.connected || !this.sftp) {
      throw new Error("Not connected to SFTP server");
    }

    return new Promise((resolve, reject) => {
      this.sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async downloadFile(remotePath, localPath) {
    if (!this.connected || !this.sftp) {
      throw new Error("Not connected to SFTP server");
    }

    return new Promise((resolve, reject) => {
      this.sftp.fastGet(remotePath, localPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async createDirectory(remotePath) {
    if (!this.connected || !this.sftp) {
      throw new Error("Not connected to SFTP server");
    }

    return new Promise((resolve, reject) => {
      this.sftp.mkdir(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async deleteFile(remotePath) {
    if (!this.connected || !this.sftp) {
      throw new Error("Not connected to SFTP server");
    }

    return new Promise((resolve, reject) => {
      // First check if it's a directory
      this.sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        if (stats.isDirectory()) {
          this.sftp.rmdir(remotePath, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        } else {
          this.sftp.unlink(remotePath, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }
      });
    });
  }

  async renameFile(oldPath, newPath) {
    if (!this.connected || !this.sftp) {
      throw new Error("Not connected to SFTP server");
    }

    return new Promise((resolve, reject) => {
      this.sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  isConnected() {
    return this.connected && this.sftp;
  }

  // Method to get status information without circular references
  getStatusInfo() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      autoReconnect: this.autoReconnect,
    };
  }
}

module.exports = { SFTPManager };
