// app.js
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const fetchAllPendingDocuments = require("./utils/fetchAllPendingDocuments");
const authRoute = require("./routes/authRoute");
const adminRoute = require("./routes/adminRoute");
const documentRoute = require("./routes/documentRoute");
const documentInProjectRoute = require("./routes/documentInProjectRoute");
const documentInGroupRoute = require("./routes/documentInGroupRoute");
const documentInGroupDeclarationRoute = require("./routes/documentInGroupDeclarationRoute");
const projectRoute = require("./routes/projectRoute");
const projectExpenseRoute = require("./routes/projectExpenseRoute");
const userRoute = require("./routes/userRoute");
const messageRoute = require("./routes/messageRoute");
const reportRoute = require("./routes/reportRoute");
const financeGasRoute = require("./routes/financeGasRoute");
const authMiddleware = require("./middlewares/authMiddleware"); // JWT middleware
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cron = require("node-cron");
const axios = require("axios");
const sftpController = require("./controllers/sftpController");
const { sftpConfig, initializeSFTP } = require("./config/sftpConfig");
const sftpRoutes = require("./routes/sftpRoutes");
const documentController = require("./controllers/documentController"); // Import the email notification function
const emailService = require("./utils/emailService"); // Import the email notification function
const { performDatabaseBackup } = require("./config/dbBackup"); // Import backup functions
const { createMonthlyUserRecords } = require("./utils/userMonthlyRecord"); // Import monthly record functions
const PaymentDocument = require("./models/DocumentPayment");
const AdvancePaymentDocument = require("./models/DocumentAdvancePayment");
const ProjectProposalDocument = require("./models/DocumentProjectProposal");
const GroupDeclaration = require("./models/GroupDeclaration");
const Project = require("./models/Project");
require("dotenv").config();

const app = express();

// Database connection
connectDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "views")));
app.use(cookieParser()); // Use cookie-parser to parse cookies
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use((req, res, next) => {
  if (req.accepts("html")) {
    res.set("Cache-Control", "no-store, must-revalidate");
  }
  next();
});

// Routes
app.use("/", authRoute);
app.use("/", authMiddleware, adminRoute);
app.use("/", authMiddleware, documentRoute); // Apply JWT middleware to document routes
app.use("/", authMiddleware, documentInProjectRoute);
app.use("/", authMiddleware, documentInGroupDeclarationRoute);
app.use("/", authMiddleware, documentInGroupRoute);
app.use("/", authMiddleware, projectRoute);
app.use("/", authMiddleware, projectExpenseRoute);
app.use("/", authMiddleware, messageRoute);
app.use("/", authMiddleware, userRoute);
app.use("/", authMiddleware, reportRoute);
app.use("/", authMiddleware, sftpRoutes);
app.use("/", authMiddleware, financeGasRoute);

// Error handling for multer
app.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err.message === "Invalid file type. Only Excel files are allowed."
  ) {
    res.send(err.message);
  } else {
    next(err);
  }
});

// Monthly user records cron job - runs on the 1st day of every month at 8:00 AM
cron.schedule("0 8 1 * *", async () => {
  try {
    const result = await createMonthlyUserRecords();
    // Silent execution - results are captured in the returned object
  } catch (error) {
    // Silent error handling - could log to a file or external service if needed
  }
});

// Database backup cron job
cron.schedule("0 */8 * * *", async () => {
  try {
    await performDatabaseBackup();
    console.log("Database backup completed successfully");
  } catch (error) {
    console.error("Database backup failed:", error.message);
  }
});

// Send notifications every 8 hours via multiple channels
cron.schedule("0 */8 * * *", async () => {
  try {
    const allPendingDocuments =
      await fetchAllPendingDocuments.fetchAllPendingDocuments();

    // Send notifications through all available channels
    await Promise.all([
      // Email notifications
      emailService.sendPendingApprovalEmails(allPendingDocuments),

      // Facebook/Chatfuel notifications
      documentController.sendPendingApprovalChatfuelMessages(
        allPendingDocuments
      ),
    ]);

    console.log(
      `Sent notifications for ${allPendingDocuments.length} pending documents`
    );
  } catch (error) {
    console.error("Error in pending approval notification scheduler:", error);
  }
});

