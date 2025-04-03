// views\documentPages\documentSummaryPayment\documentSummaryPayment.js
let currentUser = null;
let paymentDocuments = null;
let showOnlyPendingApprovals = false;
let currentApprovers = [];
let currentPage = 1;
const itemsPerPage = 10; // Adjust this value based on your preference
let totalPages = 1;
let currentGroupFilter = "";

// Add the toggle switch creation function
function createToggleSwitch() {
  const toggleContainer = document.createElement("div");
  toggleContainer.style.marginBottom = "1rem";
  toggleContainer.innerHTML = `
    <label class="toggle-switch" style="display: flex; align-items: center; cursor: pointer;">
      <input type="checkbox" id="pendingToggle" style="margin-right: 0.5rem;">
      <span>Chỉ hiện phiếu tôi cần phê duyệt/Show only documents pending my approval</span>
    </label>
  `;
  return toggleContainer;
}

// Add the current user fetch function
async function fetchCurrentUser() {
  try {
    const response = await fetch("/getCurrentUser");
    currentUser = await response.json();
  } catch (error) {
    console.error("Error fetching current user:", error);
  }
}

async function fetchGroups() {
  try {
    const response = await fetch("/getGroupDocument");
    return await response.json();
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

// Add this function to populate the group filter dropdown
async function populateGroupFilter() {
  const groups = await fetchGroups();
  const groupFilter = document.getElementById("groupFilter");

  // Clear existing options except the first one
  while (groupFilter.options.length > 1) {
    groupFilter.remove(1);
  }

  // Add group options
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = group.name;
    groupFilter.appendChild(option);
  });
}

// Add this function to filter documents by group
function filterByGroup() {
  currentGroupFilter = document.getElementById("groupFilter").value;
  currentPage = 1; // Reset to first page when filter changes
  fetchPaymentDocuments();
}

// Document filter function
function filterDocumentsForCurrentUser(documents) {
  if (!currentUser && !showOnlyPendingApprovals && !currentGroupFilter) {
    return documents;
  }

  return documents.filter((doc) => {
    // Apply group filter if selected
    if (currentGroupFilter && doc.groupName !== currentGroupFilter) {
      return false;
    }

    // Apply pending approvals filter if enabled
    if (showOnlyPendingApprovals && currentUser) {
      const isRequiredApprover = doc.approvers.some(
        (approver) => approver.username === currentUser.username
      );
      const hasNotApprovedYet = !doc.approvedBy.some(
        (approved) => approved.username === currentUser.username
      );
      return isRequiredApprover && hasNotApprovedYet;
    }

    return true;
  });
}

function showMessage(message, isError = false) {
  const messageContainer = document.getElementById("messageContainer");
  messageContainer.textContent = message;
  messageContainer.style.display = "block";
  messageContainer.className = `message ${isError ? "error" : "success"}`;
  setTimeout(() => {
    messageContainer.style.display = "none";
  }, 5000);
}

function renderPurchasingDocuments(purchDocs) {
  if (!purchDocs || purchDocs.length === 0) return "";

  return `
    <div class="documents-container">
      ${purchDocs
        .map((purchDoc) => {
          const products = purchDoc.products
            .map(
              (product) => `
          <li>
            <strong>${product.productName}</strong><br>
            Đơn giá/Cost Per Unit: ${product.costPerUnit.toLocaleString()}<br>
            Số lượng/Amount: ${product.amount.toLocaleString()}<br>
            Thuế/Vat (%): ${(product.vat ?? 0).toLocaleString()}<br>
            Thành tiền/Total Cost: ${product.totalCost.toLocaleString()}<br>
            Thành tiền sau thuế/Total Cost After Vat: ${(
              product.totalCostAfterVat ?? product.totalCost
            ).toLocaleString()}<br>
            Ghi chú/Notes: ${product.note || "None"}
          </li>
        `
            )
            .join("");

          const fileMetadata = purchDoc.fileMetadata
            ? `<p><strong>Tệp đính kèm phiếu mua hàng/File attaches to purchasing document:</strong> 
              <a href="${purchDoc.fileMetadata.link}" target="_blank">${purchDoc.fileMetadata.name}</a></p>`
            : "";

          return `
          <div class="purchasing-doc">
            <p><strong>Trạm/Center:</strong> ${
              purchDoc.costCenter ? purchDoc.costCenter : ""
            }</p>
            <p><strong>Tổng chi phí/Total Cost:</strong> ${purchDoc.grandTotalCost.toLocaleString()}</p>
            <p><strong>Sản phẩm/Products:</strong></p>
            <ul>${products}</ul>
            ${fileMetadata}
          </div>`;
        })
        .join("")}
    </div>`;
}

