// views\documentPages\documentSummaryPurchasing\documentSummaryPurchasing.js
// State management
const state = {
  currentUser: null,
  purchasingDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  paginationEnabled: true,
  selectedDocuments: new Set(),
  currentEditDoc: null,
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
            <th>Ghi chú/Notes</th>
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
            <div><strong>Trạм:</strong> ${proposal.costCenter}</div>
            <div><strong>Mô tả:</strong> ${proposal.detailsDescription}</div>
            ${
              proposal.fileMetadata
                ? `<div><strong>Tệp đính kèm:</strong> 
                 <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></div>`
                : ""
            }
          </div>
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

  // Apply cost center filter
  const selectedCenter = document.getElementById("costCenterFilter").value;
  if (selectedCenter) {
    filteredDocs = filteredDocs.filter(
      (doc) => doc.costCenter === selectedCenter
    );
  }

  return filteredDocs;
};

const populateCostCenterFilter = async () => {
  try {
    const response = await fetch("/userControlCostCenters");
    const costCenters = await response.json();
    const filterDropdown = document.getElementById("costCenterFilter");

    // Clear existing options except the first one
    while (filterDropdown.options.length > 1) {
      filterDropdown.remove(1);
    }

    // Add new options
    costCenters.forEach((center) => {
      const option = document.createElement("option");
      option.value = center.name;
      option.textContent = center.name;
      filterDropdown.appendChild(option);
    });

    // Add event listener for filtering
    filterDropdown.addEventListener("change", () => {
      state.currentPage = 1;
      fetchPurchasingDocuments();
    });
  } catch (error) {
    console.error("Error fetching cost centers for filter:", error);
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
          Trang/Page ${state.currentPage} / ${state.totalPages}
        </span>
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
  const doc = state.purchasingDocuments.find((d) => d._id === docId);
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
      fetchPurchasingDocuments();
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
            <span class="detail-label">Tên nhóm:</span>
            <span class="detail-value">${doc.groupName || "Không có"}</span>
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
        ${
          doc.fileMetadata
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "Không có tệp tin đính kèm"
        }
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

// Edit Document Functions
const addEditModal = () => {
  const modalHTML = `
    <div id="editModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeEditModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Chỉnh sửa phiếu mua hàng</h2>
        <div class="modal-body">
          <form id="editForm" onsubmit="handleEditSubmit(event)" class="modal-form">
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
              <label class="form-label">Sản phẩm:</label>
              <div id="productsList" class="products-list"></div>
              <button type="button" class="btn btn-primary" onclick="addProductField()">
                <i class="fas fa-plus"></i> Thêm sản phẩм
              </button>
            </div>
            
            <div class="form-group">
              <label for="editFile" class="form-label">Thay tệp tin mới:</label>
              <input type="file" id="editFile" class="form-input">
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

const addProductField = (product = null) => {
  const productsList = document.getElementById("productsList");
  const productDiv = document.createElement("div");
  productDiv.className = "product-item";

  productDiv.innerHTML = `
    <div class="product-fields">
      <input type="text" placeholder="Tên sản phẩm" value="${
        product?.productName || ""
      }" required>
      <input type="number" placeholder="Đơn giá" value="${
        product?.costPerUnit || ""
      }" required step="0.01">
      <input type="number" placeholder="Số lượng" value="${
        product?.amount || ""
      }" required>
      <input type="number" placeholder="VAT(%)" value="${
        product?.vat || ""
      }" required step="0.01">
      <input type="text" placeholder="Ghi chú" value="${product?.note || ""}">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
        <i class="fas fa-trash"></i> Xóa
      </button>
    </div>
  `;

  productsList.appendChild(productDiv);
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

const editDocument = async (docId) => {
  try {
    const response = await fetch(`/getPurchasingDocument/${docId}`);
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
};

const handleEditSubmit = async (event) => {
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
        note: productInputs[4].value,
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
  formData.append("approvers", JSON.stringify(state.currentApprovers));

  // Add file
  const fileInput = document.getElementById("editFile");
  if (fileInput.files.length > 0) {
    formData.append("file", fileInput.files[0]);
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
                <h3><i class="fas fa-exchange-alt"></i> Thu lại tạm ứng</h3>
                ${
                  data.advancePaymentReclaimDocuments.length > 0
                    ? renderAdvancePaymentReclaimDocuments(
                        data.advancePaymentReclaimDocuments
                      )
                    : "<p>Không có phiếu thu lại tạm ứng nào liên quan</p>"
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
            <h4>Phiếu thu lại tạm ứng</h4>
            <div class="document-details">
              <div><strong>Tem:</strong> ${doc.tag}</div>
              <div><strong>Tên:</strong> ${doc.name}</div>
              <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
              <div><strong>Phương thức thanh toán:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Thu lại tạm ứng:</strong> ${
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
    // Filter the selected documents from the state
    const documentsToExport = state.purchasingDocuments.filter((doc) =>
      selectedDocs.includes(doc._id)
    );

    // Create multiple sheets for comprehensive export
    const wb = XLSX.utils.book_new();

    // Sheet 1: Document Overview
    const overviewData = documentsToExport.map((doc, index) => ({
      STT: index + 1,
      "Tên phiếu": doc.name || "Không có",
      Trạm: doc.costCenter || "Không có",
      "Tổng chi phí": doc.grandTotalCost || 0,
      "Số sản phẩm": doc.products?.length || 0,
      "Trạng thái":
        doc.status === "Approved"
          ? "Đã phê duyệt"
          : doc.status === "Suspended"
          ? "Từ chối"
          : "Chưa phê duyệt",
      "Ngày nộp": doc.submissionDate || "Không có",
      "Kê khai": doc.declaration || "Không có",
    }));

    const overviewWs = XLSX.utils.json_to_sheet(overviewData);
    overviewWs["!cols"] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, overviewWs, "Tổng quan");

    // Sheet 2: Detailed Information (Multiple rows per document)
    const detailedData = [];

    documentsToExport.forEach((doc, docIndex) => {
      // Header row for each document
      detailedData.push({
        STT: docIndex + 1,
        "Tên phiếu": doc.name || "Không có",
        "Loại thông tin": "=== THÔNG TIN CƠ BẢN ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      // Basic information rows
      const basicInfo = [
        ["Tên phiếu", doc.name || "Không có"],
        ["Trạm", doc.costCenter || "Không có"],
        ["Ngày nộp", doc.submissionDate || "Không có"],
        ["Kê khai", doc.declaration || "Không có"],
        ["Lý do từ chối", doc.suspendReason || "Không có"],
        ["Tổng chi phí", "", doc.grandTotalCost || 0],
      ];

      basicInfo.forEach(([label, detail, value]) => {
        detailedData.push({
          STT: "",
          "Tên phiếu": "",
          "Loại thông tin": label,
          "Chi tiết": detail,
          "Giá trị": value || "",
          "Ghi chú": "",
        });
      });

      // Products section
      detailedData.push({
        STT: "",
        "Tên phiếu": "",
        "Loại thông tin": "=== SẢN PHẨM ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      if (doc.products?.length) {
        doc.products.forEach((product, productIndex) => {
          detailedData.push({
            STT: "",
            "Tên phiếu": "",
            "Loại thông tin": `Sản phẩm ${productIndex + 1}`,
            "Chi tiết": product.productName || "",
            "Giá trị": product.totalCost || 0,
            "Ghi chú": `${product.amount || 0} x ${formatCurrency(
              product.costPerUnit || 0
            )}${product.vat ? ` (VAT: ${product.vat}%)` : ""}`,
          });
        });
      } else {
        detailedData.push({
          STT: "",
          "Tên phiếu": "",
          "Loại thông tin": "Không có sản phẩm",
          "Chi tiết": "",
          "Giá trị": "",
          "Ghi chú": "",
        });
      }

      // File attachment
      detailedData.push({
        STT: "",
        "Tên phiếu": "",
        "Loại thông tin": "=== TỆP TIN ĐÍNH KÈM ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Tên phiếu": "",
        "Loại thông tin": "Tệp đính kèm",
        "Chi tiết": doc.fileMetadata
          ? doc.fileMetadata.name
          : "Không có tệp tin",
        "Giá trị": "",
        "Ghi chú": doc.fileMetadata ? doc.fileMetadata.link : "",
      });

      // Proposals section
      if (doc.appendedProposals?.length) {
        detailedData.push({
          STT: "",
          "Tên phiếu": "",
          "Loại thông tin": "=== PHIẾU ĐỀ XUẤT KÈM THEO ===",
          "Chi tiết": "",
          "Giá trị": "",
          "Ghi chú": "",
        });

        doc.appendedProposals.forEach((proposal, proposalIndex) => {
          detailedData.push({
            STT: "",
            "Tên phiếu": "",
            "Loại thông tin": `Đề xuất ${proposalIndex + 1}`,
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
              "Tên phiếu": "",
              "Loại thông tin": `  └ Tệp đề xuất`,
              "Chi tiết": proposal.fileMetadata.name || "",
              "Giá trị": "",
              "Ghi chú": proposal.fileMetadata.link || "",
            });
          }
        });
      }

      // Approval status
      detailedData.push({
        STT: "",
        "Tên phiếu": "",
        "Loại thông tin": "=== TRẠNG THÁI PHÊ DUYỆT ===",
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });

      detailedData.push({
        STT: "",
        "Tên phiếu": "",
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
            "Tên phiếu": "",
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
        "Tên phiếu": "",
        "Loại thông tin": "=" + "=".repeat(50),
        "Chi tiết": "",
        "Giá trị": "",
        "Ghi chú": "",
      });
    });

    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    detailedWs["!cols"] = [
      { wch: 5 }, // STT
      { wch: 30 }, // Tên phiếu
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
            "Tên phiếu": doc.name || "Không có",
            Trạm: doc.costCenter || "Không có",
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
        { wch: 30 },
        { wch: 20 },
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
      const paymentAmount = doc.grandTotalCost || 0;

      if (doc.status === "Approved") totalApproved += paymentAmount;
      else if (doc.status === "Suspended") totalSuspended += paymentAmount;
      else totalPending += paymentAmount;

      financialData.push({
        STT: docIndex + 1,
        "Tên phiếu": doc.name || "Không có",
        Trạm: doc.costCenter || "",
        "Tổng chi phí": doc.grandTotalCost || 0,
        "Trạng thái":
          doc.status === "Approved"
            ? "Đã phê duyệt"
            : doc.status === "Suspended"
            ? "Từ chối"
            : "Chưa phê duyệt",
        "Ngày nộp": doc.submissionDate || "",
        "Kê khai": doc.declaration || "",
        "Số sản phẩm": doc.products?.length || 0,
        "Ghi chú": doc.suspendReason || "",
      });
    });

    // Add summary rows
    financialData.push(
      {},
      {
        STT: "",
        "Tên phiếu": "TỔNG KẾT",
        Trạm: "",
        "Tổng chi phí": "",
        "Trạng thái": "",
        "Ngày nộp": "",
        "Kê khai": "",
        "Số sản phẩm": "",
        "Ghi chú": "",
      },
      {
        STT: "",
        "Tên phiếu": "Đã phê duyệt",
        Trạm: "",
        "Tổng chi phí": totalApproved,
        "Trạng thái": "",
        "Ngày nộp": "",
        "Kê khai": "",
        "Số sản phẩm": "",
        "Ghi chú": "",
      },
      {
        STT: "",
        "Tên phiếu": "Chưa phê duyệt",
        Trạm: "",
        "Tổng chi phí": totalPending,
        "Trạng thái": "",
        "Ngày nộp": "",
        "Kê khai": "",
        "Số sản phẩm": "",
        "Ghi chú": "",
      },
      {
        STT: "",
        "Tên phiếu": "Từ chối",
        Trạm: "",
        "Tổng chi phí": totalSuspended,
        "Trạng thái": "",
        "Ngày nộp": "",
        "Kê khai": "",
        "Số sản phẩm": "",
        "Ghi chú": "",
      }
    );

    const financialWs = XLSX.utils.json_to_sheet(financialData);
    financialWs["!cols"] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, financialWs, "Tổng hợp tài chính");

    // Generate the Excel file and trigger download
    XLSX.writeFile(
      wb,
      `Bao_cao_chi_tiet_phieu_mua_hang_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );

    showMessage(
      `Đã xuất báo cáo chi tiết ${selectedDocs.length} phiếu mua hàng với ${wb.SheetNames.length} bảng tính.`
    );
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
  await populateCostCenterFilter();
  await fetchPurchasingDocuments();
  addEditModal();
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
