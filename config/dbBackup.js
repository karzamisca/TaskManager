// config/dbBackup.js
const mongoose = require("mongoose");
require("dotenv").config();

class DatabaseBackup {
  constructor() {
    this.sourceConnection = null;
    this.backupConnection = null;
  }

  async connectToSources() {
    try {
      // Connect to source database (removed deprecated options)
      this.sourceConnection = mongoose.createConnection(process.env.MONGO_URI);

      // Connect to backup database (removed deprecated options)
      this.backupConnection = mongoose.createConnection(
        process.env.BACKUP_MONGO_URI
      );

      // Wait for connections to be ready
      await new Promise((resolve, reject) => {
        let sourceReady = false;
        let backupReady = false;

        const checkBothReady = () => {
          if (sourceReady && backupReady) {
            resolve();
          }
        };

        this.sourceConnection.on("connected", () => {
          sourceReady = true;
          checkBothReady();
        });

        this.backupConnection.on("connected", () => {
          backupReady = true;
          checkBothReady();
        });

        this.sourceConnection.on("error", (err) => {
          reject(err);
        });

        this.backupConnection.on("error", (err) => {
          reject(err);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error("Database connection timeout"));
        }, 30000);
      });
    } catch (error) {
      throw error;
    }
  }

  async getCollectionNames() {
    try {
      // Check if connection is ready
      if (this.sourceConnection.readyState !== 1) {
        throw new Error("Source database connection not ready");
      }

      const collections = await this.sourceConnection.db
        .listCollections()
        .toArray();
      return collections.map((collection) => collection.name);
    } catch (error) {
      throw error;
    }
  }

  async backupCollection(collectionName) {
    try {
      // Check if connections are ready
      if (this.sourceConnection.readyState !== 1) {
        throw new Error("Source database connection not ready");
      }
      if (this.backupConnection.readyState !== 1) {
        throw new Error("Backup database connection not ready");
      }

      const sourceCollection =
        this.sourceConnection.db.collection(collectionName);
      const backupCollection =
        this.backupConnection.db.collection(collectionName);

      // Get all documents from source collection
      const documents = await sourceCollection.find({}).toArray();

      if (documents.length === 0) {
        return;
      }

      // Clear backup collection and insert all documents
      await backupCollection.deleteMany({});
      await backupCollection.insertMany(documents);
    } catch (error) {
      throw error;
    }
  }

  async performFullBackup() {
    try {
      const startTime = new Date();

      await this.connectToSources();
      const collectionNames = await this.getCollectionNames();

      // Backup each collection
      for (const collectionName of collectionNames) {
        await this.backupCollection(collectionName);
      }

      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;

      // Add backup metadata
      const backupMetadata = {
        backupDate: new Date(),
        sourceDatabase: process.env.MONGO_URI.split("/").pop().split("?")[0],
        collectionsBackedUp: collectionNames,
        backupDuration: duration,
        status: "completed",
      };

      const metadataCollection =
        this.backupConnection.db.collection("backup_metadata");
      await metadataCollection.insertOne(backupMetadata);
    } catch (error) {
      // Log failure metadata
      try {
        const backupMetadata = {
          backupDate: new Date(),
          sourceDatabase: process.env.MONGO_URI.split("/").pop().split("?")[0],
          status: "failed",
          error: error.message,
        };

        if (this.backupConnection) {
          const metadataCollection =
            this.backupConnection.db.collection("backup_metadata");
          await metadataCollection.insertOne(backupMetadata);
        }
      } catch (metaError) {
        // Silent failure for metadata logging
      }

      throw error;
    } finally {
      // Close connections
      if (this.sourceConnection) {
        await this.sourceConnection.close();
      }
      if (this.backupConnection) {
        await this.backupConnection.close();
      }
    }
  }

  async getBackupStatus() {
    try {
      // Create a new connection for status check (removed deprecated options)
      const tempBackupConnection = mongoose.createConnection(
        process.env.BACKUP_MONGO_URI
      );

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        tempBackupConnection.on("connected", resolve);
        tempBackupConnection.on("error", reject);

        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error("Backup database connection timeout"));
        }, 10000);
      });

      const metadataCollection =
        tempBackupConnection.db.collection("backup_metadata");
      const latestBackup = await metadataCollection.findOne(
        {},
        { sort: { backupDate: -1 } }
      );

      await tempBackupConnection.close();
      return latestBackup;
    } catch (error) {
      return null;
    }
  }
}

// Export functions for use in cron jobs
const performDatabaseBackup = async () => {
  const backup = new DatabaseBackup();
  await backup.performFullBackup();
};

const getLastBackupStatus = async () => {
  const backup = new DatabaseBackup();
  return await backup.getBackupStatus();
};

module.exports = {
  DatabaseBackup,
  performDatabaseBackup,
  getLastBackupStatus,
};
