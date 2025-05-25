// views\documentPages\documentSummaryPurchasing\documentSummaryPurchasing.js
class PurchasingDocumentManager {
  constructor() {
    this.currentUser = null;
    this.purchasingDocuments = [];
    this.showOnlyPendingApprovals = false;
    this.currentApprovers = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalPages = 1;
    this.paginationEnabled = true;
    this.selectedDocuments = new Set();

    this.initialize();
  }

  async initialize() {
    await this.fetchCurrentUser();
    this.setupEventListeners();
    await this.populateCostCenterFilter();
    await this.fetchPurchasingDocuments();
    this.addEditModal();
  }

  setupEventListeners() {
    // Toggle switches
    document.getElementById("pendingToggle").addEventListener("change", (e) => {
      this.showOnlyPendingApprovals = e.target.checked;
      this.currentPage = 1;
      this.fetchPurchasingDocuments();
    });

    document
      .getElementById("paginationToggle")
      .addEventListener("change", () => {
        this.paginationEnabled =
          document.getElementById("paginationToggle").checked;
        this.currentPage = 1;
        this.fetchPurchasingDocuments();
      });

    // Export and selection
    document
      .getElementById("exportSelectedBtn")
      .addEventListener("click", () => this.exportSelectedToExcel());
    document
      .getElementById("selectAllCheckbox")
      .addEventListener("change", () => this.toggleSelectAll());

    // Table checkboxes
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("doc-checkbox")) {
        this.updateDocumentSelection(e.target);
        this.updateSelectAllCheckbox();
      }
    });

    document.getElementById("suspendForm").addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSuspendSubmit(e);
    });

    document
      .querySelector("#fullViewModal .modal-close")
      .addEventListener("click", () => {
        this.closeFullViewModal();
      });

    // Suspend Modal close button
    document
      .querySelector("#suspendModal .modal-close")
      .addEventListener("click", () => {
        this.closeSuspendModal();
      });
  }

  async fetchCurrentUser() {
    try {
      const response = await fetch("/getCurrentUser");
      this.currentUser = await response.json();
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  }

  filterDocumentsForCurrentUser(documents) {
    let filteredDocs = [...documents];

    // Apply pending approval filter if enabled
    if (this.showOnlyPendingApprovals && this.currentUser) {
      filteredDocs = filteredDocs.filter((doc) => {
        const isRequiredApprover = doc.approvers.some(
          (approver) => approver.username === this.currentUser.username
        );
        const hasNotApprovedYet = !doc.approvedBy.some(
          (approved) => approved.username === this.currentUser.username
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
  }

  async populateCostCenterFilter() {
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
        this.currentPage = 1;
        this.fetchPurchasingDocuments();
      });
    } catch (error) {
      console.error("Error fetching cost centers for filter:", error);
    }
  }

  async fetchPurchasingDocuments() {
    this.showLoading(true);

    try {
      const response = await fetch("/getPurchasingDocumentForSeparatedView");
      const data = await response.json();
      this.purchasingDocuments = data.purchasingDocuments;

      const filteredDocuments = this.filterDocumentsForCurrentUser(
        this.purchasingDocuments
      );

      // Calculate total pages
      this.totalPages = Math.ceil(filteredDocuments.length / this.itemsPerPage);

      // Make sure current page is in valid range
      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages;
      }
      if (this.currentPage < 1) {
        this.currentPage = 1;
      }

      // Calculate slice indexes for current page
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;

      // Get documents for current page only if pagination is enabled, otherwise show all
      const pageDocuments = this.paginationEnabled
        ? filteredDocuments.slice(startIndex, endIndex)
        : filteredDocuments;

      this.renderDocumentsTable(pageDocuments);
      this.updateSummary(filteredDocuments);

      if (this.paginationEnabled) {
        this.renderPagination();
      } else {
        this.removePagination();
      }
    } catch (err) {
      console.error("Error fetching purchasing documents:", err);
      this.showMessage("Error fetching purchasing documents", true);
    } finally {
      this.showLoading(false);
    }
  }

  renderDocumentsTable(documents) {
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
        <td><input type="checkbox" class="doc-checkbox" data-doc-id="${
          doc._id
        }" ${this.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
        <td>${doc.name ? doc.name : ""}</td>
        <td>${doc.costCenter ? doc.costCenter : ""}</td>              
        <td>
          ${this.renderProducts(doc.products)} 
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
        <td>${this.renderProposals(doc.appendedProposals)}</td>
        <td>${this.renderStatus(doc.status)}</td>
        <td class="approval-status">${approvalStatus}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-primary btn-sm" onclick="purchasingManager.showFullView('${
              doc._id
            }')">
              <i class="fas fa-eye"></i> Xem/View
            </button>
            <form action="/exportDocumentToDocx/${
              doc._id
            }" method="GET" style="display:inline;">
                <button class="btn btn-primary btn-sm">
                  <i class="fas fa-file-word"></i> DOCX
                </button>
            </form>
            ${
              doc.approvedBy.length === 0
                ? `
              <button class="btn btn-primary btn-sm" onclick="purchasingManager.editDocument('${doc._id}')">
                <i class="fas fa-edit"></i> Sửa/Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="purchasingManager.deleteDocument('${doc._id}')">
                <i class="fas fa-trash"></i> Xóa/Delete
              </button>
            `
                : ""
            }
            ${
              doc.status === "Pending"
                ? `
              <button class="btn btn-primary btn-sm" onclick="purchasingManager.approveDocument('${doc._id}')">
                <i class="fas fa-check"></i> Duyệt/Approve
              </button>
            `
                : ""
            }
            ${
              doc.status === "Approved"
                ? `
                  <button class="btn btn-primary btn-sm" onclick="purchasingManager.editDeclaration('${doc._id}')">
                    <i class="fas fa-edit"></i> Kê khai/Declaration
                  </button>
                `
                : doc.status === "Suspended"
                ? `
                  <button class="btn btn-primary btn-sm" onclick="purchasingManager.openDocument('${doc._id}')">
                    <i class="fas fa-lock-open"></i> Mở/Open
                  </button>
                `
                : `
                  <button class="btn btn-danger btn-sm" onclick="purchasingManager.suspendDocument('${doc._id}')">
                    <i class="fas fa-ban"></i> Từ chối/Suspend
                  </button>
                `
            }
            <button class="btn btn-secondary btn-sm" onclick="purchasingManager.showDocumentsContainingPurchasing('${
              doc._id
            }')">
              <i class="fas fa-link"></i> Liên quan/Related
            </button>                    
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  renderProducts(products) {
    if (!products || products.length === 0) return "-";

    return `
      <div class="products-table-container">
        <table class="products-table">
          <thead>
            <tr>
              <th>Sản phẩm/Product</th>
              <th class="text-right">Đơn giá/Cost</th>
              <th class="text-right">Số lượng/Qty</th>
              <th class="text-right">Thuế/VAT (%)</th>
              <th class="text-right">Thành tiền/Total</th>
              <th class="text-right">Sau thuế/After VAT</th>
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
                <td class="text-right">${
                  product.vat.toLocaleString() || ""
                }</td>
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
  }

  renderProposals(proposals) {
    if (!proposals || proposals.length === 0) return "-";

    return `
      <div class="proposals-container">
        ${proposals
          .map(
            (proposal) => `
          <div class="proposal-item">
            <div><strong>Công việc/Task:</strong> ${proposal.task}</div>
            <div><strong>Trạm/Center:</strong> ${proposal.costCenter}</div>
            <div><strong>Mô tả/Description:</strong> ${
              proposal.detailsDescription
            }</div>
            ${
              proposal.fileMetadata
                ? `<div><strong>Tệp đính kèm/File:</strong> 
                 <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></div>`
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  renderStatus(status) {
    switch (status) {
      case "Approved":
        return `<span class="status approved"><i class="fas fa-check-circle"></i> Approved</span>`;
      case "Suspended":
        return `<span class="status suspended"><i class="fas fa-ban"></i> Suspended</span>`;
      default:
        return `<span class="status pending"><i class="fas fa-clock"></i> Pending</span>`;
    }
  }

  updateSummary(filteredDocuments) {
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
  }

  renderPagination() {
    let paginationContainer = document.getElementById("paginationContainer");
    if (!paginationContainer) {
      const table = document.querySelector("table");
      paginationContainer = document.createElement("div");
      paginationContainer.id = "paginationContainer";
      paginationContainer.className = "pagination-container";
      table.parentNode.insertBefore(paginationContainer, table.nextSibling);
    }

    if (this.totalPages > 1) {
      paginationContainer.innerHTML = `
        <div class="pagination">
          <button onclick="purchasingManager.changePage(1)" ${
            this.currentPage === 1 ? "disabled" : ""
          }>
            <i class="fas fa-angle-double-left"></i> First
          </button>
          <button onclick="purchasingManager.changePage(${
            this.currentPage - 1
          })" ${this.currentPage === 1 ? "disabled" : ""}>
            <i class="fas fa-angle-left"></i> Prev
          </button>
          <span class="page-info">
            Trang/Page ${this.currentPage} / ${this.totalPages}
          </span>
          <button onclick="purchasingManager.changePage(${
            this.currentPage + 1
          })" ${this.currentPage === this.totalPages ? "disabled" : ""}>
            Next <i class="fas fa-angle-right"></i>
          </button>
          <button onclick="purchasingManager.changePage(${this.totalPages})" ${
        this.currentPage === this.totalPages ? "disabled" : ""
      }>
            Last <i class="fas fa-angle-double-right"></i>
          </button>
        </div>
      `;
    } else {
      paginationContainer.innerHTML = "";
    }
  }

  removePagination() {
    const paginationContainer = document.getElementById("paginationContainer");
    if (paginationContainer) {
      paginationContainer.innerHTML = "";
    }
  }

  changePage(newPage) {
    if (
      newPage >= 1 &&
      newPage <= this.totalPages &&
      newPage !== this.currentPage
    ) {
      this.currentPage = newPage;
      this.fetchPurchasingDocuments();
      // Scroll to top of table for better user experience
      document.querySelector("table").scrollIntoView({ behavior: "smooth" });
    }
  }

  // Document Actions
  async approveDocument(documentId) {
    try {
      const response = await fetch(`/approveDocument/${documentId}`, {
        method: "POST",
      });

      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        this.fetchPurchasingDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error approving document:", err);
      this.showMessage("Error approving document", true);
    }
  }

  async deleteDocument(documentId) {
    if (
      !confirm(
        "Bạn có chắc chắn muốn xóa tài liệu này?/Are you sure you want to delete this document?"
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/deleteDocument/${documentId}`, {
        method: "POST",
      });

      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        this.fetchPurchasingDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      this.showMessage("Error deleting document", true);
    }
  }

  suspendDocument(docId) {
    document.getElementById("suspendModal").style.display = "block";
    document.getElementById("suspendForm").dataset.docId = docId;
  }

  closeSuspendModal() {
    document.getElementById("suspendModal").style.display = "none";
    document.getElementById("suspendForm").reset();
  }

  async handleSuspendSubmit(event) {
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
        this.showMessage(message);
        this.closeSuspendModal();
        this.fetchPurchasingDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error suspending document:", err);
      this.showMessage(
        "Lỗi khi tạm dừng tài liệu/Error suspending document",
        true
      );
    }
  }

  async openDocument(docId) {
    try {
      const response = await fetch(`/openPurchasingDocument/${docId}`, {
        method: "POST",
      });

      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        this.fetchPurchasingDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error reopening document:", err);
      this.showMessage(
        "Lỗi khi mở lại tài liệu/Error reopening document",
        true
      );
    }
  }

  editDeclaration(docId) {
    const doc = this.purchasingDocuments.find((d) => d._id === docId);
    if (!doc) return;

    // Create a modal for editing the declaration
    const modalHTML = `
      <div id="declarationModal" class="modal">
        <div class="modal-content">
          <span class="modal-close" onclick="purchasingManager.closeDeclarationModal()">&times;</span>
          <h2 class="modal-title"><i class="fas fa-edit"></i> Kê Khai/Declaration</h2>
          <div class="modal-body">
            <div class="form-group">
              <textarea id="declarationInput" class="form-textarea">${
                doc.declaration || ""
              }</textarea>
            </div>
            <div class="form-actions">
              <button onclick="purchasingManager.saveDeclaration('${docId}')" class="btn btn-primary">
                <i class="fas fa-save"></i> Lưu kê khai/Save
              </button>
              <button onclick="purchasingManager.closeDeclarationModal()" class="btn btn-secondary">
                <i class="fas fa-times"></i> Hủy/Cancel
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
  }

  closeDeclarationModal() {
    const modal = document.getElementById("declarationModal");
    if (modal) {
      modal.remove();
    }
  }

  async saveDeclaration(docId) {
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
        this.showMessage(message);
        this.closeDeclarationModal();
        this.fetchPurchasingDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error updating declaration:", err);
      this.showMessage("Error updating declaration", true);
    }
  }

  showFullView(docId) {
    try {
      const doc = this.purchasingDocuments.find((d) => d._id === docId);
      if (!doc) throw new Error("Document not found");

      const fullViewContent = document.getElementById("fullViewContent");

      // Format date strings
      const submissionDate = doc.submissionDate || "Not specified";

      fullViewContent.innerHTML = `
        <!-- Basic Information Section -->
        <div class="full-view-section">
          <h3><i class="fas fa-info-circle"></i> Thông tin cơ bản/Basic Information</h3>
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
          <h3><i class="fas fa-boxes"></i> Sản phẩm/Products</h3>
          ${this.renderProducts(doc.products)}
        </div>
        
        <!-- File Attachment Section -->
        <div class="full-view-section">
          <h3><i class="fas fa-paperclip"></i> Tệp tin kèm theo/Attached File</h3>
          ${
            doc.fileMetadata
              ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
              : "No file attached"
          }
        </div>
        
        <!-- Proposals Section -->
        <div class="full-view-section">
          <h3><i class="fas fa-file-alt"></i> Phiếu đề xuất kèm theo/Appended Proposals</h3>
          ${this.renderProposals(doc.appendedProposals)}
        </div>
        
        <!-- Status Section -->
        <div class="full-view-section">
          <h3><i class="fas fa-tasks"></i> Trạng thái/Status Information</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Tình trạng/Status:</span>
              <span class="detail-value ${this.renderStatus(doc.status)}</span>
            </div>
          </div>
          <div class="approval-section">
            <h4><i class="fas fa-user-check"></i> Trạng thái phê duyệt/Approval Status:</h4>
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
                          ? `<div class="approval-date"><i class="fas fa-calendar-check"></i> Approved on: ${hasApproved.approvalDate}</div>`
                          : '<div class="approval-date"><i class="fas fa-clock"></i> Pending</div>'
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
      this.showMessage("Error loading full document details", true);
    }
  }

  closeFullViewModal() {
    document.getElementById("fullViewModal").style.display = "none";
  }

  // Edit Document Functions
  addEditModal() {
    const modalHTML = `
      <div id="editModal" class="modal">
        <div class="modal-content">
          <span class="modal-close" onclick="purchasingManager.closeEditModal()">&times;</span>
          <h2 class="modal-title"><i class="fas fa-edit"></i> Chỉnh sửa phiếu mua hàng/Edit Purchasing Document</h2>
          <div class="modal-body">
            <form id="editForm" onsubmit="purchasingManager.handleEditSubmit(event)" class="modal-form">
              <input type="hidden" id="editDocId">
              
              <!-- Basic Fields -->
              <div class="form-group">
                <label for="editName" class="form-label">Tên/Name:</label>
                <input type="text" id="editName" required class="form-input">
              </div>
              
              <div class="form-group">
                <label for="editCostCenter" class="form-label">Trạm/Cost Center:</label>
                <select id="editCostCenter" required class="form-select">
                  <option value="">Chọn một trạm/Select a center</option>
                  <!-- Options will be populated dynamically -->
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">Sản phẩm/Products:</label>
                <div id="productsList" class="products-list"></div>
                <button type="button" class="btn btn-primary" onclick="purchasingManager.addProductField()">
                  <i class="fas fa-plus"></i> Thêm sản phẩm/Add Product
                </button>
              </div>
              
              <div class="form-group">
                <label for="editFile" class="form-label">Thay tệp tin mới/Update File:</label>
                <input type="file" id="editFile" class="form-input">
              </div>
              
              <!-- Current Approvers Section -->
              <div class="form-group">
                <label class="form-label">Người phê duyệt hiện tại/Current Approvers:</label>
                <div id="currentApproversList" class="approvers-list"></div>
              </div>
              
              <!-- Add New Approvers Section -->
              <div class="form-group">
                <label class="form-label">Thêm người phê duyệt/Add Approvers:</label>
                <select id="newApproversDropdown" class="form-select">
                  <option value="">Chọn người phê duyệt/Select an approver</option>
                  <!-- Options will be populated dynamically -->
                </select>
                <input type="text" id="newApproverSubRole" placeholder="Vai trò/Sub Role" class="form-input" style="margin-top: var(--space-sm);">
                <button type="button" class="btn btn-primary" onclick="purchasingManager.addNewApprover()" style="margin-top: var(--space-sm);">
                  <i class="fas fa-plus"></i> Thêm/Add
                </button>
              </div>
              
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                  <i class="fas fa-save"></i> Lưu thay đổi/Save
                </button>
                <button type="button" class="btn btn-secondary" onclick="purchasingManager.closeEditModal()">
                  <i class="fas fa-times"></i> Hủy/Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
  }

  addProductField(product = null) {
    const productsList = document.getElementById("productsList");
    const productDiv = document.createElement("div");
    productDiv.className = "product-item";

    productDiv.innerHTML = `
      <div class="product-fields">
        <input type="text" placeholder="Tên sản phẩm/Product Name" value="${
          product?.productName || ""
        }" required>
        <input type="number" placeholder="Đơn giá/Cost Per Unit" value="${
          product?.costPerUnit || ""
        }" required step="0.01">
        <input type="number" placeholder="Số lượng/Amount" value="${
          product?.amount || ""
        }" required>
        <input type="number" placeholder="Thuế/Vat (%)" value="${
          product?.vat || ""
        }" required step="0.01">
        <input type="text" placeholder="Ghi chú/Note" value="${
          product?.note || ""
        }">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-trash"></i> Xóa/Remove
        </button>
      </div>
    `;

    productsList.appendChild(productDiv);
  }

  async populateCostCenterDropdown() {
    try {
      const response = await fetch("/costCenters");
      const costCenters = await response.json();
      const dropdown = document.getElementById("editCostCenter");

      // Clear existing options except the first one
      dropdown.innerHTML =
        '<option value="">Chọn một trạm/Select a center</option>';

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
  }

  async fetchApprovers() {
    try {
      const response = await fetch("/approvers");
      return await response.json();
    } catch (error) {
      console.error("Error fetching approvers:", error);
      return [];
    }
  }

  renderCurrentApprovers() {
    const currentApproversList = document.getElementById(
      "currentApproversList"
    );
    currentApproversList.innerHTML = this.currentApprovers
      .map(
        (approver) => `
          <div class="approver-item" data-id="${approver.approver}">
            <span>${approver.username}</span>
            <input type="text" value="${approver.subRole}" 
                   onchange="purchasingManager.updateApproverSubRole('${approver.approver}', this.value)" 
                   class="form-input" style="width: 120px;">
            <button type="button" class="btn btn-danger btn-sm" 
                    onclick="purchasingManager.removeApprover('${approver.approver}')">
              <i class="fas fa-trash"></i> Xóa/Remove
            </button>
          </div>
        `
      )
      .join("");
  }

  updateApproverSubRole(approverId, newSubRole) {
    const approver = this.currentApprovers.find(
      (a) => a.approver === approverId
    );
    if (approver) {
      approver.subRole = newSubRole;
    }
  }

  removeApprover(approverId) {
    this.currentApprovers = this.currentApprovers.filter(
      (a) => a.approver !== approverId
    );
    this.renderCurrentApprovers();
    this.populateNewApproversDropdown();
  }

  async populateNewApproversDropdown() {
    const allApprovers = await this.fetchApprovers();
    const availableApprovers = allApprovers.filter(
      (approver) =>
        !this.currentApprovers.some((a) => a.approver === approver._id)
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

  addNewApprover() {
    const newApproverId = document.getElementById("newApproversDropdown").value;
    const newSubRole = document.getElementById("newApproverSubRole").value;

    if (!newApproverId || !newSubRole) {
      this.showMessage(
        "Vui lòng chọn người phê duyệt và nhập vai trò phụ/Please select an approver and enter a sub role.",
        true
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

    this.currentApprovers.push(newApprover);
    this.renderCurrentApprovers();
    this.populateNewApproversDropdown();

    // Clear the input fields
    document.getElementById("newApproversDropdown").value = "";
    document.getElementById("newApproverSubRole").value = "";
  }

  async editDocument(docId) {
    try {
      const response = await fetch(`/getPurchasingDocument/${docId}`);
      const doc = await response.json();

      document.getElementById("editDocId").value = docId;
      document.getElementById("editName").value = doc.name;

      await this.populateCostCenterDropdown();
      document.getElementById("editCostCenter").value = doc.costCenter;

      // Clear and repopulate products
      const productsList = document.getElementById("productsList");
      productsList.innerHTML = "";
      doc.products.forEach((product) => this.addProductField(product));

      // Populate current approvers
      this.currentApprovers = doc.approvers;
      this.renderCurrentApprovers();

      // Populate new approvers dropdown
      await this.populateNewApproversDropdown();

      document.getElementById("editModal").style.display = "block";
    } catch (err) {
      console.error("Error fetching document details:", err);
      this.showMessage("Error loading document details", true);
    }
  }

  closeEditModal() {
    document.getElementById("editModal").style.display = "none";
    document.getElementById("editForm").reset();
    document.getElementById("productsList").innerHTML = "";
  }

  async handleEditSubmit(event) {
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
    formData.append("approvers", JSON.stringify(this.currentApprovers));

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
        this.showMessage("Document updated successfully");
        this.closeEditModal();
        this.fetchPurchasingDocuments();
      } else {
        this.showMessage(result.message || "Error updating document", true);
      }
    } catch (err) {
      console.error("Error updating document:", err);
      this.showMessage("Error updating document", true);
    }
  }

  // Documents containing purchasing
  async showDocumentsContainingPurchasing(purchasingId) {
    try {
      const response = await fetch(
        `/documentsContainingPurchasing/${purchasingId}`
      );
      const data = await response.json();

      if (data.success) {
        const modalHTML = `
          <div id="containingDocsModal" class="modal" style="display: block;">
            <div class="modal-content">
              <span class="modal-close" onclick="purchasingManager.closeContainingDocsModal()">&times;</span>
              <h2 class="modal-title"><i class="fas fa-link"></i> Tài liệu liên quan/Related Documents</h2>
              <div class="modal-body">
                <div class="related-docs-section">
                  <h3><i class="fas fa-money-bill-wave"></i> Thanh toán/Payment Documents</h3>
                  ${
                    data.paymentDocuments.length > 0
                      ? this.renderPaymentDocuments(data.paymentDocuments)
                      : "<p>Không có tài liệu thanh toán nào liên quan/No related payment documents</p>"
                  }
                </div>
                
                <div class="related-docs-section">
                  <h3><i class="fas fa-hand-holding-usd"></i> Thanh toán trước/Advance Payment Documents</h3>
                  ${
                    data.advancePaymentDocuments.length > 0
                      ? this.renderAdvancePaymentDocuments(
                          data.advancePaymentDocuments
                        )
                      : "<p>Không có tài liệu thanh toán trước nào liên quan/No related advance payment documents</p>"
                  }
                </div>
                
                <div class="related-docs-section">
                  <h3><i class="fas fa-exchange-alt"></i> Hoàn ứng/Advance Payment Reclaim Documents</h3>
                  ${
                    data.advancePaymentReclaimDocuments.length > 0
                      ? this.renderAdvancePaymentReclaimDocuments(
                          data.advancePaymentReclaimDocuments
                        )
                      : "<p>Không có tài liệu hoàn ứng nào liên quan/No related advance payment reclaim documents</p>"
                  }
                </div>
              </div>
            </div>
          </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);
      } else {
        this.showMessage("Error fetching related documents", true);
      }
    } catch (error) {
      console.error("Error fetching related documents:", error);
      this.showMessage("Error fetching related documents", true);
    }
  }

  renderPaymentDocuments(paymentDocs) {
    if (!paymentDocs || paymentDocs.length === 0) return "-";

    return `
      <div class="documents-container">
        ${paymentDocs
          .map(
            (doc) => `
          <div class="document-card">
            <h4>${doc.title || "Payment Document"}</h4>
            <div class="document-details">
              <div><strong>Tag:</strong> ${doc.tag}</div>
              <div><strong>Tên/Name:</strong> ${doc.name}</div>
              <div><strong>Trạm/Cost Center:</strong> ${
                doc.costCenter || "-"
              }</div>
              <div><strong>Phương thức thanh toán/Payment Method:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Tổng thanh toán/Total Payment:</strong> ${
                doc.totalPayment?.toLocaleString() || "-"
              }</div>
              <div><strong>Thanh toán trước/Advance Payment:</strong> ${
                doc.advancePayment?.toLocaleString() || "-"
              }</div>
              <div><strong>Hạn thanh toán/Payment Deadline:</strong> ${
                doc.paymentDeadline
              }</div>
              <div><strong>Tệp tin/File:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng/Status:</strong> ${this.renderStatus(
                doc.status
              )}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  renderAdvancePaymentDocuments(advancePaymentDocs) {
    if (!advancePaymentDocs || advancePaymentDocs.length === 0) return "-";

    return `
      <div class="documents-container">
        ${advancePaymentDocs
          .map(
            (doc) => `
          <div class="document-card">
            <h4>${doc.title || "Advance Payment Document"}</h4>
            <div class="document-details">
              <div><strong>Tag:</strong> ${doc.tag}</div>
              <div><strong>Tên/Name:</strong> ${doc.name}</div>
              <div><strong>Trạm/Cost Center:</strong> ${
                doc.costCenter || "-"
              }</div>
              <div><strong>Phương thức thanh toán/Payment Method:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Thanh toán trước/Advance Payment:</strong> ${
                doc.advancePayment?.toLocaleString() || "-"
              }</div>
              <div><strong>Hạn thanh toán/Payment Deadline:</strong> ${
                doc.paymentDeadline
              }</div>
              <div><strong>Tệp tin/File:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng/Status:</strong> ${this.renderStatus(
                doc.status
              )}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  renderAdvancePaymentReclaimDocuments(reclaimDocs) {
    if (!reclaimDocs || reclaimDocs.length === 0) return "-";

    return `
      <div class="documents-container">
        ${reclaimDocs
          .map(
            (doc) => `
          <div class="document-card">
            <h4>${doc.title || "Advance Payment Reclaim Document"}</h4>
            <div class="document-details">
              <div><strong>Tag:</strong> ${doc.tag}</div>
              <div><strong>Tên/Name:</strong> ${doc.name}</div>
              <div><strong>Trạm/Cost Center:</strong> ${
                doc.costCenter || "-"
              }</div>
              <div><strong>Phương thức thanh toán/Payment Method:</strong> ${
                doc.paymentMethod
              }</div>
              <div><strong>Hoàn ứng/Advance Payment Reclaim:</strong> ${
                doc.advancePaymentReclaim?.toLocaleString() || "-"
              }</div>
              <div><strong>Hạn thanh toán/Payment Deadline:</strong> ${
                doc.paymentDeadline
              }</div>
              <div><strong>Tệp tin/File:</strong> ${
                doc.fileMetadata?.link
                  ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
                  : "-"
              }</div>
              <div><strong>Tình trạng/Status:</strong> ${this.renderStatus(
                doc.status
              )}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  closeContainingDocsModal() {
    const modal = document.getElementById("containingDocsModal");
    if (modal) {
      modal.remove();
    }
  }

  // Export functions
  async exportSelectedToExcel() {
    const selectedDocs = Array.from(this.selectedDocuments);

    if (selectedDocs.length === 0) {
      this.showMessage("Please select at least one document to export", true);
      return;
    }

    try {
      // Show loading state
      const exportBtn = document.getElementById("exportSelectedBtn");
      const originalText = exportBtn.innerHTML;
      exportBtn.disabled = true;
      exportBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Exporting...';

      // Create form and submit
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/exportPurchasingDocumentsToExcel";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "documentIds";
      input.value = JSON.stringify(selectedDocs);
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (err) {
      console.error("Error exporting documents:", err);
      this.showMessage("Error exporting documents: " + err.message, true);
    } finally {
      // Reset button state after a delay to ensure form submission completes
      setTimeout(() => {
        const exportBtn = document.getElementById("exportSelectedBtn");
        if (exportBtn) {
          exportBtn.disabled = false;
          exportBtn.innerHTML = originalText;
        }
      }, 2000);
    }
  }

  updateDocumentSelection(checkbox) {
    const docId = checkbox.dataset.docId;
    if (checkbox.checked) {
      this.selectedDocuments.add(docId);
    } else {
      this.selectedDocuments.delete(docId);
    }
  }

  toggleSelectAll() {
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    const checkboxes = document.querySelectorAll(".doc-checkbox");

    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
      this.updateDocumentSelection(checkbox);
    });
  }

  updateSelectAllCheckbox() {
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
  }

  // Utility functions
  showMessage(message, isError = false) {
    const messageContainer = document.getElementById("messageContainer");
    messageContainer.textContent = message;
    messageContainer.className = `message ${isError ? "error" : "success"}`;

    // Get the current scroll position
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    messageContainer.style.top = `${scrollY + 20}px`;

    messageContainer.style.display = "block";

    setTimeout(() => {
      messageContainer.style.display = "none";
    }, 5000);
  }

  showLoading(show) {
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.style.display = show ? "flex" : "none";
  }
}

// Initialize the manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.purchasingManager = new PurchasingDocumentManager();
});

// Close modals when clicking outside
window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};
