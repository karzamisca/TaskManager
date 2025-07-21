// views\documentPages\documentSummaryProjectProposal\documentSummaryProjectProposal.js
let currentUser = null;
let projectProposals = null;
let showOnlyPendingApprovals = false;
let currentApprovers = [];
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = 1;
let paginationEnabled = true; // Default to enabled

function createToggleSwitch() {
  const toggleContainer = document.createElement("div");
  toggleContainer.style.marginBottom = "1rem";
  toggleContainer.innerHTML = `
    <label class="toggle-switch" style="display: flex; align-items: center; cursor: pointer;">
      <input type="checkbox" id="pendingToggle" style="margin-right: 0.5rem;">
      <span>Phiếu tôi cần duyệt</span>
    </label>
  `;
  return toggleContainer;
}

async function fetchCurrentUser() {
  try {
    const response = await fetch("/getCurrentUser");
    currentUser = await response.json();
  } catch (error) {
    console.error("Error fetching current user:", error);
  }
}

function filterDocumentsForCurrentUser(documents) {
  if (!currentUser || !showOnlyPendingApprovals) return documents;
  return documents.filter((doc) => {
    const isRequiredApprover = doc.approvers.some(
      (approver) => approver.username === currentUser.username
    );
    const hasNotApprovedYet = !doc.approvedBy.some(
      (approved) => approved.username === currentUser.username
    );
    return isRequiredApprover && hasNotApprovedYet;
  });
}

function showMessage(message, isError = false) {
  const messageContainer = document.getElementById("messageContainer");
  messageContainer.textContent = message;
  messageContainer.className = `message ${isError ? "error" : "success"}`;

  // Get the current scroll position
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  messageContainer.style.top = `${scrollY + 20}px`; // Offset from top of viewport

  messageContainer.style.display = "block";

  setTimeout(() => {
    messageContainer.style.display = "none";
  }, 5000);
}

function renderStatus(status) {
  switch (status) {
    case "Approved":
      return `<span class="status approved">Đã phê duyệt</span>`;
    case "Suspended":
      return `<span class="status suspended">Bị từ chối</span>`;
    default:
      return `<span class="status pending">Đang chờ</span>`;
  }
}

