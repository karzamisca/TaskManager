// views\documentPages\documentSummaryPurchasing\documentSummaryPurchasing.js
// State management
const state = {
  currentUser: null,
  purchasingDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentAppendedProposals: [],
  availableProposals: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  paginationEnabled: true,
  selectedDocuments: new Set(),
  currentEditDoc: null,
  nameFilter: "",
  currentGroupFilter: "",
  currentCostCenterFilter: [], // Changed to array for multiple selection
  costCenters: [],
};

// Multi-select functionality for cost centers
const initializeMultiSelect = () => {
  const button = document.getElementById("costCenterMultiSelectButton");
  const dropdown = document.getElementById("costCenterMultiSelectDropdown");
  const text = document.getElementById("costCenterMultiSelectText");

  // Toggle dropdown
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
    button.classList.toggle("open");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
    button.classList.remove("open");
  });

  // Prevent dropdown from closing when clicking inside
  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
};

// Populate multi-select dropdown with cost centers
const populateCostCenterMultiSelect = async () => {
  try {
    const response = await fetch("/userControlCostCenters");
    const costCenters = await response.json();
    state.costCenters = costCenters;

    const dropdown = document.getElementById("costCenterMultiSelectDropdown");
    dropdown.innerHTML = "";

    // Add "Select All" option
    const selectAllOption = document.createElement("div");
    selectAllOption.className = "multi-select-option";
    selectAllOption.innerHTML = `
      <input type="checkbox" id="selectAllCostCenters">
      <label for="selectAllCostCenters">Chọn tất cả</label>
    `;
    dropdown.appendChild(selectAllOption);

    // Add individual cost center options
    costCenters.forEach((center) => {
      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.innerHTML = `
        <input type="checkbox" id="costCenter_${center.name}" value="${center.name}">
        <label for="costCenter_${center.name}">${center.name}</label>
      `;
      dropdown.appendChild(option);
    });

    // Add event listeners
    const selectAllCheckbox = document.getElementById("selectAllCostCenters");
    selectAllCheckbox.addEventListener("change", (e) => {
      const checkboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]:not(#selectAllCostCenters)'
      );
      checkboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked;
      });
      updateCostCenterFilter();
    });

    const checkboxes = dropdown.querySelectorAll(
      'input[type="checkbox"]:not(#selectAllCostCenters)'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        // Update "Select All" checkbox state
        const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
        const someChecked = Array.from(checkboxes).some((cb) => cb.checked);

        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;

        updateCostCenterFilter();
      });
    });

    // Add clear button
    const clearButton = document.createElement("button");
    clearButton.className = "multi-select-clear";
    clearButton.innerHTML = '<i class="fas fa-times"></i> Xóa tất cả';
    clearButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      selectAllCheckbox.indeterminate = false;
      updateCostCenterFilter();
    });

    const buttonContainer = document.getElementById(
      "costCenterMultiSelectButton"
    );
    buttonContainer.appendChild(clearButton);
  } catch (error) {
    console.error("Error fetching cost centers for multi-select:", error);
  }
};

// Update cost center filter based on selected options
const updateCostCenterFilter = () => {
  const checkboxes = document.querySelectorAll(
    '#costCenterMultiSelectDropdown input[type="checkbox"]:not(#selectAllCostCenters)'
  );
  const selectedCostCenters = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  state.currentCostCenterFilter = selectedCostCenters;

  // Update button text
  const textElement = document.getElementById("costCenterMultiSelectText");
  const countElement = document.querySelector(".multi-select-selected-count");

  if (selectedCostCenters.length === 0) {
    textElement.textContent = "Tất cả";
    if (countElement) countElement.remove();
  } else if (selectedCostCenters.length === 1) {
    textElement.textContent = selectedCostCenters[0];
    if (countElement) countElement.remove();
  } else {
    textElement.textContent = `${selectedCostCenters.length} trạm đã chọn`;
    if (!countElement) {
      const countSpan = document.createElement("span");
      countSpan.className = "multi-select-selected-count";
      countSpan.textContent = `(${selectedCostCenters.length})`;
      textElement.parentNode.appendChild(countSpan);
    } else {
      countElement.textContent = `(${selectedCostCenters.length})`;
    }
  }

  state.currentPage = 1;
  fetchPurchasingDocuments();
};

// Utility functions
const showMessage = (message, isError = false) => {
  const messageContainer = document.getElementById("messageContainer");

  // Clear any existing timeouts to prevent multiple messages interfering
  if (messageContainer.timeoutId) {
    clearTimeout(messageContainer.timeoutId);
  }

  // Reset the message container
  messageContainer.className = `message ${isError ? "error" : "success"}`;
  messageContainer.textContent = message;
  messageContainer.style.display = "block";

  // Force reflow to ensure the element is visible before starting animation
  void messageContainer.offsetWidth;

  // Show with animation
  messageContainer.classList.remove("hidden");

  // Set timeout to hide after 5 seconds
  messageContainer.timeoutId = setTimeout(() => {
    messageContainer.classList.add("hidden");

    // Remove completely after animation completes
    setTimeout(() => {
      messageContainer.style.display = "none";
    }, 300); // Match this with your transition duration
  }, 5000);
};

const showLoading = (show) => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = show ? "flex" : "none";
};

const renderStatus = (status) => {
  switch (status) {
    case "Approved":
      return `<span class="status approved"><i class="fas fa-check-circle"></i> Đã phê duyệt</span>`;
    case "Suspended":
      return `<span class="status suspended"><i class="fas fa-ban"></i> Từ chối</span>`;
    default:
      return `<span class="status pending"><i class="fas fa-clock"></i> Chưa phê duyệt</span>`;
  }
};

