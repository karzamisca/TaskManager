// views/documentPages/documentSummaryPayment/documentSummaryPayment.js
// State management
const state = {
  currentUser: null,
  paymentDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  paginationEnabled: true,
  selectedDocuments: new Set(),
  currentEditDoc: null,
  currentGroupFilter: "",
  currentPaymentMethodFilter: "",
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

const formatCurrency = (amount) => {
  return amount?.toLocaleString() || "-";
};

const renderStatus = (status) => {
  switch (status) {
    case "Approved":
      return `<span class="status approved"><i class="fas fa-check-circle"></i> Đã thanh toán</span>`;
    case "Suspended":
      return `<span class="status suspended"><i class="fas fa-ban"></i> Từ chối</span>`;
    default:
      return `<span class="status pending"><i class="fas fa-clock"></i> Chưa phê duyệt</span>`;
  }
};

const renderPaymentMethod = (method) => {
  if (!method) return "-";
  return `<span class="payment-method">${method}</span>`;
};

const renderPaymentDetails = (doc) => {
  let html = `<div class="payment-details">`;

  if (doc.totalPayment) {
    html += `<span>Tổng thanh toán: <span class="payment-amount">${formatCurrency(
      doc.totalPayment
    )}</span></span>`;
  }

  if (doc.advancePayment) {
    html += `<span>Tạm ứng: <span class="payment-amount">${formatCurrency(
      doc.advancePayment
    )}</span></span>`;
  }

  if (doc.paymentDeadline) {
    html += `<span>Hạn trả: <span class="payment-deadline">${doc.paymentDeadline}</span></span>`;
  }

  if (doc.fileMetadata?.link) {
    html += `<a href="${doc.fileMetadata.link}" class="payment-file-link" target="_blank">
      <i class="fas fa-paperclip"></i> ${doc.fileMetadata.name}
    </a>`;
  }

  html += `</div>`;
  return html;
};

const renderApprovalStatus = (approvers, approvedBy) => {
  return approvers
    .map((approver) => {
      const hasApproved = approvedBy.find(
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

const fetchGroups = async () => {
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
    console.error("Error fetching groups:", error);
  }
};

const fetchPaymentDocuments = async () => {
  showLoading(true);

  try {
    const cacheBuster = `?_cache=${Date.now()}`;
    const response = await fetch(
      `/getPaymentDocumentForSeparatedView${cacheBuster}`,
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        credentials: "include", // if using cookies
      }
    );

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    state.paymentDocuments = data.paymentDocuments;

    // Preserve the currently selected payment method
    const paymentMethodFilter = document.getElementById("paymentMethodFilter");
    const currentlySelectedMethod = paymentMethodFilter.value;

    // Populate payment method filter
    const uniqueMethods = extractUniquePaymentMethods(state.paymentDocuments);

    // Clear existing options except the first one
    while (paymentMethodFilter.options.length > 1) {
      paymentMethodFilter.remove(1);
    }

    // Add new options
    uniqueMethods.forEach((method) => {
      const option = document.createElement("option");
      option.value = method;
      option.textContent = method;
      paymentMethodFilter.appendChild(option);
    });

    // Restore the selected value if it still exists in the options
    if (
      currentlySelectedMethod &&
      Array.from(paymentMethodFilter.options).some(
        (opt) => opt.value === currentlySelectedMethod
      )
    ) {
      paymentMethodFilter.value = currentlySelectedMethod;
      state.currentPaymentMethodFilter = currentlySelectedMethod;
    } else {
      // Reset to "All" if the previously selected method no longer exists
      paymentMethodFilter.value = "";
      state.currentPaymentMethodFilter = "";
    }

    const filteredDocuments = filterDocumentsForCurrentUser(
      state.paymentDocuments
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
    console.error("Error fetching payment documents:", err);
    showMessage("Error fetching payment documents", true);
  } finally {
    showLoading(false);
  }
};

const filterDocumentsForCurrentUser = (documents) => {
  let filteredDocs = [...documents];

  // Apply group filter if selected
  if (state.currentGroupFilter) {
    filteredDocs = filteredDocs.filter(
      (doc) => doc.groupName === state.currentGroupFilter
    );
  }

  // Apply payment method filter if selected
  if (state.currentPaymentMethodFilter) {
    filteredDocs = filteredDocs.filter(
      (doc) => doc.paymentMethod === state.currentPaymentMethodFilter
    );
  }

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

  return filteredDocs;
};

const extractUniquePaymentMethods = (documents) => {
  const methods = new Set();
  documents.forEach((doc) => {
    if (doc.paymentMethod) {
      methods.add(doc.paymentMethod);
    }
  });
  return Array.from(methods).sort();
};

const filterByPaymentMethod = () => {
  state.currentPaymentMethodFilter = document.getElementById(
    "paymentMethodFilter"
  ).value;
  state.currentPage = 1;

  // Instead of calling fetchPaymentDocuments(), just filter the existing data
  const filteredDocuments = filterDocumentsForCurrentUser(
    state.paymentDocuments
  );

  // Calculate total pages
  state.totalPages = Math.ceil(filteredDocuments.length / state.itemsPerPage);

  // Get documents for current page
  const startIndex = (state.currentPage - 1) * state.itemsPerPage;
  const endIndex = startIndex + state.itemsPerPage;
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
};

// Rendering functions
const renderDocumentsTable = (documents) => {
  const tableBody = document
    .getElementById("paymentDocumentsTable")
    .querySelector("tbody");
  tableBody.innerHTML = "";

  documents.forEach((doc) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="doc-checkbox" data-doc-id="${
        doc._id
      }" ${state.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
      <td>${doc.tag || "-"}</td>
      <td>
        <div>${doc.content || "-"}</div>
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
      <td>${renderPaymentMethod(doc.paymentMethod)}</td>
      <td>${formatCurrency(doc.totalPayment)}</td>
      <td>${doc.paymentDeadline || "-"}</td>
      <td>${renderStatus(doc.status)}</td>
      <td class="approval-status">${renderApprovalStatus(
        doc.approvers,
        doc.approvedBy
      )}</td>
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
                <button class="btn btn-danger btn-sm" onclick="suspendDocument('${doc._id}')">
                  <i class="fas fa-ban"></i> Từ chối
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
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });

  updateSelectAllCheckbox();
};

const updateSummary = (filteredDocuments) => {
  const summary = filteredDocuments.reduce(
    (acc, doc) => {
      if (doc.status === "Approved") {
        // If advance payment equals 0, then paid sum equals total payment
        if (doc.advancePayment === 0) {
          acc.paidSum += doc.totalPayment;
        }
        // If total payment equals 0, then paid sum equals advance payment
        else if (doc.totalPayment === 0) {
          acc.paidSum += doc.advancePayment;
        }
        // Otherwise, paid sum equals total payment minus advance payment
        else {
          acc.paidSum += doc.totalPayment - doc.advancePayment;
        }
        acc.approvedDocument += 1;
      }
      // Only one approver left
      else if (doc.approvers.length - doc.approvedBy.length === 1) {
        if (doc.advancePayment === 0) {
          acc.approvedSum += doc.totalPayment;
        }
        // If total payment equals 0, then approved sum equals advance payment
        else if (doc.totalPayment === 0) {
          acc.approvedSum += doc.advancePayment;
        }
        // Otherwise, approved sum equals total payment minus advance payment
        else {
          acc.approvedSum += doc.totalPayment - doc.advancePayment;
        }
        acc.unapprovedDocument += 1;
      }
      // More than one approver left
      else {
        if (doc.advancePayment === 0) {
          acc.unapprovedSum += doc.totalPayment;
        }
        // If total payment equals 0, then unapproved sum equals advance payment
        else if (doc.totalPayment === 0) {
          acc.unapprovedSum += doc.advancePayment;
        }
        // Otherwise, unapproved sum equals total payment minus advance payment
        else {
          acc.unapprovedSum += doc.totalPayment - doc.advancePayment;
        }
        acc.unapprovedDocument += 1;
      }
      return acc;
    },
    {
      paidSum: 0,
      approvedSum: 0,
      unapprovedSum: 0,
      approvedDocument: 0,
      unapprovedDocument: 0,
    }
  );

  // Update the summary display
  document.getElementById("paidSum").textContent = formatCurrency(
    summary.paidSum
  );
  document.getElementById("approvedSum").textContent = formatCurrency(
    summary.approvedSum
  );
  document.getElementById("unapprovedSum").textContent = formatCurrency(
    summary.unapprovedSum
  );
  document.getElementById("approvedDocument").textContent =
    summary.approvedDocument.toLocaleString();
  document.getElementById("unapprovedDocument").textContent =
    summary.unapprovedDocument.toLocaleString();
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
          Trang/Page ${state.currentPage} / ${state.totalPages}
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
    fetchPaymentDocuments();
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
      fetchPaymentDocuments();
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
      fetchPaymentDocuments();
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
    const response = await fetch(`/suspendDocument/${docId}`, {
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
      fetchPaymentDocuments();
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
    const response = await fetch(`/openDocument/${docId}`, {
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
    console.error("Error reopening document:", err);
    showMessage("Lỗi khi mở lại tài liệu.", true);
  }
};

const editDeclaration = (docId) => {
  const doc = state.paymentDocuments.find((d) => d._id === docId);
  if (!doc) return;

  // Create a modal for editing the declaration
  const modalHTML = `
    <div id="declarationModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeDeclarationModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Kê Khai</h2>
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
};

const closeDeclarationModal = () => {
  const modal = document.getElementById("declarationModal");
  if (modal) {
    modal.remove();
  }
};

const saveDeclaration = async (docId) => {
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
      fetchPaymentDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Error updating declaration", true);
  }
};

const openMassDeclarationModal = () => {
  if (state.selectedDocuments.size === 0) {
    showMessage("Xin hãy chọn ít nhất một phiếu để cập nhật kê khai.", true);
    return;
  }

  document.getElementById("massDeclarationModal").style.display = "block";
};

const closeMassDeclarationModal = () => {
  document.getElementById("massDeclarationModal").style.display = "none";
  document.getElementById("massDeclarationInput").value = "";
};

const handleMassDeclarationSubmit = async (event) => {
  event.preventDefault();
  const declaration = document.getElementById("massDeclarationInput").value;
  const selectedDocs = Array.from(state.selectedDocuments);

  try {
    const response = await fetch("/massUpdatePaymentDocumentDeclaration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentIds: selectedDocs, declaration }),
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      closeMassDeclarationModal();
      fetchPaymentDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating mass declaration:", err);
    showMessage("Error updating mass declaration", true);
  }
};

// Edit Document Functions
const editDocument = async (docId) => {
  try {
    const response = await fetch(`/getPaymentDocument/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name || "";
    document.getElementById("editContent").value = doc.content || "";
    document.getElementById("editPaymentMethod").value =
      doc.paymentMethod || "";
    document.getElementById("editTotalPayment").value = doc.totalPayment || "";
    document.getElementById("editDeadline").value = doc.paymentDeadline || "";

    await populateCostCenterDropdown();
    document.getElementById("editCostCenter").value = doc.costCenter || "";

    state.currentApprovers = doc.approvers;
    renderCurrentApprovers();
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

const populateCostCenterDropdown = async () => {
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
        <div class="approver-item" data-id="${approver.approver}">
          <span>${approver.username}</span>
          <input type="text" value="${approver.subRole}" 
                 onchange="updateApproverSubRole('${approver.approver}', this.value)" 
                 class="form-input" style="width: 120px;">
          <button type="button" class="btn btn-danger btn-sm" 
                  onclick="removeApprover('${approver.approver}')">
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
    (a) => a.approver !== approverId
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

const handleEditSubmit = async (event) => {
  event.preventDefault();
  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  // Add basic fields
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
  );
  formData.append(
    "paymentDeadline",
    document.getElementById("editDeadline").value
  );

  // Add approvers
  formData.append("approvers", JSON.stringify(state.currentApprovers));

  // Add file
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
      showMessage("Phiếu cập nhật thành công.");
      closeEditModal();
      fetchPaymentDocuments();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  }
};

// Full View Functions
const showFullView = async (docId) => {
  try {
    const doc = state.paymentDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");

    // Format date strings
    const submissionDate = doc.submissionDate || "Không có";
    const paymentDeadline = doc.paymentDeadline || "Không có";

    fullViewContent.innerHTML = `
      <!-- Basic Information Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-info-circle"></i> Thông tin cơ bản</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tem:</span>
            <span class="detail-value">${doc.tag || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tên:</span>
            <span class="detail-value">${doc.name || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tên nhóm:</span>
            <span class="detail-value">${doc.groupName || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ngày nộp:</span>
            <span class="detail-value">${submissionDate}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Hạn trả:</span>
            <span class="detail-value">${paymentDeadline}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Kê khai:</span>
            <span class="detail-value">${doc.declaration || "Không có"}</span>
          </div>
        </div>
      </div>
      
      <!-- Content Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-align-left"></i> Nội dung</h3>
        <p style="white-space: pre-wrap;">${
          doc.content || "No content provided"
        }</p>
      </div>
      
      <!-- Payment Information Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-money-bill-wave"></i> Thông tin thanh toán</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Phương thức thanh toán:</span>
            <span class="detail-value">${doc.paymentMethod || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tổng thanh toán:</span>
            <span class="detail-value">${formatCurrency(
              doc.totalPayment
            )}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tạm ứng:</span>
            <span class="detail-value">${formatCurrency(
              doc.advancePayment
            )}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Bù trừ:</span>
            <span class="detail-value">${
              doc.totalPayment && doc.advancePayment
                ? formatCurrency(doc.totalPayment - doc.advancePayment)
                : "Không có"
            }</span>
          </div>
        </div>
      </div>
      
      <!-- File Attachment Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-paperclip"></i> Tệp tin kèm theo</h3>
        ${
          doc.fileMetadata
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "Không có tệp tin đính kèm"
        }
      </div>
      
      <!-- Purchasing Documents Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-shopping-cart"></i> Phiếu mua hàng kèm theo</h3>
        ${
          doc.appendedPurchasingDocuments?.length
            ? renderPurchasingDocuments(doc.appendedPurchasingDocuments)
            : "Không có phiếu mua hàng kèm theo"
        }
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
            ${renderApprovalStatus(doc.approvers, doc.approvedBy)}
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

const renderPurchasingDocuments = (purchDocs) => {
  if (!purchDocs || purchDocs.length === 0) return "";

  return `
    <div class="documents-container">
      ${purchDocs
        .map((purchDoc) => {
          const products = purchDoc.products
            ? purchDoc.products
                .map(
                  (product) => `
              <div class="payment-product-item">
                <span class="payment-product-name">${product.productName}</span>
                <span class="payment-product-amount">${product.amount} x</span>
                <span class="payment-product-price">${formatCurrency(
                  product.costPerUnit
                )}</span>
                <span class="payment-product-total">${formatCurrency(
                  product.totalCost
                )}</span>
              </div>
            `
                )
                .join("")
            : "";

          const fileMetadata = purchDoc.fileMetadata
            ? `<div><strong>Tệp đính kèm:</strong> 
              <a href="${purchDoc.fileMetadata.link}" target="_blank" class="file-link">${purchDoc.fileMetadata.name}</a></div>`
            : "";

          // Render appended proposals
          const proposals = purchDoc.appendedProposals
            ? purchDoc.appendedProposals
                .map(
                  (proposal) => `
                <div class="proposal-item" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                  <div><strong>Công việc:</strong> ${proposal.task}</div>
                  <div><strong>Trạm:</strong> ${proposal.costCenter}</div>
                  <div><strong>Mô tả:</strong> ${
                    proposal.detailsDescription
                  }</div>
                  ${
                    proposal.fileMetadata?.link
                      ? `<div><strong>Tệp đính kèm:</strong> 
                         <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></div>`
                      : ""
                  }
                </div>
              `
                )
                .join("")
            : "";

          return `
            <div class="payment-document" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
              <div><strong>Tên:</strong> ${purchDoc.name || ""}</div>
              <div><strong>Trạm:</strong> ${purchDoc.costCenter || ""}</div>
              <div><strong>Tổng chi phí:</strong> ${formatCurrency(
                purchDoc.grandTotalCost
              )}</div>
              <div style="margin-top: 10px;"><strong>Sản phẩm:</strong></div>
              <div class="payment-products">${products}</div>
              ${fileMetadata}
              
              <div style="margin-top: 15px;">
                <strong>Phiếu đề xuất kèm theo:</strong>
                ${proposals || "Không có phiếu đề xuất kèm theo"}
              </div>
            </div>`;
        })
        .join("")}
    </div>`;
};

const closeFullViewModal = () => {
  document.getElementById("fullViewModal").style.display = "none";
};

// Export functions
const exportSelectedToExcel = () => {
  const selectedDocs = Array.from(state.selectedDocuments);

  if (selectedDocs.length === 0) {
    showMessage("Xin hãy chọn ít nhất một phiếu để xuất.", true);
    return;
  }

  try {
    // Filter the selected documents from the state
    const documentsToExport = state.paymentDocuments.filter((doc) =>
      selectedDocs.includes(doc._id)
    );

    // Create multiple sheets for comprehensive export
    const wb = XLSX.utils.book_new();

    // Sheet 1: Document Overview
    const overviewData = documentsToExport.map((doc, index) => ({
      STT: index + 1,
      "Mã phiếu": doc.tag || "Không có",
      "Tên phiếu": doc.name || "Không có",
      Nhóm: doc.groupName || "Không có",
      "Ngày nộp": doc.submissionDate || "Không có",
      "Hạn thanh toán": doc.paymentDeadline || "Không có",
      "Tổng thanh toán": doc.totalPayment || 0,
      "Tạm ứng": doc.advancePayment || 0,
      "Bù trừ":
        doc.totalPayment && doc.advancePayment
          ? doc.totalPayment - doc.advancePayment
          : 0,
      "Trạng thái":
        doc.status === "Approved"
          ? "Đã phê duyệt"
          : doc.status === "Suspended"
          ? "Từ chối"
          : "Chưa phê duyệt",
      "Phương thức thanh toán": doc.paymentMethod || "Không có",
    }));

    const overviewWs = XLSX.utils.json_to_sheet(overviewData);
    overviewWs["!cols"] = [
      { wch: 5 },
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, overviewWs, "Tổng quan");

    // Sheet 2: Detailed Information (Multiple rows per document)
    const detailedData = [];

    documentsToExport.forEach((doc, docIndex) => {
      // Header row for each document
      detailedData.push({
        STT: docIndex + 1,
        "Mã phiếu": doc.tag || "Không có",
        "Loại thông tin": "=== THÔNG TIN CƠ BẢN ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      // Basic information rows
      const basicInfo = [
        ["Tên phiếu", doc.name || "Không có"],
        ["Nhóm", doc.groupName || "Không có"],
        ["Ngày nộp", doc.submissionDate || "Không có"],
        ["Hạn thanh toán", doc.paymentDeadline || "Không có"],
        ["Kê khai", doc.declaration || "Không có"],
        ["Lý do từ chối", doc.suspendReason || "Không có"],
      ];

      basicInfo.forEach(([label, value]) => {
        detailedData.push({
          STT: "",
          "Mã phiếu": "",
          "Loại thông tin": label,
          "Chi tiết": value,
          "Giá trị": "",
          "Ghi chú": "",
        });
      });

      // Content section
      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=== NỘI DUNG ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "Nội dung chi tiết",
        "Chi tiết": doc.content || "Không có nội dung",
        "Giá trị": "",
        "Ghi chú": "",
      });

      // Payment information
      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=== THÔNG TIN THANH TOÁN ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      const paymentInfo = [
        ["Phương thức thanh toán", doc.paymentMethod || "Không có", ""],
        ["Tổng thanh toán", "", doc.totalPayment || 0],
        ["Tạm ứng", "", doc.advancePayment || 0],
        [
          "Bù trừ",
          "",
          doc.totalPayment && doc.advancePayment
            ? doc.totalPayment - doc.advancePayment
            : 0,
        ],
      ];

      paymentInfo.forEach(([label, detail, value]) => {
        detailedData.push({
          STT: "",
          "Mã phiếu": "",
          "Loại thông tin": label,
          "Chi tiết": detail,
          "Giá trị": value,
          "Ghi chú": "",
        });
      });

      // File attachment
      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=== TỆP TIN ĐÍNH KÈM ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "Tệp đính kèm",
        "Chi tiết": doc.fileMetadata
          ? doc.fileMetadata.name
          : "Không có tệp tin",
        "Giá trị": "",
        "Ghi chú": doc.fileMetadata ? doc.fileMetadata.link : "",
      });

      // Purchasing documents
      if (doc.appendedPurchasingDocuments?.length) {
        detailedData.push({
          STT: "",
          "Mã phiếu": "",
          "Loại thông tin": "=== PHIẾU MUA HÀNG KÈM THEO ===",
          "Chi tiết": "",
          "Giá trị": "",
          "Ghi chú": "",
        });

        doc.appendedPurchasingDocuments.forEach((purchDoc, purchIndex) => {
          detailedData.push({
            STT: "",
            "Mã phiếu": "",
            "Loại thông tin": `Phiếu mua hàng ${purchIndex + 1}`,
            "Chi tiết": purchDoc.name || "",
            "Giá trị": purchDoc.grandTotalCost || 0,
            "Ghi chú": `Trạm: ${purchDoc.costCenter || ""}`,
          });

          // Products in purchasing document
          if (purchDoc.products?.length) {
            purchDoc.products.forEach((product, productIndex) => {
              detailedData.push({
                STT: "",
                "Mã phiếu": "",
                "Loại thông tin": `  └ Sản phẩm ${productIndex + 1}`,
                "Chi tiết": product.productName || "",
                "Giá trị": product.totalCost || 0,
                "Ghi chú": `${product.amount || 0} x ${formatCurrency(
                  product.costPerUnit || 0
                )}`,
              });
            });
          }

          // Proposals in purchasing document
          if (purchDoc.appendedProposals?.length) {
            purchDoc.appendedProposals.forEach((proposal, propIndex) => {
              detailedData.push({
                STT: "",
                "Mã phiếu": "",
                "Loại thông tin": `  └ Đề xuất ${propIndex + 1}`,
                "Chi tiết": proposal.task || "",
                "Giá trị": "",
                "Ghi chú": `Trạm: ${proposal.costCenter || ""} | Mô tả: ${
                  proposal.detailsDescription || ""
                }`,
              });

              // Add proposal file link if exists
              if (proposal.fileMetadata?.link) {
                detailedData.push({
                  STT: "",
                  "Mã phiếu": "",
                  "Loại thông tin": `    └ Tệp đề xuất`,
                  "Chi tiết": proposal.fileMetadata.name || "",
                  "Giá trị": "",
                  "Ghi chú": proposal.fileMetadata.link || "",
                });
              }
            });
          }

          // Add purchasing document file link if exists
          if (purchDoc.fileMetadata?.link) {
            detailedData.push({
              STT: "",
              "Mã phiếu": "",
              "Loại thông tin": `  └ Tệp phiếu mua hàng`,
              "Chi tiết": purchDoc.fileMetadata.name || "",
              "Giá trị": "",
              "Ghi chú": purchDoc.fileMetadata.link || "",
            });
          }
        });
      }

      // Approval status
      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=== TRẠNG THÁI PHÊ DUYỆT ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "Tình trạng hiện tại",
        "Chi tiết":
          doc.status === "Approved"
            ? "Đã phê duyệt"
            : doc.status === "Suspended"
            ? "Từ chối"
            : "Chưa phê duyệt",
        "Giá trị": "",
        "Ghi chú": "",
      });

      // Individual approvers
      if (doc.approvers?.length) {
        doc.approvers.forEach((approver, approverIndex) => {
          const hasApproved = doc.approvedBy.find(
            (a) => a.username === approver.username
          );
          detailedData.push({
            STT: "",
            "Mã phiếu": "",
            "Loại thông tin": `Người phê duyệt ${approverIndex + 1}`,
            "Chi tiết": `${approver.username} (${approver.subRole})`,
            "Giá trị": "",
            "Ghi chú": hasApproved
              ? `Đã phê duyệt vào: ${hasApproved.approvalDate}`
              : "Chưa phê duyệt",
          });
        });
      }

      // Add separator row
      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=" + "=".repeat(50),
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });
    });

    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    detailedWs["!cols"] = [
      { wch: 5 }, // STT
      { wch: 15 }, // Mã phiếu
      { wch: 25 }, // Loại thông tin
      { wch: 40 }, // Chi tiết
      { wch: 15 }, // Giá trị
      { wch: 50 }, // Ghi chú
    ];
    XLSX.utils.book_append_sheet(wb, detailedWs, "Chi tiết đầy đủ");

    // Sheet 3: Approval Tracking
    const approvalData = [];
    documentsToExport.forEach((doc, docIndex) => {
      if (doc.approvers?.length) {
        doc.approvers.forEach((approver, approverIndex) => {
          const hasApproved = doc.approvedBy.find(
            (a) => a.username === approver.username
          );
          approvalData.push({
            STT: docIndex + 1,
            "Mã phiếu": doc.tag || "Không có",
            "Tên phiếu": doc.name || "Không có",
            "Người phê duyệt": approver.username,
            "Vai trò": approver.subRole,
            "Trạng thái": hasApproved ? "Đã phê duyệt" : "Chưa phê duyệt",
            "Ngày phê duyệt": hasApproved ? hasApproved.approvalDate : "",
            "Thứ tự": approverIndex + 1,
            "Tổng số người PD": doc.approvers.length,
            "Đã PD": doc.approvedBy.length,
          });
        });
      }
    });

    if (approvalData.length > 0) {
      const approvalWs = XLSX.utils.json_to_sheet(approvalData);
      approvalWs["!cols"] = [
        { wch: 5 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 8 },
        { wch: 12 },
        { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(wb, approvalWs, "Theo dõi phê duyệt");
    }

    // Sheet 4: Financial Summary
    const financialData = [];
    let totalApproved = 0,
      totalPending = 0,
      totalSuspended = 0;

    documentsToExport.forEach((doc, docIndex) => {
      const paymentAmount =
        doc.totalPayment && doc.advancePayment
          ? doc.totalPayment - doc.advancePayment
          : doc.totalPayment || doc.advancePayment || 0;

      if (doc.status === "Approved") totalApproved += paymentAmount;
      else if (doc.status === "Suspended") totalSuspended += paymentAmount;
      else totalPending += paymentAmount;

      financialData.push({
        STT: docIndex + 1,
        "Mã phiếu": doc.tag || "Không có",
        "Tên phiếu": doc.name || "Không có",
        "Phương thức thanh toán": doc.paymentMethod || "",
        "Tổng thanh toán": doc.totalPayment || 0,
        "Tạm ứng": doc.advancePayment || 0,
        "Số tiền thực tế": paymentAmount,
        "Trạng thái":
          doc.status === "Approved"
            ? "Đã phê duyệt"
            : doc.status === "Suspended"
            ? "Từ chối"
            : "Chưa phê duyệt",
        "Hạn thanh toán": doc.paymentDeadline || "",
        "Ghi chú": doc.suspendReason || doc.declaration || "",
      });
    });

    // Add summary rows
    financialData.push(
      {},
      {
        STT: "",
        "Mã phiếu": "TỔNG KẾT",
        "Tên phiếu": "",
        "Phương thức thanh toán": "",
        "Tổng thanh toán": "",
        "Tạm ứng": "",
        "Số tiền thực tế": "",
        "Trạng thái": "",
        "Hạn thanh toán": "",
        "Ghi chú": "",
      },
      {
        STT: "",
        "Mã phiếu": "Đã phê duyệt",
        "Tên phiếu": "",
        "Phương thức thanh toán": "",
        "Tổng thanh toán": "",
        "Tạm ứng": "",
        "Số tiền thực tế": totalApproved,
        "Trạng thái": "",
        "Hạn thanh toán": "",
        "Ghi chú": "",
      },
      {
        STT: "",
        "Mã phiếu": "Chưa phê duyệt",
        "Tên phiếu": "",
        "Phương thức thanh toán": "",
        "Tổng thanh toán": "",
        "Tạm ứng": "",
        "Số tiền thực tế": totalPending,
        "Trạng thái": "",
        "Hạn thanh toán": "",
        "Ghi chú": "",
      },
      {
        STT: "",
        "Mã phiếu": "Từ chối",
        "Tên phiếu": "",
        "Phương thức thanh toán": "",
        "Tổng thanh toán": "",
        "Tạm ứng": "",
        "Số tiền thực tế": totalSuspended,
        "Trạng thái": "",
        "Hạn thanh toán": "",
        "Ghi chú": "",
      }
    );

    const financialWs = XLSX.utils.json_to_sheet(financialData);
    financialWs["!cols"] = [
      { wch: 5 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, financialWs, "Tổng hợp tài chính");

    // Generate the Excel file and trigger download
    XLSX.writeFile(
      wb,
      `Bao_cao_chi_tiet_phieu_thanh_toan_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );

    showMessage(
      `Đã xuất báo cáo chi tiết ${selectedDocs.length} phiếu thanh toán với ${wb.SheetNames.length} bảng tính.`
    );
  } catch (err) {
    console.error("Error exporting documents:", err);
    showMessage("Lỗi khi xuất dữ liệu: " + err.message, true);
  }
};

// Selection functions
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

// Filter functions
const filterByGroup = () => {
  state.currentGroupFilter = document.getElementById("groupFilter").value;
  state.currentPage = 1;
  fetchPaymentDocuments();
};

// Event listeners
const setupEventListeners = () => {
  // Toggle switches
  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    state.showOnlyPendingApprovals = e.target.checked;
    state.currentPage = 1;
    fetchPaymentDocuments();
  });

  document.getElementById("paginationToggle").addEventListener("change", () => {
    state.paginationEnabled =
      document.getElementById("paginationToggle").checked;
    state.currentPage = 1;
    fetchPaymentDocuments();
  });

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

  // Group filter
  document
    .getElementById("groupFilter")
    .addEventListener("change", filterByGroup);

  // Payment method filter
  document
    .getElementById("paymentMethodFilter")
    .addEventListener("change", filterByPaymentMethod);

  // Mass declaration form
  document
    .getElementById("massDeclarationForm")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      handleMassDeclarationSubmit(e);
    });

  // Edit form
  document.getElementById("editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleEditSubmit(e);
  });
};

// Initialize the application
const initialize = async () => {
  await fetchCurrentUser();
  await fetchGroups();
  setupEventListeners();
  await fetchPaymentDocuments();
};

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initialize);

// Close modals when clicking outside
window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};

// Global functions for HTML event handlers
window.changePage = changePage;
window.showFullView = showFullView;
window.closeFullViewModal = closeFullViewModal;
window.approveDocument = approveDocument;
window.deleteDocument = deleteDocument;
window.suspendDocument = suspendDocument;
window.closeSuspendModal = closeSuspendModal;
window.openDocument = openDocument;
window.editDocument = editDocument;
window.closeEditModal = closeEditModal;
window.editDeclaration = editDeclaration;
window.closeDeclarationModal = closeDeclarationModal;
window.saveDeclaration = saveDeclaration;
window.openMassDeclarationModal = openMassDeclarationModal;
window.closeMassDeclarationModal = closeMassDeclarationModal;
window.addNewApprover = addNewApprover;
window.removeApprover = removeApprover;
window.updateApproverSubRole = updateApproverSubRole;
window.toggleSelectAll = toggleSelectAll;
window.filterByGroup = filterByGroup;