function renderContent(content) {
  if (!content || content.length === 0) return "-";
  return `
    <div class="content-container">
      ${content
        .map(
          (item) => `
        <div class="content-item">
          <strong>${item.name}:</strong> ${item.text}
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

async function fetchProjectProposals() {
  try {
    const response = await fetch("/getProjectProposalForSeparatedView");
    const data = await response.json();
    projectProposals = data.projectProposals;
    const filteredDocuments = filterDocumentsForCurrentUser(projectProposals);

    totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    // Calculate slice indexes for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Get documents for current page only if pagination is enabled, otherwise show all
    const pageDocuments = paginationEnabled
      ? filteredDocuments.slice(startIndex, endIndex)
      : filteredDocuments;

    const tableBody = document.getElementById("projectProposalsTable");
    tableBody.innerHTML = "";

    pageDocuments.forEach((doc) => {
      const approvalStatus = doc.approvers
        .map((approver) => {
          const hasApproved = doc.approvedBy.find(
            (a) => a.username === approver.username
          );
          return `
            <div class="approver-item">
              <span class="status-icon ${
                hasApproved ? "status-approved" : "status-pending"
              }"></span>
              <div>
                <div>${approver.username} (${approver.subRole})</div>
                ${
                  hasApproved
                    ? `<div class="approval-date">Duyệt vào: ${hasApproved.approvalDate}</div>`
                    : '<div class="approval-date">Chờ duyệt</div>'
                }
              </div>
            </div>
          `;
        })
        .join("");

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${doc.name || ""}</td>
        <td>
          ${renderContent(doc.content)}
          ${doc.declaration ? `(Kê khai: ${doc.declaration})` : ""}
          ${doc.suspendReason ? `(Lý do từ chối: ${doc.suspendReason})` : ""}
        </td>
        <td>${
          doc.fileMetadata?.link
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "-"
        }</td>
        <td>${renderStatus(doc.status)}</td>
        <td class="approval-status">${approvalStatus}</td>
        <td>
          <button class="approve-btn" onclick="showFullView('${
            doc._id
          }')" style="margin-right: 5px;">
            Xem đầy đủ
          </button>
          <form action="/exportDocumentToDocx/${
            doc._id
          }" method="GET" style="display:inline;">
              <button class="approve-btn">Xuất DOCX</button>
          </form>
          ${
            doc.approvedBy.length === 0
              ? `
            <button class="approve-btn" onclick="editDocument('${doc._id}')" style="margin-right: 5px;">Sửa</button>
            <button class="approve-btn" onclick="deleteDocument('${doc._id}')">Xóa</button>
          `
              : ""
          }
          ${
            doc.status === "Pending"
              ? `
            <button class="approve-btn" onclick="approveDocument('${doc._id}')" style="margin-right: 5px;">
              Phê duyệt
            </button>
          `
              : ""
          }
          ${
            doc.status === "Approved"
              ? `
              <button class="approve-btn" onclick="editDeclaration('${doc._id}')" style="margin-right: 5px;">
                Kê khai
              </button>
            `
              : doc.status === "Suspended"
              ? `
              <button class="approve-btn" onclick="openDocument('${doc._id}')">
                Mở 
              </button>
            `
              : `
              <button class="approve-btn" onclick="suspendDocument('${doc._id}')">
                Từ chối
              </button>
            `
          }                      
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Render pagination controls if pagination is enabled
    if (paginationEnabled) {
      renderPagination();
    } else {
      // Remove pagination if disabled
      let paginationContainer = document.getElementById("paginationContainer");
      if (paginationContainer) {
        paginationContainer.innerHTML = "";
      }
    }
    document.getElementById("approvedDocument").textContent =
      data.approvedDocument.toLocaleString();
    document.getElementById("unapprovedDocument").textContent =
      data.unapprovedDocument.toLocaleString();
  } catch (err) {
    console.error("Error fetching project proposals:", err);
    showMessage("Error fetching project proposals", true);
  }
}

// Function to handle pagination toggle
function togglePagination() {
  paginationEnabled = document.getElementById("paginationToggle").checked;
  currentPage = 1; // Reset to first page
  fetchProjectProposals();
}

// Function to render pagination controls
function renderPagination() {
  // First check if pagination container exists, if not create it
  let paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer) {
    const table = document.querySelector("table");
    paginationContainer = document.createElement("div");
    paginationContainer.id = "paginationContainer";
    paginationContainer.className = "pagination";
    table.parentNode.insertBefore(paginationContainer, table.nextSibling);
  }

  // Generate pagination HTML
  let paginationHTML = `
    <style>
      /* Pagination styles */
      .pagination {
        display: flex;
        justify-content: center;
        margin: 20px 0;
      }
      
      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .pagination-controls button {
        background-color: var(--primary-color);
        color: var(--bg-color);
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .pagination-controls button:hover:not([disabled]) {
        background-color: var(--primary-hover);
      }
      
      .pagination-controls button[disabled] {
        background-color: var(--border-color);
        cursor: not-allowed;
        opacity: 0.6;
      }
      
      .pagination-controls .page-info {
        margin: 0 10px;
        color: var(--text-color);
      }
      
      @media screen and (max-width: 768px) {
        .pagination-controls {
          gap: 5px;
        }
        
        .pagination-controls button {
          padding: 6px 10px;
          font-size: 14px;
        }
      }
    </style>
  `;

  if (totalPages > 1) {
    paginationHTML += `
      <div class="pagination-controls">
        <button onclick="changePage(1)" ${currentPage === 1 ? "disabled" : ""}>
          &laquo; Đầu
        </button>
        <button onclick="changePage(${currentPage - 1})" ${
      currentPage === 1 ? "disabled" : ""
    }>
          &lsaquo; Trước
        </button>
        <span class="page-info">
          Trang ${currentPage} / ${totalPages}
        </span>
        <button onclick="changePage(${currentPage + 1})" ${
      currentPage === totalPages ? "disabled" : ""
    }>
          Sau &rsaquo;
        </button>
        <button onclick="changePage(${totalPages})" ${
      currentPage === totalPages ? "disabled" : ""
    }>
          Cuối &raquo;
        </button>
      </div>
    `;
  }

  paginationContainer.innerHTML = paginationHTML;
}