// Assign declaration group name and declaration to approved payment and advance payment document
cron.schedule("*/5 * * * *", async () => {
  try {
    // This includes both missing groupName and empty string groupName
    const ungroupedDocuments = await Promise.all([
      // Regular payment documents
      PaymentDocument.find({
        status: "Approved",
        $or: [
          { groupDeclarationName: { $exists: false } },
          { groupDeclarationName: "" },
          { groupDeclarationName: null },
        ],
      }),
      // Advance payment documents
      AdvancePaymentDocument.find({
        status: "Approved",
        $or: [
          { groupDeclarationName: { $exists: false } },
          { groupDeclarationName: "" },
          { groupDeclarationName: null },
        ],
      }),
    ]);

    // Combine both document types
    const allDocuments = [...ungroupedDocuments[0], ...ungroupedDocuments[1]];

    if (allDocuments.length === 0) {
      return;
    }

    // Process each document
    let documentsAssigned = 0;
    const groupsCreated = [];

    // Group documents by date (DD-MM-YYYY)
    const documentsByDate = {};

    allDocuments.forEach((doc) => {
      // Get the latest approval date for the document
      if (doc.approvedBy && doc.approvedBy.length > 0) {
        // Sort approval dates in descending order
        const sortedApprovals = [...doc.approvedBy].sort((a, b) => {
          // Parse date strings in format "DD-MM-YYYY HH:MM:SS"
          const parseCustomDate = (dateStr) => {
            const [datePart, timePart] = dateStr.split(" ");
            const [day, month, year] = datePart.split("-");
            const [hour, minute, second] = timePart.split(":");
            // Month is 0-indexed in JavaScript Date constructor
            return new Date(year, month - 1, day, hour, minute, second);
          };
          return (
            parseCustomDate(b.approvalDate) - parseCustomDate(a.approvalDate)
          );
        });

        // Get just the date part (DD-MM-YYYY) for grouping
        const latestApprovalDate = sortedApprovals[0].approvalDate;
        const datePart = latestApprovalDate.split(" ")[0];

        // Add document to its date group
        if (!documentsByDate[datePart]) {
          documentsByDate[datePart] = [];
        }
        documentsByDate[datePart].push(doc);
      }
    });

    // Process each date group
    for (const [date, documents] of Object.entries(documentsByDate)) {
      // Create a group name based on the date
      const groupDeclarationName = `PTT${date.replace(/-/g, "")}`;

      // Generate a standard declaration for the group
      const declaration = `Phiếu thanh toán phê duyệt vào ${date}`;

      // Check if the group already exists
      let group = await GroupDeclaration.findOne({
        name: groupDeclarationName,
      });

      // If group doesn't exist, create it
      if (!group) {
        group = new GroupDeclaration({
          name: groupDeclarationName,
          description: `Phiếu thanh toán phê duyệt vào ${date}`,
        });
        await group.save();
        groupsCreated.push(groupDeclarationName);
      }

      // Assign all documents in this date group to the group
      for (const doc of documents) {
        doc.groupDeclarationName = groupDeclarationName;

        // Only update declaration if it's empty, null, or doesn't exist
        if (
          !doc.declaration ||
          doc.declaration === "" ||
          !("declaration" in doc)
        ) {
          doc.declaration = declaration;
        }

        // Save the document using the appropriate model
        await doc.save();
        documentsAssigned++;
      }
    }
  } catch (err) {
    console.error("Error in automatic document grouping:", err);
  }
});

