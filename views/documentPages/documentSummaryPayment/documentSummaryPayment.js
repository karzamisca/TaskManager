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
  currentTagFilter: "",
  currentCostCenterFilter: [], // Changed to array for multiple selection
  currentGroupFilter: "",
  currentGroupDeclarationFilter: "",
  currentPaymentMethodFilter: "",
  costCenters: [], // Store cost centers for multi-select
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
    const response = await fetch("/costCenters");
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
  fetchPaymentDocuments();
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

  // Handle multiple files
  if (doc.fileMetadata && doc.fileMetadata.length > 0) {
    html += `<div class="file-attachments">`;
    doc.fileMetadata.forEach((file, index) => {
      html += `<a href="${file.link}" class="payment-file-link" target="_blank">
        <i class="fas fa-paperclip"></i> ${file.name}
        ${file.size ? ` (${file.size})` : ""}
      </a>${index < doc.fileMetadata.length - 1 ? "<br>" : ""}`;
    });
    html += `</div>`;
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

// Helper function to render stage approval status
const renderStageApprovalStatus = (approvers, approvedBy) => {
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

const fetchPaymentDocuments = async () => {
  showLoading(true);

  try {
    const response = await fetch("/getPaymentDocumentForSeparatedView");
    const data = await response.json();
    state.paymentDocuments = data.paymentDocuments;

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

  // Apply tag filter if there's a search term
  if (state.currentTagFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.tag?.toLowerCase().includes(state.currentTagFilter)
    );
  }

  // Apply cost center filter if selected (now handles multiple)
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

  // Apply declaration group filter if selected
  if (state.currentGroupDeclarationFilter) {
    filteredDocs = filteredDocs.filter((doc) => {
      // Check document-level group declaration
      const docLevelMatch =
        doc.groupDeclarationName === state.currentGroupDeclarationFilter;

      // Check stage-level group declarations
      const stageLevelMatch = doc.stages?.some(
        (stage) =>
          stage.groupDeclarationName === state.currentGroupDeclarationFilter
      );

      // Return true if either document-level or any stage-level matches
      return docLevelMatch || stageLevelMatch;
    });
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

// Filter functions
const filterByTag = () => {
  state.currentTagFilter = document
    .getElementById("tagFilter")
    .value.toLowerCase();
  state.currentPage = 1;
  fetchPaymentDocuments();
};

const filterByGroup = () => {
  state.currentGroupFilter = document.getElementById("groupFilter").value;
  state.currentPage = 1;
  fetchPaymentDocuments();
};

const filterByGroupDeclaration = () => {
  state.currentGroupDeclarationFilter = document.getElementById(
    "groupDeclarationFilter"
  ).value;
  state.currentPage = 1;
  fetchPaymentDocuments();
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

const fetchGroupDeclaration = async () => {
  try {
    const response = await fetch("/getGroupDeclaration");
    const groups = await response.json();
    const filterDropdown = document.getElementById("groupDeclarationFilter");

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

const filterByPaymentMethod = () => {
  state.currentPaymentMethodFilter = document.getElementById(
    "paymentMethodFilter"
  ).value;
  state.currentPage = 1;
  fetchPaymentDocuments();
};

const getDocumentPriority = (doc) => {
  // If document is already approved, return null (no special coloring)
  if (doc.status === "Approved") {
    return null;
  }

  // For documents with stages, find the highest priority among unapproved stages
  if (doc.stages && doc.stages.length > 0) {
    const unapprovedStages = doc.stages.filter(
      (stage) => stage.status !== "Approved" && stage.priority
    );

    if (unapprovedStages.length > 0) {
      // Find the highest priority among unapproved stages
      const priorities = {
        Cao: 3,
        "Trung bình": 2,
        Thấp: 1,
      };

      let highestPriority = "Thấp";
      let highestPriorityValue = 1;

      unapprovedStages.forEach((stage) => {
        const currentPriorityValue = priorities[stage.priority] || 1;
        if (currentPriorityValue > highestPriorityValue) {
          highestPriorityValue = currentPriorityValue;
          highestPriority = stage.priority;
        }
      });

      return highestPriority;
    }
  }

  // For documents without stages or all stages approved, use document priority
  return doc.priority || "Thấp";
};

// Add this helper function to determine if a document should show priority badge
const shouldShowPriorityBadge = (doc) => {
  // Only show badge for unapproved documents
  if (doc.status === "Approved") {
    return false;
  }

  // For documents with stages, only show badge if all stages are approved
  if (doc.stages && doc.stages.length > 0) {
    const allStagesApproved = doc.stages.every(
      (stage) => stage.status === "Approved"
    );
    return allStagesApproved;
  }

  // For documents without stages, show badge
  return true;
};

// Update the getDocumentPriority function to handle badge priority specifically
const getDocumentPriorityForBadge = (doc) => {
  // For documents with stages where all are approved, use document priority
  if (doc.stages && doc.stages.length > 0) {
    const allStagesApproved = doc.stages.every(
      (stage) => stage.status === "Approved"
    );
    if (allStagesApproved) {
      return doc.priority || "Thấp";
    }
    return null; // Don't show badge if there are unapproved stages
  }

  // For documents without stages, use document priority
  return doc.priority || "Thấp";
};

// Update the renderDocumentsTable function
// Check if document is partially approved (some but not all document approvers have approved)
const isDocumentPartiallyApproved = (doc) => {
  // Document must be in pending status
  if (doc.status !== "Pending") return false;

  // Must have document-level approvers
  if (!doc.approvers || doc.approvers.length === 0) return false;

  // Must have some but not all approvers approved
  const approvedCount = doc.approvedBy?.length || 0;
  const totalApprovers = doc.approvers.length;

  return approvedCount > 0 && approvedCount < totalApprovers;
};

// Suspend a specific payment stage
const suspendPaymentStage = async (docId, stageIndex) => {
  const suspendReason = prompt("Nhập lý do từ chối giai đoạn thanh toán:");

  if (!suspendReason || suspendReason.trim() === "") {
    showMessage("Vui lòng nhập lý do từ chối.", true);
    return;
  }

  try {
    const response = await fetch(
      `/suspendPaymentStage/${docId}/${stageIndex}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ suspendReason: suspendReason.trim() }),
      }
    );

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      fetchPaymentDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error suspending payment stage:", err);
    showMessage("Lỗi khi từ chối giai đoạn thanh toán.", true);
  }
};

// Open a suspended payment stage
const openPaymentStage = async (docId, stageIndex) => {
  if (!confirm("Bạn có chắc chắn muốn mở lại giai đoạn thanh toán này?")) {
    return;
  }

  try {
    const response = await fetch(`/openPaymentStage/${docId}/${stageIndex}`, {
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
    console.error("Error opening payment stage:", err);
    showMessage("Lỗi khi mở lại giai đoạn thanh toán.", true);
  }
};

// Update the renderDocumentsTable function to include priority update button
const renderDocumentsTable = (documents) => {
  const tableBody = document
    .getElementById("paymentDocumentsTable")
    .querySelector("tbody");
  tableBody.innerHTML = "";

  documents.forEach((doc) => {
    // Check if user can approve the document
    const canApproveDocument =
      doc.approvers.some(
        (approver) => approver.username === state.currentUser?.username
      ) &&
      (!doc.stages ||
        doc.stages.length === 0 ||
        doc.stages.every((stage) => stage.status === "Approved"));

    // Check which stages the user can approve
    const approvableStages =
      doc.stages
        ?.map((stage, index) => {
          const canApprove =
            stage.approvers.some(
              (approver) => approver.username === state.currentUser?.username
            ) &&
            !stage.approvedBy.some(
              (approver) => approver.username === state.currentUser?.username
            ) &&
            stage.status === "Pending";
          return { index, canApprove };
        })
        .filter((stage) => stage.canApprove) || [];

    // Determine priority for coloring and badge
    const priority = getDocumentPriority(doc);
    const priorityClass = priority
      ? `priority-${priority.toLowerCase().replace(" ", "-")}`
      : "";

    // Check if we should show priority badge next to tag
    const showPriorityBadge = shouldShowPriorityBadge(doc);
    const badgePriority = showPriorityBadge
      ? getDocumentPriorityForBadge(doc)
      : null;

    // Check if document is partially approved
    const isPartiallyApproved = isDocumentPartiallyApproved(doc);

    const row = document.createElement("tr");
    if (priorityClass) {
      row.className = priorityClass;
    }
    if (isPartiallyApproved) {
      row.classList.add("partially-approved-doc");
    }

    row.innerHTML = `
      <td><input type="checkbox" class="doc-checkbox" data-doc-id="${
        doc._id
      }" ${state.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${doc.tag || "-"}
          ${
            badgePriority
              ? `<span class="priority-badge priority-${badgePriority
                  .toLowerCase()
                  .replace(" ", "-")}">
                  ${badgePriority}
                </span>`
              : ""
          }
        </div>
      </td>
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
        ${
          doc.stages?.length > 0
            ? `<div class="stages-summary">
                <strong>Các giai đoạn:</strong>
                ${doc.stages
                  .map((stage, idx) => {
                    return `
                  <div class="stage-summary-item ${
                    stage.status === "Approved"
                      ? "approved"
                      : stage.status === "Suspended"
                      ? "suspended"
                      : "pending"
                  }">
                    <span>GĐ ${idx + 1}: ${stage.name}</span>
                    <span>${formatCurrency(stage.amount)}</span>
                    <span class="status-badge">${
                      stage.status === "Approved"
                        ? "Đã duyệt"
                        : stage.status === "Suspended"
                        ? "Từ chối"
                        : "Chờ duyệt"
                    }</span>
                    ${
                      stage.priority && stage.status !== "Approved"
                        ? `<span class="priority-badge priority-${stage.priority
                            .toLowerCase()
                            .replace(" ", "-")}" 
                              style="margin-left: 8px; font-size: 0.7em;">
                            ${stage.priority}
                          </span>`
                        : ""
                    }
                    ${
                      stage.status === "Suspended" && stage.suspendReason
                        ? `<div class="suspend-reason" style="font-size: 0.8em; margin-top: 4px;">
                            <strong>Lý do:</strong> ${stage.suspendReason}
                           </div>`
                        : ""
                    }
                    <div class="stage-action-buttons">
                      ${
                        stage.status === "Pending"
                          ? `<button class="btn btn-danger btn-sm btn-suspend" 
                                 onclick="suspendPaymentStage('${doc._id}', ${idx})">
                              <i class="fas fa-ban"></i> Từ chối
                            </button>`
                          : ""
                      }
                      ${
                        stage.status === "Suspended"
                          ? `<button class="btn btn-primary btn-sm btn-open" 
                                 onclick="openPaymentStage('${doc._id}', ${idx})">
                              <i class="fas fa-lock-open"></i> Mở
                            </button>`
                          : ""
                      }
                      ${
                        stage.approvers.some(
                          (approver) =>
                            approver.username === state.currentUser?.username
                        ) &&
                        !stage.approvedBy.some(
                          (approved) =>
                            approved.username === state.currentUser?.username
                        ) &&
                        stage.status === "Pending"
                          ? `<button class="btn btn-primary btn-sm stage-approve-btn" 
                                 onclick="approvePaymentStage('${
                                   doc._id
                                 }', ${idx})">
                              <i class="fas fa-check-circle"></i> Duyệt GĐ ${
                                idx + 1
                              }
                            </button>`
                          : ""
                      }
                    </div>
                  </div>`;
                  })
                  .join("")}
              </div>`
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
            doc.approvedBy.length === 0 &&
            (!doc.stages || doc.stages.length === 0)
              ? `
            <button class="btn btn-primary btn-sm" onclick="editDocument('${doc._id}')">
              <i class="fas fa-edit"></i> Sửa
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteDocument('${doc._id}')">
              <i class="fas fa-trash"></i> Xóa
            </button>
          `
              : doc.approvedBy.length === 0
              ? `
            <button class="btn btn-primary btn-sm" onclick="editDocument('${doc._id}')">
              <i class="fas fa-edit"></i> Sửa
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
            // Priority update button for partially approved documents
            isPartiallyApproved
              ? `
                <button class="btn btn-priority btn-sm" onclick="openPriorityUpdateModal('${doc._id}')">
                  <i class="fas fa-exclamation-triangle"></i> Cập nhật ưu tiên
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

// Priority Update Modal Functions
const openPriorityUpdateModal = (docId) => {
  const doc = state.paymentDocuments.find((d) => d._id === docId);
  if (!doc) return;

  // Populate modal with document info
  document.getElementById("priorityUpdateDocTag").textContent =
    doc.tag || doc.name;
  document.getElementById("documentPriorityUpdate").value =
    doc.priority || "Thấp";

  // Show current approval status
  const approvalStatusContainer = document.getElementById(
    "currentApprovalStatus"
  );
  approvalStatusContainer.innerHTML = `
    <div style="font-size: 0.9rem;">
      <div>Đã phê duyệt: ${doc.approvedBy?.length || 0}/${
    doc.approvers.length
  }</div>
      <div>Người chưa phê duyệt: ${
        doc.approvers.length - (doc.approvedBy?.length || 0)
      }</div>
    </div>
  `;

  // Store current document ID for update
  document.getElementById("priorityUpdateModal").dataset.docId = docId;

  // Show modal
  document.getElementById("priorityUpdateModal").style.display = "block";
};

const closePriorityUpdateModal = () => {
  document.getElementById("priorityUpdateModal").style.display = "none";
  document.getElementById("priorityUpdateModal").dataset.docId = "";
};

const updateDocumentPriority = async () => {
  const docId = document.getElementById("priorityUpdateModal").dataset.docId;
  const newPriority = document.getElementById("documentPriorityUpdate").value;

  if (!docId) {
    showMessage("Không tìm thấy tài liệu để cập nhật", true);
    return;
  }

  try {
    const response = await fetch(`/updatePaymentDocumentPriority/${docId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority: newPriority }),
    });

    const message = await response.text();

    if (response.ok) {
      showMessage(message);
      closePriorityUpdateModal();

      // Update local state and refresh view
      const docIndex = state.paymentDocuments.findIndex((d) => d._id === docId);
      if (docIndex !== -1) {
        state.paymentDocuments[docIndex].priority = newPriority;
      }
      fetchPaymentDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating document priority:", err);
    showMessage("Lỗi khi cập nhật ưu tiên", true);
  }
};

const parseDateFromString = (dateStr) => {
  if (!dateStr) return null;

  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
  const year = parseInt(parts[2], 10);

  // Validate date components
  if (isNaN(day)) return null;
  if (isNaN(month)) return null;
  if (isNaN(year)) return null;
  if (year < 1000) return null; // Basic year validation

  const date = new Date(year, month, day);

  // Check if the date is valid (handles cases like 31-02-2023)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const updateSummary = (filteredDocuments) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);
  thirtyDaysLater.setHours(0, 0, 0, 0);

  // First, calculate the original summary values exactly as before
  const originalSummary = filteredDocuments.reduce(
    (acc, doc) => {
      if (doc.status === "Approved") {
        if (doc.advancePayment === 0) {
          acc.paidSum += doc.totalPayment;
        } else if (doc.totalPayment === 0) {
          acc.paidSum += doc.advancePayment;
        } else {
          acc.paidSum += doc.totalPayment - doc.advancePayment;
        }
        acc.approvedDocument += 1;
      } else if (doc.approvers.length - doc.approvedBy.length === 1) {
        if (doc.advancePayment === 0) {
          acc.approvedSum += doc.totalPayment;
        } else if (doc.totalPayment === 0) {
          acc.approvedSum += doc.advancePayment;
        } else {
          acc.approvedSum += doc.totalPayment - doc.advancePayment;
        }
        acc.unapprovedDocument += 1;
      } else {
        if (doc.advancePayment === 0) {
          acc.unapprovedSum += doc.totalPayment;
        } else if (doc.totalPayment === 0) {
          acc.unapprovedSum += doc.advancePayment;
        } else {
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

  // Then calculate the new values (due in 30 days and expired) only for pending documents
  const newCalculations = filteredDocuments.reduce(
    (acc, doc) => {
      // Skip approved and suspended documents
      if (doc.status !== "Pending") return acc;

      // Helper function to parse DD-MM-YYYY dates
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        // Validate the date
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month ||
          date.getDate() !== day
        ) {
          return null;
        }
        return date;
      };

      // For documents with stages
      if (doc.stages && doc.stages.length > 0) {
        doc.stages.forEach((stage) => {
          const deadline = parseDate(stage.deadline);
          if (!deadline) return;

          const amount = stage.amount || 0;

          if (deadline >= today && deadline <= thirtyDaysLater) {
            acc.dueIn30DaysSum += amount;
          } else if (deadline < today) {
            acc.expiredSum += amount;
          }
        });
      }
      // For documents without stages
      else {
        const deadline = parseDate(doc.paymentDeadline);
        if (!deadline) return;

        const amount = doc.totalPayment || 0;

        if (deadline >= today && deadline <= thirtyDaysLater) {
          acc.dueIn30DaysSum += amount;
        } else if (deadline < today) {
          acc.expiredSum += amount;
        }
      }

      return acc;
    },
    {
      dueIn30DaysSum: 0,
      expiredSum: 0,
    }
  );

  // Update the summary display
  document.getElementById("paidSum").textContent = formatCurrency(
    originalSummary.paidSum
  );
  document.getElementById("approvedSum").textContent = formatCurrency(
    originalSummary.approvedSum
  );
  document.getElementById("unapprovedSum").textContent = formatCurrency(
    originalSummary.unapprovedSum
  );
  document.getElementById("approvedDocument").textContent =
    originalSummary.approvedDocument.toLocaleString();
  document.getElementById("unapprovedDocument").textContent =
    originalSummary.unapprovedDocument.toLocaleString();

  // Update the new fields
  document.getElementById("dueIn30DaysSum").textContent = formatCurrency(
    newCalculations.dueIn30DaysSum
  );
  document.getElementById("expiredSum").textContent = formatCurrency(
    newCalculations.expiredSum
  );
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
    fetchPaymentDocuments();
    document.querySelector("table").scrollIntoView({ behavior: "smooth" });
  }
};

// Document actions
const approveDocument = async (documentId) => {
  try {
    const response = await fetch(`/approvePaymentDocument/${documentId}`, {
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

const approvePaymentStage = async (docId, stageIndex) => {
  try {
    const response = await fetch(
      `/approvePaymentStage/${docId}/${stageIndex}`,
      {
        method: "POST",
      }
    );

    const result = await response.json();

    if (response.ok) {
      showMessage(result.message);

      // If we can now approve the document, show a special message
      if (result.canApproveDocument) {
        showMessage(
          "Tất cả giai đoạn đã được phê duyệt. Bạn có thể phê duyệt toàn bộ phiếu thanh toán bây giờ."
        );
      }

      fetchPaymentDocuments();
    } else {
      showMessage(result.message || "Error approving stage", true);
    }
  } catch (err) {
    console.error("Error approving payment stage:", err);
    showMessage("Error approving payment stage", true);
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
  // Remove any existing declaration modal first
  const existingModal = document.getElementById("declarationModal");
  if (existingModal) {
    existingModal.remove();
  }

  const doc = state.paymentDocuments.find((d) => d._id === docId);
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
      // Update the local state to reflect changes
      const docIndex = state.paymentDocuments.findIndex((d) => d._id === docId);
      if (docIndex !== -1) {
        state.paymentDocuments[docIndex].declaration = declaration;
      }
      fetchPaymentDocuments(); // Refresh the view
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

// Handle payment stages
const renderPaymentStages = () => {
  const container = document.getElementById("paymentStagesContainer");
  container.innerHTML = "";

  if (
    !state.currentEditDoc?.stages ||
    state.currentEditDoc.stages.length === 0
  ) {
    container.innerHTML =
      "<p>Không có giai đoạn thanh toán nào được thiết lập</p>";
    return;
  }

  state.currentEditDoc.stages.forEach((stage, index) => {
    const isPartiallyApproved = stage.approvedBy?.length > 0;
    const isFullyApproved = stage.status === "Approved";
    const isSuspended = stage.status === "Suspended";
    const isNewStage = !stage._id;

    // Only lock fully approved stages, NOT suspended stages
    const isLocked = isFullyApproved; // Removed isSuspended from this condition

    const stageElement = document.createElement("div");
    stageElement.className = `payment-stage ${
      isPartiallyApproved ? "partially-approved-stage" : ""
    } ${isFullyApproved ? "approved-stage" : ""} ${
      isSuspended ? "stage-suspended" : ""
    }`;
    stageElement.dataset.index = index;

    stageElement.innerHTML = `
      <div class="stage-header">
        <h4>Giai đoạn ${index + 1} ${
      isPartiallyApproved
        ? `(${stage.approvedBy.length}/${stage.approvers.length} đã duyệt)`
        : ""
    } ${isFullyApproved ? "(Đã phê duyệt hoàn toàn)" : ""}
      ${isSuspended ? "(Đã từ chối)" : ""}</h4>
        ${
          !isLocked && !isSuspended // Allow deletion only for non-suspended, non-approved stages
            ? `<button type="button" class="btn btn-danger btn-sm" onclick="removeSpecificStage(${index})">
                <i class="fas fa-trash"></i> Xóa
              </button>`
            : isSuspended
            ? '<span class="lock-icon"><i class="fas fa-ban"></i> Đã từ chối (Có thể chỉnh sửa)</span>'
            : '<span class="lock-icon"><i class="fas fa-lock"></i> Đã khóa</span>'
        }
      </div>
      
      ${
        isSuspended && stage.suspendReason
          ? `<div class="suspend-reason">
              <strong>Lý do từ chối:</strong> ${stage.suspendReason}
             </div>`
          : ""
      }
      
      <div class="form-group">
        <label>Tên giai đoạn:</label>
        <input type="text" class="form-input stage-name" value="${
          stage.name || ""
        }" 
               onchange="updateStageField(${index}, 'name', this.value)"
               ${isLocked ? "disabled" : ""}>
      </div>
      <div class="form-group">
        <label>Số tiền:</label>
        <input type="number" class="form-input stage-amount" value="${
          stage.amount || 0
        }" 
               onchange="updateStageField(${index}, 'amount', this.value)"
               ${isLocked ? "disabled" : ""}>
      </div>
      <div class="form-group">
        <label>Mức độ ưu tiên:</label>
        <select class="form-select stage-priority"
                onchange="updateStageField(${index}, 'priority', this.value)"
                ${isLocked ? "disabled" : ""}>
          <option value="Thấp" ${
            stage.priority === "Thấp" ? "selected" : ""
          }>Thấp</option>
          <option value="Trung bình" ${
            stage.priority === "Trung bình" ? "selected" : ""
          }>Trung bình</option>
          <option value="Cao" ${
            stage.priority === "Cao" ? "selected" : ""
          }>Cao</option>
        </select>
      </div>
      <div class="form-group">
        <label>Hạn thanh toán:</label>
        <input type="text" class="form-input stage-deadline" value="${
          stage.deadline || ""
        }" 
               placeholder="DD-MM-YYYY" pattern="(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-[0-9]{4}"
               onchange="updateStageField(${index}, 'deadline', this.value)"
               ${isLocked ? "disabled" : ""}>
      </div>
      <div class="form-group">
        <label>Hình thức thanh toán:</label>
        <select class="form-input stage-payment-method"
                onchange="updateStageField(${index}, 'paymentMethod', this.value)"
                ${isLocked ? "disabled" : ""}>
          <option value="Không có" ${
            stage.paymentMethod === "Không có" ? "selected" : ""
          }>Không có</option>
          <option value="Chuyển khoản nội bộ" ${
            stage.paymentMethod === "Chuyển khoản nội bộ" ? "selected" : ""
          }>Chuyển khoản nội bộ</option>
          <option value="Tiền mặt" ${
            stage.paymentMethod === "Tiền mặt" ? "selected" : ""
          }>Tiền mặt</option>
        </select>
      </div>
      <div class="form-group">
        <label>Ghi chú:</label>
        <textarea class="form-textarea stage-notes" 
                  onchange="updateStageField(${index}, 'notes', this.value)"
                  ${isLocked ? "disabled" : ""}>${stage.notes || ""}</textarea>
      </div>
      ${
        // Only show file upload section if this is not a new stage
        !isNewStage
          ? `<div class="form-group">
              <label>Tệp đính kèm:</label>
              ${
                stage.fileMetadata
                  ? `<div class="file-attachment">
                      <a href="${stage.fileMetadata.link}" target="_blank">${
                      stage.fileMetadata.name
                    }</a>
                      <button type="button" class="btn btn-danger btn-sm" onclick="removeStageFile(${index})" ${
                      isLocked ? "disabled" : ""
                    }>
                        <i class="fas fa-trash"></i> Xóa
                      </button>
                    </div>`
                  : '<div class="file-upload-container">' +
                    '<input type="file" id="stageFileInput' +
                    index +
                    '" class="form-input" style="display: none;" ' +
                    (isLocked ? "disabled" : "") +
                    ">" +
                    '<button type="button" class="btn btn-primary btn-sm" onclick="uploadStageFile(' +
                    index +
                    ')" ' +
                    (isLocked ? "disabled" : "") +
                    ">" +
                    '<i class="fas fa-upload"></i> Tải lên tệp' +
                    "</button>" +
                    "</div>"
              }
            </div>`
          : ""
      }
      <div class="form-group">
        <label>Người phê duyệt:</label>
        <div class="stage-approvers-container" id="stageApproversContainer${index}">
          ${renderStageApprovers(
            stage.approvers || [],
            stage.approvedBy || [],
            index,
            isLocked
          )}
        </div>
        ${
          !isLocked
            ? `<div class="add-stage-approver">
                <select class="form-select stage-approver-select" id="stageApproverSelect${index}">
                  <option value="">Chọn người phê duyệt</option>
                </select>
                <input type="text" class="form-input stage-approver-subrole" 
                       id="stageApproverSubRole${index}" placeholder="Vai trò">
                <button type="button" class="btn btn-primary btn-sm" 
                        onclick="addStageApprover(${index})">
                  <i class="fas fa-plus"></i> Thêm
                </button>
              </div>`
            : ""
        }
      </div>
      <div class="stage-controls">
        ${
          stage.status === "Pending" || stage.status === "Suspended"
            ? `<button type="button" class="btn btn-suspend btn-sm" 
                     onclick="suspendPaymentStage('${state.currentEditDoc._id}', ${index})">
                <i class="fas fa-ban"></i> Từ chối giai đoạn
              </button>`
            : ""
        }
        ${
          stage.status === "Suspended"
            ? `<button type="button" class="btn btn-open btn-sm" 
                     onclick="openPaymentStage('${state.currentEditDoc._id}', ${index})">
                <i class="fas fa-lock-open"></i> Mở giai đoạn
              </button>`
            : ""
        }
      </div>
    `;

    container.appendChild(stageElement);
    if (!isLocked) {
      populateStageApproversDropdown(index);
    }
  });
};

const uploadStageFile = async (stageIndex) => {
  const fileInput = document.getElementById(`stageFileInput${stageIndex}`);

  // If no file is selected, trigger the file selection dialog
  if (!fileInput.files[0]) {
    fileInput.click(); // This opens the file selection dialog

    // Add event listener to handle file selection
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (file) {
        await handleStageFileUpload(stageIndex, file);
      }
    };
    return;
  }

  // If file is already selected, proceed with upload
  const file = fileInput.files[0];
  await handleStageFileUpload(stageIndex, file);
};

// Separate function to handle the actual file upload
const handleStageFileUpload = async (stageIndex, file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    showLoading(true);
    const response = await fetch(
      `/uploadStageFile/${state.currentEditDoc._id}/${stageIndex}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();
    if (response.ok) {
      showMessage("Tệp đã được tải lên thành công");
      // Update the local state
      state.currentEditDoc.stages[stageIndex].fileMetadata =
        result.fileMetadata;
      renderPaymentStages();

      // Clear the file input for future uploads
      document.getElementById(`stageFileInput${stageIndex}`).value = "";
    }
  } catch (error) {
    console.error("Error uploading stage file:", error);
  } finally {
    showLoading(false);
  }
};

const removeStageFile = async (stageIndex) => {
  if (!confirm("Bạn có chắc chắn muốn xóa tệp đính kèm này?")) {
    return;
  }

  try {
    showLoading(true);
    const response = await fetch(
      `/removeStageFile/${state.currentEditDoc._id}/${stageIndex}`,
      {
        method: "POST",
      }
    );

    const result = await response.json();
    if (response.ok) {
      showMessage(result.message);
      // Update the local state
      state.currentEditDoc.stages[stageIndex].fileMetadata = null;
      renderPaymentStages();
    } else {
      showMessage(result.message || "Error removing file", true);
    }
  } catch (error) {
    console.error("Error removing stage file:", error);
    showMessage("Lỗi khi xóa tệp", true);
  } finally {
    showLoading(false);
  }
};

const renderStageApprovers = (approvers, approvedBy, stageIndex, isLocked) => {
  return approvers
    .map((approver) => {
      const hasApproved = approvedBy.some(
        (a) => a.username === approver.username
      );
      return `
      <div class="approver-item ${hasApproved ? "approved" : ""}">
        <span class="status-icon ${
          hasApproved ? "status-approved" : "status-pending"
        }"></span>
        <div class="approver-info">
          <div>${approver.username} (${approver.subRole})</div>
          ${
            hasApproved
              ? `<div class="approval-date">Đã phê duyệt</div>`
              : '<div class="approval-date">Chưa phê duyệt</div>'
          }
        </div>
        ${
          !isLocked
            ? `<button type="button" class="btn btn-danger btn-sm" 
                    onclick="removeStageApprover(${stageIndex}, '${approver.approver}')">
                <i class="fas fa-trash"></i> Xóa
              </button>`
            : ""
        }
      </div>
    `;
    })
    .join("");
};

const populateStageApproversDropdown = async (stageIndex) => {
  const allApprovers = await fetchApprovers();
  const currentApprovers =
    state.currentEditDoc.stages[stageIndex].approvers || [];
  const availableApprovers = allApprovers.filter(
    (approver) => !currentApprovers.some((a) => a.approver === approver._id)
  );

  const dropdown = document.getElementById(`stageApproverSelect${stageIndex}`);
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

const addPaymentStage = () => {
  if (!state.currentEditDoc.stages) {
    state.currentEditDoc.stages = [];
  }

  state.currentEditDoc.stages.push({
    name: `Giai đoạn ${state.currentEditDoc.stages.length + 1}`,
    amount: 0,
    priority: "Thấp", // Default priority
    deadline: "",
    paymentMethod: "",
    notes: "",
    approvers: [],
    approvedBy: [],
    status: "Pending",
    suspendReason: "",
  });

  renderPaymentStages();
};

const removePaymentStage = () => {
  if (state.currentEditDoc.stages && state.currentEditDoc.stages.length > 0) {
    const lastStage =
      state.currentEditDoc.stages[state.currentEditDoc.stages.length - 1];
    if (lastStage.approvedBy && lastStage.approvedBy.length > 0) {
      showMessage("Không thể xóa giai đoạn đã có người phê duyệt", true);
      return;
    }
    state.currentEditDoc.stages.pop();
    renderPaymentStages();
  }
};

const removeSpecificStage = (index) => {
  if (
    state.currentEditDoc.stages &&
    state.currentEditDoc.stages.length > index
  ) {
    const stage = state.currentEditDoc.stages[index];
    if (stage.approvedBy && stage.approvedBy.length > 0) {
      showMessage("Không thể xóa giai đoạn đã có người phê duyệt", true);
      return;
    }
    state.currentEditDoc.stages.splice(index, 1);
    renderPaymentStages();
  }
};

const updateStageField = (index, field, value) => {
  if (
    state.currentEditDoc.stages &&
    state.currentEditDoc.stages.length > index
  ) {
    state.currentEditDoc.stages[index][field] = value;
  }
};

const addStageApprover = async (stageIndex) => {
  const approverId = document.getElementById(
    `stageApproverSelect${stageIndex}`
  ).value;
  const subRole = document.getElementById(
    `stageApproverSubRole${stageIndex}`
  ).value;

  if (!approverId || !subRole.trim()) {
    showMessage("Vui lòng chọn người phê duyệt và nhập vai trò phụ.", true);
    return;
  }

  const allApprovers = await fetchApprovers();
  const approver = allApprovers.find((a) => a._id === approverId);

  if (approver) {
    // Check if approver already exists in this stage
    const existingApprover = state.currentEditDoc.stages[
      stageIndex
    ].approvers.find((a) => a.approver === approverId);

    if (existingApprover) {
      showMessage("Người phê duyệt này đã được thêm vào giai đoạn này.", true);
      return;
    }

    state.currentEditDoc.stages[stageIndex].approvers.push({
      approver: approverId,
      username: approver.username,
      subRole: subRole.trim(),
    });

    // Clear the input fields
    document.getElementById(`stageApproverSelect${stageIndex}`).value = "";
    document.getElementById(`stageApproverSubRole${stageIndex}`).value = "";

    renderPaymentStages();
    showMessage(`Đã thêm người phê duyệt vào giai đoạn ${stageIndex + 1}.`);
  }
};

const removeStageApprover = (stageIndex, approverId) => {
  if (
    state.currentEditDoc.stages &&
    state.currentEditDoc.stages.length > stageIndex
  ) {
    const stage = state.currentEditDoc.stages[stageIndex];

    // Check if this is the last approver
    if (stage.approvers.length === 1) {
      showMessage(
        "Không thể xóa người phê duyệt cuối cùng. Mỗi giai đoạn phải có ít nhất một người phê duyệt.",
        true
      );
      return;
    }

    // Check if the approver to be removed has already approved
    const approverToRemove = stage.approvers.find(
      (a) => a.approver === approverId
    );
    const hasAlreadyApproved = stage.approvedBy.some(
      (a) => a.username === approverToRemove?.username
    );

    if (hasAlreadyApproved) {
      showMessage(
        "Không thể xóa người phê duyệt đã thực hiện phê duyệt.",
        true
      );
      return;
    }

    if (!confirm("Bạn có chắc chắn muốn xóa người phê duyệt này không?")) {
      return;
    }

    state.currentEditDoc.stages[stageIndex].approvers =
      state.currentEditDoc.stages[stageIndex].approvers.filter(
        (a) => a.approver !== approverId
      );
    renderPaymentStages();
    showMessage("Đã xóa người phê duyệt khỏi giai đoạn.");
  }
};

const updateStageApproverSubRole = (stageIndex, approverId, newSubRole) => {
  if (
    state.currentEditDoc.stages &&
    state.currentEditDoc.stages.length > stageIndex
  ) {
    const approver = state.currentEditDoc.stages[stageIndex].approvers.find(
      (a) => a.approver === approverId
    );
    if (approver) {
      approver.subRole = newSubRole;
    }
  }
};

// Purchasing Documents Management
const fetchAvailablePurchasingDocuments = async () => {
  try {
    const response = await fetch("/approvedPurchasingDocumentsForPayment");
    return await response.json();
  } catch (error) {
    console.error("Error fetching purchasing documents:", error);
    return [];
  }
};

const populatePurchasingDocumentsDropdown = async () => {
  const availableDocs = await fetchAvailablePurchasingDocuments();
  const dropdown = document.getElementById("availablePurchasingDocs");

  dropdown.innerHTML = '<option value="">Chọn phiếu mua hàng</option>';

  availableDocs.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc._id;
    option.textContent = `${doc.name} - ${
      doc.tag || "No tag"
    } - ${formatCurrency(doc.grandTotalCost)}`;
    option.dataset.doc = JSON.stringify(doc);
    dropdown.appendChild(option);
  });
};

const renderCurrentPurchasingDocuments = () => {
  const container = document.getElementById("currentPurchasingDocuments");

  if (
    !state.currentEditDoc.appendedPurchasingDocuments ||
    state.currentEditDoc.appendedPurchasingDocuments.length === 0
  ) {
    container.innerHTML = "<p>Không có phiếu mua hàng nào được đính kèm</p>";
    return;
  }

  container.innerHTML = state.currentEditDoc.appendedPurchasingDocuments
    .map(
      (doc, index) => `
      <div class="purchasing-doc-item">
        <div class="purchasing-doc-header">
          <span class="purchasing-doc-title">${
            doc.name || "Không có tên"
          }</span>
          <button type="button" class="purchasing-doc-remove" onclick="removePurchasingDocument(${index})">
            <i class="fas fa-times"></i> Xóa
          </button>
        </div>
        <div class="purchasing-doc-details">
          <div class="purchasing-doc-detail"><strong>Tem:</strong> ${
            doc.tag || "Không có"
          }</div>
          <div class="purchasing-doc-detail"><strong>Trạm:</strong> ${
            doc.costCenter || "Không có"
          }</div>
          <div class="purchasing-doc-detail"><strong>Tổng chi phí:</strong> ${formatCurrency(
            doc.grandTotalCost
          )}</div>
          ${
            doc.products && doc.products.length > 0
              ? `
            <div class="purchasing-doc-products">
              <strong>Sản phẩm:</strong>
              ${doc.products
                .map(
                  (product) => `
                <div class="purchasing-doc-product">
                  <span>${product.productName}</span>
                  <span>${product.amount} x ${formatCurrency(
                    product.costPerUnit
                  )} = ${formatCurrency(product.totalCost)}</span>
                </div>
              `
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
      </div>
    `
    )
    .join("");
};

const addPurchasingDocument = () => {
  const dropdown = document.getElementById("availablePurchasingDocs");
  const selectedOption = dropdown.options[dropdown.selectedIndex];

  if (!selectedOption.value) {
    showMessage("Vui lòng chọn một phiếu mua hàng", true);
    return;
  }

  const selectedDoc = JSON.parse(selectedOption.dataset.doc);

  // Check if document is already added
  if (state.currentEditDoc.appendedPurchasingDocuments) {
    const alreadyAdded = state.currentEditDoc.appendedPurchasingDocuments.some(
      (doc) => doc._id === selectedDoc._id
    );

    if (alreadyAdded) {
      showMessage("Phiếu mua hàng này đã được thêm vào", true);
      return;
    }
  } else {
    state.currentEditDoc.appendedPurchasingDocuments = [];
  }

  // Add the document
  state.currentEditDoc.appendedPurchasingDocuments.push(selectedDoc);

  // Re-render the list
  renderCurrentPurchasingDocuments();

  // Reset dropdown
  dropdown.selectedIndex = 0;

  showMessage("Đã thêm phiếu mua hàng");
};

const removePurchasingDocument = (index) => {
  if (!confirm("Bạn có chắc chắn muốn xóa phiếu mua hàng này?")) {
    return;
  }

  state.currentEditDoc.appendedPurchasingDocuments.splice(index, 1);
  renderCurrentPurchasingDocuments();
  showMessage("Đã xóa phiếu mua hàng");
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
    document.getElementById("editPriority").value = doc.priority;
    document.getElementById("editNotes").value = doc.notes || "";

    await populateCostCenterDropdownForEditing();
    document.getElementById("editCostCenter").value = doc.costCenter;

    await populateGroupDropdownForEditing();
    document.getElementById("editGroupName").value = doc.groupName;

    state.currentApprovers = doc.approvers;
    state.currentEditDoc = doc;

    renderCurrentApprovers();
    await populateNewApproversDropdown();
    renderPaymentStages();

    // Initialize purchasing documents
    await populatePurchasingDocumentsDropdown();
    renderCurrentPurchasingDocuments();

    // Render current files
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

// Enhanced validation function for stages
const validatePaymentStages = () => {
  if (
    !state.currentEditDoc.stages ||
    state.currentEditDoc.stages.length === 0
  ) {
    return { isValid: true, errors: [] };
  }

  const errors = [];

  state.currentEditDoc.stages.forEach((stage, index) => {
    const stageNum = index + 1;

    // Check if stage has at least one approver
    if (!stage.approvers || stage.approvers.length === 0) {
      errors.push(`Giai đoạn ${stageNum}: Phải có ít nhất một người phê duyệt`);
    }

    // Check required fields
    if (!stage.name || stage.name.trim() === "") {
      errors.push(`Giai đoạn ${stageNum}: Tên giai đoạn không được để trống`);
    }

    if (!stage.amount || stage.amount <= 0) {
      errors.push(`Giai đoạn ${stageNum}: Số tiền phải lớn hơn 0`);
    }

    if (!stage.deadline || stage.deadline.trim() === "") {
      errors.push(`Giai đoạn ${stageNum}: Hạn thanh toán không được để trống`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
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
                ${
                  state.currentEditDoc.approvedBy?.length > 0 ? "disabled" : ""
                }>
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `
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
      "Bạn có chắc chắn muốn xóa tệp tin này? Hành động này không thể hoàn tác."
    )
  ) {
    return;
  }

  try {
    showLoading(true);

    // Call backend to delete the file
    const response = await fetch(
      `/deletePaymentDocumentFile/${state.currentEditDoc._id}/${fileToDelete.driveFileId}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    if (response.ok) {
      showMessage("Tệp tin đã được xóa thành công.");

      // Remove the file from local state
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

  // Validate payment stages first
  const stageValidation = validatePaymentStages();
  if (!stageValidation.isValid) {
    const errorMessage =
      "Lỗi trong các giai đoạn thanh toán:\n" +
      stageValidation.errors.join("\n");
    showMessage(errorMessage, true);
    return;
  }

  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  // Add basic fields
  formData.append("name", document.getElementById("editName").value);
  formData.append("content", document.getElementById("editContent").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value
  );
  formData.append("groupName", document.getElementById("editGroupName").value);
  formData.append("priority", document.getElementById("editPriority").value);
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
  formData.append("notes", document.getElementById("editNotes").value);

  // Add approvers
  formData.append("approvers", JSON.stringify(state.currentApprovers));

  // Add stages if they exist
  if (state.currentEditDoc.stages) {
    formData.append("stages", JSON.stringify(state.currentEditDoc.stages));
  }

  // Add purchasing documents if they exist
  if (state.currentEditDoc.appendedPurchasingDocuments) {
    formData.append(
      "appendedPurchasingDocuments",
      JSON.stringify(state.currentEditDoc.appendedPurchasingDocuments)
    );
  }

  // Add current file metadata (after potential deletions)
  if (state.currentEditDoc.fileMetadata) {
    formData.append(
      "currentFileMetadata",
      JSON.stringify(state.currentEditDoc.fileMetadata)
    );
  }

  // Add new files
  const fileInput = document.getElementById("editFiles");
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }
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
                `
                  )
                  .join("")}
              </div>`
            : "Không có tệp tin đính kèm"
        }
      </div>
    `;

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
            <span class="detail-label">Trạm:</span>
            <span class="detail-value">${doc.costCenter || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Nhóm:</span>
            <span class="detail-value">${doc.groupName || "Không có"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Mức độ ưu tiên:</span>
            <span class="detail-value">${doc.priority}</span>
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
            <span class="detail-label">Hạn trả:</span>
            <span class="detail-value">${paymentDeadline}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Ghi chú:</span>
            <span class="detail-value">${doc.notes}</span>
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
        ${filesSection}
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
    if (doc.stages && doc.stages.length > 0) {
      fullViewContent.innerHTML += `
      <div class="full-view-section">
        <h3><i class="fas fa-layer-group"></i> Các giai đoạn thanh toán</h3>
        <div class="stages-container">
          ${doc.stages
            .map(
              (stage, index) => `
            <div class="stage-item ${stage.status.toLowerCase()}">
              <div class="stage-header">
                <h4>Giai đoạn ${index + 1}: ${stage.name} (${stage.amount})</h4>
                <span class="status-badge">${
                  stage.status === "Approved"
                    ? "Đã phê duyệt"
                    : stage.status === "Suspended"
                    ? "Từ chối"
                    : "Chưa phê duyệt"
                }</span>
                <span class="priority-badge" style="margin-left: 10px; background-color: ${
                  stage.priority === "Cao"
                    ? "#f44336"
                    : stage.priority === "Trung bình"
                    ? "#ff9800"
                    : "#4caf50"
                }; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">
                  ${stage.priority}
                </span>                
              </div>
              <div class="stage-details">
                <div><strong>Số tiền:</strong> ${formatCurrency(
                  stage.amount
                )}</div>
                <div><strong>Hạn thanh toán:</strong> ${
                  stage.deadline || "Không có"
                }</div>
                <div><strong>Mức độ ưu tiên:</strong> ${
                  stage.priority
                }</div>                
                <div><strong>Hình thức thanh toán:</strong> ${
                  stage.paymentMethod || "Không có"
                }</div>
                <div><strong>Ghi chú:</strong> ${
                  stage.notes || "Không có"
                }</div>
                ${
                  stage.fileMetadata
                    ? `<div><strong>Tệp đính kèm:</strong> 
                        <a href="${stage.fileMetadata.link}" target="_blank">${stage.fileMetadata.name}</a>
                       </div>`
                    : ""
                }
                ${
                  stage.status === "Suspended" && stage.suspendReason
                    ? `<div><strong>Lý do từ chối:</strong> ${stage.suspendReason}</div>`
                    : ""
                }
              </div>
              <div class="stage-approval-status">
                <h5>Trạng thái phê duyệt:</h5>
                ${renderStageApprovalStatus(stage.approvers, stage.approvedBy)}
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
    }

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

          // Handle fileMetadata as both single object and array for backward compatibility
          const fileMetadata = purchDoc.fileMetadata
            ? Array.isArray(purchDoc.fileMetadata)
              ? purchDoc.fileMetadata.length > 0
                ? `<div class="file-attachments">
                    <strong>Tệp đính kèm:</strong>
                    ${purchDoc.fileMetadata
                      .map(
                        (file) => `
                      <div class="file-item">
                        <a href="${
                          file.link
                        }" target="_blank" class="file-link">
                          <i class="fas fa-file"></i> ${file.name}
                          ${file.size ? ` (${file.size})` : ""}
                        </a>
                      </div>
                    `
                      )
                      .join("")}
                  </div>`
                : ""
              : `<div><strong>Tệp đính kèm:</strong> 
                  <a href="${purchDoc.fileMetadata.link}" target="_blank" class="file-link">${purchDoc.fileMetadata.name}</a></div>`
            : "";

          // Render appended proposals with backward compatibility for fileMetadata
          const proposals = purchDoc.appendedProposals
            ? purchDoc.appendedProposals
                .map((proposal) => {
                  // Handle proposal fileMetadata as both single object and array
                  const proposalFile = proposal.fileMetadata
                    ? Array.isArray(proposal.fileMetadata)
                      ? proposal.fileMetadata.length > 0
                        ? `<div class="file-attachments">
                              <strong>Tệp đính kèm:</strong>
                              ${proposal.fileMetadata
                                .map(
                                  (file) => `
                                <div class="file-item">
                                  <a href="${
                                    file.link
                                  }" target="_blank" class="file-link">
                                    <i class="fas fa-file"></i> ${file.name}
                                    ${file.size ? ` (${file.size})` : ""}
                                  </a>
                                </div>
                              `
                                )
                                .join("")}
                            </div>`
                        : ""
                      : `<div><strong>Tệp đính kèm:</strong> 
                            <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></div>`
                    : "";

                  return `
                      <div class="proposal-item" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                        <div><strong>Công việc:</strong> ${proposal.task}</div>
                        <div><strong>Trạm:</strong> ${proposal.costCenter}</div>
                        <div><strong>Nhóm:</strong> ${proposal.groupName}</div>
                        <div><strong>Mô tả:</strong> ${proposal.detailsDescription}</div>
                        ${proposalFile}
                      </div>
                    `;
                })
                .join("")
            : "";

          return `
            <div class="payment-document" style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
              <div><strong>Tên:</strong> ${purchDoc.name || ""}</div>
              <div><strong>Trạm:</strong> ${purchDoc.costCenter || ""}</div>
              <div><strong>Nhóm:</strong> ${purchDoc.groupName || ""}</div>
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

  // Helper function to calculate optimal column width
  const calculateColumnWidth = (data, key, minWidth = 10, maxWidth = 50) => {
    let maxLength = key.length; // Start with header length

    data.forEach((row) => {
      const cellValue = String(row[key] || "");
      maxLength = Math.max(maxLength, cellValue.length);
    });

    // Add some padding and apply min/max constraints
    const calculatedWidth = Math.min(
      Math.max(maxLength + 2, minWidth),
      maxWidth
    );
    return { wch: calculatedWidth };
  };

  // Helper function to auto-size all columns in a worksheet
  const autoSizeColumns = (worksheet, data) => {
    if (!data || data.length === 0) return;

    const columns = Object.keys(data[0]);
    const colWidths = columns.map((key) => calculateColumnWidth(data, key));
    worksheet["!cols"] = colWidths;
  };

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
      "Tem phiếu": doc.tag || "Không có",
      "Nội dung": doc.content || "Không có",
      Nhóm: doc.groupName || "Không có",
      Trạm: doc.costCenter || "Không có",
      "Ngày nộp": doc.submissionDate || "Không có",
      "Hạn thanh toán": doc.paymentDeadline || "Không có",
      "Tổng thanh toán": doc.totalPayment || 0,
      "Trạng thái":
        doc.status === "Approved"
          ? "Đã phê duyệt"
          : doc.status === "Suspended"
          ? "Từ chối"
          : "Chưa phê duyệt",
      "Phương thức thanh toán": doc.paymentMethod || "Không có",
    }));

    const overviewWs = XLSX.utils.json_to_sheet(overviewData);
    // Auto-size columns for overview sheet
    autoSizeColumns(overviewWs, overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, "Tổng quan");

    // Sheet 2: Detailed Information (Multiple rows per document)
    const detailedData = [];

    documentsToExport.forEach((doc, docIndex) => {
      // Header row for each document
      detailedData.push({
        STT: docIndex + 1,
        "Tem phiếu": doc.tag || "Không có",
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
          "Tem phiếu": "",
          "Loại thông tin": label,
          "Chi tiết": value,
          "Giá trị": "",
          "Ghi chú": "",
        });
      });

      // Content section
      detailedData.push({
        STT: "",
        "Tem phiếu": "",
        "Loại thông tin": "=== NỘI DUNG ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Tem phiếu": "",
        "Loại thông tin": "Nội dung chi tiết",
        "Chi tiết": doc.content || "Không có nội dung",
        "Giá trị": "",
        "Ghi chú": "",
      });

      // Payment information
      detailedData.push({
        STT: "",
        "Tem phiếu": "",
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
          "Tem phiếu": "",
          "Loại thông tin": label,
          "Chi tiết": detail,
          "Giá trị": value,
          "Ghi chú": "",
        });
      });

      // File attachment
      detailedData.push({
        STT: "",
        "Tem phiếu": "",
        "Loại thông tin": "=== TỆP TIN ĐÍNH KÈM ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Tem phiếu": "",
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
          "Tem phiếu": "",
          "Loại thông tin": "=== PHIẾU MUA HÀNG KÈM THEO ===",
          "Chi tiết": "",
          "Giá trị": "",
          "Ghi chú": "",
        });

        doc.appendedPurchasingDocuments.forEach((purchDoc, purchIndex) => {
          detailedData.push({
            STT: "",
            "Tem phiếu": "",
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
                "Tem phiếu": "",
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
                "Tem phiếu": "",
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
                  "Tem phiếu": "",
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
              "Tem phiếu": "",
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
        "Tem phiếu": "",
        "Loại thông tin": "=== TRẠNG THÁI PHÊ DUYỆT ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Tem phiếu": "",
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
            "Tem phiếu": "",
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
        "Tem phiếu": "",
        "Loại thông tin": "=" + "=".repeat(50),
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });
    });

    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    // Custom auto-sizing for detailed sheet with specific constraints
    const detailedColumns = [
      { key: "STT", min: 5, max: 8 },
      { key: "Tem phiếu", min: 10, max: 20 },
      { key: "Loại thông tin", min: 15, max: 35 },
      { key: "Chi tiết", min: 20, max: 60 },
      { key: "Giá trị", min: 10, max: 15 },
      { key: "Ghi chú", min: 20, max: 80 },
    ];

    detailedWs["!cols"] = detailedColumns.map((col) =>
      calculateColumnWidth(detailedData, col.key, col.min, col.max)
    );
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
            "Tem phiếu": doc.tag || "Không có",
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
      autoSizeColumns(approvalWs, approvalData);
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
        "Tem phiếu": doc.tag || "Không có",
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
        "Tem phiếu": "TỔNG KẾT",
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
        "Tem phiếu": "Đã phê duyệt",
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
        "Tem phiếu": "Chưa phê duyệt",
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
        "Tem phiếu": "Từ chối",
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
    autoSizeColumns(financialWs, financialData);
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

  document.getElementById("tagFilter").addEventListener("input", filterByTag);

  // Group filter
  document
    .getElementById("groupFilter")
    .addEventListener("change", filterByGroup);

  // Declaration Group filter
  document
    .getElementById("groupDeclarationFilter")
    .addEventListener("change", filterByGroupDeclaration);

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
  await populateCostCenterMultiSelect(); // Replace populateCostCenterFilter
  initializeMultiSelect(); // Initialize multi-select functionality
  await fetchGroups();
  await fetchGroupDeclaration();
  setupEventListeners();
  await fetchPaymentDocuments();
};

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initialize);
