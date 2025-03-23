// app.js
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoute = require("./routes/authRoute");
const adminRoute = require("./routes/adminRoute");
const documentRoute = require("./routes/documentRoute");
const projectDocumentRoute = require("./routes/projectDocumentRoute");
const groupRoute = require("./routes/groupRoute");
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
const Document = require("./models/Document");
const ProposalDocument = require("./models/ProposalDocument");
const PurchasingDocument = require("./models/PurchasingDocument");
const PaymentDocument = require("./models/PaymentDocument");
const Group = require("./models/Group");
require("dotenv").config();

const app = express();

// Database connection
connectDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
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
app.use("/", authMiddleware, projectDocumentRoute);
app.use("/", authMiddleware, groupRoute);
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
  try {
    const serverUrl =
      `https://kylongtask.azurewebsites.net/login` ||
      `http://localhost:${PORT}`;
    await axios.get(serverUrl);
  } catch (error) {
    console.error("Failed to ping server:", error.message);
  }
});

// Cron job to ping the server every 5 minutes to keep it warm
cron.schedule("*/5 * * * *", async () => {
  try {
    const serverUrl = `https://kylongtech.com` || `http://localhost:${PORT}`;
    await axios.get(serverUrl);
  } catch (error) {
    console.error("Failed to ping server:", error.message);
  }
});

// Cron job to ping the server every 5 minutes to keep it warm
cron.schedule("*/5 * * * *", async () => {
  try {
    const serverUrl =
      `https://www.kylongtech.com` || `http://localhost:${PORT}`;
    await axios.get(serverUrl);
  } catch (error) {
    console.error("Failed to ping server:", error.message);
  }
});

// Cron job to send email notifications every 24 hours
cron.schedule("0 */8 * * *", async () => {
  try {
    // Fetch all documents that are not fully approved
    const [
      pendingDocuments,
      pendingProposals,
      pendingPurchasingDocs,
      pendingPaymentDocs,
    ] = await Promise.all([
      Document.find({ status: { $ne: "Approved" } }),
      ProposalDocument.find({ status: { $ne: "Approved" } }),
      PurchasingDocument.find({ status: { $ne: "Approved" } }),
      PaymentDocument.find({ status: { $ne: "Approved" } }),
    ]);
    // Combine all pending documents and send consolidated emails
    const allPendingDocuments = [
      ...pendingDocuments,
      ...pendingProposals,
      ...pendingPurchasingDocs,
      ...pendingPaymentDocs,
    ];
    await documentController.sendPendingApprovalEmails(allPendingDocuments);
  } catch (error) {
    console.error("Error in pending approval email scheduler:", error);
  }
});

cron.schedule("0 */8 * * *", async () => {
  try {
    // Fetch all documents that are not fully approved
    const [
      pendingDocuments,
      pendingProposals,
      pendingPurchasingDocs,
      pendingPaymentDocs,
    ] = await Promise.all([
      Document.find({ status: { $ne: "Approved" } }),
      ProposalDocument.find({ status: { $ne: "Approved" } }),
      PurchasingDocument.find({ status: { $ne: "Approved" } }),
      PaymentDocument.find({ status: { $ne: "Approved" } }),
    ]);

    // Combine all pending documents
    const allPendingDocuments = [
      ...pendingDocuments,
      ...pendingProposals,
      ...pendingPurchasingDocs,
      ...pendingPaymentDocs,
    ];

    // Send Chatfuel messages
    await documentController.sendPendingApprovalChatfuelMessages(
      allPendingDocuments
    );
  } catch (error) {
    console.error("Error in pending approval Chatfuel scheduler:", error);
  }
});

//Assign group name and declaration to payment document
cron.schedule("* * * * *", async () => {
  console.log("Running automatic payment document grouping...");
  try {
    // Fetch all approved documents that don't have a group assigned
    // This includes both missing groupName and empty string groupName
    const ungroupedDocuments = await PaymentDocument.find({
      status: "Approved",
      $or: [
        { groupName: { $exists: false } },
        { groupName: "" },
        { groupName: null },
      ],
    });

    if (ungroupedDocuments.length === 0) {
      console.log("No ungrouped approved documents found to assign");
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
      const groupName = `Phiếu thanh toán_${date.replace(/-/g, "")}`;

      // Generate a standard declaration for the group
      const declaration = `Phiếu thanh toán phê duyệt vào ${date}`;

      // Check if the group already exists
      let group = await Group.findOne({ name: groupName });

      // If group doesn't exist, create it
      if (!group) {
        group = new Group({
          name: groupName,
          description: `Phiếu thanh toán phê duyệt vào ${date}`,
        });
        await group.save();
        groupsCreated.push(groupName);
        console.log(`Created new group: ${groupName}`);
      }

      // Assign all documents in this date group to the group
      for (const doc of documents) {
        doc.groupName = groupName;

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

    console.log(
      `Assignment completed: ${documentsAssigned} documents assigned to groups`
    );
    if (groupsCreated.length > 0) {
      console.log(`New groups created: ${groupsCreated.join(", ")}`);
    }
  } catch (err) {
    console.error("Error in automatic document grouping:", err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
