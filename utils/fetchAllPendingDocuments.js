// utils/fetchAllPendingDocuments.js
const Document = require("../models/Document");
const ProposalDocument = require("../models/DocumentProposal");
const PurchasingDocument = require("../models/DocumentPurchasing");
const PaymentDocument = require("../models/DocumentPayment");
const AdvancePaymentDocument = require("../models/DocumentAdvancePayment");
const DeliveryDocument = require("../models/DocumentDelivery");
const ProjectProposalDocument = require("../models/DocumentProjectProposal");

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
