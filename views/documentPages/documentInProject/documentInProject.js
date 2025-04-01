// views\documentPages\documentInProject\documentInProject.js
let token = null;
let currentProjectId = null;
let currentUserRole = null;
let currentProject = null;
let currentUserId = null;
let productCount = 0;
let allowedCostCenters = []; // Store allowed cost centers for the current user

// Fetch user role and ID
async function fetchUserRole() {
  const response = await fetch("/getRoleProjectDocument", {
    credentials: "include", // Include cookies
  });
  const data = await response.json();
  currentUserRole = data.role;
  currentUserId = data._id; // Use _id instead of userId
}

// Fetch allowed cost centers for the current user
async function fetchAllowedCostCenters() {
  fetch("/getCurrentUser")
    .then((response) => response.json())
    .then((userData) => {
      const currentUser = userData.username; // Get the current user's username

      // Fetch cost centers
      fetch("/costCentersProjectDocument")
        .then((response) => response.json())
        .then((costCenters) => {
          const costCenterSelect = document.getElementById(
            "proposal-cost-center"
          );

          // Clear the existing options (if any)
          costCenterSelect.innerHTML =
            '<option value="">Chọn một trạm/Select a center</option>';

          // Add options dynamically based on the allowed users
          costCenters.forEach((center) => {
            if (
              center.allowedUsers.length === 0 ||
              center.allowedUsers.includes(currentUser)
            ) {
              const option = document.createElement("option");
              option.value = center.name;
              option.textContent = center.name;
              costCenterSelect.appendChild(option);
            }
          });
        })
        .catch((error) => {
          console.error("Error fetching cost centers:", error);
        });
    })
    .catch((error) => {
      console.error("Error fetching current user:", error);
    });
}

// Populate the cost center dropdown with allowed cost centers
function populateCostCenterDropdown() {
  const costCenterDropdown = document.getElementById("proposal-cost-center");
  costCenterDropdown.innerHTML = ""; // Clear existing options

  // Add a default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select a cost center";
  costCenterDropdown.appendChild(defaultOption);

  // Add allowed cost centers
  allowedCostCenters.forEach((costCenter) => {
    const option = document.createElement("option");
    option.value = costCenter.name;
    option.textContent = costCenter.name;
    costCenterDropdown.appendChild(option);
  });
}

// Create a new project
async function createProject(event) {
  event.preventDefault(); // Prevent default form submission
  const title = document.getElementById("project-title").value;
  const description = document.getElementById("project-description").value;

  const response = await fetch("/createProjectDocument", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify({ title, description }),
  });

  const data = await response.json();
  if (response.ok) {
    alert("Project created successfully");
    loadProjects(); // Reload the project list
  } else {
    alert(data.message);
  }
}

// Load all projects
async function loadProjects() {
  const response = await fetch("/getAllProjectDocuments", {
    credentials: "include", // Include cookies
  });
  const projects = await response.json();

  const projectList = document.getElementById("projects");
  projectList.innerHTML = "";

  projects.forEach((project) => {
    const li = document.createElement("li");
    li.textContent = project.title;
    li.setAttribute("data-project-id", project._id); // Attach projectId
    li.onclick = () => loadProject(project._id); // Load project details
    projectList.appendChild(li);
  });
}

// Load project details
async function loadProject(projectId) {
  const response = await fetch(`/getProjectDocument/${projectId}`, {
    credentials: "include",
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.message || "Failed to load project");
    return;
  }

  currentProject = data;
  currentProjectId = projectId;

  document.getElementById("project-details").style.display = "block";
  document.getElementById("project-details-title").innerText = data.title;
  document.getElementById("project-details-description").innerText =
    data.description;

  // Initialize phases
  ["proposal", "purchasing", "payment"].forEach((phase) => {
    // Update phase displays and forms
    lockPhase(phase, data.phases[phase]);

    // Display attachments if they exist
    if (data.phases[phase].attachments) {
      displayAttachments(phase, data.phases[phase].attachments);
    }

    // Update the attach file button state
    const attachBtn = document.querySelector(
      `#${phase}-attachments-list + .file-input-wrapper .attach-file-btn`
    );
    if (attachBtn) {
      attachBtn.disabled = !canModifyPhase(phase);
    }
  });
}