const renderProducts = (products) => {
  if (!products || products.length === 0) return "-";

  return `
    <div class="products-table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th class="text-right">Đơn giá</th>
            <th class="text-right">Số lượng</th>
            <th class="text-right">VAT (%)</th>
            <th class="text-right">Thành tiền</th>
            <th class="text-right">Sau VAT</th>
            <th>Trạm</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (product) => `
            <tr>
              <td><strong>${product.productName}</strong></td>
              <td class="text-right">${product.costPerUnit.toLocaleString()}</td>
              <td class="text-right">${product.amount.toLocaleString()}</td>
              <td class="text-right">${product.vat.toLocaleString() || ""}</td>
              <td class="text-right">${product.totalCost.toLocaleString()}</td>
              <td class="text-right">${
                product.totalCostAfterVat.toLocaleString() || ""
              }</td>
              <td>${product.costCenter || ""}</td>
              <td>${product.note || ""}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

// Replace the single file rendering with array handling
const renderFiles = (fileArray) => {
  if (!fileArray || fileArray.length === 0) return "-";

  return `
    <div class="file-array-container">
      ${fileArray
        .map(
          (file) => `
        <div class="file-item">
          <i class="fas fa-paperclip file-icon"></i>
          <a href="${file.link}" class="file-link" target="_blank">${file.name}</a>
        </div>
      `
        )
        .join("")}
    </div>
  `;
};

// Update renderProposals to handle file arrays in proposals
const renderProposals = (proposals) => {
  if (!proposals || proposals.length === 0) return "-";

  return `
    <div class="proposals-container">
      ${proposals
        .map(
          (proposal) => `
          <div>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
          <div class="proposal-item">
            <div><strong>Công việc:</strong> ${proposal.task}</div>
            <div><strong>Trạm:</strong> ${proposal.costCenter}</div>
            <div><strong>Nhóm:</strong> ${proposal.groupName}</div>
            <div><strong>Dự án:</strong> ${
              proposal.projectName || "Không có"
            }</div>
            <div><strong>Mô tả:</strong> ${proposal.detailsDescription}</div>
            <div><strong>Ngày nộp:</strong> ${proposal.submissionDate}</div>
            <div><strong>Người nộp:</strong> ${
              proposal.submittedBy?.username || "Không rõ"
            }</div>
            <div><strong>Trạng thái:</strong> ${proposal.status}</div>
            ${
              proposal.declaration
                ? `<div><strong>Kê khai:</strong> ${proposal.declaration}</div>`
                : ""
            }
            ${
              proposal.suspendReason
                ? `<div><strong>Lý do tạm dừng:</strong> ${proposal.suspendReason}</div>`
                : ""
            }
            ${
              proposal.fileMetadata && proposal.fileMetadata.length > 0
                ? `<div><strong>Tệp đính kèm:</strong> 
                   ${renderFiles(proposal.fileMetadata)}</div>`
                : ""
            }            
            <div><strong>Đã phê duyệt bởi:</strong></div>
            <ul>
              ${proposal.approvedBy
                .map(
                  (approval) => `
                <li>
                  ${approval.username} - ${approval.approvalDate}
                </li>
              `
                )
                .join("")}
            </ul>                        
        `
        )
        .join("")}
    </div>
  `;
};

// Data fetching
const fetchCurrentUser = async () => {
  try {
    const response = await fetch("/getCurrentUser");
    state.currentUser = await response.json();
  } catch (error) {
    console.error("Error fetching current user:", error);
  }
};

const fetchPurchasingDocuments = async () => {
  showLoading(true);

  try {
    const response = await fetch("/getPurchasingDocumentForSeparatedView");
    const data = await response.json();
    state.purchasingDocuments = data.purchasingDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(
      state.purchasingDocuments
    );

    // Calculate total pages
    state.totalPages = Math.ceil(filteredDocuments.length / state.itemsPerPage);

    // Make sure current page is in valid range
    if (state.currentPage > state.totalPages) {
      state.currentPage = state.totalPages;
    }
    if (state.currentPage < 1) {
      state.currentPage = 1;
    }

    // Calculate slice indexes for current page
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;

    // Get documents for current page only if pagination is enabled, otherwise show all
    const pageDocuments = state.paginationEnabled
      ? filteredDocuments.slice(startIndex, endIndex)
      : filteredDocuments;

    renderDocumentsTable(pageDocuments);
    updateSummary(filteredDocuments);

    if (state.paginationEnabled) {
      renderPagination();
    } else {
      removePagination();
    }
  } catch (err) {
    console.error("Error fetching purchasing documents:", err);
    showMessage("Error fetching purchasing documents", true);
  } finally {
    showLoading(false);
  }
};

const filterDocumentsForCurrentUser = (documents) => {
  let filteredDocs = [...documents];

  // Apply pending approval filter if enabled
  if (state.showOnlyPendingApprovals && state.currentUser) {
    filteredDocs = filteredDocs.filter((doc) => {
      const isRequiredApprover = doc.approvers.some(
        (approver) => approver.username === state.currentUser.username
      );
      const hasNotApprovedYet = !doc.approvedBy.some(
        (approved) => approved.username === state.currentUser.username
      );
      return isRequiredApprover && hasNotApprovedYet;
    });
  }

  // Apply name filter if there's a search term
  if (state.nameFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.name?.toLowerCase().includes(state.nameFilter)
    );
  }

  // Apply cost center filter (now handles multiple)
  if (state.currentCostCenterFilter.length > 0) {
    filteredDocs = filteredDocs.filter((doc) =>
      state.currentCostCenterFilter.includes(doc.costCenter)
    );
  }

  // Apply group filter if selected
  if (state.currentGroupFilter) {
    filteredDocs = filteredDocs.filter(
      (doc) => doc.groupName === state.currentGroupFilter
    );
  }

  return filteredDocs;
};

const filterByGroup = () => {
  state.currentGroupFilter = document.getElementById("groupFilter").value;
  state.currentPage = 1;
  fetchPurchasingDocuments();
};

const populateGroupFilter = async () => {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    const filterDropdown = document.getElementById("groupFilter");

    // Clear existing options except the first one
    while (filterDropdown.options.length > 1) {
      filterDropdown.remove(1);
    }

    // Add new options
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.name;
      option.textContent = group.name;
      filterDropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching groups for filter:", error);
  }
};

// Rendering functions
const renderDocumentsTable = (documents) => {
  const tableBody = document
    .getElementById("purchasingDocumentsTable")
    .querySelector("tbody");
  tableBody.innerHTML = "";

  documents.forEach((doc) => {
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
      <td><input type="checkbox" class="doc-checkbox" data-doc-id="${
        doc._id
      }" ${state.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
      <td>${doc.name ? doc.name : ""}</td>
      <td>${doc.costCenter ? doc.costCenter : ""}</td>              
      <td>
        ${renderProducts(doc.products)} 
        ${
          doc.declaration
            ? `<div class="declaration"><strong>Kê khai:</strong> ${doc.declaration}</div>`
            : ""
        }
        ${
          doc.suspendReason
            ? `<div class="suspend-reason"><strong>Lý do từ chối:</strong> ${doc.suspendReason}</div>`
            : ""
        }
      </td>
      <td>${renderFiles(doc.fileMetadata)}</td>
      <td>${doc.grandTotalCost?.toLocaleString() || "-"}</td>
      <td>${renderProposals(doc.appendedProposals)}</td>
      <td>${renderStatus(doc.status)}</td>
      <td class="approval-status">${approvalStatus}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-primary btn-sm" onclick="showFullView('${
            doc._id
          }')">
            <i class="fas fa-eye"></i> Xem
          </button>
          <form action="/exportDocumentToDocx/${
            doc._id
          }" method="GET" style="display:inline;">
            <button class="btn btn-primary btn-sm">
              <i class="fas fa-file-word"></i> Xuất DOCX
            </button>
          </form>
          ${
            doc.approvedBy.length === 0
              ? `
                <button class="btn btn-primary btn-sm" onclick="editDocument('${doc._id}')">
                  <i class="fas fa-edit"></i> Sửa
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteDocument('${doc._id}')">
                  <i class="fas fa-trash"></i> Xóa
                </button>
              `
              : ""
          }
          ${
            doc.status === "Pending"
              ? `
                <button class="btn btn-primary btn-sm" onclick="approveDocument('${doc._id}')">
                  <i class="fas fa-check"></i> Phê duyệt
                </button>
              `
              : ""
          }
          ${
            doc.status === "Approved"
              ? `
                <button class="btn btn-primary btn-sm" onclick="editDeclaration('${doc._id}')">
                  <i class="fas fa-edit"></i> Kê khai
                </button>
              `
              : ""
          }
          ${
            doc.status === "Suspended"
              ? `
                <button class="btn btn-primary btn-sm" onclick="openDocument('${doc._id}')">
                  <i class="fas fa-lock-open"></i> Mở
                </button>
              `
              : `
                <button class="btn btn-danger btn-sm" onclick="suspendDocument('${doc._id}')">
                  <i class="fas fa-ban"></i> Từ chối
                </button>
              `
          }
          <button class="btn btn-secondary btn-sm" onclick="showDocumentsContainingPurchasing('${
            doc._id
          }')">
            <i class="fas fa-link"></i> Liên quan
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
};

