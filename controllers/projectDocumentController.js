const Project = require("../models/ProjectDocument");
const User = require("../models/User");

//Serve view
exports.getProjectDocumentView = (req, res) => {
  res.sendFile("projectDocument.html", {
    root: "./views/approvals/projectDocuments",
  });
};

exports.createProjectDocument = async (req, res) => {
  const { title, description } = req.body;
  const project = new Project({
    title,
    description,
    createdBy: req._id,
    phases: {
      proposal: {
        approvedBy: null, // Initialize as null for single approver
      },
      purchasing: {
        approvedBy: null, // Initialize as null for single approver
      },
      payment: {
        approvedBy: [], // Initialize as empty array for multiple approvers
      },
    },
  });
  await project.save();
  res.status(201).json({ message: "Project created successfully", project });
};

exports.approvePhaseProjectDocument = async (req, res) => {
  console.log("User ID from middleware:", req._id); // Debugging
  console.log("User Role from middleware:", req.role); // Debugging

  const { projectId, phase } = req.body;
  const project = await Project.findById(projectId);

  if (!project) return res.status(404).json({ message: "Project not found" });

  // Role-based checks
  if (phase === "proposal" && req.role !== "approver") {
    return res.status(403).json({ message: "Unauthorized" });
  }
  if (phase === "purchasing" && req.role !== "approver") {
    return res.status(403).json({ message: "Unauthorized" });
  }
  if (
    phase === "payment" &&
    req.role !== "approver" &&
    req.role !== "Director"
  ) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  // Handle phase approval
  if (phase === "payment") {
    // Initialize approvedBy if it's undefined
    if (!project.phases.payment.approvedBy) {
      project.phases.payment.approvedBy = [];
    }

    // Ensure the user hasn't already approved this phase
    if (project.phases.payment.approvedBy.includes(req._id)) {
      return res
        .status(400)
        .json({ message: "You have already approved this phase." });
    }

    // Add the user's ID to the approvedBy array
    project.phases.payment.approvedBy.push(req._id);

    // Check if both roles have approved
    const approvedUsers = await User.find({
      _id: { $in: project.phases.payment.approvedBy },
    });

    const hasHeadOfAccounting = approvedUsers.some(
      (user) => user.role === "approver"
    );
    const hasDirector = approvedUsers.some((user) => user.role === "Director");

    // Mark the phase as fully approved if both roles have approved
    if (hasHeadOfAccounting && hasDirector) {
      project.phases.payment.status = "Approved";
    } else {
      project.phases.payment.status = "Partially Approved";
    }
  } else {
    // For other phases, simply approve the phase
    project.phases[phase].status = "Approved";
    project.phases[phase].approvedBy = req._id;

    // Unlock the next phase
    if (phase === "proposal") {
      project.phases.purchasing.status = "Pending"; // Unlock purchasing phase
    } else if (phase === "purchasing") {
      project.phases.payment.status = "Pending"; // Unlock payment phase
    }
  }

  await project.save();
  res.json({ message: "Phase approved successfully", project });
};

function getCurrentGMT7Date() {
  const date = new Date();
  const offset = 7; // GMT+7
  const localTime = date.getTime() + offset * 60 * 60 * 1000;
  const localDate = new Date(localTime);

  const day = String(localDate.getUTCDate()).padStart(2, "0");
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = localDate.getUTCFullYear();
  const hours = String(localDate.getUTCHours()).padStart(2, "0");
  const minutes = String(localDate.getUTCMinutes()).padStart(2, "0");
  const seconds = String(localDate.getUTCSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

exports.updatePhaseDetailsProjectDocument = async (req, res) => {
  const { projectId, phase, details } = req.body;
  console.log("Updating phase details:", { projectId, phase, details }); // Debugging

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if the phase is already approved
    if (project.phases[phase].status === "Approved") {
      return res.status(403).json({ message: "This phase is read-only" });
    }

    // Map form field names to schema field names for each phase
    const fieldMappings = {
      proposal: {
        task: "task",
        "cost-center": "costCenter",
        "date-of-error": "dateOfError",
        "details-description": "detailsDescription",
        direction: "direction",
      },
      purchasing: {
        title: "title",
        products: "products",
        "grand-total-cost": "grandTotalCost",
      },
      payment: {
        title: "title",
        "payment-method": "paymentMethod",
        "amount-of-money": "amountOfMoney",
        paid: "paid",
        "payment-deadline": "paymentDeadline",
      },
    };

    // Handle purchasing phase differently
    if (phase === "purchasing") {
      const products = [];
      let grandTotalCost = 0;

      // Collect product details
      let i = 0;
      while (details[`product-name-${i}`]) {
        const productName = details[`product-name-${i}`];
        const costPerUnit = parseFloat(details[`cost-per-unit-${i}`]);
        const amount = parseFloat(details[`amount-${i}`]);
        const totalCost = costPerUnit * amount;
        const note = details[`note-${i}`];

        if (productName && !isNaN(costPerUnit) && !isNaN(amount)) {
          products.push({
            productName,
            costPerUnit,
            amount,
            totalCost,
            note,
          });
          grandTotalCost += totalCost;
        }
        i++;
      }

      // Update purchasing phase details
      project.phases.purchasing.products = products;
      project.phases.purchasing.grandTotalCost = grandTotalCost;
      project.phases.purchasing.title = details.title; // Ensure this line is present
    } else {
      // For other phases, update phase-specific fields
      for (const [formField, value] of Object.entries(details)) {
        const schemaField = fieldMappings[phase][formField];
        if (schemaField && project.phases[phase][schemaField] !== undefined) {
          project.phases[phase][schemaField] = value;
        }
      }
    }

    // Update lastUpdatedAt for the phase
    project.phases[phase].lastUpdatedAt = getCurrentGMT7Date();

    console.log("Updated project:", project); // Debugging

    // Save the updated project
    await project.save();
    res.json({ message: "Phase details updated successfully", project });
  } catch (error) {
    console.error("Error updating phase details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getProjectDocument = async (req, res) => {
  const project = await Project.findById(req.params.id).populate(
    "createdBy phases.proposal.approvedBy phases.purchasing.approvedBy phases.payment.approvedBy"
  );
  if (!project) return res.status(404).json({ message: "Project not found" });
  res.json(project);
};

exports.getAllProjectDocuments = async (req, res) => {
  const projects = await Project.find({}) // Remove the filter
    .populate(
      "createdBy phases.proposal.approvedBy phases.purchasing.approvedBy phases.payment.approvedBy"
    );
  res.json(projects);
};

exports.getRoleProjectDocument = async (req, res) => {
  if (req.user) {
    return res.json({ role: req.user.role, _id: req.user._id }); // Return _id instead of userId
  }
  res.status(401).send("Unauthorized");
};
