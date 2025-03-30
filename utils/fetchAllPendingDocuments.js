// utils/fetchAllPendingDocuments.js
const Document = require("../models/Document");
const ProposalDocument = require("../models/ProposalDocument");
const PurchasingDocument = require("../models/PurchasingDocument");
const PaymentDocument = require("../models/PaymentDocument");
const AdvancePaymentDocument = require("../models/AdvancePaymentDocument");
const DeliveryDocument = require("../models/DeliveryDocument");
const ProjectProposalDocument = require("../models/ProjectProposalDocument");

async function fetchAllPendingDocuments() {
  const [
    pendingDocuments,
    pendingProposals,
    pendingPurchasingDocs,
    pendingDeliveryDocs,
    pendingPaymentDocs,
    pendingAdvancePaymentDocs,
    pendingProjectProposals,
  ] = await Promise.all([
    Document.find({ status: { $ne: "Approved" } }),
    ProposalDocument.find({ status: { $ne: "Approved" } }),
    PurchasingDocument.find({ status: { $ne: "Approved" } }),
    DeliveryDocument.find({ status: { $ne: "Approved" } }),
    PaymentDocument.find({ status: { $ne: "Approved" } }),
    AdvancePaymentDocument.find({ status: { $ne: "Approved" } }),
    ProjectProposalDocument.find({ status: { $ne: "Approved" } }),
  ]);

  // Combine all pending documents
  return [
    ...pendingDocuments,
    ...pendingProposals,
    ...pendingPurchasingDocs,
    ...pendingDeliveryDocs,
    ...pendingPaymentDocs,
    ...pendingAdvancePaymentDocs,
    ...pendingProjectProposals,
  ];
}

module.exports = { fetchAllPendingDocuments };