function renderProposals(purchDocs) {
  const allProposals = purchDocs
    .flatMap((purchDoc) => purchDoc.appendedProposals)
    .filter((proposal) => proposal);

  if (allProposals.length === 0) return "";

  return `
    <div class="proposals-container">
      ${allProposals
        .map(
          (proposal) => `
        <div class="proposal-card">
          <p><strong>Công việc/Task:</strong> ${proposal.task}</p>
          <p><strong>Trạm/Center:</strong> ${proposal.costCenter}</p>
          <p><strong>Mô tả/Description:</strong> ${
            proposal.detailsDescription
          }</p>
          ${
            proposal.fileMetadata
              ? `<p><strong>Tệp đính kèm/File:</strong> 
                <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></p>`
              : ""
          }
        </div>
      `
        )
        .join("")}
    </div>`;
}

function renderStatus(status) {
  switch (status) {
    case "Approved":
      return `<span class="status approved">Approved</span>`;
    case "Suspended":
      return `<span class="status suspended">Suspended</span>`;
    default:
      return `<span class="status pending">Pending</span>`;
  }
}

// Function to toggle select all checkboxes
function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById("selectAll");
  const checkboxes = document.querySelectorAll(
    'input[type="checkbox"][name="documentCheckbox"]'
  );
  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

// Function to get selected document IDs
function getSelectedDocumentIds() {
  const checkboxes = document.querySelectorAll(
    'input[type="checkbox"][name="documentCheckbox"]:checked'
  );
  return Array.from(checkboxes).map((checkbox) => checkbox.value);
}

// Function to reset the "Select All" checkbox
function resetSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("selectAll");
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
  }
}

