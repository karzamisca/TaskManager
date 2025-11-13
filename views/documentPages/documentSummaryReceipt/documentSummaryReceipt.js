// views\documentPages\documentSummaryReceipt\documentSummaryReceipt.js
let currentUser = null;
let receiptDocuments = null;
let showOnlyPendingApprovals = false;
let currentApprovers = [];
let currentPage = 1;
const itemsPerPage = 10;
let totalPages = 1;
let paginationEnabled = true;
let choicesInstances = [];
let selectedDocuments = new Set();
let isExporting = false;

async function fetchCurrentUser() {
  try {
    const response = await fetch("/getCurrentUser");
    currentUser = await response.json();
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người dùng:", error);
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

  const scrollY = window.scrollY || document.documentElement.scrollTop;
  messageContainer.style.top = `${scrollY + 20}px`;

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
      return `<span class="status suspended">Từ chối</span>`;
    default:
      return `<span class="status pending">Chưa phê duyệt</span>`;
  }
}

function renderProducts(products) {
  if (!products || products.length === 0) return "-";

  return `
    <table class="products-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Sản phẩm</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Đơn giá</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Số lượng</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">VAT (%)</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thành tiền</th>
          <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Thành tiền sau VAT</th>
          <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Ghi chú</th>
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
              <strong>Công việc:</strong> ${proposal.task}<br>
              <strong>Trạm:</strong> ${proposal.costCenter}<br>
              <strong>Nhóm:</strong> ${proposal.groupName}<br>
              <strong>Mô tả:</strong> ${proposal.detailsDescription}<br>
              ${
                proposal.fileMetadata && proposal.fileMetadata.length > 0
                  ? `<strong>Tệp đính kèm:</strong> 
                    ${proposal.fileMetadata
                      .map(
                        (file) =>
                          `<a href="${file.link}" target="_blank" style="display: block; margin: 2px 0;">${file.name}</a>`
                      )
                      .join("")}`
                  : ""
              }
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderFiles(fileMetadata) {
  if (!fileMetadata || fileMetadata.length === 0) return "-";

  return `
    <div class="file-links-container">
      ${fileMetadata
        .map(
          (file) => `
          <div>
            <a href="${file.link}" class="file-link" target="_blank" title="${
            file.name
          }">
              <i class="fas fa-file" style="margin-right: 4px;"></i>
              ${file.name}
              ${file.size ? ` <small>(${file.size})</small>` : ""}
            </a>
          </div>
          `
        )
        .join("")}
    </div>
  `;
}

// Selection and Export Functions
function toggleSelectAll(checked) {
  const filteredDocuments = filterDocumentsForCurrentUser(receiptDocuments);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageDocuments = paginationEnabled
    ? filteredDocuments.slice(startIndex, endIndex)
    : filteredDocuments;

  if (checked) {
    pageDocuments.forEach((doc) => selectedDocuments.add(doc._id));
  } else {
    pageDocuments.forEach((doc) => selectedDocuments.delete(doc._id));
  }

  updateSelectionUI();
  renderTableRows();
}

function toggleDocumentSelection(docId, checked) {
  if (checked) {
    selectedDocuments.add(docId);
  } else {
    selectedDocuments.delete(docId);
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const selectedCount = document.getElementById("selectedCount");
  const exportBtn = document.getElementById("exportSelectedBtn");
  const selectionControls = document.getElementById("selectionControls");
  const selectAllCheckbox = document.getElementById("selectAll");

  selectedCount.textContent = selectedDocuments.size;
  exportBtn.disabled = selectedDocuments.size === 0 || isExporting;

  // Show/hide selection controls
  if (selectedDocuments.size > 0) {
    selectionControls.style.display = "flex";
  } else {
    selectionControls.style.display = "none";
  }

  // Update select all checkbox state
  if (selectAllCheckbox) {
    const filteredDocuments = filterDocumentsForCurrentUser(receiptDocuments);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageDocuments = paginationEnabled
      ? filteredDocuments.slice(startIndex, endIndex)
      : filteredDocuments;

    const allSelected =
      pageDocuments.length > 0 &&
      pageDocuments.every((doc) => selectedDocuments.has(doc._id));
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate =
      !allSelected &&
      pageDocuments.some((doc) => selectedDocuments.has(doc._id));
  }
}

function clearSelection() {
  selectedDocuments.clear();
  updateSelectionUI();
  renderTableRows();
}

async function exportSelectedToExcel() {
  if (selectedDocuments.size === 0 || isExporting) return;

  isExporting = true;
  const exportBtn = document.getElementById("exportSelectedBtn");
  exportBtn.classList.add("export-loading");
  exportBtn.disabled = true;

  try {
    const selectedDocs = Array.from(selectedDocuments);

    const response = await fetch("/exportReceiptDocumentsToExcel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentIds: selectedDocs }),
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Create filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      a.download = `phieu_xuat_kho_${timestamp}.xlsx`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showMessage(
        `Đã xuất thành công ${selectedDocuments.size} phiếu ra Excel`
      );
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (err) {
    console.error("Lỗi khi xuất Excel:", err);
    showMessage("Lỗi khi xuất dữ liệu ra Excel", true);
  } finally {
    isExporting = false;
    exportBtn.classList.remove("export-loading");
    exportBtn.disabled = selectedDocuments.size === 0;
  }
}

// Updated renderTableRows function with selection checkboxes
function renderTableRows() {
  const filteredDocuments = filterDocumentsForCurrentUser(receiptDocuments);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageDocuments = paginationEnabled
    ? filteredDocuments.slice(startIndex, endIndex)
    : filteredDocuments;

  const tableBody = document.getElementById("receiptDocumentsTable");
  tableBody.innerHTML = "";

  pageDocuments.forEach((doc) => {
    const isSelected = selectedDocuments.has(doc._id);
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
                  ? `<div class="approval-date">Đã phê duyệt vào: ${hasApproved.approvalDate}</div>`
                  : '<div class="approval-date">Chưa phê duyệt</div>'
              }
            </div>
          </div>
        `;
      })
      .join("");

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="select-row-cell">
        <input type="checkbox" class="select-checkbox" 
               ${isSelected ? "checked" : ""}
               onchange="toggleDocumentSelection('${doc._id}', this.checked)">
      </td>
      <td>${doc.name}</td>
      <td>${doc.costCenter}</td>   
      <td>${doc.groupName}</td>           
      <td>${renderProducts(doc.products)}</td>
      <td>${renderFiles(doc.fileMetadata)}</td>
      <td>${doc.grandTotalCost?.toLocaleString() || "-"}</td>
      <td>${renderProposals(doc.appendedProposals)}</td>
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
            <button class="approve-btn">Xuất ra DOCX</button>
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
      </td>
    `;
    tableBody.appendChild(row);
  });

  updateSelectionUI();
}

async function fetchReceiptDocuments() {
  try {
    const response = await fetch("/getReceiptDocumentForSeparatedView");
    const data = await response.json();
    receiptDocuments = data.receiptDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(receiptDocuments);

    totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }

    renderTableRows();

    if (paginationEnabled) {
      renderPagination();
    } else {
      let paginationContainer = document.getElementById("paginationContainer");
      if (paginationContainer) {
        paginationContainer.innerHTML = "";
      }
    }

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
    console.error("Lỗi khi lấy danh sách phiếu xuất kho:", err);
    showMessage("Lỗi khi lấy danh sách phiếu xuất kho", true);
  }
}

function togglePagination() {
  paginationEnabled = document.getElementById("paginationToggle").checked;
  currentPage = 1;
  selectedDocuments.clear();
  fetchReceiptDocuments();
}

function renderPagination() {
  let paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer) {
    const table = document.querySelector("table");
    paginationContainer = document.createElement("div");
    paginationContainer.id = "paginationContainer";
    paginationContainer.className = "pagination";
    table.parentNode.insertBefore(paginationContainer, table.nextSibling);
  }

  let paginationHTML = `
    <style>
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