const updateSummary = (filteredDocuments) => {
  const approvedDocs = filteredDocuments.filter(
    (doc) => doc.status === "Approved"
  );
  const unapprovedDocs = filteredDocuments.filter(
    (doc) => doc.status === "Pending"
  );

  const approvedSum = approvedDocs.reduce(
    (sum, doc) => sum + (doc.grandTotalCost || 0),
    0
  );
  const unapprovedSum = unapprovedDocs.reduce(
    (sum, doc) => sum + (doc.grandTotalCost || 0),
    0
  );

  document.getElementById("approvedSum").textContent =
    approvedSum.toLocaleString();
  document.getElementById("unapprovedSum").textContent =
    unapprovedSum.toLocaleString();
  document.getElementById("approvedDocument").textContent =
    approvedDocs.length.toLocaleString();
  document.getElementById("unapprovedDocument").textContent =
    unapprovedDocs.length.toLocaleString();
};

const renderPagination = () => {
  let paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer) {
    const table = document.querySelector("table");
    paginationContainer = document.createElement("div");
    paginationContainer.id = "paginationContainer";
    paginationContainer.className = "pagination-container";
    table.parentNode.insertBefore(paginationContainer, table.nextSibling);
  }

  if (state.totalPages > 1) {
    paginationContainer.innerHTML = `
      <div class="pagination">
        <button onclick="changePage(1)" ${
          state.currentPage === 1 ? "disabled" : ""
        }>
          <i class="fas fa-angle-double-left"></i> Trang đầu
        </button>
        <button onclick="changePage(${state.currentPage - 1})" ${
      state.currentPage === 1 ? "disabled" : ""
    }>
          <i class="fas fa-angle-left"></i> Trang trước
        </button>
        <span class="page-info">
          Trang ${state.currentPage} / ${state.totalPages}
        </span>
        <div class="go-to-page">
          <span>Đến trang:</span>
          <input type="number" class="page-input" id="pageInput" 
                 min="1" max="${state.totalPages}" value="${state.currentPage}">
          <button onclick="goToPage()">Đi</button>
        </div>
        <button onclick="changePage(${state.currentPage + 1})" ${
      state.currentPage === state.totalPages ? "disabled" : ""
    }>
          Trang tiếp <i class="fas fa-angle-right"></i>
        </button>
        <button onclick="changePage(${state.totalPages})" ${
      state.currentPage === state.totalPages ? "disabled" : ""
    }>
          Trang cuối <i class="fas fa-angle-double-right"></i>
        </button>
      </div>
    `;
  } else {
    paginationContainer.innerHTML = "";
  }
};

const removePagination = () => {
  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) {
    paginationContainer.innerHTML = "";
  }
};

