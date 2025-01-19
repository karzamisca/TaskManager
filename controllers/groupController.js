// controllers/groupController.js
const Group = require("../models/Group");
const PaymentDocument = require("../models/PaymentDocument");
const ProposalDocument = require("../models/ProposalDocument");
const PurchasingDocument = require("../models/PurchasingDocument");

exports.createGroup = (req, res) => {
  const { name, description } = req.body;

  const newGroup = new Group({
    name,
    description,
  });

  newGroup
    .save()
    .then(() => {
      res.redirect("/group");
    })
    .catch((err) => {
      console.log("Error creating group:", err);
      res.status(500).send("Internal Server Error");
    });
};

// New method to get all groups as JSON
exports.getGroup = (req, res) => {
  Group.find()
    .then((groups) => {
      res.json(groups);
    })
    .catch((err) => {
      console.log("Error fetching groups:", err);
      res.status(500).send("Internal Server Error");
    });
};

exports.getGroupedDocuments = async (req, res) => {
  try {
    // Fetch all documents from the models and filter out documents without a groupName
    const proposalDocuments = await ProposalDocument.find({
      groupName: { $ne: null },
    });
    const paymentDocuments = await PaymentDocument.find({
      groupName: { $ne: null },
    });
    const purchasingDocuments = await PurchasingDocument.find({
      groupName: { $ne: null },
    });

    // Combine all documents into one array with a 'type' field
    const allDocuments = [
      ...proposalDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Proposal",
      })),
      ...purchasingDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Purchasing",
      })),
      ...paymentDocuments.map((doc) => ({
        ...doc.toObject(),
        type: "Payment",
      })),
    ];

    // Group by groupName
    const groupedDocuments = allDocuments.reduce((acc, doc) => {
      if (!acc[doc.groupName]) {
        acc[doc.groupName] = [];
      }
      acc[doc.groupName].push(doc);
      return acc;
    }, {});

    // Return grouped documents as JSON
    res.json(groupedDocuments);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).send("Internal Server Error");
  }
};