function changePage(newPage) {
  if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
    currentPage = newPage;
    fetchReceiptDocuments();
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
      fetchReceiptDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Lỗi khi phê duyệt phiếu:", err);
    showMessage("Lỗi khi phê duyệt phiếu", true);
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
      fetchReceiptDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Lỗi khi xóa phiếu:", err);
    showMessage("Lỗi khi xóa phiếu", true);
  }
}

async function fetchProducts() {
  try {
    const response = await fetch("/documentProduct");
    const products = await response.json();
    return products;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error);
    return [];
  }
}

async function addProductField(product = null) {
  const productsList = document.getElementById("productsList");
  const productDiv = document.createElement("div");
  productDiv.className = "product-item";
  productDiv.style.marginBottom = "10px";

  productsList.appendChild(productDiv);

  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "10px";
  productDiv.appendChild(container);

  // Create select element for Choices.js
  const productSelect = document.createElement("select");
  productSelect.required = true;
  productSelect.style.width = "100%";
  productSelect.className = "product-select";

  container.appendChild(productSelect);

  // Fetch and populate products
  try {
    const products = await fetchProducts();

    // Initialize Choices.js
    const choices = new Choices(productSelect, {
      searchEnabled: true,
      searchPlaceholderValue: "Tìm kiếm sản phẩm...",
      noResultsText: "Không tìm thấy sản phẩm",
      itemSelectText: "Nhấn để chọn",
      searchResultLimit: 50,
      shouldSort: true,
      placeholder: true,
      placeholderValue: "Chọn sản phẩm",
      removeItemButton: false,
    });

    // Store instance for cleanup
    choicesInstances.push(choices);

    // Add products to choices
    const choicesData = products.map((prod) => ({
      value: prod.name,
      label: `${prod.name} (${prod.code})`,
      selected: product && product.productName === prod.name,
    }));

    choices.setChoices(choicesData, "value", "label", false);

    // Set selected value if editing
    if (product && product.productName) {
      choices.setChoiceByValue(product.productName);
    }
  } catch (error) {
    console.error("Error loading products:", error);
    showMessage("Lỗi khi tải danh sách sản phẩm", true);
  }

  // Cost input
  const costInput = document.createElement("input");
  costInput.type = "number";
  costInput.placeholder = "Đơn giá";
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
  amountInput.placeholder = "Số lượng";
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
  vatInput.placeholder = "VAT (%)";
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
  noteInput.placeholder = "Ghi chú";
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
  removeButton.textContent = "Xóa";
  removeButton.style.background = "#dc3545";
  removeButton.onclick = function () {
    // Find and destroy the Choices instance before removing
    const selectElement = this.parentElement.querySelector(".product-select");
    if (selectElement) {
      const choicesInstance = choicesInstances.find(
        (c) => c.passedElement.element === selectElement
      );
      if (choicesInstance) {
        choicesInstance.destroy();
        choicesInstances = choicesInstances.filter(
          (c) => c !== choicesInstance
        );
      }
    }
    this.parentElement.parentElement.remove();
  };
  container.appendChild(removeButton);
}