const goToPage = () => {
  const pageInput = document.getElementById("pageInput");
  if (!pageInput) return;

  const pageNumber = parseInt(pageInput.value);
  if (
    !isNaN(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= state.totalPages &&
    pageNumber !== state.currentPage
  ) {
    changePage(pageNumber);
  } else {
    // Reset to current page if input is invalid
    pageInput.value = state.currentPage;
  }
};

const changePage = (newPage) => {
  if (
    newPage >= 1 &&
    newPage <= state.totalPages &&
    newPage !== state.currentPage
  ) {
    state.currentPage = newPage;
    fetchPurchasingDocuments();
    document.querySelector("table").scrollIntoView({ behavior: "smooth" });
  }
};

// Document actions
const approveDocument = async (documentId) => {
  try {
    const response = await fetch(`/approveDocument/${documentId}`, {
      method: "POST",
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error approving document:", err);
    showMessage("Error approving document", true);
  }
};

const deleteDocument = async (documentId) => {
  if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) {
    return;
  }

  try {
    const response = await fetch(`/deleteDocument/${documentId}`, {
      method: "POST",
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error deleting document:", err);
    showMessage("Error deleting document", true);
  }
};

const suspendDocument = (docId) => {
  document.getElementById("suspendModal").style.display = "block";
  document.getElementById("suspendForm").dataset.docId = docId;
};

const closeSuspendModal = () => {
  document.getElementById("suspendModal").style.display = "none";
  document.getElementById("suspendForm").reset();
};

const handleSuspendSubmit = async (event) => {
  event.preventDefault();
  const docId = event.target.dataset.docId;
  const suspendReason = document.getElementById("suspendReason").value;

  try {
    const response = await fetch(`/suspendPurchasingDocument/${docId}`, {
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
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error suspending document:", err);
    showMessage("Lỗi khi tạm dừng tài liệu.", true);
  }
};

const openDocument = async (docId) => {
  try {
    const response = await fetch(`/openPurchasingDocument/${docId}`, {
      method: "POST",
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error reopening document:", err);
    showMessage("Lỗi khi mở lại tài liệu.", true);
  }
};

const editDeclaration = (docId) => {
  // Remove any existing declaration modal first
  const existingModal = document.getElementById("declarationModal");
  if (existingModal) {
    existingModal.remove();
  }

  const doc = state.purchasingDocuments.find((d) => d._id === docId);
  if (!doc) return;

  // Create a fresh modal
  const modalHTML = `
    <div id="declarationModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeDeclarationModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Kê Khai - ${
          doc.tag || doc.name
        }</h2>
        <div class="modal-body">
          <div class="form-group">
            <textarea id="declarationInput" class="form-textarea">${
              doc.declaration || ""
            }</textarea>
          </div>
          <div class="form-actions">
            <button onclick="saveDeclaration('${docId}')" class="btn btn-primary">
              <i class="fas fa-save"></i> Lưu kê khai
            </button>
            <button onclick="closeDeclarationModal()" class="btn btn-secondary">
              <i class="fas fa-times"></i> Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Append the modal to the body
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Show the modal
  document.getElementById("declarationModal").style.display = "block";

  // Focus on the textarea
  document.getElementById("declarationInput").focus();
};

const closeDeclarationModal = () => {
  const modal = document.getElementById("declarationModal");
  if (modal) {
    modal.style.display = "none";
    // Remove after animation completes
    setTimeout(() => modal.remove(), 300);
  }
};

const saveDeclaration = async (docId) => {
  const declaration = document.getElementById("declarationInput").value;

  try {
    const response = await fetch(
      `/updatePurchasingDocumentDeclaration/${docId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ declaration }),
      }
    );

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      closeDeclarationModal();
      // Update the local state to reflect changes
      const docIndex = state.purchasingDocuments.findIndex(
        (d) => d._id === docId
      );
      if (docIndex !== -1) {
        state.purchasingDocuments[docIndex].declaration = declaration;
      }
      fetchPurchasingDocuments(); // Refresh the view
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Error updating declaration", true);
  }
};

const showFullView = (docId) => {
  try {
    const doc = state.purchasingDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");

    // Format date strings
    const submissionDate = doc.submissionDate || "Không có";

    fullViewContent.innerHTML = `
      <!-- Basic Information Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-info-circle"></i> Thông tin cơ bản</h3>
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
            <span class="detail-value">${doc.groupName || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Người nộp:</span>
            <span class="detail-value">${
              doc.submittedBy?.username || "Không rõ"
            }</span>
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
      
      <!-- Products Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-boxes"></i> Sản phẩm</h3>
        ${renderProducts(doc.products)}
      </div>
      
      <!-- File Attachment Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-paperclip"></i> Tệp tin kèm theo</h3>
        ${renderFiles(doc.fileMetadata)}
      </div>
      
      <!-- Proposals Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-file-alt"></i> Phiếu đề xuất kèm theo</h3>
        ${renderProposals(doc.appendedProposals)}
      </div>
      
      <!-- Status Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-tasks"></i> Trạng thái</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tình trạng:</span>
            <span class="detail-value ${renderStatus(doc.status)}</span>
          </div>
        </div>
        <div class="approval-section">
          <h4><i class="fas fa-user-check"></i> Trạng thái phê duyệt:</h4>
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
                        ? `<div class="approval-date"><i class="fas fa-calendar-check"></i> Đã phê duyệt vào: ${hasApproved.approvalDate}</div>`
                        : '<div class="approval-date"><i class="fas fa-clock"></i> Chưa phê duyệt</div>'
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
};

const closeFullViewModal = () => {
  document.getElementById("fullViewModal").style.display = "none";
};

// Proposal Management Functions
const fetchAvailableProposals = async () => {
  try {
    const response = await fetch("/approvedProposalsForPurchasing");
    const allProposals = await response.json();

    // Filter out proposals that are already appended to the current document
    const currentProposalIds = state.currentAppendedProposals.map(
      (p) => p.proposalId
    );
    state.availableProposals = allProposals.filter(
      (proposal) => !currentProposalIds.includes(proposal._id)
    );

    populateProposalsDropdown();
  } catch (error) {
    console.error("Error fetching available proposals:", error);
    showMessage("Error loading available proposals", true);
  }
};

const populateProposalsDropdown = () => {
  const dropdown = document.getElementById("newProposalsDropdown");
  dropdown.innerHTML = '<option value="">Chọn phiếu đề xuất</option>';

  state.availableProposals.forEach((proposal) => {
    const option = document.createElement("option");
    option.value = proposal._id;
    option.textContent = `${proposal.task} - ${proposal.costCenter} - ${proposal.submissionDate}`;
    dropdown.appendChild(option);
  });
};

const renderCurrentAppendedProposals = () => {
  const currentProposalsList = document.getElementById(
    "currentAppendedProposalsList"
  );

  if (state.currentAppendedProposals.length === 0) {
    currentProposalsList.innerHTML =
      '<p class="text-muted">Không có phiếu đề xuất nào</p>';
    return;
  }

  currentProposalsList.innerHTML = state.currentAppendedProposals
    .map(
      (proposal, index) => `
      <div class="proposal-item" data-proposal-id="${proposal.proposalId}">
        <div class="proposal-info">
          <strong>${proposal.task}</strong>
          <div class="proposal-details">
            <span>Trạm: ${proposal.costCenter}</span>
            <span>Nhóm: ${proposal.groupName}</span>
            <span>Ngày: ${proposal.submissionDate}</span>
          </div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" 
                onclick="removeAppendedProposal('${proposal.proposalId}')">
          <i class="fas fa-trash"></i> Xóa
        </button>
      </div>
    `
    )
    .join("");
};

const removeAppendedProposal = (proposalId) => {
  state.currentAppendedProposals = state.currentAppendedProposals.filter(
    (proposal) => proposal.proposalId !== proposalId
  );
  renderCurrentAppendedProposals();
  fetchAvailableProposals(); // Refresh available proposals
};

const addNewProposal = () => {
  const selectedProposalId = document.getElementById(
    "newProposalsDropdown"
  ).value;

  if (!selectedProposalId) {
    showMessage("Vui lòng chọn một phiếu đề xuất.", true);
    return;
  }

  const selectedProposal = state.availableProposals.find(
    (proposal) => proposal._id === selectedProposalId
  );

  if (selectedProposal) {
    const newAppendedProposal = {
      task: selectedProposal.task,
      costCenter: selectedProposal.costCenter,
      groupName: selectedProposal.groupName,
      dateOfError: selectedProposal.dateOfError,
      detailsDescription: selectedProposal.detailsDescription,
      direction: selectedProposal.direction,
      fileMetadata: selectedProposal.fileMetadata || [],
      proposalId: selectedProposal._id,
      submissionDate: selectedProposal.submissionDate,
      submittedBy: selectedProposal.submittedBy,
      approvers: selectedProposal.approvers,
      approvedBy: selectedProposal.approvedBy,
      status: selectedProposal.status,
      declaration: selectedProposal.declaration,
      suspendReason: selectedProposal.suspendReason,
      projectName: selectedProposal.projectName,
    };

    state.currentAppendedProposals.push(newAppendedProposal);
    renderCurrentAppendedProposals();
    fetchAvailableProposals(); // Refresh available proposals

    // Clear the dropdown selection
    document.getElementById("newProposalsDropdown").value = "";
  }
};

// Edit Document Functions
const addEditModal = () => {
  const modalHTML = `
    <div id="editModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeEditModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Chỉnh sửa phiếu mua hàng</h2>
        <div class="modal-body">
          <form id="editForm" onsubmit="handleEditSubmit(event)" class="modal-form" enctype="multipart/form-data">
            <input type="hidden" id="editDocId">
            
            <!-- Basic Fields -->
            <div class="form-group">
              <label for="editName" class="form-label">Tên:</label>
              <input type="text" id="editName" required class="form-input">
            </div>
            
            <div class="form-group">
              <label for="editCostCenter" class="form-label">Trạm:</label>
              <select id="editCostCenter" required class="form-select">
                <option value="">Chọn một trạm</option>
                <!-- Options will be populated dynamically -->
              </select>
            </div>

            <div class="form-group">
              <label for="editGroupName" class="form-label">Nhóm:</label>
              <select id="editGroupName" required class="form-select">
                <option value="">Chọn một nhóm</option>
                <!-- Options will be populated dynamically -->
              </select>
            </div>            

            <div class="form-group">
              <label class="form-label">Sản phẩm:</label>
              <div id="productsList" class="products-list"></div>
              <button type="button" class="btn btn-primary" onclick="addProductField()">
                <i class="fas fa-plus"></i> Thêm sản phẩm
              </button>
            </div>
            
            <!-- Current Files Section -->
            <div class="form-group">
              <label class="form-label">Tệp tin hiện tại:</label>
              <div id="currentFilesList" class="files-list"></div>
            </div>
            
            <!-- New Files Section -->
            <div class="form-group">
              <label for="editFiles" class="form-label">Thay tệp tin mới:</label>
              <input type="file" id="editFiles" class="form-input" multiple>
              <small class="form-text">Có thể chọn nhiều tệp tin</small>
            </div>
            
            <!-- Current Appended Proposals Section -->
            <div class="form-group">
              <label class="form-label">Phiếu đề xuất đã gắn kèm:</label>
              <div id="currentAppendedProposalsList" class="proposals-list"></div>
            </div>
            
            <!-- Add New Proposals Section -->
            <div class="form-group">
              <label class="form-label">Thêm phiếu đề xuất:</label>
              <select id="newProposalsDropdown" class="form-select">
                <option value="">Chọn phiếu đề xuất</option>
                <!-- Options will be populated dynamically -->
              </select>
              <button type="button" class="btn btn-primary" onclick="addNewProposal()" style="margin-top: var(--space-sm);">
                <i class="fas fa-plus"></i> Thêm phiếu đề xuất
              </button>
            </div>
            
            <!-- Current Approvers Section -->
            <div class="form-group">
              <label class="form-label">Người phê duyệt hiện tại:</label>
              <div id="currentApproversList" class="approvers-list"></div>
            </div>
            
            <!-- Add New Approvers Section -->
            <div class="form-group">
              <label class="form-label">Thêm người phê duyệt:</label>
              <select id="newApproversDropdown" class="form-select">
                <option value="">Chọn người phê duyệt</option>
                <!-- Options will be populated dynamically -->
              </select>
              <input type="text" id="newApproverSubRole" placeholder="Vai trò" class="form-input" style="margin-top: var(--space-sm);">
              <button type="button" class="btn btn-primary" onclick="addNewApprover()" style="margin-top: var(--space-sm);">
                <i class="fas fa-plus"></i> Thêm
              </button>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> Lưu thay đổi
              </button>
              <button type="button" class="btn btn-secondary" onclick="closeEditModal()">
                <i class="fas fa-times"></i> Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
};

const fetchProducts = async () => {
  try {
    const response = await fetch("/documentProduct");
    const products = await response.json();
    return products;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error);
    return [];
  }
};

const validateProductFields = () => {
  const productItems = document.querySelectorAll(".product-item");

  if (productItems.length === 0) {
    showMessage("Vui lòng thêm ít nhất một sản phẩm", true);
    return false;
  }

  for (let item of productItems) {
    const productSelect = item.querySelector(".product-select");

    // Check if product name is selected
    if (productSelect) {
      const choicesInstance = productSelect._choices;
      const productName = choicesInstance
        ? choicesInstance.getValue(true)
        : productSelect.value;

      if (!productName || productName === "") {
        showMessage("Vui lòng chọn tên sản phẩm cho tất cả các mục", true);
        // Try to focus on the field
        if (choicesInstance) {
          choicesInstance.showDropdown();
        } else {
          productSelect.focus();
        }
        return false;
      }
    } else {
      // Fallback text input
      const nameInput = item.querySelector('input[type="text"]:first-of-type');
      if (nameInput && !nameInput.value) {
        showMessage("Vui lòng nhập tên sản phẩm cho tất cả các mục", true);
        nameInput.focus();
        return false;
      }
    }

    // Check other required fields
    const requiredInputs = item.querySelectorAll("input[required]");
    for (let input of requiredInputs) {
      if (!input.value || input.value === "") {
        showMessage(
          `Vui lòng điền đầy đủ thông tin sản phẩm (${input.placeholder})`,
          true
        );
        input.focus();
        return false;
      }
    }
  }

  return true;
};

const addProductField = async (product = null) => {
  const productsList = document.getElementById("productsList");
  const productDiv = document.createElement("div");
  productDiv.className = "product-item";

  // Create the container first
  const fieldsContainer = document.createElement("div");
  fieldsContainer.className = "product-fields";
  productDiv.appendChild(fieldsContainer);

  // Product dropdown with unique ID for Choices.js
  const productDropdown = document.createElement("select");
  const uniqueId = `product-select-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  productDropdown.id = uniqueId;
  productDropdown.className = "form-select product-select";
  // Remove required attribute temporarily - we'll validate manually
  productDropdown.removeAttribute("required");

  // Add default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Chọn sản phẩm";
  productDropdown.appendChild(defaultOption);

  // Fetch and populate products
  let fallbackToInput = false;
  let selectedProductName = product?.productName;

  try {
    const products = await fetchProducts();
    products.forEach((prod) => {
      const option = document.createElement("option");
      option.value = prod.name;
      option.textContent = `${prod.name} (${prod.code})`;
      productDropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading products:", error);
    fallbackToInput = true;
  }

  // Create other inputs
  const costInput = document.createElement("input");
  costInput.type = "number";
  costInput.placeholder = "Đơn giá";
  costInput.value = product?.costPerUnit || "";
  costInput.required = true;
  costInput.step = "0.01";
  costInput.className = "form-input";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.placeholder = "Số lượng";
  amountInput.value = product?.amount || "";
  amountInput.required = true;
  amountInput.step = "0.01";
  amountInput.className = "form-input";

  const vatInput = document.createElement("input");
  vatInput.type = "number";
  vatInput.placeholder = "VAT(%)";
  vatInput.value = product?.vat !== undefined ? product.vat : "";
  vatInput.required = true;
  vatInput.step = "0.01";
  vatInput.className = "form-input";

  // Create cost center dropdown
  const costCenterSelect = document.createElement("select");
  costCenterSelect.className = "product-cost-center form-select";
  // Cost center is optional, so no required attribute

  const defaultCenterOption = document.createElement("option");
  defaultCenterOption.value = "";
  defaultCenterOption.textContent = "Chọn trạm";
  costCenterSelect.appendChild(defaultCenterOption);

  // Populate cost centers if available
  if (state.costCenters) {
    state.costCenters.forEach((center) => {
      const option = document.createElement("option");
      option.value = center.name;
      option.textContent = center.name;
      if (product?.costCenter === center.name) {
        option.selected = true;
      }
      costCenterSelect.appendChild(option);
    });
  }

  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "Ghi chú";
  noteInput.value = product?.note || "";
  noteInput.className = "form-input";

  // Create remove button
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "btn btn-danger btn-sm";
  removeButton.innerHTML = '<i class="fas fa-trash"></i> Xóa';
  removeButton.onclick = function () {
    // Destroy Choices instance before removing
    const productSelect =
      this.parentElement.parentElement.querySelector(".product-select");
    if (productSelect && productSelect._choices) {
      productSelect._choices.destroy();
    }
    this.parentElement.parentElement.remove();
  };

  // If products couldn't be loaded, fall back to text input
  if (fallbackToInput) {
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Tên sản phẩm";
    nameInput.value = product?.productName || "";
    nameInput.required = true;
    nameInput.className = "form-input";
    fieldsContainer.appendChild(nameInput);
  } else {
    // Set the value BEFORE appending to DOM if we have one
    if (selectedProductName) {
      productDropdown.value = selectedProductName;
    }
    fieldsContainer.appendChild(productDropdown);
  }

  // Append all other inputs
  fieldsContainer.appendChild(costInput);
  fieldsContainer.appendChild(amountInput);
  fieldsContainer.appendChild(vatInput);
  fieldsContainer.appendChild(costCenterSelect);
  fieldsContainer.appendChild(noteInput);
  fieldsContainer.appendChild(removeButton);

  productsList.appendChild(productDiv);

  // Initialize Choices.js after DOM insertion
  if (!fallbackToInput) {
    setTimeout(() => {
      const choices = new Choices(`#${uniqueId}`, {
        searchEnabled: true,
        searchPlaceholderValue: "Tìm kiếm sản phẩm...",
        noResultsText: "Không tìm thấy sản phẩm",
        itemSelectText: "Nhấn để chọn",
        shouldSort: false,
        searchResultLimit: 50,
        removeItemButton: false,
        placeholder: true,
        placeholderValue: "Chọn sản phẩm",
      });

      // Store Choices instance for cleanup
      productDropdown._choices = choices;

      // Set the selected value AFTER Choices.js initializes
      if (selectedProductName) {
        choices.setChoiceByValue(selectedProductName);
      }
    }, 0);
  }
};