async function fetchPaymentDocuments() {
  try {
    const response = await fetch("/getPaymentDocumentForSeparatedView");
    const data = await response.json();
    paymentDocuments = data.paymentDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(paymentDocuments);

    // Reset the "Select All" checkbox
    resetSelectAllCheckbox();

    // Calculate total pages
    totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

    // Make sure current page is in valid range
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }

    // Calculate slice indexes for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Get documents for current page only
    const pageDocuments = filteredDocuments.slice(startIndex, endIndex);

    const tableBody = document.getElementById("paymentDocumentsTable");
    tableBody.innerHTML = "";

    pageDocuments.forEach((doc) => {
      // Create merged approval status display
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
                    ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                    : '<div class="approval-date">Pending</div>'
                }
              </div>
            </div>
          `;
        })
        .join("");

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="checkbox" name="documentCheckbox" value="${
          doc._id
        }"></td>
        <td>${doc.tag || "-"}</td>
        <td>${doc.content || "-"} ${
        doc.suspendReason
          ? `(Lý do từ chối tài liệu: ${doc.suspendReason})`
          : ""
      }${doc.declaration ? `(Kê khai: ${doc.declaration})` : ""}</td>
        <td>${doc.paymentMethod || "-"}</td>
        <td>${doc.totalPayment?.toLocaleString() || "-"}</td>
        <td>${doc.paymentDeadline || "-"}</td>
        <td>${renderStatus(doc.status)}</td>
        <td class="approval-status">${approvalStatus}</td>
        <td>
          <button class="approve-btn" onclick="showFullView('${
            doc._id
          }')" style="margin-right: 5px;">
            Xem đầy đủ/Full View
          </button>
          <form action="/exportDocumentToDocx/${
            doc._id
          }" method="GET" style="display:inline;">
              <button class="approve-btn">Xuất ra DOCX/Export to DOCX</button>
          </form>
          ${
            doc.approvedBy.length === 0
              ? `
            <button class="approve-btn" onclick="editDocument('${doc._id}')" style="margin-right: 5px;">Sửa/Edit</button>
            <button class="approve-btn" onclick="deleteDocument('${doc._id}')">Xóa/Delete</button>
          `
              : ""
          }
          ${
            doc.status === "Pending"
              ? `
            <button class="approve-btn" onclick="approveDocument('${doc._id}')" style="margin-right: 5px;">
              Phê duyệt/Approve
            </button>
          `
              : ""
          }
          ${
            doc.status === "Approved"
              ? `
                <button class="approve-btn" onclick="editDeclaration('${doc._id}')" style="margin-right: 5px;">
                  Kê khai/Declaration
                </button>
                <button class="approve-btn" onclick="suspendDocument('${doc._id}')">
                  Từ chối/Suspend
                </button>
              `
              : doc.status === "Suspended"
              ? `
                <button class="approve-btn" onclick="openDocument('${doc._id}')">
                  Mở/Open
                </button>
              `
              : `
                <button class="approve-btn" onclick="suspendDocument('${doc._id}')">
                  Từ chối/Suspend
                </button>
              `
          }
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Render pagination controls
    renderPagination();

    // Update summary section
    document.getElementById("approvedSum").textContent =
      data.approvedSum.toLocaleString();
    document.getElementById("paidSum").textContent =
      data.paidSum.toLocaleString();
    document.getElementById("unapprovedSum").textContent =
      data.unapprovedSum.toLocaleString();
    document.getElementById("approvedDocument").textContent =
      data.approvedDocument.toLocaleString();
    document.getElementById("unapprovedDocument").textContent =
      data.unapprovedDocument.toLocaleString();
  } catch (err) {
    console.error("Error fetching payment documents:", err);
    showMessage("Error fetching payment documents", true);
  }
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
  let paginationHTML = "";

  if (totalPages > 1) {
    paginationHTML += `
      <div class="pagination-controls">
        <button onclick="changePage(1)" ${currentPage === 1 ? "disabled" : ""}>
          &laquo; First
        </button>
        <button onclick="changePage(${currentPage - 1})" ${
      currentPage === 1 ? "disabled" : ""
    }>
          &lsaquo; Prev
        </button>
        <span class="page-info">
          Trang/Page ${currentPage} / ${totalPages}
        </span>
        <button onclick="changePage(${currentPage + 1})" ${
      currentPage === totalPages ? "disabled" : ""
    }>
          Next &rsaquo;
        </button>
        <button onclick="changePage(${totalPages})" ${
      currentPage === totalPages ? "disabled" : ""
    }>
          Last &raquo;
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
    fetchPaymentDocuments();
    // Scroll to top of table for better user experience
    document.querySelector("table").scrollIntoView({ behavior: "smooth" });
  }
}

// Add CSS for pagination to the existing <style> section
document.addEventListener("DOMContentLoaded", function () {
  const styleTag = document.querySelector("style");
  styleTag.innerHTML += `
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
  `;
});