async function populateCostCenterDropdown() {
  try {
    const userResponse = await fetch("/getCurrentUser");
    const userData = await userResponse.json();
    const currentUser = userData.username;

    const costCenterResponse = await fetch("/costCenters");
    const costCenters = await costCenterResponse.json();

    const costCenterDropdown = document.getElementById("editCostCenter");

    costCenterDropdown.innerHTML = '<option value="">Chọn một trạm</option>';

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
    console.error("Lỗi khi lấy danh sách trạm:", error);
  }
}

async function fetchApprovers() {
  try {
    const response = await fetch("/approvers");
    const approvers = await response.json();
    return approvers;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người phê duyệt:", error);
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
          <button type="button" class="approve-btn" onclick="removeApprover('${approver.approver}')" style="background: #dc3545; padding: 4px 8px;">Xóa</button>
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
    alert("Vui lòng chọn người phê duyệt và nhập vai trò phụ.");
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
    <option value="">Chọn người phê duyệt</option>
    ${availableApprovers
      .map(
        (approver) => `
      <option value="${approver._id}">${approver.username}</option>
    `
      )
      .join("")}
  `;
}

async function fetchGroups() {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    return groups;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách nhóm:", error);
    return [];
  }
}

async function editDocument(docId) {
  try {
    const response = await fetch(`/getReceiptDocument/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name;

    await populateCostCenterDropdown();
    document.getElementById("editCostCenter").value = doc.costCenter;

    // Populate group dropdown
    const groups = await fetchGroups();
    const groupDropdown = document.getElementById("editGroupName");
    groupDropdown.innerHTML = '<option value="">Chọn nhóm</option>';
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.name;
      option.textContent = group.name;
      groupDropdown.appendChild(option);
    });
    if (doc.groupName) {
      groupDropdown.value = doc.groupName;
    }

    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";
    doc.products.forEach((product) => addProductField(product));

    currentApprovers = doc.approvers.map((approver) => ({
      approver: approver.approver?._id || approver.approver,
      username: approver.approver?.username || approver.username,
      subRole: approver.subRole,
    }));

    renderCurrentApprovers();
    await populateNewApproversDropdown();

    // Render current files
    renderCurrentFiles(doc.fileMetadata);

    document.getElementById("editModal").style.display = "block";
  } catch (err) {
    console.error("Lỗi khi lấy chi tiết phiếu:", err);
    showMessage("Lỗi khi tải chi tiết phiếu", true);
  }
}