// Lock a phase if it's approved
function lockPhase(phase, phaseData) {
  const form = document.getElementById(`${phase}-form`);
  const submitButton = form.querySelector("button[type='submit']");
  const approveButton = form.querySelector("button[onclick*='approvePhase']");
  const addProductButton = document.querySelector(
    "#purchasing-form button[onclick*='addProduct']"
  );

  // Populate form fields
  if (phase === "purchasing") {
    const productsDiv = document.getElementById("purchasing-products");
    productsDiv.innerHTML = ""; // Clear existing products

    // Populate products
    phaseData.products.forEach((product, index) => {
      const productDiv = document.createElement("div");
      productDiv.innerHTML = `
        <h4>Product ${index + 1}</h4>
        <label for="purchasing-product-name-${index}">Product Name:</label>
        <input
          type="text"
          id="purchasing-product-name-${index}"
          value="${product.productName}"
          ${phaseData.status !== "Pending" ? "disabled" : ""}
          required
        />
        <label for="purchasing-cost-per-unit-${index}">Cost Per Unit:</label>
        <input
          type="number"
          id="purchasing-cost-per-unit-${index}"
          value="${product.costPerUnit}"
          ${phaseData.status !== "Pending" ? "disabled" : ""}
          required
        />
        <label for="purchasing-amount-${index}">Amount:</label>
        <input
          type="number"
          id="purchasing-amount-${index}"
          value="${product.amount}"
          ${phaseData.status !== "Pending" ? "disabled" : ""}
          required
        />
        <label for="purchasing-total-cost-${index}">Total Cost:</label>
        <input
          type="number"
          id="purchasing-total-cost-${index}"
          value="${product.totalCost}"
          readonly
        />
        <label for="purchasing-note-${index}">Note:</label>
        <input
          type="text"
          id="purchasing-note-${index}"
          value="${product.note}"
          ${phaseData.status !== "Pending" ? "disabled" : ""}
          required
        />
      `;
      productsDiv.appendChild(productDiv);
    });

    // Populate grand total cost
    document.getElementById("purchasing-grand-total-cost").value =
      phaseData.grandTotalCost;

    // Populate the title field
    document.getElementById("purchasing-title").value = phaseData.title || "";

    // Enable or disable the "Add Product" button based on phase status
    if (addProductButton) {
      addProductButton.disabled = phaseData.status !== "Pending";
    }
  } else if (phase === "proposal") {
    // Populate proposal phase fields
    document.getElementById("proposal-task").value = phaseData.task || "";
    document.getElementById("proposal-cost-center").value =
      phaseData.costCenter || "";
    document.getElementById("proposal-date-of-error").value =
      phaseData.dateOfError || "";
    document.getElementById("proposal-details-description").value =
      phaseData.detailsDescription || "";
    document.getElementById("proposal-direction").value =
      phaseData.direction || "";
  } else if (phase === "payment") {
    // Populate payment phase fields
    document.getElementById("payment-title").value = phaseData.title || "";
    document.getElementById("payment-payment-method").value =
      phaseData.paymentMethod || "";
    document.getElementById("payment-amount-of-money").value =
      phaseData.amountOfMoney || "";
    document.getElementById("payment-paid").value = phaseData.paid || "";
    document.getElementById("payment-payment-deadline").value =
      phaseData.paymentDeadline || "";
  }

  // Handle phase status
  if (phaseData.status === "Pending") {
    form.querySelectorAll("input, textarea, select").forEach((element) => {
      element.disabled = false;
    });
    submitButton.disabled = false; // Enable the submit button
    approveButton.disabled = !canApprovePhase(phase); // Allow approval if the user can approve
  } else if (phaseData.status === "Locked") {
    form
      .querySelectorAll("input, textarea, select, button")
      .forEach((element) => {
        element.disabled = true;
      });
  } else if (phaseData.status === "Partially Approved") {
    form.querySelectorAll("input, textarea, select").forEach((element) => {
      element.disabled = true;
    });
    submitButton.disabled = true; // Disable the submit button
    approveButton.disabled = !canApprovePhase(phase); // Allow approval if the user can approve
  } else if (phaseData.status === "Approved") {
    form
      .querySelectorAll("input, textarea, select, button")
      .forEach((element) => {
        element.disabled = true;
      });
  }
}

// Check if the current user can approve the phase
function canApprovePhase(phase) {
  if (phase === "proposal" && currentUserRole === "headOfMechanical")
    return true;
  if (phase === "purchasing" && currentUserRole === "headOfPurchasing")
    return true;
  if (
    phase === "payment" &&
    (currentUserRole === "headOfAccounting" || currentUserRole === "director")
  ) {
    // Check if the user has already approved the payment phase
    if (currentProject && currentProject.phases.payment.approvedBy) {
      const userHasApproved = currentProject.phases.payment.approvedBy.some(
        (approverId) => approverId === currentUserId
      );
      if (userHasApproved) {
        return false; // User has already approved
      }
    }
    return true;
  }
  return false;
}

async function approvePhase(phase) {
  if (!currentProjectId) {
    alert("No project selected. Please select a project first.");
    return;
  }

  // Check if the user has the correct role to approve the phase
  if (!canApprovePhase(phase)) {
    alert("You do not have permission to approve this phase.");
    return;
  }

  const response = await fetch("/approvePhaseProjectDocument", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify({ projectId: currentProjectId, phase }),
  });

  const data = await response.json();
  if (response.ok) {
    alert("Phase approved successfully");
    loadProject(currentProjectId); // Reload project details
  } else {
    alert(data.message);
  }
}

async function updatePhase(phase, event) {
  event.preventDefault(); // Prevent default form submission
  if (!currentProjectId) {
    alert("No project selected. Please select a project first.");
    return;
  }

  const form = document.getElementById(`${phase}-form`);
  const details = {};

  // Collect phase details from the form
  form.querySelectorAll("input, textarea, select").forEach((input) => {
    const key = input.id.replace(`${phase}-`, "");
    if (input.value) {
      details[key] = input.value;
    }
  });

  const response = await fetch("/updatePhaseDetailsProjectDocument", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify({
      projectId: currentProjectId,
      phase,
      details,
    }),
  });

  const data = await response.json();
  if (response.ok) {
    alert("Phase details updated successfully");
    loadProject(currentProjectId); // Reload project details
  } else {
    alert(data.message);
  }
}

