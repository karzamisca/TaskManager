// views\documentPages\documentSummaryDelivery\documentSummaryDelivery.js
let currentUser = null;
let deliveryDocuments = null;
let showOnlyPendingApprovals = false;
let currentApprovers = [];
let currentPage = 1;
const itemsPerPage = 10; // Adjust this value based on your preference
let totalPages = 1;

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
  messageContainer.style.display = "block";
  messageContainer.className = `message ${isError ? "error" : "success"}`;
  setTimeout(() => {
    messageContainer.style.display = "none";
  }, 5000);
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

function renderProducts(products) {
  if (!products || products.length === 0) return "-";

  return `
    <table class="products-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Sản phẩm/Product</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Đơn giá/Cost Per Unit</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Số lượng/Amount</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thuế/Vat (%)</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thành tiền/Total Cost</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thành tiền sau thuế/Total Cost After Vat</th>
          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Ghi chú/Notes</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (product) => `
          <tr>
            <td style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;"><strong>${
              product.productName
            }</strong></td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${product.costPerUnit.toLocaleString()}</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${product.amount.toLocaleString()}</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${
              product.vat.toLocaleString() || ""
            }</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${product.totalCost.toLocaleString()}</td>
            <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">${
              product.totalCostAfterVat.toLocaleString() || ""
            }</td>
            <td style="text-align: left; padding: 8px; border-bottom: 1px solid #eee;">${
              product.note || ""
            }</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderProposals(proposals) {
  if (!proposals || proposals.length === 0) return "-";

  return `
    <div class="products-container">
      ${proposals
        .map(
          (proposal) => `
            <div class="product-item">
              <strong>Công việc/Task:</strong> ${proposal.task}<br>
              <strong>Trạm/Center:</strong> ${proposal.costCenter}<br>
              <strong>Mô tả/Description:</strong> ${
                proposal.detailsDescription
              }<br>
              ${
                proposal.fileMetadata
                  ? `<strong>Tệp đính kèm/File:</strong> 
                <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a>`
                  : ""
              }
            </div>
          `
        )
        .join("")}
        </div>
      `;
}

// Update the fetchDeliveryDocuments function to use the new endpoint
async function fetchDeliveryDocuments() {
  try {
    const response = await fetch("/getDeliveryDocumentForSeparatedView");
    const data = await response.json();
    deliveryDocuments = data.deliveryDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(deliveryDocuments);

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

    const tableBody = document.getElementById("deliveryDocumentsTable");
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
        <td>${doc.name}</td>
        <td>${doc.costCenter}</td>              
        <td>${renderProducts(doc.products)}</td>
        <td>${
          doc.fileMetadata?.link
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "-"
        }</td>
        <td>${doc.grandTotalCost?.toLocaleString() || "-"}</td>
        <td>${renderProposals(doc.appendedProposals)}</td>
        <td>${renderStatus(doc.status)}</td>
        <td class="approval-status">${approvalStatus}</td>
        <td>
          <button class="approve-btn" onclick="showFullView('${
            doc._id
          }')" style="margin-right: 5px;">
            Xem đầy đủ/Full View
          </button
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
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Render pagination controls
    renderPagination();

    // Update summary section
    const approvedSum = filteredDocuments
      .filter((doc) => doc.status === "Approved")
      .reduce((sum, doc) => sum + (doc.grandTotalCost || 0), 0);

    const unapprovedSum = filteredDocuments
      .filter((doc) => doc.status === "Pending")
      .reduce((sum, doc) => sum + (doc.grandTotalCost || 0), 0);

    document.getElementById("approvedSum").textContent =
      approvedSum.toLocaleString();
    document.getElementById("unapprovedSum").textContent =
      unapprovedSum.toLocaleString();
    document.getElementById("approvedDocument").textContent =
      data.approvedDocument.toLocaleString();
    document.getElementById("unapprovedDocument").textContent =
      data.unapprovedDocument.toLocaleString();
  } catch (err) {
    console.error("Error fetching delivery documents:", err);
    showMessage("Error fetching delivery documents", true);
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
    fetchDeliveryDocuments();
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
      fetchDeliveryDocuments();
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
      fetchDeliveryDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error approving document:", err);
    showMessage("Error approving document", true);
  }
}