// Add function to render current files
function renderCurrentFiles(fileMetadata) {
  const currentFilesContainer = document.getElementById(
    "currentFilesContainer"
  );
  if (!currentFilesContainer) return;

  if (!fileMetadata || fileMetadata.length === 0) {
    currentFilesContainer.innerHTML = "<p>Không có tệp tin nào</p>";

    // Still create the hidden input but with empty array
    if (!document.getElementById("currentFileMetadata")) {
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.id = "currentFileMetadata";
      hiddenInput.value = "[]";
      currentFilesContainer.appendChild(hiddenInput);
    } else {
      document.getElementById("currentFileMetadata").value = "[]";
    }

    return;
  }

  currentFilesContainer.innerHTML = `
    <h4>Tệp tin hiện tại:</h4>
    <div id="currentFilesList">
      ${fileMetadata
        .map((file, index) => {
          // Use the correct identifier for the file
          const fileIdentifier = file._id || file.driveFileId;
          return `
        <div class="file-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #ddd; margin-bottom: 5px; border-radius: 4px;">
          <div>
            <a href="${
              file.link
            }" target="_blank" style="text-decoration: none; color: #007bff;">
              <i class="fas fa-file" style="margin-right: 5px;"></i>
              ${file.name}
            </a>
            ${file.size ? ` <small>(${file.size})</small>` : ""}
          </div>
          <button type="button" class="btn btn-danger btn-sm" onclick="deleteCurrentFile('${fileIdentifier}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
        })
        .join("")}
    </div>
  `;

  // Add or update the hidden input
  let hiddenInput = document.getElementById("currentFileMetadata");
  if (!hiddenInput) {
    hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = "currentFileMetadata";
    currentFilesContainer.appendChild(hiddenInput);
  }
  hiddenInput.value = JSON.stringify(fileMetadata);
}

// Add function to delete current file
async function deleteCurrentFile(fileId) {
  const docId = document.getElementById("editDocId").value;

  if (!confirm("Bạn có chắc chắn muốn xóa tệp tin này?")) {
    return;
  }

  try {
    const response = await fetch(
      `/deleteReceiptDocumentFile/${docId}/${fileId}`,
      {
        method: "POST",
      }
    );

    const result = await response.json();
    console.log("Delete response:", result);

    if (result.success) {
      showMessage("Tệp tin đã được xóa thành công");

      // Get current file metadata
      const currentFileMetadataInput = document.getElementById(
        "currentFileMetadata"
      );
      let currentFiles = [];

      if (currentFileMetadataInput && currentFileMetadataInput.value) {
        currentFiles = JSON.parse(currentFileMetadataInput.value);
        console.log("Current files before deletion:", currentFiles);
      }

      // Filter out the deleted file
      const updatedFiles = currentFiles.filter((file) => {
        const hasMatchingId = file._id && file._id.toString() === fileId;
        const hasMatchingDriveId =
          file.driveFileId && file.driveFileId === fileId;
        return !hasMatchingId && !hasMatchingDriveId;
      });

      console.log("Updated files after deletion:", updatedFiles);

      // Update the hidden input
      currentFileMetadataInput.value = JSON.stringify(updatedFiles);

      // Re-render the files display
      renderCurrentFiles(updatedFiles);
    } else {
      showMessage(result.message || "Lỗi khi xóa tệp tin", true);
    }
  } catch (error) {
    console.error("Lỗi khi xóa tệp tin:", error);
    showMessage("Lỗi khi xóa tệp tin", true);
  }
}

function closeEditModal() {
  // Destroy all Choices instances
  choicesInstances.forEach((choice) => {
    if (choice && typeof choice.destroy === "function") {
      choice.destroy();
    }
  });
  choicesInstances = [];

  document.getElementById("editModal").style.display = "none";
  document.getElementById("editForm").reset();
  document.getElementById("productsList").innerHTML = "";
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  formData.append("name", document.getElementById("editName").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value
  );
  formData.append("groupName", document.getElementById("editGroupName").value);

  const products = [];
  const productItems = document.querySelectorAll(".product-item");

  productItems.forEach((item) => {
    const productSelect = item.querySelector("select.product-select");

    // Get all inputs - now we need to select them more specifically
    const costInput = item.querySelector('input[placeholder="Đơn giá"]');
    const amountInput = item.querySelector('input[placeholder="Số lượng"]');
    const vatInput = item.querySelector('input[placeholder="VAT (%)"]');
    const noteInput = item.querySelector('input[placeholder="Ghi chú"]');

    // Get value from Choices.js select
    let productName = "";
    if (productSelect) {
      productName = productSelect.value;
    }

    if (productName && costInput && amountInput && vatInput) {
      const costPerUnit = parseFloat(costInput.value) || 0;
      const amount = parseFloat(amountInput.value) || 0;
      const vat = parseFloat(vatInput.value) || 0;
      const note = noteInput ? noteInput.value || "" : "";

      const product = {
        productName: productName,
        costPerUnit: costPerUnit,
        amount: amount,
        vat: vat,
        totalCost: costPerUnit * amount,
        totalCostAfterVat:
          costPerUnit * amount + costPerUnit * amount * (vat / 100),
        note: note,
      };
      products.push(product);
    }
  });

  formData.append("products", JSON.stringify(products));

  const grandTotalCost = products.reduce(
    (sum, product) => sum + product.totalCostAfterVat,
    0
  );
  formData.append("grandTotalCost", grandTotalCost);

  formData.append("approvers", JSON.stringify(currentApprovers));

  const currentFileMetadata = document.getElementById("currentFileMetadata");
  if (currentFileMetadata && currentFileMetadata.value) {
    formData.append("currentFileMetadata", currentFileMetadata.value);
  }

  const fileInput = document.getElementById("editFile");
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }
  }

  try {
    const response = await fetch(`/updateReceiptDocument/${docId}`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (response.ok) {
      showMessage("Cập nhật phiếu thành công");
      closeEditModal();
      fetchReceiptDocuments();
    } else {
      showMessage(result.message || "Lỗi khi cập nhật phiếu", true);
    }
  } catch (err) {
    console.error("Lỗi khi cập nhật phiếu:", err);
    showMessage("Lỗi khi cập nhật phiếu", true);
  }
}

function addEditModal() {
  const modalHTML = `
    <div id="editModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-color); padding: 20px; border-radius: 8px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <h2>Chỉnh sửa phiếu xuất kho</h2>
        <form id="editForm" onsubmit="handleEditSubmit(event)">
          <input type="hidden" id="editDocId">

          <div style="margin-bottom: 15px;">
            <label for="editName">Tên:</label>
            <input type="text" id="editName" required style="width: 100%; padding: 8px;">
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editCostCenter" style="display: block; margin-bottom: 0.5em;">Trạm:</label>
            <select id="editCostCenter" required style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; border: 1px solid var(--border-color); border-radius: clamp(3px, 0.5vw, 6px);">
              <option value="">Chọn một trạm</option>
            </select>
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editGroupName" style="display: block; margin-bottom: 0.5em;">Nhóm:</label>
            <select id="editGroupName" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; border: 1px solid var(--border-color); border-radius: clamp(3px, 0.5vw, 6px);">
              <option value="">Chọn nhóm</option>
            </select>
          </div>

          <div id="productsContainer" style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label style="display: block; margin-bottom: 0.5em;">Sản phẩm:</label>
            <div id="productsList"></div>
            <button type="button" class="approve-btn" onclick="addProductField()" style="margin-top: 10px;">
              Thêm sản phẩm
            </button>
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <div id="currentFilesContainer"></div>
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label for="editFile" style="display: block; margin-bottom: 0.5em;">Thêm tệp tin mới:</label>
            <input type="file" id="editFile" multiple style="
                width: 100%;
                padding: clamp(6px, 1vw, 12px);
                font-size: inherit;
            ">
            <small>Có thể chọn nhiều tệp tin cùng lúc</small>
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label style="display: block; margin-bottom: 0.5em;">Người phê duyệt hiện tại:</label>
            <div id="currentApproversList"></div>
          </div>

          <div style="margin-bottom: clamp(12px, 1.5vw, 20px);">
            <label style="display: block; margin-bottom: 0.5em;">Thêm người phê duyệt:</label>
            <select id="newApproversDropdown" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit;">
              <option value="">Chọn người phê duyệt</option>
            </select>
            <input type="text" id="newApproverSubRole" placeholder="Vai trò" style="width: 100%; padding: clamp(6px, 1vw, 12px); font-size: inherit; margin-top: 10px;">
            <button type="button" class="approve-btn" onclick="addNewApprover()" style="margin-top: 10px;">
              Thêm
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
              ">Lưu thay đổi</button>
              
              <button type="button" class="approve-btn" onclick="closeEditModal()" style="
                  background: #666;
                  padding: clamp(8px, 1vw, 16px) clamp(16px, 2vw, 24px);
                  font-size: inherit;
              ">Hủy</button>
          </div>
        </form>
      </div>
    </div>
   `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function showFullView(docId) {
  try {
    const doc = receiptDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Không tìm thấy phiếu");

    const fullViewContent = document.getElementById("fullViewContent");

    const submissionDate = doc.submissionDate || "Không xác định";

    fullViewContent.innerHTML = `
      <div class="full-view-section">
        <h3>Thông tin cơ bản</h3>
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
            <span class="detail-label">Nhóm:</span>
            <span class="detail-value">${
              doc.groupName || "Không xác định"
            }</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ngày nộp:</span>
            <span class="detail-value">${submissionDate}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Người nộp:</span>
            <span class="detail-value">${doc.submittedBy.username}</span>
          </div>          
          <div class="detail-item">
            <span class="detail-label">Kê khai:</span>
            <span class="detail-value">${
              doc.declaration || "Không xác định"
            }</span>
          </div>
        </div>
      </div>

      <div class="full-view-section">
        <h3>Sản phẩm</h3>
        ${renderProducts(doc.products)}
      </div>

      <div class="full-view-section">
        <h3>Tệp tin kèm theo</h3>
        ${renderFiles(doc.fileMetadata)}
      </div>

      <div class="full-view-section">
        <h3>Phiếu đề xuất kèm theo</h3>
        ${renderProposals(doc.appendedProposals)}
      </div>

      <div class="full-view-section">
        <h3>Thông tin trạng thái</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tình trạng:</span>
            <span class="detail-value"> ${renderStatus(doc.status)}</span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <h4>Trạng thái phê duyệt:</h4>
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
                        ? `<div class="approval-date">Đã phê duyệt vào: ${hasApproved.approvalDate}</div>`
                        : '<div class="approval-date">Chưa phê duyệt</div>'
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
    console.error("Lỗi khi hiển thị chi tiết:", err);
    showMessage("Lỗi khi tải chi tiết phiếu", true);
  }
}

function closeFullViewModal() {
  document.getElementById("fullViewModal").style.display = "none";
}

async function initializePage() {
  await fetchCurrentUser();

  document
    .getElementById("paginationToggle")
    .addEventListener("change", togglePagination);

  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    showOnlyPendingApprovals = e.target.checked;
    currentPage = 1;
    selectedDocuments.clear();
    fetchReceiptDocuments();
  });

  // Add export button event listener
  document
    .getElementById("exportSelectedBtn")
    .addEventListener("click", exportSelectedToExcel);

  fetchReceiptDocuments();
}

document.addEventListener("DOMContentLoaded", () => {
  addEditModal();
  initializePage();
});