function addProduct() {
  const productDiv = document.createElement("div");
  productDiv.innerHTML = `
    <h4>Product ${productCount + 1}</h4>
    <label for="purchasing-product-name-${productCount}">Product Name:</label>
    <input
      type="text"
      id="purchasing-product-name-${productCount}"
      placeholder="Enter product name"
      required
    />
    <label for="purchasing-cost-per-unit-${productCount}">Cost Per Unit:</label>
    <input
      type="number"
      id="purchasing-cost-per-unit-${productCount}"
      placeholder="Enter cost per unit"
      required
    />
    <label for="purchasing-amount-${productCount}">Amount:</label>
    <input
      type="number"
      id="purchasing-amount-${productCount}"
      placeholder="Enter amount"
      required
    />
    <label for="purchasing-total-cost-${productCount}">Total Cost:</label>
    <input
      type="number"
      id="purchasing-total-cost-${productCount}"
      placeholder="Total cost"
      readonly
    />
    <label for="purchasing-note-${productCount}">Note:</label>
    <input
      type="text"
      id="purchasing-note-${productCount}"
      placeholder="Enter note"
      required
    />
  `;
  document.getElementById("purchasing-products").appendChild(productDiv);
  productCount++; // Increment the product count
}

// Function to display attachments
function displayAttachments(phase, attachments) {
  const attachmentsList = document.getElementById(`${phase}-attachments-list`);
  if (!attachmentsList) {
    console.error(`Attachments list element not found for phase: ${phase}`);
    return;
  }

  attachmentsList.innerHTML = "";

  if (!attachments || attachments.length === 0) {
    attachmentsList.innerHTML =
      '<p style="margin: 0.5em 0; color: #666;">No attachments</p>';
    return;
  }

  const list = document.createElement("ul");
  attachments.forEach((file) => {
    const item = document.createElement("li");

    const link = document.createElement("a");
    link.href = file.googleDriveUrl;
    link.target = "_blank";
    link.textContent = file.name;
    item.appendChild(link);

    if (canModifyPhase(phase)) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Xóa/Remove";
      removeBtn.className = "remove-file-btn";
      removeBtn.onclick = () => removeFile(phase, file._id);
      item.appendChild(removeBtn);
    }

    list.appendChild(item);
  });

  attachmentsList.appendChild(list);
}

// Function to trigger file input
function triggerFileInput(phase) {
  if (!canModifyPhase(phase)) return;
  document.getElementById(`${phase}-file-input`).click();
}

// Function to check if phase can be modified
function canModifyPhase(phase) {
  return (
    currentProject &&
    currentProject.phases[phase] &&
    currentProject.phases[phase].status === "Pending"
  );
}

// Function to upload files to Google Drive
async function uploadFiles(phase, files) {
  const formData = new FormData();
  formData.append("phase", phase);
  formData.append("projectId", currentProjectId);
  for (let file of files) {
    formData.append("files", file);
  }

  try {
    const response = await fetch("/uploadProjectFiles", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const result = await response.json();
    if (response.ok) {
      await loadProject(currentProjectId); // Reload project to show new attachments
    } else {
      alert(result.message || "Failed to upload files");
    }
  } catch (error) {
    console.error("Error uploading files:", error);
    alert("Failed to upload files");
  }
}

// Function to remove file attachment
async function removeFile(phase, fileId) {
  if (!canModifyPhase(phase)) {
    alert("Cannot remove files from this phase anymore");
    return;
  }

  try {
    const response = await fetch("/removeProjectFile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        projectId: currentProjectId,
        phase,
        fileId,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      await loadProject(currentProjectId); // Reload project to update attachments list
    } else {
      alert(result.message || "Failed to remove file");
    }
  } catch (error) {
    console.error("Error removing file:", error);
    alert("Failed to remove file");
  }
}

// Update the loadProject function to display attachments
const originalLoadProject = loadProject;
loadProject = async function (projectId) {
  await originalLoadProject(projectId);

  // Display attachments for each phase
  ["proposal", "purchasing", "payment"].forEach((phase) => {
    if (currentProject.phases[phase].attachments) {
      displayAttachments(phase, currentProject.phases[phase].attachments);
    }
  });
};

// Add event listeners when the page loads
document.addEventListener("DOMContentLoaded", function () {
  ["proposal", "purchasing", "payment"].forEach((phase) => {
    const fileInput = document.getElementById(`${phase}-file-input`);
    if (fileInput) {
      fileInput.addEventListener("change", (event) => {
        if (event.target.files.length > 0) {
          uploadFiles(phase, event.target.files);
        }
      });
    }
  });
});

// On page load
window.onload = async () => {
  await fetchUserRole();
  await fetchAllowedCostCenters(); // Fetch allowed cost centers
  await loadProjects();
};
