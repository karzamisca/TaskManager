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
const authMiddleware = require("./middlewares/authMiddleware"); // JWT middleware
const entryRoute = require("./routes/entryRoute");
const googleDriveRoute = require("./routes/googleDriveRoute");
const fileServerRoute = require("./routes/fileServerRoute");
const messageRoute = require("./routes/messageRoute");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cron = require("node-cron");
const axios = require("axios");
const documentController = require("./controllers/documentController"); // Import the email notification function
const PaymentDocument = require("./models/DocumentPayment");
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

// Routes
app.use("/", authRoute);
app.use("/", authMiddleware, adminRoute);
app.use("/", authMiddleware, googleDriveRoute);
app.use("/", authMiddleware, fileServerRoute);
app.use("/", authMiddleware, documentRoute); // Apply JWT middleware to document routes
app.use("/", authMiddleware, documentInProjectRoute);
app.use("/", authMiddleware, documentInGroupDeclarationRoute);
app.use("/", authMiddleware, documentInGroupRoute);
app.use("/", authMiddleware, projectRoute);
app.use("/", authMiddleware, entryRoute);
app.use("/", authMiddleware, messageRoute);

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

// Cron job to ping the server every 5 minutes to keep it warm
cron.schedule("*/5 * * * *", async () => {
  const servers = [
    "https://kylongtask.azurewebsites.net/login",
    "https://kylongtech.com",
    "https://www.kylongtech.com",
  ];

  for (const serverUrl of servers) {
    try {
      await axios.get(serverUrl);
      console.log(`Successfully pinged ${serverUrl}`);
    } catch (error) {
      console.error(`Failed to ping server ${serverUrl}:`, error.message);
    }
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
      documentController.sendPendingApprovalEmails(allPendingDocuments),

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

// Assign declaration group name and declaration to approved payment document
cron.schedule("*/5 * * * *", async () => {
  try {
    // Fetch all approved documents that don't have a group assigned
    // This includes both missing groupName and empty string groupName
    const ungroupedDocuments = await PaymentDocument.find({
      status: "Approved",
      $or: [
        { groupDeclarationName: { $exists: false } },
        { groupDeclarationName: "" },
        { groupDeclarationName: null },
      ],
    });
    if (ungroupedDocuments.length === 0) {
      return;
    }
    // Process each document
    let documentsAssigned = 0;
    const groupsCreated = [];
    // Group documents by date (DD-MM-YYYY)
    const documentsByDate = {};
    ungroupedDocuments.forEach((doc) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