async function approveDocument(documentId) {
  try {
    const response = await fetch(`/approveDocument/${documentId}`, {
      method: "POST",
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchPaymentDocuments();
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
      fetchPaymentDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error approving document:", err);
    showMessage("Error approving document", true);
  }
}

async function populateCostCenterDropdown() {
  try {
    // Fetch the current user
    const userResponse = await fetch("/getCurrentUser");
    const userData = await userResponse.json();
    const currentUser = userData.username;

    // Fetch cost centers
    const costCenterResponse = await fetch("/costCenters");
    const costCenters = await costCenterResponse.json();

    // Get the cost center dropdown in the edit modal
    const costCenterDropdown = document.getElementById("editCostCenter");

    // Clear existing options
    costCenterDropdown.innerHTML =
      '<option value="">Chọn một trạm/Select a center</option>';

    // Populate the dropdown with allowed cost centers
    costCenters.forEach((center) => {
      if (
        center.allowedUsers.length === 0 ||
        center.allowedUsers.includes(currentUser)
      ) {
        const option = document.createElement("option");
        option.value = center.name;
        option.textContent = center.name;
        costCenterDropdown.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error fetching cost centers:", error);
  }
}

// Add edit modal HTML at the end of the table
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
          Chỉnh sửa phiếu thanh toán/Edit Payment Document
        </h2>
        
        <form id="editForm" onsubmit="handleEditSubmit(event)">
          <input type="hidden" id="editDocId">
          
          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editName" style="display: block; margin-bottom: 0.5em;">Tên/Name:</label>
            <input type="text" id="editName" required style="
              width: 100%;
              padding: clamp(6px, 1vw, 12px);
              font-size: inherit;
              border: 1px solid var(--border-color);
              border-radius: clamp(3px, 0.5vw, 6px);
            ">
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editContent" style="display: block; margin-bottom: 0.5em;">Nội dung/Content:</label>
            <textarea id="editContent" required style="
              width: 100%;
              padding: clamp(6px, 1vw, 12px);
              min-height: clamp(80px, 15vh, 150px);
              font-size: inherit;
              border: 1px solid var(--border-color);
              border-radius: clamp(3px, 0.5vw, 6px);
            "></textarea>
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
              <label for="editCostCenter" style="display: block; margin-bottom: 0.5em;">Trạm/Cost Center:</label>
              <select id="editCostCenter" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; border: 1px solid var(--border-color); border-radius: clamp(3px, 0.5vw, 6px);">
                  <option value="">Chọn một trạm/Select a center</option>
                  <!-- Options will be populated dynamically -->
              </select>
          </div>      

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editPaymentMethod" style="display: block; margin-bottom: 0.5em;">Hình thức thanh toán/Payment Method:</label>
            <input type="text" id="editPaymentMethod" required style="
              width: 100%;
              padding: clamp(6px, 1vw, 12px);
              font-size: inherit;
              border: 1px solid var(--border-color);
              border-radius: clamp(3px, 0.5vw, 6px);
            ">
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editTotalPayment" style="display: block; margin-bottom: 0.5em;">Tổng thanh toán/Total Payment:</label>
            <input type="number" id="editTotalPayment" required style="
              width: 100%;
              padding: clamp(6px, 1vw, 12px);
              font-size: inherit;
              border: 1px solid var(--border-color);
              border-radius: clamp(3px, 0.5vw, 6px);
            ">
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editDeadline" style="display: block; margin-bottom: 0.5em;">Hạn thanh toán/Payment Deadline (DD-MM-YYYY):</label>
            <input type="text" 
                  id="editDeadline" 
                  required 
                  placeholder="DD/MM/YYYY"
                  pattern="(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-[0-9]{4}"
                  style="
                    width: 100%;
                    padding: clamp(6px, 1vw, 12px);
                    font-size: inherit;
                    border: 1px solid var(--border-color);
                    border-radius: clamp(3px, 0.5vw, 6px);
                  ">
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editFile" style="display: block; margin-bottom: 0.5em;">Thay tệp tin mới/Update File:</label>
            <input type="file" id="editFile" style="
              width: 100%;
              padding: clamp(6px, 1vw, 12px);
              font-size: inherit;
            ">
          </div>

          <!-- Current Approvers Section -->
          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label style="display: block; margin-bottom: 0.5em;">Người phê duyệt hiện tại/Current Approvers:</label>
            <div id="currentApproversList"></div>
          </div>

          <!-- Add New Approvers Section -->
          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label style="display: block; margin-bottom: 0.5em;">Thêm người phê duyệt/Add Approvers:</label>
            <select id="newApproversDropdown" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit;">
              <option value="">Chọn người phê duyệt/Select an approver</option>
              <!-- Options will be populated dynamically -->
            </select>
            <input type="text" id="newApproverSubRole" placeholder="Vai trò/Sub Role" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; margin-top: 10px;">
            <button type="button" class="approve-btn" onclick="addNewApprover()" style="margin-top: 10px;">
              Thêm/Add
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
            ">Lưu thay đổi/Save Changes</button>
            
            <button type="button" class="approve-btn" onclick="closeEditModal()" style="
              background: #666;
              padding: clamp(8px, 1vw, 16px) clamp(16px, 2vw, 24px);
              font-size: inherit;
            ">Hủy/Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
}

// Add edit button to each row in the fetchPaymentDocuments function
function addEditButton(doc) {
  if (!doc.approved) {
    return `<button class="approve-btn" onclick="editDocument('${doc._id}')">Chỉnh sửa/Edit</button>`;
  }
  return "";
}

// Function to fetch all approvers
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

// Function to render current approvers
function renderCurrentApprovers() {
  const currentApproversList = document.getElementById("currentApproversList");
  currentApproversList.innerHTML = currentApprovers
    .map(
      (approver) => `
        <div class="approver-item" data-id="${approver.approver}">
          <span>${approver.username} (${approver.subRole})</span>
          <input type="text" value="${approver.subRole}" onchange="updateApproverSubRole('${approver.approver}', this.value)" style="width: 100px; padding: 4px;">
          <button type="button" class="approve-btn" onclick="removeApprover('${approver.approver}')" style="background: #dc3545; padding: 4px 8px;">Xóa/Remove</button>
        </div>
      `
    )
    .join("");
}

// Function to update an approver's subRole
function updateApproverSubRole(approverId, newSubRole) {
  const approver = currentApprovers.find((a) => a.approver === approverId);
  if (approver) {
    approver.subRole = newSubRole;
  }
}

// Function to remove an approver
function removeApprover(approverId) {
  currentApprovers = currentApprovers.filter((a) => a.approver !== approverId);
  renderCurrentApprovers();
  populateNewApproversDropdown(); // Refresh the dropdown
}

// Function to add a new approver
function addNewApprover() {
  const newApproverId = document.getElementById("newApproversDropdown").value;
  const newSubRole = document.getElementById("newApproverSubRole").value;

  if (!newApproverId || !newSubRole) {
    alert(
      "Vui lòng chọn người phê duyệt và nhập vai trò phụ/Please select an approver and enter a sub role."
    );
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
  populateNewApproversDropdown(); // Refresh the dropdown

  // Clear the input fields
  document.getElementById("newApproversDropdown").value = "";
  document.getElementById("newApproverSubRole").value = "";
}

// Function to populate the new approvers dropdown (excluding current approvers)
async function populateNewApproversDropdown() {
  const allApprovers = await fetchApprovers();
  const availableApprovers = allApprovers.filter(
    (approver) => !currentApprovers.some((a) => a.approver === approver._id)
  );

  const dropdown = document.getElementById("newApproversDropdown");
  dropdown.innerHTML = `
    <option value="">Chọn người phê duyệt/Select an approver</option>
    ${availableApprovers
      .map(
        (approver) => `
      <option value="${approver._id}">${approver.username}</option>
    `
      )
      .join("")}
  `;
}

// Edit document function
async function editDocument(docId) {
  try {
    const response = await fetch(`/getPaymentDocument/${docId}`);
    const doc = await response.json();
    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name;
    document.getElementById("editContent").value = doc.content;
    // Populate the cost center dropdown
    await populateCostCenterDropdown();
    document.getElementById("editCostCenter").value = doc.costCenter;
    document.getElementById("editPaymentMethod").value = doc.paymentMethod;
    document.getElementById("editTotalPayment").value = doc.totalPayment;
    document.getElementById("editDeadline").value = doc.paymentDeadline;
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

// Close edit modal
function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("editForm").reset();
}

// Handle edit form submission
async function handleEditSubmit(event) {
  event.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();
  formData.append("name", document.getElementById("editName").value);
  formData.append("content", document.getElementById("editContent").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value
  );
  formData.append(
    "paymentMethod",
    document.getElementById("editPaymentMethod").value
  );
  formData.append(
    "totalPayment",
    document.getElementById("editTotalPayment").value
  ); // Changed from amountOfMoney
  formData.append(
    "paymentDeadline",
    document.getElementById("editDeadline").value
  );
  formData.append("approvers", JSON.stringify(currentApprovers));

  const fileInput = document.getElementById("editFile");
  if (fileInput.files.length > 0) {
    formData.append("file", fileInput.files[0]);
  }

  try {
    const response = await fetch(`/updatePaymentDocument/${docId}`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (response.ok) {
      showMessage("Document updated successfully");
      closeEditModal();
      fetchPaymentDocuments();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  }
}

async function showFullView(docId) {
  try {
    const doc = paymentDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");

    // Format date strings
    const submissionDate = doc.submissionDate || "Not specified";
    const paymentDeadline = doc.paymentDeadline || "Not specified";

    fullViewContent.innerHTML = `
      <!-- Basic Information Section -->
      <div class="full-view-section">
        <h3>Thông tin cơ bản/Basic Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Mã/Tag:</span>
            <span class="detail-value">${doc.tag || "Not specified"}</span>
            <span class="detail-label">Tên/Name:</span>
            <span class="detail-value">${doc.name || "Not specified"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tên nhóm/Group Name:</span>
            <span class="detail-value">${
              doc.groupName || "Not specified"
            }</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ngày nộp/Submission Date:</span>
            <span class="detail-value">${submissionDate}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Hạn trả/Payment Deadline:</span>
            <span class="detail-value">${paymentDeadline}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Kê khai/Declaration:</span>
            <span class="detail-value">${
              doc.declaration || "Not specified"
            }</span>
          </div>
        </div>
      </div>

      <!-- Content Section -->
      <div class="full-view-section">
        <h3>Nội dung/Content</h3>
        <p style="white-space: pre-wrap;">${
          doc.content || "No content provided"
        }</p>
      </div>

      <div class="full-view-section">
        <h3>Trạm/Center</h3>
        <p style="white-space: pre-wrap;">${
          doc.costCenter || "No content provided"
        }</p>
      </div>

      <!-- Payment Information Section -->
      <div class="full-view-section">
        <h3>Thông tin thanh toán/Payment Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Phương thức/Payment Method:</span>
            <span class="detail-value">${
              doc.paymentMethod || "Not specified"
            }</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tổng thanh toán/Total Payment:</span>
            <span class="detail-value">${
              doc.totalPayment?.toLocaleString() || "Not specified"
            }</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tạm ứng/Advance Payment:</span>
            <span class="detail-value">${
              doc.advancePayment?.toLocaleString() || "Not specified"
            }</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Bù trừ/Offset:</span>
            <span class="detail-value">${
              doc.totalPayment && doc.advancePayment
                ? (doc.totalPayment - doc.advancePayment).toLocaleString()
                : "Not calculated"
            }</span>
          </div>
        </div>
      </div>

      <!-- File Attachment Section -->
      <div class="full-view-section">
        <h3>Tệp tin kèm theo/Attached File</h3>
        ${
          doc.fileMetadata
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "No file attached"
        }
      </div>

      <!-- Purchasing Documents Section -->
      <div class="full-view-section">
        <h3>Phiếu mua hàng kèm theo/Appended Purchasing Documents</h3>
        ${
          doc.appendedPurchasingDocuments?.length
            ? renderPurchasingDocuments(doc.appendedPurchasingDocuments)
            : "No purchasing documents attached"
        }
      </div>

      <!-- Proposals Section -->
      <div class="full-view-section">
        <h3>Phiếu đề xuất kèm theo/Appended Proposal Documents</h3>
        ${
          doc.appendedPurchasingDocuments?.length
            ? renderProposals(doc.appendedPurchasingDocuments)
            : "No proposal documents attached"
        }
      </div>

      <!-- Status Section -->
      <div class="full-view-section">
        <h3>Trạng thái/Status Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tình trạng/Status:</span>
            <span class="detail-value ${renderStatus(doc.status)}</span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <h4>Trạng thái phê duyệt/Approval Status:</h4>
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
                        ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                        : '<div class="approval-date">Pending</div>'
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

// Function to show the suspend modal
function suspendDocument(docId) {
  document.getElementById("suspendModal").style.display = "block";
  document.getElementById("suspendForm").dataset.docId = docId;
}

// Function to close the suspend modal
function closeSuspendModal() {
  document.getElementById("suspendModal").style.display = "none";
  document.getElementById("suspendForm").reset();
}

// Function to handle suspend form submission
async function handleSuspendSubmit(event) {
  event.preventDefault();
  const docId = event.target.dataset.docId;
  const suspendReason = document.getElementById("suspendReason").value;

  try {
    const response = await fetch(`/suspendDocument/${docId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ suspendReason }),
    });

    const message = await response.text(); // Get the response message

    if (response.ok) {
      showMessage(message); // Show success message
      closeSuspendModal();
      fetchPaymentDocuments();
    } else {
      showMessage(message, true); // Show error message
    }
  } catch (err) {
    console.error("Error suspending document:", err);
    showMessage("Lỗi khi tạm dừng tài liệu/Error suspending document", true);
  }
}

// Function to reopen the document
async function openDocument(docId) {
  try {
    const response = await fetch(`/openDocument/${docId}`, {
      method: "POST",
    });

    const message = await response.text(); // Get the response message

    if (response.ok) {
      showMessage(message); // Show success message
      fetchPaymentDocuments();
    } else {
      showMessage(message, true); // Show error message
    }
  } catch (err) {
    console.error("Error reopening document:", err);
    showMessage("Lỗi khi mở lại tài liệu/Error reopening document", true);
  }
}

function editDeclaration(docId) {
  const doc = paymentDocuments.find((d) => d._id === docId);
  if (!doc) return;

  // Create a modal for editing the declaration
  const modalHTML = `
    <div id="declarationModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-color); padding: 20px; width: 90%; max-width: 500px; border-radius: 8px;">
        <span onclick="closeDeclarationModal()" style="position: absolute; right: 10px; top: 10px; cursor: pointer; font-size: 24px;">&times;</span>
        <h2>Kê Khai/Declaration</h2>
        <textarea id="declarationInput" style="width: 100%; height: 150px; padding: 10px; font-size: 16px;">${
          doc.declaration || ""
        }</textarea>
        <button onclick="saveDeclaration('${docId}')" class="approve-btn" style="margin-top: 10px;">Lưu kê khai/Save Declaration</button>
      </div>
    </div>
  `;

  // Append the modal to the body
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Show the modal
  document.getElementById("declarationModal").style.display = "block";
}

function closeDeclarationModal() {
  const modal = document.getElementById("declarationModal");
  if (modal) {
    modal.remove(); // Remove the modal from the DOM
  }
}

async function saveDeclaration(docId) {
  const declaration = document.getElementById("declarationInput").value;

  try {
    const response = await fetch(`/updatePaymentDocumentDeclaration/${docId}`, {
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
      fetchPaymentDocuments(); // Refresh the document list
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Error updating declaration", true);
  }
}

// Function to open the mass declaration modal
function openMassDeclarationModal() {
  const selectedIds = getSelectedDocumentIds();
  if (selectedIds.length === 0) {
    showMessage(
      "Vui lòng chọn ít nhất một tài liệu để cập nhật kê khai/Please select at least one document to update declaration.",
      true
    );
    return;
  }
  document.getElementById("massDeclarationModal").style.display = "block";
}

// Function to close the mass declaration modal
function closeMassDeclarationModal() {
  document.getElementById("massDeclarationModal").style.display = "none";
  document.getElementById("massDeclarationForm").reset();
}

// Function to handle mass declaration form submission
async function handleMassDeclarationSubmit(event) {
  event.preventDefault();
  const selectedIds = getSelectedDocumentIds();
  const declaration = document.getElementById("massDeclarationInput").value;

  if (selectedIds.length === 0) {
    showMessage(
      "Vui lòng chọn ít nhất một tài liệu để cập nhật kê khai/Please select at least one document to update declaration.",
      true
    );
    return;
  }

  try {
    const response = await fetch("/massUpdatePaymentDocumentDeclaration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentIds: selectedIds, declaration }),
    });

    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      closeMassDeclarationModal();
      fetchPaymentDocuments(); // Refresh the document list
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Lỗi khi cập nhật kê khai/Error updating declaration", true);
  }
}

// Update window click event to close modals
window.onclick = function (event) {
  const fullViewModal = document.getElementById("fullViewModal");
  const editModal = document.getElementById("editModal");
  if (event.target === fullViewModal) {
    closeFullViewModal();
  }
  if (event.target === editModal) {
    closeEditModal();
  }
};

async function initializePage() {
  await fetchCurrentUser();

  // Add toggle switch before the table
  const table = document.querySelector("table");
  table.parentElement.insertBefore(createToggleSwitch(), table);

  // Add group filter
  await populateGroupFilter();

  // Add toggle event listener
  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    showOnlyPendingApprovals = e.target.checked;
    currentPage = 1; // Reset to first page when filter changes
    fetchPaymentDocuments();
  });

  // Initial fetch of documents
  fetchPaymentDocuments();
}

// Update the DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", () => {
  addEditModal();
  initializePage();
});