// Create new project based on approved project proposal document
cron.schedule("*/5 * * * *", async () => {
  try {
    // Find all project proposal documents with "Approved" status
    const approvedProposals = await ProjectProposalDocument.find({
      status: "Approved",
    });

    // Process each approved proposal
    for (const proposal of approvedProposals) {
      try {
        // Ensure the document has a projectName field (use name if not set)
        if (!proposal.projectName) {
          proposal.projectName = proposal.name;
          await proposal.save();
        }

        const projectName = proposal.projectName;

        // Check if project with this name already exists
        const existingProject = await Project.findOne({ name: projectName });

        if (existingProject) {
          continue; // Skip to next proposal
        }

        // Get the final approval date (latest approval date from approvedBy array)
        let finalApprovalDate = "Not specified";
        if (proposal.approvedBy && proposal.approvedBy.length > 0) {
          // Sort by approval date (assuming dates are in a format that sorts correctly)
          const sortedApprovals = [...proposal.approvedBy].sort(
            (a, b) => new Date(b.approvalDate) - new Date(a.approvalDate)
          );
          finalApprovalDate = sortedApprovals[0].approvalDate;
        }

        // Create a new project based on the proposal
        const newProject = new Project({
          name: projectName,
          description: `Dự án được phê duyệt vào ${finalApprovalDate}`,
        });

        // Save the new project
        await newProject.save();
      } catch (error) {
        console.error(
          `Error processing proposal ${proposal.name || "unknown"}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error("Error during project check:", error);
  }
});

// SFTP connection refresh cron job - runs every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    // Check if SFTP manager exists and attempt to refresh connection
    if (sftpController && sftpController.sftpManager) {
      const isConnected = sftpController.sftpManager.isConnected();
      const statusInfo = sftpController.sftpManager.getStatusInfo();

      if (!isConnected) {
        console.log("SFTP Cron: Connection lost, attempting to reconnect...");
        console.log("SFTP Cron: Status -", statusInfo);

        // Reset auto-reconnect in case it was disabled
        sftpController.sftpManager.autoReconnect = true;
        sftpController.sftpManager.reconnectAttempts = 0;

        await sftpController.sftpManager.connect(sftpConfig.connection);
        console.log("SFTP Cron: Successfully reconnected to SFTP server");
      } else {
        // Even if connected, perform a health check by testing the connection
        try {
          // Test connection with a simple operation using your SFTPManager's method
          await sftpController.sftpManager.listFiles("/");
          console.log("SFTP Cron: Connection healthy");
        } catch (testError) {
          console.log("SFTP Cron: Connection test failed, reconnecting...");
          console.log("SFTP Cron: Test error:", testError.message);

          // Disconnect and reconnect
          await sftpController.sftpManager.disconnect();

          // Reset reconnect settings
          sftpController.sftpManager.autoReconnect = true;
          sftpController.sftpManager.reconnectAttempts = 0;

          await sftpController.sftpManager.connect(sftpConfig.connection);
          console.log("SFTP Cron: Successfully refreshed SFTP connection");
        }
      }
    } else {
      console.log(
        "SFTP Cron: SFTP manager not available, attempting initialization..."
      );
      await initializeSFTP();
      console.log("SFTP Cron: SFTP initialized successfully");
    }
  } catch (error) {
    console.error(
      "SFTP Cron: Failed to refresh SFTP connection:",
      error.message
    );

    // Attempt to reinitialize if connection refresh fails
    try {
      console.log("SFTP Cron: Attempting to reinitialize SFTP...");
      await initializeSFTP();
      console.log("SFTP Cron: SFTP reinitialized successfully");
    } catch (reinitError) {
      console.error(
        "SFTP Cron: Failed to reinitialize SFTP:",
        reinitError.message
      );
    }
  }
});

const connectionMonitor = {
  isActive: false,
  checkInterval: 30000, // 30 seconds
  timer: null,
  start: function (sftpManager) {
    if (this.isActive) return;

    this.isActive = true;
    this.timer = setInterval(async () => {
      try {
        if (!sftpManager.isConnected()) {
          console.log(
            "Connection monitor: SFTP connection lost, attempting to reconnect..."
          );
          await sftpManager.connect(sftpConfig.connection);
        }
      } catch (error) {
        console.error("Connection monitor error:", error);
      }
    }, this.checkInterval);
  },
  stop: function () {
    if (this.timer) {
      clearInterval(this.timer);
      this.isActive = false;
    }
  },
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    // Initialize SFTP connection
    await initializeSFTP();

    // Start connection monitor
    connectionMonitor.start(sftpController.sftpManager);

    // Add listener for connection changes
    sftpController.sftpManager.addConnectionListener((connected, error) => {
      if (connected) {
        console.log("SFTP connection established");
      } else {
        console.log("SFTP connection lost", error ? `: ${error.message}` : "");
      }
    });
  } catch (error) {
    console.error("Failed to initialize SFTP connection:", error);
  }
});