function addProductField(product = null) {
  const productsList = document.getElementById("productsList");
  const productDiv = document.createElement("div");
  productDiv.className = "product-item";
  productDiv.style.marginBottom = "10px";

  // Create the div first
  productsList.appendChild(productDiv);

  // Create and configure inputs directly instead of using innerHTML
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "10px";
  productDiv.appendChild(container);

  // Product Name input
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Tên sản phẩm/Product Name";
  nameInput.required = true;
  nameInput.style.width = "100%";
  nameInput.style.padding = "8px";
  if (product && product.productName !== undefined) {
    nameInput.value = product.productName;
  }
  container.appendChild(nameInput);

  // Cost Per Unit input
  const costInput = document.createElement("input");
  costInput.type = "number";
  costInput.placeholder = "Đơn giá/Cost Per Unit";
  costInput.required = true;
  costInput.style.width = "100%";
  costInput.style.padding = "8px";
  if (product && product.costPerUnit !== undefined) {
    costInput.value = product.costPerUnit;
  }
  container.appendChild(costInput);

  // Amount input
  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.placeholder = "Số lượng/Amount";
  amountInput.required = true;
  amountInput.style.width = "100%";
  amountInput.style.padding = "8px";
  if (product && product.amount !== undefined) {
    amountInput.value = product.amount;
  }
  container.appendChild(amountInput);

  // VAT input
  const vatInput = document.createElement("input");
  vatInput.type = "number";
  vatInput.placeholder = "Thuế/Vat (%)";
  vatInput.required = true;
  vatInput.style.width = "100%";
  vatInput.style.padding = "8px";
  if (product && product.vat !== undefined) {
    vatInput.value = product.vat;
  }
  container.appendChild(vatInput);

  // Note input
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "Ghi chú/Note";
  noteInput.style.width = "100%";
  noteInput.style.padding = "8px";
  if (product && product.note !== undefined) {
    noteInput.value = product.note;
  }
  container.appendChild(noteInput);

  // Remove button
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "approve-btn";
  removeButton.textContent = "Xóa/Remove";
  removeButton.style.background = "#dc3545";
  removeButton.onclick = function () {
    this.parentElement.parentElement.remove();
  };
  container.appendChild(removeButton);
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

// Function to initialize the modal with document data
async function editDocument(docId) {
  try {
    const response = await fetch(`/getDeliveryDocument/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name;

    await populateCostCenterDropdown();
    document.getElementById("editCostCenter").value = doc.costCenter;

    // Clear and repopulate products
    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";
    doc.products.forEach((product) => addProductField(product));
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
  document.getElementById("productsList").innerHTML = "";
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  // Add basic fields
  formData.append("name", document.getElementById("editName").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value
  );

  // Get all products
  const products = [];
  const productItems = document.querySelectorAll(".product-item");

  productItems.forEach((item) => {
    const productInputs = item.querySelectorAll("input");
    if (productInputs.length >= 4) {
      const costPerUnit = parseFloat(productInputs[1].value) || 0;
      const amount = parseInt(productInputs[2].value) || 0;
      const vat = parseFloat(productInputs[3].value) || 0;

      const product = {
        productName: productInputs[0].value,
        costPerUnit: costPerUnit,
        amount: amount,
        vat: vat,
        totalCost: costPerUnit * amount,
        totalCostAfterVat:
          costPerUnit * amount + costPerUnit * amount * (vat / 100),
        note: productInputs[3].value,
      };
      products.push(product);
    }
  });

  formData.append("products", JSON.stringify(products));

  // Calculate grand total
  const grandTotalCost = products.reduce(
    (sum, product) => sum + product.totalCostAfterVat,
    0
  );
  formData.append("grandTotalCost", grandTotalCost);

  // Add approvers
  formData.append("approvers", JSON.stringify(currentApprovers));

  // Add file
  const fileInput = document.getElementById("editFile");
  if (fileInput.files.length > 0) {
    formData.append("file", fileInput.files[0]);
  }

  try {
    const response = await fetch(`/updateDeliveryDocument/${docId}`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (response.ok) {
      showMessage("Document updated successfully");
      closeEditModal();
      fetchDeliveryDocuments();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  }
}

// Update the edit modal to include the new fields
function addEditModal() {
  const modalHTML = `
    <div id="editModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-color); padding: 20px; border-radius: 8px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <h2>Chỉnh sửa phiếu xuất kho/Edit Delivery Document</h2>
        <form id="editForm" onsubmit="handleEditSubmit(event)">
          <input type="hidden" id="editDocId">

          <!-- Basic Fields -->
          <div style="margin-bottom: 15px;">
            <label for="editName">Tên/Name:</label>
            <input type="text" id="editName" required style="width: 100%; padding: 8px;">
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editCostCenter" style="display: block; margin-bottom: 0.5em;">Trạm/Cost Center:</label>
            <select id="editCostCenter" required style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; border: 1px solid var(--border-color); border-radius: clamp(3px, 0.5vw, 6px);">
              <option value="">Chọn một trạm/Select a center</option>
              <!-- Options will be populated dynamically -->
            </select>
          </div>

          <!-- Products Section -->
          <div id="productsContainer" style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label style="display: block; margin-bottom: 0.5em;">Sản phẩm/Products:</label>
            <div id="productsList"></div>
            <button type="button" class="approve-btn" onclick="addProductField()" style="margin-top: 10px;">
              Thêm sản phẩm/Add Product
            </button>
          </div>

          <!-- File Upload -->
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

          <!-- Save and Cancel Buttons -->
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

function showFullView(docId) {
  try {
    const doc = deliveryDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");

    // Format date strings
    const submissionDate = doc.submissionDate || "Not specified";

    fullViewContent.innerHTML = `
      <!-- Basic Information Section -->
      <div class="full-view-section">
        <h3>Thông tin cơ bản/Basic Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tên:</span>
            <span class="detail-value">${doc.name}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Trạm:</span>
            <span class="detail-value">${doc.costCenter}</span>
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
            <span class="detail-label">Kê khai/Declaration:</span>
            <span class="detail-value">${
              doc.declaration || "Not specified"
            }</span>
          </div>
        </div>
      </div>

      <!-- Products Section -->
      <div class="full-view-section">
        <h3>Sản phẩm/Products</h3>
        ${renderProducts(doc.products)}
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

      <!-- Proposals Section -->
      <div class="full-view-section">
        <h3>Phiếu đề xuất kèm theo/Appended Proposals</h3>
        ${renderProposals(doc.appendedProposals)}
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

async function initializePage() {
  await fetchCurrentUser();

  const table = document.querySelector("table");
  table.parentElement.insertBefore(createToggleSwitch(), table);

  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    showOnlyPendingApprovals = e.target.checked;
    currentPage = 1; // Reset to first page when filter changes
    fetchDeliveryDocuments();
  });

  fetchDeliveryDocuments();
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  addEditModal();
  initializePage();
});
