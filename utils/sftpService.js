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
    this.reconnectInterval = 5000; // 5 seconds
    this.config = null;
    this.connectionPromise = null;
    this.connectionListeners = [];
  }

  async connect(config) {
    // If already connecting, return the existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.config = config;
    this.connectionPromise = new Promise((resolve, reject) => {
      this.client = new Client();

      const cleanup = () => {
        this.connectionPromise = null;
      };

      this.client.on("ready", () => {
        this.client.sftp((err, sftp) => {
          if (err) {
            cleanup();
            reject(err);
            return;
          }

          this.sftp = sftp;
          this.connected = true;
          this.reconnectAttempts = 0;
          cleanup();
          this.notifyConnectionListeners(true);
          resolve();
        });
      });

      this.client.on("error", (err) => {
        console.error("SSH connection error:", err);
        this.handleConnectionError(err);
        cleanup();
        reject(err);
      });

      this.client.on("close", () => {
        console.log("SSH connection closed");
        this.handleConnectionClose();
        cleanup();
      });

      this.client.connect(config);
    });

    return this.connectionPromise;
  }

  handleConnectionError(err) {
    this.connected = false;
    this.sftp = null;
    this.notifyConnectionListeners(false, err);

    if (
      this.autoReconnect &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  handleConnectionClose() {
    this.connected = false;
    this.sftp = null;
    this.notifyConnectionListeners(false);

    if (
      this.autoReconnect &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectInterval}ms...`
    );

    setTimeout(() => {
      if (this.autoReconnect) {
        this.connect(this.config).catch((err) => {
          console.error("Reconnect attempt failed:", err);
        });
      }
    }, this.reconnectInterval);
  }

  async disconnect() {
    this.autoReconnect = false;
    if (this.client) {
      return new Promise((resolve) => {
        this.client.on("close", () => {
          this.connected = false;
          this.sftp = null;
          this.reconnectAttempts = 0;
          this.notifyConnectionListeners(false);
          resolve();
        });
        this.client.end();
      });
    }
    return Promise.resolve();
  }

  addConnectionListener(callback) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  notifyConnectionListeners(connected, error = null) {
    this.connectionListeners.forEach((callback) => {
      try {
        callback(connected, error);
      } catch (err) {
        console.error("Connection listener error:", err);
      }
    });
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
