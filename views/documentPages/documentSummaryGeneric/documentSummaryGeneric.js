// views/documentPages/documentSummaryGeneric/documentSummaryGeneric.js
// State management
const state = {
  currentUser: null,
  genericDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  paginationEnabled: true,
  selectedDocuments: new Set(),
  currentEditDoc: null,
  currentTagFilter: "",
  currentNameFilter: "",
  currentGroupFilter: [],
  currentProjectFilter: "",
  currentSubmissionDateFilter: "",
  customSubmissionDateRange: { from: null, to: null },
  groups: [],
  projects: [],
};

// Helper functions for date parsing and filtering
const parseDateFromString = (dateString) => {
  if (!dateString) return null;

  if (dateString.includes("-") && dateString.includes(":")) {
    const spaceIndex = dateString.indexOf(" ");
    const datePart = dateString.substring(0, spaceIndex);
    const timePart = dateString.substring(spaceIndex + 1);

    const dateParts = datePart.split("-");
    if (dateParts.length !== 3) return null;

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);

    const timeParts = timePart.split(":");
    const hour = timeParts.length > 0 ? parseInt(timeParts[0], 10) : 0;
    const minute = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;
    const second = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;

    return new Date(year, month, day, hour, minute, second);
  }

  return null;
};

const isSubmissionDateInRange = (
  submissionDateStr,
  filterType,
  customRange = null,
) => {
  if (!submissionDateStr || !filterType) return true;

  const submissionDate = parseDateFromString(submissionDateStr);
  if (!submissionDate) return true;

  const { start, end } = getDateRange(filterType, customRange);
  if (!start || !end) return true;

  return submissionDate >= start && submissionDate <= end;
};

const getDateRange = (filterType, customRange = null) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  if (filterType === "custom" && customRange) {
    if (customRange.from) {
      const fromParts = customRange.from.split("/");
      if (fromParts.length === 3) {
        start.setDate(parseInt(fromParts[0], 10));
        start.setMonth(parseInt(fromParts[1], 10) - 1);
        start.setFullYear(parseInt(fromParts[2], 10));
        start.setHours(0, 0, 0, 0);
      }
    } else {
      start.setTime(new Date(0).getTime());
    }

    if (customRange.to) {
      const toParts = customRange.to.split("/");
      if (toParts.length === 3) {
        end.setDate(parseInt(toParts[0], 10));
        end.setMonth(parseInt(toParts[1], 10) - 1);
        end.setFullYear(parseInt(toParts[2], 10));
        end.setHours(23, 59, 59, 999);
      }
    } else {
      end.setTime(now.getTime());
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  switch (filterType) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisWeek":
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisMonth":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "lastMonth":
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last3Months":
      start.setMonth(now.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisYear":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return { start: null, end: null };
  }

  return { start, end };
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes(" ")) {
    return dateStr.split(" ")[0];
  }
  return dateStr;
};

