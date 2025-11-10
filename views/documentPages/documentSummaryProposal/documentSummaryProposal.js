// views/documentPages/documentSummaryProposal/documentSummaryProposal.js
// State management
const state = {
  currentUser: null,
  proposalDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  paginationEnabled: true,
  selectedDocuments: new Set(),
  currentEditDoc: null,
  taskFilter: "",
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
  fetchProposalDocuments();
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

// Data fetching
const fetchCurrentUser = async () => {
  try {
    const response = await fetch("/getCurrentUser");
    state.currentUser = await response.json();
  } catch (error) {
    console.error("Error fetching current user:", error);
  }
};

const fetchProposalDocuments = async () => {
  showLoading(true);

  try {
    const response = await fetch("/getProposalDocumentForSeparatedView");
    const data = await response.json();
    state.proposalDocuments = data.proposalDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(
      state.proposalDocuments
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
    console.error("Error fetching proposal documents:", err);
    showMessage("Error fetching proposal documents", true);
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

  // Apply task filter if there's a search term
  if (state.taskFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.task?.toLowerCase().includes(state.taskFilter)
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
  fetchProposalDocuments();
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

// Helper function to render multiple files
const renderFilesList = (fileMetadata) => {
  if (!fileMetadata || fileMetadata.length === 0) {
    return "-";
  }

  return `
    <div class="files-container">
      ${fileMetadata
        .map(
          (file) => `
          <div class="file-item">
            <a href="${file.link}" class="file-link" target="_blank" title="${
            file.name
          }">
              ${file.name}
            </a>
            ${file.size ? `<span class="file-size">${file.size}</span>` : ""}
          </div>
        `
        )
        .join("")}
    </div>
  `;
};

// Rendering functions
const renderDocumentsTable = (documents) => {
  const tableBody = document
    .getElementById("proposalDocumentsTable")
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

    // Render multiple files
    const filesHtml = renderFilesList(doc.fileMetadata);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="doc-checkbox" data-doc-id="${
        doc._id
      }" ${state.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
      <td>${doc.task || ""} 
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
      <td>${doc.costCenter || ""}</td>
      <td>${doc.groupName || ""}</td>
      <td>${doc.dateOfError || ""}</td>
      <td>${doc.detailsDescription || ""}</td>
      <td>${doc.direction || ""}</td>
      <td>${filesHtml}</td>
      <td>${doc.submissionDate || ""}</td>
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
              : doc.status === "Suspended"
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
          <button class="btn btn-secondary btn-sm" onclick="showDocumentsContainingProposal('${
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
    fetchProposalDocuments();
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
      fetchProposalDocuments();
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
      fetchProposalDocuments();
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
    const response = await fetch(`/suspendProposalDocument/${docId}`, {
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
      fetchProposalDocuments();
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
    const response = await fetch(`/openProposalDocument/${docId}`, {
      method: "POST",
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchProposalDocuments();
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

  const doc = state.proposalDocuments.find((d) => d._id === docId);
  if (!doc) return;

  // Create a fresh modal
  const modalHTML = `
    <div id="declarationModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeDeclarationModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Kê Khai - ${
          doc.task || doc._id
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
      `/updateProposalDocumentDeclaration/${docId}`,
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
      const docIndex = state.proposalDocuments.findIndex(
        (d) => d._id === docId
      );
      if (docIndex !== -1) {
        state.proposalDocuments[docIndex].declaration = declaration;
      }
      fetchProposalDocuments(); // Refresh the view
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
    const doc = state.proposalDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");

    // Format date strings
    const submissionDate = doc.submissionDate || "Không có";

    // Render multiple files for full view
    const filesHtml = renderFullViewFiles(doc.fileMetadata);

    fullViewContent.innerHTML = `
      <!-- Basic Information Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-info-circle"></i> Thông tin cơ bản</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Công việc:</span>
            <span class="detail-value">${doc.task}</span>
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
            <span class="detail-label">Ngày lỗi:</span>
            <span class="detail-value">${doc.dateOfError || "Không có"}</span>
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
          <div class="detail-item">
            <span class="detail-label">Số lượng tệp tin:</span>
            <span class="detail-value">${doc.fileMetadata?.length || 0}</span>
          </div>
        </div>
      </div>
      
      <!-- Description Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-align-left"></i> Mô tả chi tiết</h3>
        <p>${doc.detailsDescription || "Không có mô tả"}</p>
      </div>
      
      <!-- Direction Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-directions"></i> Hướng xử lý</h3>
        <p>${doc.direction || "Không có hướng xử lý"}</p>
      </div>
      
      <!-- File Attachment Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-paperclip"></i> Tệp tin kèm theo (${
          doc.fileMetadata?.length || 0
        })</h3>
        ${filesHtml}
      </div>
      
      <!-- Status Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-tasks"></i> Trạng thái</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tình trạng:</span>
            <span class="detail-value">${renderStatus(doc.status)}</span>
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

// Helper function to render files in full view
const renderFullViewFiles = (fileMetadata) => {
  if (!fileMetadata || fileMetadata.length === 0) {
    return "Không có tệp tin đính kèm";
  }

  return `
    <div class="full-view-files">
      ${fileMetadata
        .map(
          (file) => `
        <div class="file-item">
          <a href="${file.link}" class="file-link" target="_blank">
            <i class="fas fa-file"></i> ${file.name}
          </a>
          ${file.size ? `<span class="file-size">${file.size}</span>` : ""}
          <div class="file-actions">
            <a href="${
              file.link
            }" class="btn btn-sm" target="_blank" title="Tải xuống">
              <i class="fas fa-download"></i>
            </a>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
};

// Function to show all files in a modal
const showAllFiles = (event, filesJson) => {
  event.stopPropagation();

  try {
    const files = JSON.parse(filesJson);

    const modalHTML = `
      <div id="filesModal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="modal-close" onclick="closeFilesModal()">&times;</span>
          <h2 class="modal-title"><i class="fas fa-files"></i> Tất cả tệp tin</h2>
          <div class="modal-body">
            <div class="modal-file-list">
              ${files
                .map(
                  (file) => `
                <div class="file-item">
                  <a href="${file.link}" class="file-link" target="_blank">
                    <i class="fas fa-file"></i> ${file.name}
                  </a>
                  ${
                    file.size
                      ? `<span class="file-size">${file.size}</span>`
                      : ""
                  }
                  <div class="file-actions">
                    <a href="${
                      file.link
                    }" class="btn btn-sm" target="_blank" title="Tải xuống">
                      <i class="fas fa-download"></i>
                    </a>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
  } catch (error) {
    console.error("Error showing files modal:", error);
    showMessage("Error loading files", true);
  }
};

const closeFilesModal = () => {
  const modal = document.getElementById("filesModal");
  if (modal) {
    modal.remove();
  }
};

const closeFullViewModal = () => {
  document.getElementById("fullViewModal").style.display = "none";
};

// Edit Document Functions
const addEditModal = () => {
  const modalHTML = `
    <div id="editModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeEditModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Chỉnh sửa phiếu đề xuất</h2>
        <div class="modal-body">
          <form id="editForm" onsubmit="handleEditSubmit(event)" class="modal-form" enctype="multipart/form-data">
            <input type="hidden" id="editDocId">
            
            <!-- Basic Fields -->
            <div class="form-group">
              <label for="editTask" class="form-label">Công việc:</label>
              <input type="text" id="editTask" required class="form-input">
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
              <label for="editDateOfError" class="form-label">Ngày lỗi:</label>
              <input type="text" id="editDateOfError" required class="form-input">
            </div>
            
            <div class="form-group">
              <label for="editDetailsDescription" class="form-label">Mô tả chi tiết:</label>
              <textarea id="editDetailsDescription" required class="form-textarea"></textarea>
            </div>
            
            <div class="form-group">
              <label for="editDirection" class="form-label">Hướng xử lý:</label>
              <textarea id="editDirection" required class="form-textarea"></textarea>
            </div>
            
            <!-- Current Files Section -->
            <div class="form-group">
              <label class="form-label">Tệp tin hiện tại:</label>
              <div id="currentFilesList" class="files-list"></div>
            </div>
            
            <!-- New Files Section -->
            <div class="form-group">
              <label for="editFiles" class="form-label">Thêm tệp tin mới:</label>
              <input type="file" id="editFiles" class="form-input" multiple>
              <small class="form-text">Có thể chọn nhiều tệp tin (tối đa 10 tệp)</small>
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

// Add function to render current files in edit modal
const renderCurrentFiles = (fileMetadata) => {
  const currentFilesList = document.getElementById("currentFilesList");

  if (!fileMetadata || fileMetadata.length === 0) {
    currentFilesList.innerHTML = "<p>Không có tệp tin nào</p>";
    return;
  }

  currentFilesList.innerHTML = fileMetadata
    .map((file) => {
      const fileId = file._id || file.driveFileId;
      return `
      <div class="file-item" data-file-id="${fileId}">
        <div class="file-info">
          <a href="${file.link}" class="file-link" target="_blank">
            <i class="fas fa-file"></i> ${file.name}
          </a>
          ${file.size ? `<span class="file-size">${file.size}</span>` : ""}
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeCurrentFile('${fileId}')">
          <i class="fas fa-trash"></i> Xóa
        </button>
      </div>
    `;
    })
    .join("");
};

// Add function to handle file removal
const removeCurrentFile = async (fileId) => {
  if (!confirm("Bạn có chắc chắn muốn xóa tệp tin này?")) {
    return;
  }

  const docId = document.getElementById("editDocId").value;

  try {
    const response = await fetch(
      `/deleteProposalDocumentFile/${docId}/${fileId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      // Remove from UI
      const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
      if (fileElement) {
        fileElement.remove();
      }

      // Update state
      if (state.currentEditDoc && state.currentEditDoc.fileMetadata) {
        state.currentEditDoc.fileMetadata =
          state.currentEditDoc.fileMetadata.filter(
            (file) => (file._id || file.driveFileId) !== fileId
          );
      }

      showMessage("Tệp tin đã được xóa thành công");

      // Update file count display if needed
      const remainingFiles = document.querySelectorAll(
        "#currentFilesList .file-item"
      ).length;
      if (remainingFiles === 0) {
        document.getElementById("currentFilesList").innerHTML =
          "<p>Không có tệp tin nào</p>";
      }
    } else {
      showMessage("Lỗi khi xóa tệp tin: " + result.message, true);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    showMessage("Lỗi khi xóa tệp tin", true);
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

const editDocument = async (docId) => {
  try {
    const response = await fetch(`/getProposalDocument/${docId}`);
    const doc = await response.json();

    // Store the current document in state
    state.currentEditDoc = doc;

    // Ensure files have proper IDs
    if (doc.fileMetadata) {
      doc.fileMetadata = doc.fileMetadata.map((file) => ({
        ...file,
        // Ensure each file has an ID
        _id:
          file._id ||
          file.driveFileId ||
          `temp-${Math.random().toString(36).substr(2, 9)}`,
      }));
    }

    document.getElementById("editDocId").value = docId;
    document.getElementById("editTask").value = doc.task;
    document.getElementById("editDateOfError").value = doc.dateOfError;
    document.getElementById("editDetailsDescription").value =
      doc.detailsDescription;
    document.getElementById("editDirection").value = doc.direction;

    await populateCostCenterDropdownForEditing();
    document.getElementById("editCostCenter").value = doc.costCenter;

    await populateGroupDropdownForEditing();
    document.getElementById("editGroupName").value = doc.groupName;

    // Populate current files
    renderCurrentFiles(doc.fileMetadata);

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
};

const handleEditSubmit = async (event) => {
  event.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  // Add basic fields
  formData.append("task", document.getElementById("editTask").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value
  );
  formData.append("groupName", document.getElementById("editGroupName").value);
  formData.append(
    "dateOfError",
    document.getElementById("editDateOfError").value
  );
  formData.append(
    "detailsDescription",
    document.getElementById("editDetailsDescription").value
  );
  formData.append("direction", document.getElementById("editDirection").value);

  // Add files - handle multiple files
  const filesInput = document.getElementById("editFiles");
  if (filesInput.files.length > 0) {
    for (let i = 0; i < filesInput.files.length; i++) {
      formData.append("files", filesInput.files[i]);
    }
  }

  // Add approvers
  formData.append("approvers", JSON.stringify(state.currentApprovers));

  try {
    showLoading(true);
    const response = await fetch(`/updateProposalDocument/${docId}`, {
      method: "POST",
      body: formData,
    });

    // Handle both JSON and text responses
    let result;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch {
        result = { message: text };
      }
    }

    if (response.ok) {
      showMessage("Phiếu cập nhật thành công.");
      closeEditModal();
      fetchProposalDocuments();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  } finally {
    showLoading(false);
  }
};

// Documents containing proposal
const showDocumentsContainingProposal = async (proposalId) => {
  try {
    const response = await fetch(`/documentsContainingProposal/${proposalId}`);
    const data = await response.json();

    if (data.success) {
      const modalHTML = `
        <div id="containingDocsModal" class="modal" style="display: block;">
          <div class="modal-content">
            <span class="modal-close" onclick="closeContainingDocsModal()">&times;</span>
            <h2 class="modal-title"><i class="fas fa-link"></i> Phiếu liên quan</h2>
            <div class="modal-body">
              <div class="related-docs-section">
                <h3><i class="fas fa-money-bill-wave"></i> Phiếu mua hàng</h3>
                ${
                  data.purchasingDocuments.length > 0
                    ? renderPurchasingDocuments(data.purchasingDocuments)
                    : "<p>Không có phiếu mua hàng nào liên quan</p>"
                }
              </div>
              
              <div class="related-docs-section">
                <h3><i class="fas fa-truck"></i> Phiếu xuất kho</h3>
                ${
                  data.deliveryDocuments.length > 0
                    ? renderDeliveryDocuments(data.deliveryDocuments)
                    : "<p>Không có phiếu xuất kho nào liên quan</p>"
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

const renderPurchasingDocuments = (purchasingDocs) => {
  if (!purchasingDocs || purchasingDocs.length === 0) return "-";

  return `
    <div class="documents-container">
      ${purchasingDocs
        .map(
          (doc) => `
          <div class="document-card">
            <h4>${doc.name || "Phiếu mua hàng"}</h4>
            <div class="document-details">
              <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
              <div><strong>Tổng chi phí:</strong> ${
                doc.grandTotalCost?.toLocaleString() || "-"
              }</div>
              <div><strong>Tệp tin:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng:</strong> ${renderStatus(
                doc.status
              )}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.open('/documentView/${
              doc._id
            }', '_blank')">
              Xem chi tiết
            </button>
          </div>
        `
        )
        .join("")}
    </div>
  `;
};

const renderDeliveryDocuments = (deliveryDocs) => {
  if (!deliveryDocs || deliveryDocs.length === 0) return "-";

  return `
    <div class="documents-container">
      ${deliveryDocs
        .map(
          (doc) => `
          <div class="document-card">
            <h4>${doc.name || "Phiếu xuất kho"}</h4>
            <div class="document-details">
              <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
              <div><strong>Tệp tin:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng:</strong> ${renderStatus(
                doc.status
              )}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.open('/documentView/${
              doc._id
            }', '_blank')">
              Xem chi tiết
            </button>
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

// Export functions
const exportSelectedToExcel = async () => {
  const selectedDocs = Array.from(state.selectedDocuments);

  if (selectedDocs.length === 0) {
    showMessage("Xin hãy chọn ít nhất một phiếu để xuất.", true);
    return;
  }

  try {
    // Show loading state
    const exportBtn = document.getElementById("exportSelectedBtn");
    const originalText = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xuất...';

    // Filter selected documents
    const docsToExport = state.proposalDocuments.filter((doc) =>
      selectedDocs.includes(doc._id)
    );

    // Prepare data for Excel
    const excelData = docsToExport.map((doc) => ({
      "Công việc": doc.task || "",
      Trạm: doc.costCenter || "",
      "Ngày lỗi": doc.dateOfError || "",
      "Mô tả chi tiết": doc.detailsDescription || "",
      "Hướng xử lý": doc.direction || "",
      "Tệp tin kèm theo": doc.fileMetadata?.map((f) => f.name).join(", ") || "",
      "Số lượng tệp": doc.fileMetadata?.length || 0,
      "Ngày nộp phiếu": doc.submissionDate || "",
      Nhóm: doc.groupName || "",
      "Tình trạng": doc.status || "",
      "Kê khai": doc.declaration || "",
      "Lý do từ chối": doc.suspendReason || "",
      "Người phê duyệt": doc.approvers
        .map((a) => `${a.username} (${a.subRole})`)
        .join(", "),
      "Người đã phê duyệt": doc.approvedBy
        .map((a) => `${a.username} (${a.approvalDate})`)
        .join(", "),
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Phiếu đề xuất");

    // Generate Excel file and trigger download
    const fileName = `Danh_sach_phieu_de_xuat_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showMessage(`Đã xuất ${selectedDocs.length} phiếu đề xuất ra file Excel`);
  } catch (err) {
    console.error("Error exporting documents:", err);
    showMessage("Lỗi khi xuất file Excel: " + err.message, true);
  } finally {
    // Reset button state
    const exportBtn = document.getElementById("exportSelectedBtn");
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML =
        '<i class="fas fa-file-excel"></i> Xuất đã chọn ra Excel';
    }
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
    fetchProposalDocuments();
  });

  document.getElementById("paginationToggle").addEventListener("change", () => {
    state.paginationEnabled =
      document.getElementById("paginationToggle").checked;
    state.currentPage = 1;
    fetchProposalDocuments();
  });

  document.getElementById("taskFilter").addEventListener("input", (e) => {
    state.taskFilter = e.target.value.trim().toLowerCase();
    state.currentPage = 1;
    fetchProposalDocuments();
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
  await fetchProposalDocuments();
  addEditModal();
};

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initialize);