const populateCostCenterDropdownForEditing = async () => {
  try {
    const response = await fetch("/costCenters");
    const costCenters = await response.json();
    const dropdown = document.getElementById("editCostCenter");

    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">Chọn một trạm</option>';

    // Add new options
    costCenters.forEach((center) => {
      const option = document.createElement("option");
      option.value = center.name;
      option.textContent = center.name;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching cost centers:", error);
  }
};

const populateGroupDropdownForEditing = async () => {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    const dropdown = document.getElementById("editGroupName");

    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">Chọn một nhóm</option>';

    // Add new options
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.name;
      option.textContent = group.name;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching groups for filter:", error);
  }
};

const fetchApprovers = async () => {
  try {
    const response = await fetch("/approvers");
    return await response.json();
  } catch (error) {
    console.error("Error fetching approvers:", error);
    return [];
  }
};

const renderCurrentApprovers = () => {
  const currentApproversList = document.getElementById("currentApproversList");
  currentApproversList.innerHTML = state.currentApprovers
    .map(
      (approver) => `
        <div class="approver-item">
          <span>${approver.username}</span>
          <input type="text" value="${approver.subRole}" 
                 onchange="updateApproverSubRole('${approver._id}', this.value)" 
                 class="form-input" style="width: 120px;">
          <button type="button" class="btn btn-danger btn-sm" 
                  onclick="removeApprover('${approver._id}')">  <!-- Use _id here -->
            <i class="fas fa-trash"></i> Xóa
          </button>
        </div>
      `
    )
    .join("");
};

const updateApproverSubRole = (approverId, newSubRole) => {
  const approver = state.currentApprovers.find(
    (a) => a.approver === approverId
  );
  if (approver) {
    approver.subRole = newSubRole;
  }
};

const removeApprover = (approverId) => {
  state.currentApprovers = state.currentApprovers.filter(
    (a) => a._id !== approverId // Compare with _id
  );

  renderCurrentApprovers();
  populateNewApproversDropdown();
};

const populateNewApproversDropdown = async () => {
  const allApprovers = await fetchApprovers();
  const availableApprovers = allApprovers.filter(
    (approver) =>
      !state.currentApprovers.some((a) => a.approver === approver._id)
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
};

const addNewApprover = () => {
  const newApproverId = document.getElementById("newApproversDropdown").value;
  const newSubRole = document.getElementById("newApproverSubRole").value;

  if (!newApproverId || !newSubRole) {
    showMessage("Vui lòng chọn người phê duyệt và nhập vai trò phụ.", true);
    return;
  }

  const newApprover = {
    approver: newApproverId,
    username: document
      .getElementById("newApproversDropdown")
      .selectedOptions[0].text.split(" (")[0],
    subRole: newSubRole,
  };

  state.currentApprovers.push(newApprover);
  renderCurrentApprovers();
  populateNewApproversDropdown();

  // Clear the input fields
  document.getElementById("newApproversDropdown").value = "";
  document.getElementById("newApproverSubRole").value = "";
};

// Add function to render current files
const renderCurrentFiles = (files, docId) => {
  const currentFilesList = document.getElementById("currentFilesList");
  if (!files || files.length === 0) {
    currentFilesList.innerHTML =
      '<p class="text-muted">Không có tệp tin nào</p>';
    return;
  }

  currentFilesList.innerHTML = files
    .map(
      (file) => `
    <div class="file-item" data-file-id="${file._id || file.driveFileId}">
      <i class="fas fa-paperclip file-icon"></i>
      <a href="${file.link}" class="file-link" target="_blank">${file.name}</a>
      <button type="button" class="btn btn-danger btn-sm" 
              onclick="removeCurrentFile('${
                file._id || file.driveFileId
              }', '${docId}')">
        <i class="fas fa-trash"></i> Xóa
      </button>
    </div>
  `
    )
    .join("");
};

// Add function to remove current file
const removeCurrentFile = async (fileId, docId) => {
  if (!confirm("Bạn có chắc chắn muốn xóa tệp tin này?")) {
    return;
  }

  try {
    const response = await fetch(
      `/deletePurchasingDocumentFile/${docId}/${fileId}`,
      {
        method: "POST",
      }
    );

    const result = await response.json();

    if (result.success) {
      // Remove from UI
      const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
      if (fileItem) {
        fileItem.remove();
      }
      showMessage("Tệp tin đã được xóa thành công.");

      // Update the file count display if needed
      if (result.remainingFiles === 0) {
        document.getElementById("currentFilesList").innerHTML =
          '<p class="text-muted">Không có tệp tin nào</p>';
      }
    } else {
      showMessage("Lỗi khi xóa tệp tin: " + result.message, true);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    showMessage("Lỗi khi xóa tệp tin", true);
  }
};

// Update the editDocument function to show current proposals
const editDocument = async (docId) => {
  try {
    // Load cost centers first
    const costCenterResponse = await fetch("/costCenters");
    state.costCenters = await costCenterResponse.json();

    const response = await fetch(`/getPurchasingDocument/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name;

    await populateCostCenterDropdownForEditing();
    document.getElementById("editCostCenter").value = doc.costCenter;

    await populateGroupDropdownForEditing();
    document.getElementById("editGroupName").value = doc.groupName;

    // Clear and repopulate products
    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";
    doc.products.forEach((product) => addProductField(product));

    // Show current files - PASS THE DOC ID
    renderCurrentFiles(doc.fileMetadata, docId);

    // Populate current appended proposals
    state.currentAppendedProposals = doc.appendedProposals || [];
    renderCurrentAppendedProposals();

    // Fetch and populate available proposals
    await fetchAvailableProposals();

    // Populate current approvers
    state.currentApprovers = doc.approvers;
    renderCurrentApprovers();

    // Populate new approvers dropdown
    await populateNewApproversDropdown();

    document.getElementById("editModal").style.display = "block";
  } catch (err) {
    console.error("Error fetching document details:", err);
    showMessage("Error loading document details", true);
  }
};

const closeEditModal = () => {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("editForm").reset();
  document.getElementById("productsList").innerHTML = "";
  state.currentAppendedProposals = [];
  state.currentApprovers = [];
};

const handleEditSubmit = async (event) => {
  event.preventDefault();

  if (!validateProductFields()) {
    return;
  }

  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  // Add basic fields
  formData.append("name", document.getElementById("editName").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value
  );
  formData.append("groupName", document.getElementById("editGroupName").value);

  // Get all products
  const products = [];
  const productItems = document.querySelectorAll(".product-item");

  productItems.forEach((item) => {
    const productSelect = item.querySelector(".product-select");
    const costCenterSelect = item.querySelector(".product-cost-center");

    // Get all input elements (not including selects)
    const inputs = item.querySelectorAll(
      'input[type="number"], input[type="text"]'
    );

    // Handle product name from select or input
    let productName = "";
    if (productSelect && productSelect.tagName === "SELECT") {
      // Get value from Choices.js instance or directly from select
      const choicesInstance = productSelect._choices;
      productName = choicesInstance
        ? choicesInstance.getValue(true)
        : productSelect.value;
    } else {
      // Fallback to first input if dropdown failed to load
      const nameInput = item.querySelector('input[type="text"]:first-of-type');
      if (nameInput) {
        productName = nameInput.value;
      }
    }

    if (!productName) {
      return; // Skip this product if no name
    }

    // Now we need to find the correct inputs
    // If we have a select, inputs are: cost, amount, vat, note
    // If we have text input for name, inputs are: name, cost, amount, vat, note
    const hasSelect = productSelect && productSelect.tagName === "SELECT";

    let costPerUnit, amount, vat, note;

    if (hasSelect) {
      // With select: inputs[0]=cost, inputs[1]=amount, inputs[2]=vat, inputs[3]=note
      costPerUnit = parseFloat(inputs[0]?.value) || 0;
      amount = parseFloat(inputs[1]?.value) || 0;
      vat = parseFloat(inputs[2]?.value) || 0;
      note = inputs[3]?.value || "";
    } else {
      // With text input: inputs[0]=name, inputs[1]=cost, inputs[2]=amount, inputs[3]=vat, inputs[4]=note
      costPerUnit = parseFloat(inputs[1]?.value) || 0;
      amount = parseFloat(inputs[2]?.value) || 0;
      vat = parseFloat(inputs[3]?.value) || 0;
      note = inputs[4]?.value || "";
    }

    const product = {
      productName: productName,
      costPerUnit: costPerUnit,
      amount: amount,
      vat: vat,
      totalCost: costPerUnit * amount,
      totalCostAfterVat:
        costPerUnit * amount + costPerUnit * amount * (vat / 100),
      costCenter: costCenterSelect ? costCenterSelect.value : "",
      note: note,
    };
    products.push(product);
  });

  formData.append("products", JSON.stringify(products));

  // Calculate grand total
  const grandTotalCost = products.reduce(
    (sum, product) => sum + product.totalCostAfterVat,
    0
  );
  formData.append("grandTotalCost", grandTotalCost);

  // Add approvers
  formData.append("approvers", JSON.stringify(state.currentApprovers));

  // Add appended proposals
  formData.append(
    "appendedProposals",
    JSON.stringify(state.currentAppendedProposals)
  );

  // Add removed file IDs if any
  if (window.removedFileIds && window.removedFileIds.size > 0) {
    formData.append(
      "removedFileIds",
      JSON.stringify(Array.from(window.removedFileIds))
    );
  }

  // Add files
  const fileInput = document.getElementById("editFiles");
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }
  }

  try {
    const response = await fetch(`/updatePurchasingDocument/${docId}`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (response.ok) {
      showMessage("Phiếu cập nhật thành công.");
      closeEditModal();
      fetchPurchasingDocuments();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  }
};

// Documents containing purchasing
const showDocumentsContainingPurchasing = async (purchasingId) => {
  try {
    const response = await fetch(
      `/documentsContainingPurchasing/${purchasingId}`
    );
    const data = await response.json();

    if (data.success) {
      const modalHTML = `
        <div id="containingDocsModal" class="modal" style="display: block;">
          <div class="modal-content">
            <span class="modal-close" onclick="closeContainingDocsModal()">&times;</span>
            <h2 class="modal-title"><i class="fas fa-link"></i> Phiếu liên quan</h2>
            <div class="modal-body">
              <div class="related-docs-section">
                <h3><i class="fas fa-money-bill-wave"></i> Thanh toán</h3>
                ${
                  data.paymentDocuments.length > 0
                    ? renderPaymentDocuments(data.paymentDocuments)
                    : "<p>Không có phiếu thanh toán nào liên quan</p>"
                }
              </div>
              
              <div class="related-docs-section">
                <h3><i class="fas fa-hand-holding-usd"></i> Tạm ứng</h3>
                ${
                  data.advancePaymentDocuments.length > 0
                    ? renderAdvancePaymentDocuments(
                        data.advancePaymentDocuments
                      )
                    : "<p>Không có phiếu tạm ứng nào liên quan</p>"
                }
              </div>
              
              <div class="related-docs-section">
                <h3><i class="fas fa-exchange-alt"></i> Thu hồi tạm ứng</h3>
                ${
                  data.advancePaymentReclaimDocuments.length > 0
                    ? renderAdvancePaymentReclaimDocuments(
                        data.advancePaymentReclaimDocuments
                      )
                    : "<p>Không có phiếu thu hồi tạm ứng nào liên quan</p>"
                }
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHTML);
    } else {
      showMessage("Error fetching related documents", true);
    }
  } catch (error) {
    console.error("Error fetching related documents:", error);
    showMessage("Error fetching related documents", true);
  }
};

const renderPaymentDocuments = (paymentDocs) => {
  if (!paymentDocs || paymentDocs.length === 0) return "-";

  return `
    <div class="documents-container">
      ${paymentDocs
        .map(
          (doc) => `
          <div class="document-card">
            <h4>${doc.title || "Payment Document"}</h4>
            <div class="document-details">
              <div><strong>Tem:</strong> ${doc.tag}</div>
              <div><strong>Tên:</strong> ${doc.name}</div>
              <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
              <div><strong>Phương thức thanh toán:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Tổng thanh toán:</strong> ${
                doc.totalPayment?.toLocaleString() || "-"
              }</div>
              <div><strong>Tạm ứng:</strong> ${
                doc.advancePayment?.toLocaleString() || "-"
              }</div>
              <div><strong>Hạn thanh toán:</strong> ${doc.paymentDeadline}</div>
              <div><strong>Tệp tin:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng:</strong> ${renderStatus(
                doc.status
              )}</div>
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
};

const renderAdvancePaymentDocuments = (advancePaymentDocs) => {
  if (!advancePaymentDocs || advancePaymentDocs.length === 0) return "-";

  return `
    <div class="documents-container">
      ${advancePaymentDocs
        .map(
          (doc) => `
          <div class="document-card">
            <h4>Phiếu tạm ứng</h4>
            <div class="document-details">
              <div><strong>Tem:</strong> ${doc.tag}</div>
              <div><strong>Tên:</strong> ${doc.name}</div>
              <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
              <div><strong>Phương thức thanh toán:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Tạm ứng:</strong> ${
                doc.advancePayment?.toLocaleString() || "-"
              }</div>
              <div><strong>Hạn thanh toán:</strong> ${doc.paymentDeadline}</div>
              <div><strong>Tệp tin:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng:</strong> ${renderStatus(
                doc.status
              )}</div>
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
};

const renderAdvancePaymentReclaimDocuments = (reclaimDocs) => {
  if (!reclaimDocs || reclaimDocs.length === 0) return "-";

  return `
    <div class="documents-container">
      ${reclaimDocs
        .map(
          (doc) => `
          <div class="document-card">
            <h4>Phiếu thu hồi tạm ứng</h4>
            <div class="document-details">
              <div><strong>Tem:</strong> ${doc.tag}</div>
              <div><strong>Tên:</strong> ${doc.name}</div>
              <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
              <div><strong>Phương thức thanh toán:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Thu hồi tạm ứng:</strong> ${
                doc.advancePaymentReclaim?.toLocaleString() || "-"
              }</div>
              <div><strong>Hạn thanh toán:</strong> ${doc.paymentDeadline}</div>
              <div><strong>Tệp tin:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng:</strong> ${renderStatus(
                doc.status
              )}</div>
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
};

const closeContainingDocsModal = () => {
  const modal = document.getElementById("containingDocsModal");
  if (modal) {
    modal.remove();
  }
};

const formatCurrency = (amount) => {
  return amount?.toLocaleString() || "-";
};

// Export functions
const exportSelectedToExcel = () => {
  const selectedDocs = Array.from(state.selectedDocuments);

  if (selectedDocs.length === 0) {
    showMessage("Xin hãy chọn ít nhất một phiếu để xuất.", true);
    return;
  }

  try {
    const documentsToExport = state.purchasingDocuments.filter((doc) =>
      selectedDocs.includes(doc._id)
    );

    const wb = XLSX.utils.book_new();
    const detailedData = [];

    documentsToExport.forEach((doc, docIndex) => {
      // Document header
      detailedData.push({
        STT: docIndex + 1,
        "Tên phiếu": doc.name || "Không có",
        Trạm: doc.costCenter || "Không có",
        "Ngày nộp": doc.submissionDate || "Không có",
        "Tên sản phẩm": "",
        "Trạm sản phẩm": "",
        "Số lượng": "",
        "Giá trước VAT": "",
        "Tổng trước VAT": "", // Will be calculated below
        "VAT (%)": "",
        "Giá sau VAT": "",
        "Tổng sau VAT": doc.grandTotalCost || 0,
        "Ghi chú": "",
        "Tình trạng":
          doc.status === "Approved"
            ? "Đã phê duyệt"
            : doc.status === "Suspended"
            ? "Từ chối"
            : "Chưa phê duyệt",
        "Kê khai": doc.declaration || "Không có",
        "Lý do từ chối": doc.suspendReason || "Không có",
        "Tệp đính kèm": doc.fileMetadata ? doc.fileMetadata.name : "Không có",
        "Link tệp": doc.fileMetadata ? doc.fileMetadata.link : "",
        "Người nộp": doc.submittedBy?.username || "Không rõ",
        "Người phê duyệt":
          doc.approvedBy.map((a) => a.username).join(", ") || "Chưa có",
      });

      // Products section
      let documentTotalBeforeVAT = 0;

      if (doc.products?.length) {
        doc.products.forEach((product, productIndex) => {
          const costBeforeVAT = product.costPerUnit || 0;
          const vatPercentage = product.vat || 0;
          const costAfterVAT = costBeforeVAT * (1 + vatPercentage / 100);
          const amount = product.amount || 0;
          const totalBeforeVAT = costBeforeVAT * amount;
          const totalAfterVAT = costAfterVAT * amount;

          documentTotalBeforeVAT += totalBeforeVAT;

          detailedData.push({
            STT: `SP${productIndex + 1}`,
            "Tên phiếu": "",
            Trạm: "",
            "Ngày nộp": "",
            "Tên sản phẩm": product.productName || "",
            "Trạm sản phẩm": product.costCenter || "",
            "Số lượng": amount,
            "Giá trước VAT": costBeforeVAT,
            "Tổng trước VAT": totalBeforeVAT,
            "VAT (%)": vatPercentage,
            "Giá sau VAT": costAfterVAT,
            "Tổng sau VAT": totalAfterVAT,
            "Ghi chú": product.note || "",
            "Tình trạng": "",
            "Kê khai": "",
            "Lý do từ chối": "",
            "Tệp đính kèm": "",
            "Link tệp": "",
            "Người nộp": "",
            "Người phê duyệt": "",
          });
        });

        // Update document header with calculated total before VAT
        detailedData[detailedData.length - doc.products.length - 1][
          "Tổng trước VAT"
        ] = documentTotalBeforeVAT;
      } else {
        detailedData.push({
          STT: "",
          "Tên phiếu": "",
          Trạm: "",
          "Ngày nộp": "",
          "Tên sản phẩm": "Không có sản phẩm",
          "Trạm sản phẩm": "",
          "Số lượng": "",
          "Giá trước VAT": "",
          "Tổng trước VAT": "",
          "VAT (%)": "",
          "Giá sau VAT": "",
          "Tổng sau VAT": "",
          "Ghi chú": "",
          "Tình trạng": "",
          "Kê khai": "",
          "Lý do từ chối": "",
          "Tệp đính kèm": "",
          "Link tệp": "",
          "Người nộp": "",
          "Người phê duyệt": "",
        });
      }

      // Add empty row as separator
      detailedData.push({});
    });

    const detailedWs = XLSX.utils.json_to_sheet(detailedData);

    // Calculate optimal column widths based on actual content
    const sheetRange = XLSX.utils.decode_range(detailedWs["!ref"]);
    const colWidths = [];

    // Initialize with minimum widths for headers
    const headers = Object.keys(detailedData[0] || {});
    headers.forEach((header, colIndex) => {
      colWidths[colIndex] = Math.max(header.length, 8); // Minimum 8 characters
    });

    // Check all data rows to find maximum content length per column
    for (let rowNum = sheetRange.s.r; rowNum <= sheetRange.e.r; rowNum++) {
      for (let colNum = sheetRange.s.c; colNum <= sheetRange.e.c; colNum++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = detailedWs[cellRef];

        if (cell && cell.v) {
          const cellValue = String(cell.v);
          const cellLength = cellValue.length;

          // For Vietnamese text, add extra width as characters may be wider
          const adjustedLength =
            /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
              cellValue
            )
              ? Math.ceil(cellLength * 1.1)
              : cellLength;

          colWidths[colNum] = Math.max(colWidths[colNum] || 0, adjustedLength);
        }
      }
    }

    // Set maximum reasonable width to prevent extremely wide columns
    detailedWs["!cols"] = colWidths.map((width) => ({
      wch: Math.min(width + 2, 100), // Add 2 for padding, max 100 characters
    }));

    // Set row heights for better visibility
    detailedWs["!rows"] = [];

    for (let rowNum = sheetRange.s.r; rowNum <= sheetRange.e.r; rowNum++) {
      // Check if this is a document header row (has numeric STT)
      const sttCell = detailedWs[XLSX.utils.encode_cell({ r: rowNum, c: 0 })];
      const isDocumentHeader = sttCell && typeof sttCell.v === "number";

      // Check if this is an empty separator row
      const isEmptyRow = !sttCell || sttCell.v === "";

      if (isDocumentHeader) {
        // Document header rows - taller for prominence
        detailedWs["!rows"][rowNum] = { hpt: 25 };
      } else if (isEmptyRow) {
        // Separator rows - smaller height
        detailedWs["!rows"][rowNum] = { hpt: 8 };
      } else {
        // Product rows - standard height
        detailedWs["!rows"][rowNum] = { hpt: 20 };
      }
    }

    // Auto-wrap text for better readability in cells with long content
    const wrapTextColumns = [1, 7, 8, 9, 10, 20]; // Columns with potentially long text

    for (let rowNum = sheetRange.s.r; rowNum <= sheetRange.e.r; rowNum++) {
      wrapTextColumns.forEach((colNum) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        if (detailedWs[cellRef]) {
          if (!detailedWs[cellRef].s) detailedWs[cellRef].s = {};
          detailedWs[cellRef].s.alignment = { wrapText: true, vertical: "top" };
        }
      });
    }

    // Add freeze panes to keep headers visible
    detailedWs["!freeze"] = { xSplit: 1, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, detailedWs, "Chi tiết đầy đủ");

    XLSX.writeFile(
      wb,
      `Bao_cao_phieu_mua_hang_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    showMessage(`Đã xuất ${selectedDocs.length} phiếu mua hàng.`);
  } catch (err) {
    console.error("Error exporting documents:", err);
    showMessage("Lỗi khi xuất dữ liệu: " + err.message, true);
  }
};

const updateDocumentSelection = (checkbox) => {
  const docId = checkbox.dataset.docId;
  if (checkbox.checked) {
    state.selectedDocuments.add(docId);
  } else {
    state.selectedDocuments.delete(docId);
  }
};

const toggleSelectAll = () => {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".doc-checkbox");

  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
    updateDocumentSelection(checkbox);
  });
};

const updateSelectAllCheckbox = () => {
  const checkboxes = document.querySelectorAll(".doc-checkbox");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.disabled = true;
    return;
  }

  selectAllCheckbox.disabled = false;
  const allChecked = Array.from(checkboxes).every(
    (checkbox) => checkbox.checked
  );
  selectAllCheckbox.checked = allChecked;
};

// Event listeners
const setupEventListeners = () => {
  // Toggle switches
  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    state.showOnlyPendingApprovals = e.target.checked;
    state.currentPage = 1;
    fetchPurchasingDocuments();
  });

  document.getElementById("paginationToggle").addEventListener("change", () => {
    state.paginationEnabled =
      document.getElementById("paginationToggle").checked;
    state.currentPage = 1;
    fetchPurchasingDocuments();
  });

  document.getElementById("nameFilter").addEventListener("input", (e) => {
    state.nameFilter = e.target.value.trim().toLowerCase();
    state.currentPage = 1;
    fetchPurchasingDocuments();
  });

  document
    .getElementById("groupFilter")
    .addEventListener("change", filterByGroup);

  document.addEventListener("keypress", (e) => {
    if (e.target.id === "pageInput" && e.key === "Enter") {
      goToPage();
    }
  });

  // Export and selection
  document
    .getElementById("exportSelectedBtn")
    .addEventListener("click", () => exportSelectedToExcel());
  document
    .getElementById("selectAllCheckbox")
    .addEventListener("change", () => toggleSelectAll());

  // Table checkboxes
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("doc-checkbox")) {
      updateDocumentSelection(e.target);
      updateSelectAllCheckbox();
    }
  });

  document.getElementById("suspendForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleSuspendSubmit(e);
  });

  document
    .querySelector("#fullViewModal .modal-close")
    .addEventListener("click", () => {
      closeFullViewModal();
    });

  // Suspend Modal close button
  document
    .querySelector("#suspendModal .modal-close")
    .addEventListener("click", () => {
      closeSuspendModal();
    });
};

// Initialize the application
const initialize = async () => {
  await fetchCurrentUser();
  setupEventListeners();
  await populateCostCenterMultiSelect(); // Replace populateCostCenterFilter
  initializeMultiSelect(); // Initialize multi-select functionality
  await populateGroupFilter();
  await fetchPurchasingDocuments();
  addEditModal();
};

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initialize);