const validateAndParseDate = (dateStr) => {
  if (!dateStr) return { isValid: false, date: null, message: "" };

  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);

  if (!match) {
    return {
      isValid: false,
      date: null,
      message:
        "Định dạng ngày không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy",
    };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      date: null,
      message: "Tháng phải từ 01 đến 12",
    };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      date: null,
      message: `Tháng ${month} chỉ có từ 01 đến ${daysInMonth} ngày`,
    };
  }

  const currentYear = new Date().getFullYear();
  if (year < 2000 || year > currentYear + 10) {
    return {
      isValid: false,
      date: null,
      message: `Năm phải từ 2000 đến ${currentYear + 10}`,
    };
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return {
      isValid: false,
      date: null,
      message: "Ngày không hợp lệ",
    };
  }

  return { isValid: true, date, message: "" };
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Utility functions
const showMessage = (message, isError = false) => {
  const messageContainer = document.getElementById("messageContainer");

  if (messageContainer.timeoutId) {
    clearTimeout(messageContainer.timeoutId);
  }

  messageContainer.className = `message ${isError ? "error" : "success"}`;
  messageContainer.textContent = message;
  messageContainer.style.display = "block";

  void messageContainer.offsetWidth;
  messageContainer.classList.remove("hidden");

  messageContainer.timeoutId = setTimeout(() => {
    messageContainer.classList.add("hidden");
    setTimeout(() => {
      messageContainer.style.display = "none";
    }, 300);
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

const renderApprovalStatus = (approvers, approvedBy) => {
  return approvers
    .map((approver) => {
      const hasApproved = approvedBy.find(
        (a) => a.username === approver.username,
      );
      return `
        <div class="approver-item">
          <span class="status-icon ${hasApproved ? "status-approved" : "status-pending"}"></span>
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

const fetchGenericDocuments = async () => {
  showLoading(true);

  try {
    const response = await fetch("/getGenericDocumentForSeparatedView");
    const data = await response.json();
    state.genericDocuments = data.genericDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(
      state.genericDocuments,
    );

    state.totalPages = Math.ceil(filteredDocuments.length / state.itemsPerPage);

    if (state.currentPage > state.totalPages && state.totalPages > 0) {
      state.currentPage = state.totalPages;
    }
    if (state.currentPage < 1) {
      state.currentPage = 1;
    }

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;

    const pageDocuments =
      state.paginationEnabled && filteredDocuments.length > 0
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
    console.error("Error fetching generic documents:", err);
    showMessage("Error fetching generic documents", true);
  } finally {
    showLoading(false);
  }
};

const filterDocumentsForCurrentUser = (documents) => {
  let filteredDocs = [...documents];

  if (state.currentTagFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.tag?.toLowerCase().includes(state.currentTagFilter),
    );
  }

  if (state.currentNameFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.name?.toLowerCase().includes(state.currentNameFilter),
    );
  }

  if (state.currentGroupFilter.length > 0) {
    filteredDocs = filteredDocs.filter((doc) =>
      state.currentGroupFilter.includes(doc.groupName),
    );
  }

  if (state.currentProjectFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.projectName?.toLowerCase().includes(state.currentProjectFilter),
    );
  }

  if (state.currentSubmissionDateFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      isSubmissionDateInRange(
        doc.submissionDate,
        state.currentSubmissionDateFilter,
        state.customSubmissionDateRange,
      ),
    );
  }

  if (state.showOnlyPendingApprovals && state.currentUser) {
    filteredDocs = filteredDocs.filter((doc) => {
      const isRequiredApprover = doc.approvers.some(
        (approver) => approver.username === state.currentUser.username,
      );
      const hasNotApprovedYet = !doc.approvedBy.some(
        (approved) => approved.username === state.currentUser.username,
      );
      return isRequiredApprover && hasNotApprovedYet;
    });
  }

  return filteredDocs;
};

// Render functions
const renderDocumentsTable = (documents) => {
  const tableBody = document
    .getElementById("genericDocumentsTable")
    .querySelector("tbody");
  tableBody.innerHTML = "";

  if (documents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center;">Không có dữ liệu</td>
      </tr>
    `;
    return;
  }

  documents.forEach((doc) => {
    const canApproveDocument =
      doc.approvers.some(
        (approver) => approver.username === state.currentUser?.username,
      ) &&
      !doc.approvedBy.some(
        (approved) => approved.username === state.currentUser?.username,
      ) &&
      doc.status === "Pending";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="doc-checkbox" data-doc-id="${
        doc._id
      }" ${state.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
      <td>${doc.tag || "-"}</td>
      <td>${doc.name || "-"}</td>
      <td>${doc.groupName || "-"}</td>
      <td>${doc.projectName || "-"}</td>
      <td>
        <div class="notes-preview">${doc.notes || "-"}</div>
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
      <td>${formatDisplayDate(doc.submissionDate) || "-"}</td>
      <td>${renderStatus(doc.status)}</td>
      <td class="approval-status">${renderApprovalStatus(doc.approvers, doc.approvedBy)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-primary btn-sm" onclick="showFullView('${doc._id}')">
            <i class="fas fa-eye"></i> Xem
          </button>
          <form action="/exportDocumentToDocx/${doc._id}" method="GET" style="display:inline;">
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
            doc.status === "Pending" && canApproveDocument
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
  let approvedDocument = 0;
  let unapprovedDocument = 0;
  let pendingForMe = 0;

  filteredDocuments.forEach((doc) => {
    if (doc.status === "Approved") {
      approvedDocument++;
    } else {
      unapprovedDocument++;
    }

    if (state.currentUser) {
      const isRequiredApprover = doc.approvers.some(
        (approver) => approver.username === state.currentUser.username,
      );
      const hasNotApprovedYet = !doc.approvedBy.some(
        (approved) => approved.username === state.currentUser.username,
      );
      if (isRequiredApprover && hasNotApprovedYet && doc.status === "Pending") {
        pendingForMe++;
      }
    }
  });

  document.getElementById("approvedDocument").textContent =
    approvedDocument.toLocaleString();
  document.getElementById("unapprovedDocument").textContent =
    unapprovedDocument.toLocaleString();
  document.getElementById("pendingForMe").textContent =
    pendingForMe.toLocaleString();
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
        <button onclick="changePage(1)" ${state.currentPage === 1 ? "disabled" : ""}>
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

const changePage = (newPage) => {
  if (
    newPage >= 1 &&
    newPage <= state.totalPages &&
    newPage !== state.currentPage
  ) {
    state.currentPage = newPage;
    fetchGenericDocuments();
    document.querySelector("table").scrollIntoView({ behavior: "smooth" });
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
    pageInput.value = state.currentPage;
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
      fetchGenericDocuments();
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
      fetchGenericDocuments();
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
      fetchGenericDocuments();
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
      fetchGenericDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error reopening document:", err);
    showMessage("Lỗi khi mở lại tài liệu.", true);
  }
};

const editDeclaration = (docId) => {
  const existingModal = document.getElementById("declarationModal");
  if (existingModal) {
    existingModal.remove();
  }

  const doc = state.genericDocuments.find((d) => d._id === docId);
  if (!doc) return;

  const modalHTML = `
    <div id="declarationModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeDeclarationModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Kê Khai - ${doc.tag || doc.name}</h2>
        <div class="modal-body">
          <div class="form-group">
            <textarea id="declarationInput" class="form-textarea">${doc.declaration || ""}</textarea>
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

  document.body.insertAdjacentHTML("beforeend", modalHTML);
  document.getElementById("declarationModal").style.display = "block";
  document.getElementById("declarationInput").focus();
};

const closeDeclarationModal = () => {
  const modal = document.getElementById("declarationModal");
  if (modal) {
    modal.style.display = "none";
    setTimeout(() => modal.remove(), 300);
  }
};

const saveDeclaration = async (docId) => {
  const declaration = document.getElementById("declarationInput").value;

  try {
    const response = await fetch(`/updateDocumentDeclaration/${docId}`, {
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
      const docIndex = state.genericDocuments.findIndex((d) => d._id === docId);
      if (docIndex !== -1) {
        state.genericDocuments[docIndex].declaration = declaration;
      }
      fetchGenericDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Error updating declaration", true);
  }
};

// Mass declaration
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
    const response = await fetch("/massUpdateDocumentDeclaration", {
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
      fetchGenericDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating mass declaration:", err);
    showMessage("Error updating mass declaration", true);
  }
};

// Multi-select functionality for groups
const initializeMultiSelect = () => {
  const groupButton = document.getElementById("groupMultiSelectButton");
  const groupDropdown = document.getElementById("groupMultiSelectDropdown");

  if (groupButton && groupDropdown) {
    groupButton.addEventListener("click", (e) => {
      e.stopPropagation();
      groupDropdown.classList.toggle("open");
      groupButton.classList.toggle("open");
    });

    document.addEventListener("click", () => {
      groupDropdown.classList.remove("open");
      groupButton.classList.remove("open");
    });

    groupDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
};

const populateGroupMultiSelect = async () => {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    state.groups = groups;

    const dropdown = document.getElementById("groupMultiSelectDropdown");
    if (!dropdown) return;

    dropdown.innerHTML = "";

    const selectAllOption = document.createElement("div");
    selectAllOption.className = "multi-select-option";
    selectAllOption.innerHTML = `
      <input type="checkbox" id="selectAllGroups">
      <label for="selectAllGroups">Chọn tất cả</label>
    `;
    dropdown.appendChild(selectAllOption);

    groups.forEach((group) => {
      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.innerHTML = `
        <input type="checkbox" id="group_${group.name}" value="${group.name}">
        <label for="group_${group.name}">${group.name}</label>
      `;
      dropdown.appendChild(option);
    });

    const selectAllCheckbox = document.getElementById("selectAllGroups");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", (e) => {
        const checkboxes = dropdown.querySelectorAll(
          'input[type="checkbox"]:not(#selectAllGroups)',
        );
        checkboxes.forEach((checkbox) => {
          checkbox.checked = e.target.checked;
        });
        updateGroupFilter();
      });
    }

    const checkboxes = dropdown.querySelectorAll(
      'input[type="checkbox"]:not(#selectAllGroups)',
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
        const someChecked = Array.from(checkboxes).some((cb) => cb.checked);

        if (selectAllCheckbox) {
          selectAllCheckbox.checked = allChecked;
          selectAllCheckbox.indeterminate = someChecked && !allChecked;
        }

        updateGroupFilter();
      });
    });

    const clearButton = document.createElement("button");
    clearButton.className = "multi-select-clear";
    clearButton.innerHTML = '<i class="fas fa-times"></i> Xóa tất cả';
    clearButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      if (selectAllCheckbox) {
        selectAllCheckbox.indeterminate = false;
      }
      updateGroupFilter();
    });

    const buttonContainer = document.getElementById("groupMultiSelectButton");
    if (buttonContainer) {
      buttonContainer.appendChild(clearButton);
    }
  } catch (error) {
    console.error("Error fetching groups for multi-select:", error);
  }
};

const updateGroupFilter = () => {
  const checkboxes = document.querySelectorAll(
    '#groupMultiSelectDropdown input[type="checkbox"]:not(#selectAllGroups)',
  );
  const selectedGroups = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  state.currentGroupFilter = selectedGroups;

  const textElement = document.getElementById("groupMultiSelectText");
  const buttonContainer = document.getElementById("groupMultiSelectButton");
  const countElement = buttonContainer?.querySelector(
    ".multi-select-selected-count",
  );

  if (selectedGroups.length === 0) {
    if (textElement) textElement.textContent = "Tất cả";
    if (countElement) countElement.remove();
  } else if (selectedGroups.length === 1) {
    if (textElement) textElement.textContent = selectedGroups[0];
    if (countElement) countElement.remove();
  } else {
    if (textElement)
      textElement.textContent = `${selectedGroups.length} nhóm đã chọn`;
    if (!countElement && textElement && textElement.parentNode) {
      const countSpan = document.createElement("span");
      countSpan.className = "multi-select-selected-count";
      countSpan.textContent = `(${selectedGroups.length})`;
      textElement.parentNode.appendChild(countSpan);
    } else if (countElement) {
      countElement.textContent = `(${selectedGroups.length})`;
    }
  }

  state.currentPage = 1;
  fetchGenericDocuments();
};

// Edit Document Functions
const editDocument = async (docId) => {
  try {
    const response = await fetch(`/getGenericDocument/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name || "";
    document.getElementById("editNotes").value = doc.notes || "";

    await populateGroupDropdownForEditing();
    document.getElementById("editGroupName").value = doc.groupName || "";

    await populateProjectDropdownForEditing();
    document.getElementById("editProjectName").value = doc.projectName || "";

    state.currentApprovers = doc.approvers;
    state.currentEditDoc = doc;

    renderCurrentApprovers();
    await populateNewApproversDropdown();
    renderCurrentFiles(doc.fileMetadata || []);

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

const populateGroupDropdownForEditing = async () => {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    const dropdown = document.getElementById("editGroupName");

    if (dropdown) {
      dropdown.innerHTML = '<option value="">Chọn một nhóm</option>';
      groups.forEach((group) => {
        const option = document.createElement("option");
        option.value = group.name;
        option.textContent = group.name;
        dropdown.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching groups:", error);
  }
};

const populateProjectDropdownForEditing = async () => {
  try {
    const response = await fetch("/getProjectDocument");
    const projects = await response.json();
    const dropdown = document.getElementById("editProjectName");

    if (dropdown) {
      dropdown.innerHTML = '<option value="">Chọn một dự án</option>';
      projects.forEach((project) => {
        const option = document.createElement("option");
        option.value = project.name;
        option.textContent = project.name;
        dropdown.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
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
                  onclick="removeApprover('${approver._id}')">
            <i class="fas fa-trash"></i> Xóa
          </button>
        </div>
      `,
    )
    .join("");
};

const updateApproverSubRole = (approverId, newSubRole) => {
  const approver = state.currentApprovers.find(
    (a) => a.approver === approverId,
  );
  if (approver) {
    approver.subRole = newSubRole;
  }
};

const removeApprover = (approverId) => {
  state.currentApprovers = state.currentApprovers.filter(
    (a) => a.approver !== approverId,
  );
  renderCurrentApprovers();
  populateNewApproversDropdown();
};

const populateNewApproversDropdown = async () => {
  const allApprovers = await fetchApprovers();
  const availableApprovers = allApprovers.filter(
    (approver) =>
      !state.currentApprovers.some((a) => a.approver === approver._id),
  );

  const dropdown = document.getElementById("newApproversDropdown");
  dropdown.innerHTML = `
    <option value="">Chọn người phê duyệt</option>
    ${availableApprovers
      .map(
        (approver) => `
      <option value="${approver._id}">${approver.username}</option>
    `,
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

  document.getElementById("newApproversDropdown").value = "";
  document.getElementById("newApproverSubRole").value = "";
};

const renderCurrentFiles = (files) => {
  const currentFilesList = document.getElementById("currentFilesList");

  if (!files || files.length === 0) {
    currentFilesList.innerHTML = "<p>Không có tệp tin nào</p>";
    return;
  }

  currentFilesList.innerHTML = files
    .map(
      (file, index) => `
    <div class="file-item">
      <div class="file-info">
        <i class="fas fa-file"></i>
        <span class="file-name">${file.name || file.displayName}</span>
        ${file.size ? `<span class="file-size">(${file.size})</span>` : ""}
      </div>
      <div class="file-actions">
        <a href="${file.link}" target="_blank" class="btn btn-primary btn-sm">
          <i class="fas fa-download"></i>
        </a>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeExistingFile(${index})" 
                ${state.currentEditDoc.approvedBy?.length > 0 ? "disabled" : ""}>
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `,
    )
    .join("");
};

const removeExistingFile = async (index) => {
  if (
    !state.currentEditDoc.fileMetadata ||
    state.currentEditDoc.fileMetadata.length <= index
  ) {
    return;
  }

  const fileToDelete = state.currentEditDoc.fileMetadata[index];

  if (
    !confirm(
      "Bạn có chắc chắn muốn xóa tệp tin này? Hành động này không thể hoàn tác.",
    )
  ) {
    return;
  }

  try {
    showLoading(true);

    const response = await fetch(
      `/deleteGenericDocumentFile/${state.currentEditDoc._id}/${fileToDelete.driveFileId}`,
      {
        method: "DELETE",
      },
    );

    const result = await response.json();

    if (response.ok) {
      showMessage("Tệp tin đã được xóa thành công.");
      state.currentEditDoc.fileMetadata.splice(index, 1);
      renderCurrentFiles(state.currentEditDoc.fileMetadata);
    } else {
      showMessage(result.message || "Lỗi khi xóa tệp tin", true);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    showMessage("Lỗi khi xóa tệp tin", true);
  } finally {
    showLoading(false);
  }
};

const handleEditSubmit = async (event) => {
  event.preventDefault();

  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  formData.append("name", document.getElementById("editName").value);
  formData.append("groupName", document.getElementById("editGroupName").value);
  formData.append(
    "projectName",
    document.getElementById("editProjectName").value,
  );
  formData.append("notes", document.getElementById("editNotes").value);
  formData.append("approvers", JSON.stringify(state.currentApprovers));

  if (state.currentEditDoc.fileMetadata) {
    formData.append(
      "currentFileMetadata",
      JSON.stringify(state.currentEditDoc.fileMetadata),
    );
  }

  const fileInput = document.getElementById("editFiles");
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }
  }

  try {
    const response = await fetch(`/updateGenericDocument/${docId}`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (response.ok) {
      showMessage("Phiếu cập nhật thành công.");
      closeEditModal();
      fetchGenericDocuments();
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
    const doc = state.genericDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");

    const filesSection = `
      <div class="full-view-section">
        <h3><i class="fas fa-paperclip"></i> Tệp tin kèm theo</h3>
        ${
          doc.fileMetadata && doc.fileMetadata.length > 0
            ? `<div class="file-attachments">
                ${doc.fileMetadata
                  .map(
                    (file) => `
                  <div class="file-item">
                    <a href="${file.link}" class="file-link" target="_blank">
                      <i class="fas fa-file"></i> ${file.name}
                      ${file.size ? ` (${file.size})` : ""}
                    </a>
                  </div>
                `,
                  )
                  .join("")}
              </div>`
            : "Không có tệp tin đính kèm"
        }
      </div>
    `;

    fullViewContent.innerHTML = `
      <div class="full-view-section">
        <h3><i class="fas fa-info-circle"></i> Thông tin cơ bản</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Mã phiếu:</span>
            <span class="detail-value">${doc.tag || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tên phiếu:</span>
            <span class="detail-value">${doc.name || "Không có"}</span>
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
            <span class="detail-label">Người nộp:</span>
            <span class="detail-value">${doc.submittedBy?.username || "Không rõ"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ngày nộp:</span>
            <span class="detail-value">${formatDisplayDate(doc.submissionDate) || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ghi chú:</span>
            <span class="detail-value">${doc.notes || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Kê khai:</span>
            <span class="detail-value">${doc.declaration || "Không có"}</span>
          </div>
          ${
            doc.suspendReason
              ? `
            <div class="detail-item">
              <span class="detail-label">Lý do từ chối:</span>
              <span class="detail-value">${doc.suspendReason}</span>
            </div>
          `
              : ""
          }
        </div>
      </div>
      
      <div class="full-view-section">
        ${filesSection}
      </div>
      
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
    const documentsToExport = state.genericDocuments.filter((doc) =>
      selectedDocs.includes(doc._id),
    );

    const wb = XLSX.utils.book_new();

    const overviewData = documentsToExport.map((doc, index) => ({
      STT: index + 1,
      "Mã phiếu": doc.tag || "Không có",
      "Tên phiếu": doc.name || "Không có",
      Nhóm: doc.groupName || "Không có",
      "Dự án": doc.projectName || "Không có",
      "Ghi chú": doc.notes || "Không có",
      "Ngày nộp": doc.submissionDate || "Không có",
      "Kê khai": doc.declaration || "Không có",
      "Trạng thái":
        doc.status === "Approved"
          ? "Đã phê duyệt"
          : doc.status === "Suspended"
            ? "Từ chối"
            : "Chưa phê duyệt",
      "Lý do từ chối": doc.suspendReason || "",
      "Người nộp": doc.submittedBy?.username || "Không rõ",
      "Người phê duyệt": doc.approvers
        .map((a) => `${a.username} (${a.subRole})`)
        .join(", "),
      "Đã phê duyệt bởi": doc.approvedBy
        .map((a) => `${a.username} - ${a.approvalDate}`)
        .join(", "),
      "Số tệp đính kèm": doc.fileMetadata?.length || 0,
    }));

    const overviewWs = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, "Tổng quan");

    const detailedData = [];
    documentsToExport.forEach((doc, docIndex) => {
      detailedData.push({
        STT: docIndex + 1,
        "Mã phiếu": doc.tag || "Không có",
        "Loại thông tin": "=== THÔNG TIN CƠ BẢN ===",
        "Chi tiết": "",
        "Giá trị": "",
      });

      const basicInfo = [
        ["Tên phiếu", doc.name || "Không có"],
        ["Nhóm", doc.groupName || "Không có"],
        ["Dự án", doc.projectName || "Không có"],
        ["Người nộp", doc.submittedBy?.username || "Không rõ"],
        ["Ngày nộp", doc.submissionDate || "Không có"],
        ["Ghi chú", doc.notes || "Không có"],
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
        });
      });

      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=== TỆP TIN ĐÍNH KÈM ===",
        "Chi tiết": "",
        "Giá trị": "",
      });

      if (doc.fileMetadata && doc.fileMetadata.length > 0) {
        doc.fileMetadata.forEach((file, fileIndex) => {
          detailedData.push({
            STT: "",
            "Mã phiếu": "",
            "Loại thông tin": `Tệp ${fileIndex + 1}`,
            "Chi tiết": file.name || "",
            "Giá trị": file.link || "",
          });
        });
      } else {
        detailedData.push({
          STT: "",
          "Mã phiếu": "",
          "Loại thông tin": "Tệp đính kèm",
          "Chi tiết": "Không có tệp tin",
          "Giá trị": "",
        });
      }

      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=== TRẠNG THÁI PHÊ DUYỆT ===",
        "Chi tiết": "",
        "Giá trị": "",
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
      });

      if (doc.approvers?.length) {
        doc.approvers.forEach((approver, approverIndex) => {
          const hasApproved = doc.approvedBy.find(
            (a) => a.username === approver.username,
          );
          detailedData.push({
            STT: "",
            "Mã phiếu": "",
            "Loại thông tin": `Người phê duyệt ${approverIndex + 1}`,
            "Chi tiết": `${approver.username} (${approver.subRole})`,
            "Giá trị": hasApproved
              ? `Đã phê duyệt vào: ${hasApproved.approvalDate}`
              : "Chưa phê duyệt",
          });
        });
      }

      detailedData.push({
        STT: "",
        "Mã phiếu": "",
        "Loại thông tin": "=" + "=".repeat(50),
        "Chi tiết": "",
        "Giá trị": "",
      });
    });

    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, detailedWs, "Chi tiết đầy đủ");

    XLSX.writeFile(
      wb,
      `Bao_cao_phieu_van_ban_chung_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );

    showMessage(
      `Đã xuất báo cáo chi tiết ${selectedDocs.length} phiếu văn bản chung.`,
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
    (checkbox) => checkbox.checked,
  );
  selectAllCheckbox.checked = allChecked;
};

// Custom filter handlers
const setupCustomFilterHandlers = () => {
  const submissionDateFilter = document.getElementById("submissionDateFilter");
  const submissionDateCustomContainer = document.getElementById(
    "submissionDateCustomContainer",
  );
  const applySubmissionDateCustom = document.getElementById(
    "applySubmissionDateCustom",
  );
  const clearSubmissionDateCustom = document.getElementById(
    "clearSubmissionDateCustom",
  );
  const submissionDateFrom = document.getElementById("submissionDateFrom");
  const submissionDateTo = document.getElementById("submissionDateTo");

  if (submissionDateFilter) {
    submissionDateFilter.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        if (submissionDateCustomContainer)
          submissionDateCustomContainer.style.display = "block";
        submissionDateFrom.value = "";
        submissionDateTo.value = "";
        submissionDateFrom.classList.remove("invalid");
        submissionDateTo.classList.remove("invalid");
      } else {
        if (submissionDateCustomContainer)
          submissionDateCustomContainer.style.display = "none";
        state.customSubmissionDateRange = { from: null, to: null };
        state.currentSubmissionDateFilter = e.target.value;
        state.currentPage = 1;
        fetchGenericDocuments();
      }
    });
  }

  if (applySubmissionDateCustom) {
    applySubmissionDateCustom.addEventListener("click", () => {
      const from = submissionDateFrom.value.trim();
      const to = submissionDateTo.value.trim();

      if (!from && !to) {
        showMessage(
          "Vui lòng nhập ít nhất một ngày cho khoảng tùy chỉnh",
          true,
        );
        return;
      }

      let fromDate = null;
      let toDate = null;

      if (from) {
        const fromResult = validateAndParseDate(from);
        if (!fromResult.isValid) {
          showMessage(`Ngày "Từ": ${fromResult.message}`, true);
          submissionDateFrom.focus();
          return;
        }
        fromDate = fromResult.date;
      }

      if (to) {
        const toResult = validateAndParseDate(to);
        if (!toResult.isValid) {
          showMessage(`Ngày "Đến": ${toResult.message}`, true);
          submissionDateTo.focus();
          return;
        }
        toDate = toResult.date;
      }

      if (fromDate && toDate && fromDate > toDate) {
        showMessage('Ngày "Từ" không được sau ngày "Đến"', true);
        submissionDateFrom.focus();
        return;
      }

      state.customSubmissionDateRange = {
        from: fromDate ? formatDateToDDMMYYYY(fromDate) : null,
        to: toDate ? formatDateToDDMMYYYY(toDate) : null,
      };
      state.currentSubmissionDateFilter = "custom";
      state.currentPage = 1;
      fetchGenericDocuments();

      let dateText = "Tùy chỉnh: ";
      if (from && to) {
        dateText += `${from} - ${to}`;
      } else if (from) {
        dateText += `Từ ${from}`;
      } else if (to) {
        dateText += `Đến ${to}`;
      }

      const customOption = submissionDateFilter.querySelector(
        'option[value="custom"]',
      );
      if (customOption) customOption.textContent = dateText;

      showMessage("Đã áp dụng khoảng ngày tùy chỉnh");
    });
  }

  if (clearSubmissionDateCustom) {
    clearSubmissionDateCustom.addEventListener("click", () => {
      submissionDateFrom.value = "";
      submissionDateTo.value = "";
      submissionDateFrom.classList.remove("invalid");
      submissionDateTo.classList.remove("invalid");
      state.customSubmissionDateRange = { from: null, to: null };
      state.currentSubmissionDateFilter = "";
      submissionDateFilter.value = "";
      if (submissionDateCustomContainer)
        submissionDateCustomContainer.style.display = "none";

      const customOption = submissionDateFilter.querySelector(
        'option[value="custom"]',
      );
      if (customOption)
        customOption.textContent = "Chọn khoảng ngày tùy chỉnh...";

      state.currentPage = 1;
      fetchGenericDocuments();
    });
  }

  const handleEnterKey = (inputElement, buttonElement) => {
    if (inputElement && buttonElement) {
      inputElement.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          buttonElement.click();
        }
      });
    }
  };

  handleEnterKey(submissionDateFrom, applySubmissionDateCustom);
  handleEnterKey(submissionDateTo, applySubmissionDateCustom);
};

// Event listeners
const setupEventListeners = () => {
  const pendingToggle = document.getElementById("pendingToggle");
  if (pendingToggle) {
    pendingToggle.addEventListener("change", (e) => {
      state.showOnlyPendingApprovals = e.target.checked;
      state.currentPage = 1;
      fetchGenericDocuments();
    });
  }

  const paginationToggle = document.getElementById("paginationToggle");
  if (paginationToggle) {
    paginationToggle.addEventListener("change", () => {
      state.paginationEnabled = paginationToggle.checked;
      state.currentPage = 1;
      fetchGenericDocuments();
    });
  }

  document.addEventListener("keypress", (e) => {
    if (e.target.id === "pageInput" && e.key === "Enter") {
      goToPage();
    }
  });

  const exportBtn = document.getElementById("exportSelectedBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportSelectedToExcel());
  }

  const massDeclarationBtn = document.getElementById("massDeclarationBtn");
  if (massDeclarationBtn) {
    massDeclarationBtn.addEventListener("click", () =>
      openMassDeclarationModal(),
    );
  }

  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => toggleSelectAll());
  }

  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("doc-checkbox")) {
      updateDocumentSelection(e.target);
      updateSelectAllCheckbox();
    }
  });

  const suspendForm = document.getElementById("suspendForm");
  if (suspendForm) {
    suspendForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSuspendSubmit(e);
    });
  }

  const fullViewClose = document.querySelector("#fullViewModal .modal-close");
  if (fullViewClose) {
    fullViewClose.addEventListener("click", () => {
      closeFullViewModal();
    });
  }

  const tagFilter = document.getElementById("tagFilter");
  if (tagFilter) {
    tagFilter.addEventListener("input", (e) => {
      state.currentTagFilter = e.target.value.toLowerCase();
      state.currentPage = 1;
      fetchGenericDocuments();
    });
  }

  const nameFilter = document.getElementById("nameFilter");
  if (nameFilter) {
    nameFilter.addEventListener("input", (e) => {
      state.currentNameFilter = e.target.value.toLowerCase();
      state.currentPage = 1;
      fetchGenericDocuments();
    });
  }

  const projectFilter = document.getElementById("projectFilter");
  if (projectFilter) {
    projectFilter.addEventListener("input", (e) => {
      state.currentProjectFilter = e.target.value.toLowerCase();
      state.currentPage = 1;
      fetchGenericDocuments();
    });
  }

  const massDeclarationForm = document.getElementById("massDeclarationForm");
  if (massDeclarationForm) {
    massDeclarationForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleMassDeclarationSubmit(e);
    });
  }

  const editForm = document.getElementById("editForm");
  if (editForm) {
    editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleEditSubmit(e);
    });
  }
};

// Initialize the application
const initialize = async () => {
  await fetchCurrentUser();
  await populateGroupMultiSelect();
  initializeMultiSelect();
  setupEventListeners();
  setupCustomFilterHandlers();
  await fetchGenericDocuments();
};

// Make functions available globally
window.changePage = changePage;
window.goToPage = goToPage;
window.approveDocument = approveDocument;
window.deleteDocument = deleteDocument;
window.suspendDocument = suspendDocument;
window.openDocument = openDocument;
window.editDeclaration = editDeclaration;
window.saveDeclaration = saveDeclaration;
window.closeDeclarationModal = closeDeclarationModal;
window.showFullView = showFullView;
window.editDocument = editDocument;
window.closeEditModal = closeEditModal;
window.updateApproverSubRole = updateApproverSubRole;
window.removeApprover = removeApprover;
window.addNewApprover = addNewApprover;
window.removeExistingFile = removeExistingFile;
window.closeSuspendModal = closeSuspendModal;
window.closeMassDeclarationModal = closeMassDeclarationModal;

document.addEventListener("DOMContentLoaded", initialize);