// Function to change the current page
function changePage(newPage) {
  if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
    currentPage = newPage;
    fetchProjectProposals();
    // Scroll to top of table for better user experience
    document.querySelector("table").scrollIntoView({ behavior: "smooth" });
  }
}

async function approveDocument(documentId) {
  try {
    const response = await fetch(`/approveDocument/${documentId}`, {
      method: "POST",
    });
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      fetchProjectProposals();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error approving document:", err);
    showMessage("Error approving document", true);
  }
}

async function deleteDocument(documentId) {
  try {
    const response = await fetch(`/deleteDocument/${documentId}`, {
      method: "POST",
    });
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      fetchProjectProposals();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error deleting document:", err);
    showMessage("Error deleting document", true);
  }
}

function addEditModal() {
  const modalHTML = `
          <div id="editModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
            <div style="
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: var(--bg-color);
              padding: clamp(16px, 2vw, 24px);
              width: clamp(300px, 85vw, 900px);
              border-radius: clamp(4px, 1vw, 8px);
              max-height: 90vh;
              overflow-y: auto;
              font-size: clamp(14px, 1.5vw, 16px);
            ">
              <span onclick="closeEditModal()" style="
                position: sticky;
                float: right;
                top: 10px;
                cursor: pointer;
                font-size: clamp(20px, 2vw, 28px);
                padding: clamp(4px, 0.5vw, 8px);
              ">&times;</span>
              
              <h2 style="font-size: clamp(18px, 2vw, 24px); margin-bottom: clamp(16px, 2vw, 24px);">
                Edit Project Proposal
              </h2>
              
              <form id="editForm" onsubmit="handleEditSubmit(event)">
                <input type="hidden" id="editDocId">
                <!-- Basic Fields -->
                <div style="margin-bottom: 15px;">
                  <label for="editTitle">Title:</label>
                  <input type="text" id="editTitle" required style="width: 100%; padding: 8px;">
                </div>
                <div style="margin-bottom: 15px;">
                  <label for="editName">Name:</label>
                  <input type="text" id="editName" required style="width: 100%; padding: 8px;">
                </div>
                <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
                  <label for="editGroupName" style="display: block; margin-bottom: 0.5em;">Group Name:</label>
                  <input type="text" id="editGroupName" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit;">
                </div>
                <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
                  <label for="editProjectName" style="display: block; margin-bottom: 0.5em;">Project Name:</label>
                  <input type="text" id="editProjectName" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit;">
                </div>
                
                <div id="contentContainer" style="margin-bottom: clamp(12px, 1.5vw, 20px);">
                  <label style="display: block; margin-bottom: 0.5em;">Content:</label>
                  <div id="contentList"></div>
                  <button type="button" class="approve-btn" onclick="addContentField()" style="margin-top: 10px;">
                    Add Content
                  </button>
                </div>
                <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
                  <label for="editFile" style="display: block; margin-bottom: 0.5em;">Update File:</label>
                  <input type="file" id="editFile" style="
                    width: 100%;
                    padding: clamp(6px, 1vw, 12px);
                    font-size: inherit;
                  ">
                </div>
                <!-- Current Approvers Section -->
                <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
                  <label style="display: block; margin-bottom: 0.5em;">Current Approvers:</label>
                  <div id="currentApproversList"></div>
                </div>
                <!-- Add New Approvers Section -->
                <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
                  <label style="display: block; margin-bottom: 0.5em;">Add Approvers:</label>
                  <select id="newApproversDropdown" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit;">
                    <option value="">Select an approver</option>
                    <!-- Options will be populated dynamically -->
                  </select>
                  <input type="text" id="newApproverSubRole" placeholder="Sub Role" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; margin-top: 10px;">
                  <button type="button" class="approve-btn" onclick="addNewApprover()" style="margin-top: 10px;">
                    Add
                  </button>
                </div>
                <div style="
                  display: flex;
                  gap: clamp(8px, 1vw, 16px);
                  margin-top: clamp(20px, 2.5vw, 32px);
                ">
                  <button type="submit" class="approve-btn" style="
                    padding: clamp(8px, 1vw, 16px) clamp(16px, 2vw, 24px);
                    font-size: inherit;
                  ">Save Changes</button>
                  
                  <button type="button" class="approve-btn" onclick="closeEditModal()" style="
                    background: #666;
                    padding: clamp(8px, 1vw, 16px) clamp(16px, 2vw, 24px);
                    font-size: inherit;
                  ">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function addContentField(content = null) {
  const contentList = document.getElementById("contentList");
  const contentDiv = document.createElement("div");
  contentDiv.className = "content-item";
  contentDiv.style.marginBottom = "10px";
  contentList.appendChild(contentDiv);

  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "10px";
  contentDiv.appendChild(container);

  // Name input
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Content Name";
  nameInput.required = true;
  nameInput.style.width = "100%";
  nameInput.style.padding = "8px";
  if (content && content.name !== undefined) {
    nameInput.value = content.name;
  }
  container.appendChild(nameInput);

  // Text input
  const textInput = document.createElement("textarea");
  textInput.placeholder = "Content Text";
  textInput.required = true;
  textInput.style.width = "100%";
  textInput.style.padding = "8px";
  textInput.style.minHeight = "60px";
  if (content && content.text !== undefined) {
    textInput.value = content.text;
  }
  container.appendChild(textInput);

  // Remove button
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "approve-btn";
  removeButton.textContent = "Remove";
  removeButton.style.background = "#dc3545";
  removeButton.onclick = function () {
    this.parentElement.parentElement.remove();
  };
  container.appendChild(removeButton);
}

async function fetchApprovers() {
  try {
    const response = await fetch("/approvers");
    const approvers = await response.json();
    return approvers;
  } catch (error) {
    console.error("Error fetching approvers:", error);
    return [];
  }
}

function renderCurrentApprovers() {
  const currentApproversList = document.getElementById("currentApproversList");
  currentApproversList.innerHTML = currentApprovers
    .map(
      (approver) => `
        <div class="approver-item" data-id="${approver.approver}">
          <span>${approver.username} (${approver.subRole})</span>
          <input type="text" value="${approver.subRole}" onchange="updateApproverSubRole('${approver.approver}', this.value)" style="width: 100px; padding: 4px;">
          <button type="button" class="approve-btn" onclick="removeApprover('${approver.approver}')" style="background: #dc3545; padding: 4px 8px;">Remove</button>
        </div>
      `
    )
    .join("");
}

function updateApproverSubRole(approverId, newSubRole) {
  const approver = currentApprovers.find((a) => a.approver === approverId);
  if (approver) {
    approver.subRole = newSubRole;
  }
}

function removeApprover(approverId) {
  currentApprovers = currentApprovers.filter((a) => a.approver !== approverId);
  renderCurrentApprovers();
  populateNewApproversDropdown();
}

function addNewApprover() {
  const newApproverId = document.getElementById("newApproversDropdown").value;
  const newSubRole = document.getElementById("newApproverSubRole").value;

  if (!newApproverId || !newSubRole) {
    alert("Please select an approver and enter a sub role.");
    return;
  }

  const newApprover = {
    approver: newApproverId,
    username: document
      .getElementById("newApproversDropdown")
      .selectedOptions[0].text.split(" (")[0],
    subRole: newSubRole,
  };

  currentApprovers.push(newApprover);
  renderCurrentApprovers();
  populateNewApproversDropdown();
  document.getElementById("newApproversDropdown").value = "";
  document.getElementById("newApproverSubRole").value = "";
}

async function populateNewApproversDropdown() {
  const allApprovers = await fetchApprovers();
  const availableApprovers = allApprovers.filter(
    (approver) => !currentApprovers.some((a) => a.approver === approver._id)
  );

  const dropdown = document.getElementById("newApproversDropdown");
  dropdown.innerHTML = `
    <option value="">Select an approver</option>
    ${availableApprovers
      .map(
        (approver) => `
      <option value="${approver._id}">${approver.username}</option>
    `
      )
      .join("")}
  `;
}

async function editDocument(docId) {
  try {
    const response = await fetch(`/getProjectProposal/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editTitle").value = doc.title;
    document.getElementById("editName").value = doc.name;
    document.getElementById("editGroupName").value = doc.groupName || "";
    document.getElementById("editProjectName").value = doc.projectName || "";

    // Clear and repopulate content
    const contentList = document.getElementById("contentList");
    contentList.innerHTML = "";
    doc.content.forEach((item) => addContentField(item));

    // Populate current approvers
    currentApprovers = doc.approvers;
    renderCurrentApprovers();

    // Populate new approvers dropdown
    await populateNewApproversDropdown();
    document.getElementById("editModal").style.display = "block";
  } catch (err) {
    console.error("Error fetching document details:", err);
    showMessage("Error loading document details", true);
  }
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("editForm").reset();
  document.getElementById("contentList").innerHTML = "";
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  // Add basic fields
  formData.append("title", document.getElementById("editTitle").value);
  formData.append("name", document.getElementById("editName").value);
  formData.append("groupName", document.getElementById("editGroupName").value);
  formData.append(
    "projectName",
    document.getElementById("editProjectName").value
  );

  // Get all content items
  const content = [];
  const contentItems = document.querySelectorAll(".content-item");
  contentItems.forEach((item) => {
    const inputs = item.querySelectorAll("input, textarea");
    if (inputs.length >= 2) {
      content.push({
        name: inputs[0].value,
        text: inputs[1].value,
      });
    }
  });
  formData.append("content", JSON.stringify(content));

  // Add approvers
  formData.append("approvers", JSON.stringify(currentApprovers));

  // Add file
  const fileInput = document.getElementById("editFile");
  if (fileInput.files.length > 0) {
    formData.append("file", fileInput.files[0]);
  }

  try {
    const response = await fetch(`/updateProjectProposal/${docId}`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (response.ok) {
      showMessage("Document updated successfully");
      closeEditModal();
      fetchProjectProposals();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  }
}

function suspendDocument(docId) {
  document.getElementById("suspendModal").style.display = "block";
  document.getElementById("suspendForm").dataset.docId = docId;
}

function closeSuspendModal() {
  document.getElementById("suspendModal").style.display = "none";
  document.getElementById("suspendForm").reset();
}

async function handleSuspendSubmit(event) {
  event.preventDefault();
  const docId = event.target.dataset.docId;
  const suspendReason = document.getElementById("suspendReason").value;

  try {
    const response = await fetch(`/suspendProjectProposal/${docId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ suspendReason }),
    });
    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      closeSuspendModal();
      fetchProjectProposals();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error suspending document:", err);
    showMessage("Error suspending document", true);
  }
}

async function openDocument(docId) {
  try {
    const response = await fetch(`/openProjectProposal/${docId}`, {
      method: "POST",
    });
    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchProjectProposals();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error reopening document:", err);
    showMessage("Error reopening document", true);
  }
}

function editDeclaration(docId) {
  const doc = projectProposals.find((d) => d._id === docId);
  if (!doc) return;

  const modalHTML = `
    <div id="declarationModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-color); padding: 20px; width: 90%; max-width: 500px; border-radius: 8px;">
        <span onclick="closeDeclarationModal()" style="position: absolute; right: 10px; top: 10px; cursor: pointer; font-size: 24px;">&times;</span>
        <h2>Declaration</h2>
        <textarea id="declarationInput" style="width: 100%; height: 150px; padding: 10px; font-size: 16px;">${
          doc.declaration || ""
        }</textarea>
        <button onclick="saveDeclaration('${docId}')" class="approve-btn" style="margin-top: 10px;">Save Declaration</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  document.getElementById("declarationModal").style.display = "block";
}

function closeDeclarationModal() {
  const modal = document.getElementById("declarationModal");
  if (modal) {
    modal.remove();
  }
}

async function saveDeclaration(docId) {
  const declaration = document.getElementById("declarationInput").value;
  try {
    const response = await fetch(`/updateProjectProposalDeclaration/${docId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ declaration }),
    });
    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      closeDeclarationModal();
      fetchProjectProposals();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Error updating declaration", true);
  }
}

function showFullView(docId) {
  try {
    const doc = projectProposals.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");
    const submissionDate = doc.submissionDate || "Không có";

    fullViewContent.innerHTML = `
      <!-- Basic Information Section -->
      <div class="full-view-section">
        <h3>Thông tin cơ bản</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tên:</span>
            <span class="detail-value">${doc.name}</span>
          </div>                
          <div class="detail-item">
            <span class="detail-label">Nhóm:</span>
            <span class="detail-value">${doc.groupName || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Dự án:</span>
            <span class="detail-value">${doc.projectName || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ngày nộp:</span>
            <span class="detail-value">${submissionDate}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Kê khai:</span>
            <span class="detail-value">${doc.declaration || "Không có"}</span>
          </div>
        </div>
      </div>

      <!-- Content Section -->
      <div class="full-view-section">
        <h3>Nội dung</h3>
        ${renderContent(doc.content)}
      </div>

      <!-- File Attachment Section -->
      <div class="full-view-section">
        <h3>Tệp kèm theo</h3>
        ${
          doc.fileMetadata
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "Không có"
        }
      </div>

      <!-- Status Section -->
      <div class="full-view-section">
        <h3>Thông tin tình trạng</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tình trạng:</span>
            <span class="detail-value">${renderStatus(doc.status)}</span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <h4>Tình trạng phê duyệt:</h4>
          <div class="approval-status">
            ${doc.approvers
              .map((approver) => {
                const hasApproved = doc.approvedBy.find(
                  (a) => a.username === approver.username
                );
                return `
                <div class="approver-item">
                  <span class="status-icon ${
                    hasApproved ? "status-approved" : "status-pending"
                  }"></span>
                  <div>
                    <div>${approver.username} (${approver.subRole})</div>
                    ${
                      hasApproved
                        ? `<div class="approval-date">Duyệt vào: ${hasApproved.approvalDate}</div>`
                        : '<div class="approval-date">Chờ duyệt</div>'
                    }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;

    document.getElementById("fullViewModal").style.display = "block";
  } catch (err) {
    console.error("Error showing full view:", err);
    showMessage("Error loading full document details", true);
  }
}

function closeFullViewModal() {
  document.getElementById("fullViewModal").style.display = "none";
}

async function initializePage() {
  await fetchCurrentUser();
  const table = document.querySelector("table");
  table.parentElement.insertBefore(createToggleSwitch(), table);
  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    showOnlyPendingApprovals = e.target.checked;
    currentPage = 1;
    fetchProjectProposals();
  });

  // Add pagination toggle event listener
  document
    .getElementById("paginationToggle")
    .addEventListener("change", togglePagination);

  fetchProjectProposals();
}

document.addEventListener("DOMContentLoaded", () => {
  addEditModal();
  initializePage();
});
