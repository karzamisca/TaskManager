// views/documentPages/documentSummaryPayment/documentSummaryPayment.js

// Constants and state variables
const STATE = {
  currentUser: null,
  paymentDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  currentGroupFilter: "",
  paginationEnabled: true,
};

// DOM Elements
const DOM = {
  messageContainer: document.getElementById("messageContainer"),
  paymentDocumentsTable: document.getElementById("paymentDocumentsTable"),
  fullViewModal: document.getElementById("fullViewModal"),
  fullViewContent: document.getElementById("fullViewContent"),
  suspendModal: document.getElementById("suspendModal"),
  suspendForm: document.getElementById("suspendForm"),
  massDeclarationModal: document.getElementById("massDeclarationModal"),
  massDeclarationForm: document.getElementById("massDeclarationForm"),
  editModal: document.getElementById("editModal"),
  editForm: document.getElementById("editForm"),
};

// Utility Functions
const Utils = {
  showMessage: (message, isError = false) => {
    DOM.messageContainer.textContent = message;
    DOM.messageContainer.className = `message ${isError ? "error" : "success"}`;
    DOM.messageContainer.style.top = `${window.scrollY + 20}px`;
    DOM.messageContainer.style.display = "block";

    setTimeout(() => {
      DOM.messageContainer.style.display = "none";
    }, 5000);
  },

  formatCurrency: (amount) => {
    return amount?.toLocaleString() || "-";
  },

  resetSelectAllCheckbox: () => {
    const selectAllCheckbox = document.getElementById("selectAll");
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
    }
  },

  getSelectedDocumentIds: () => {
    const checkboxes = document.querySelectorAll(
      'input[type="checkbox"][name="documentCheckbox"]:checked'
    );
    return Array.from(checkboxes).map((checkbox) => checkbox.value);
  },
};

// API Functions
const API = {
  fetchCurrentUser: async () => {
    try {
      const response = await fetch("/getCurrentUser");
      STATE.currentUser = await response.json();
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  },

  fetchGroups: async () => {
    try {
      const response = await fetch("/getGroupDocument");
      return await response.json();
    } catch (error) {
      console.error("Error fetching groups:", error);
      return [];
    }
  },

  fetchPaymentDocuments: async () => {
    try {
      const response = await fetch("/getPaymentDocumentForSeparatedView");
      const data = await response.json();
      STATE.paymentDocuments = data.paymentDocuments;
      return data.paymentDocuments;
    } catch (err) {
      console.error("Error fetching payment documents:", err);
      Utils.showMessage("Error fetching payment documents", true);
      return [];
    }
  },

  fetchDocumentDetails: async (documentId) => {
    try {
      const response = await fetch(`/getPaymentDocument/${documentId}`);
      return await response.json();
    } catch (err) {
      console.error("Error fetching document details:", err);
      throw err;
    }
  },

  fetchCostCenters: async () => {
    try {
      const response = await fetch("/costCenters");
      return await response.json();
    } catch (error) {
      console.error("Error fetching cost centers:", error);
      return [];
    }
  },

  fetchApprovers: async () => {
    try {
      const response = await fetch("/approvers");
      return await response.json();
    } catch (error) {
      console.error("Error fetching approvers:", error);
      return [];
    }
  },

  approveDocument: async (documentId) => {
    try {
      const response = await fetch(`/approveDocument/${documentId}`, {
        method: "POST",
      });
      const message = await response.text();
      return { success: response.ok, message };
    } catch (err) {
      console.error("Error approving document:", err);
      return { success: false, message: "Error approving document" };
    }
  },

  deleteDocument: async (documentId) => {
    try {
      const response = await fetch(`/deleteDocument/${documentId}`, {
        method: "POST",
      });
      const message = await response.text();
      return { success: response.ok, message };
    } catch (err) {
      console.error("Error deleting document:", err);
      return { success: false, message: "Error deleting document" };
    }
  },

  suspendDocument: async (documentId, suspendReason) => {
    try {
      const response = await fetch(`/suspendDocument/${documentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ suspendReason }),
      });
      const message = await response.text();
      return { success: response.ok, message };
    } catch (err) {
      console.error("Error suspending document:", err);
      return { success: false, message: "Error suspending document" };
    }
  },

  openDocument: async (documentId) => {
    try {
      const response = await fetch(`/openDocument/${documentId}`, {
        method: "POST",
      });
      const message = await response.text();
      return { success: response.ok, message };
    } catch (err) {
      console.error("Error reopening document:", err);
      return { success: false, message: "Error reopening document" };
    }
  },

  updateDeclaration: async (documentId, declaration) => {
    try {
      const response = await fetch(
        `/updatePaymentDocumentDeclaration/${documentId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ declaration }),
        }
      );
      const message = await response.text();
      return { success: response.ok, message };
    } catch (err) {
      console.error("Error updating declaration:", err);
      return { success: false, message: "Error updating declaration" };
    }
  },

  massUpdateDeclaration: async (documentIds, declaration) => {
    try {
      const response = await fetch("/massUpdatePaymentDocumentDeclaration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentIds, declaration }),
      });
      const message = await response.text();
      return { success: response.ok, message };
    } catch (err) {
      console.error("Error updating declaration:", err);
      return { success: false, message: "Error updating declaration" };
    }
  },

  updatePaymentDocument: async (documentId, formData) => {
    try {
      const response = await fetch(`/updatePaymentDocument/${documentId}`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      return { success: response.ok, result };
    } catch (err) {
      console.error("Error updating document:", err);
      return { success: false, result: { message: "Error updating document" } };
    }
  },
};

// Document Filtering
const DocumentFilters = {
  filterByCurrentUser: (documents) => {
    if (
      !STATE.currentUser &&
      !STATE.showOnlyPendingApprovals &&
      !STATE.currentGroupFilter
    ) {
      return documents;
    }

    return documents.filter((doc) => {
      // Apply group filter if selected
      if (
        STATE.currentGroupFilter &&
        doc.groupName !== STATE.currentGroupFilter
      ) {
        return false;
      }

      // Apply pending approvals filter if enabled
      if (STATE.showOnlyPendingApprovals && STATE.currentUser) {
        const isRequiredApprover = doc.approvers.some(
          (approver) => approver.username === STATE.currentUser.username
        );
        const hasNotApprovedYet = !doc.approvedBy.some(
          (approved) => approved.username === STATE.currentUser.username
        );
        return isRequiredApprover && hasNotApprovedYet;
      }

      return true;
    });
  },
};

// Document Rendering
const DocumentRenderer = {
  renderPurchasingDocuments: (purchDocs) => {
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
              Đơn giá: ${Utils.formatCurrency(product.costPerUnit)}<br>
              Số lượng: ${Utils.formatCurrency(product.amount)}<br>
              VAT (%): ${(product.vat ?? 0).toLocaleString()}<br>
              Thành tiền: ${Utils.formatCurrency(product.totalCost)}<br>
              Thành tiền sau VAT: ${Utils.formatCurrency(
                product.totalCostAfterVat ?? product.totalCost
              )}<br>
              Ghi chú: ${product.note || "None"}
            </li>
          `
              )
              .join("");

            const fileMetadata = purchDoc.fileMetadata
              ? `<p><strong>Tệp đính kèm phiếu mua hàng:</strong> 
              <a href="${purchDoc.fileMetadata.link}" target="_blank" class="file-link">${purchDoc.fileMetadata.name}</a></p>`
              : "";

            return `
            <div class="purchasing-doc">
              <p><strong>Tên:</strong> ${purchDoc.name || ""}</p>
              <p><strong>Trạm:</strong> ${purchDoc.costCenter || ""}</p>
              <p><strong>Tổng chi phí:</strong> ${Utils.formatCurrency(
                purchDoc.grandTotalCost
              )}</p>
              <p><strong>Sản phẩm:</strong></p>
              <ul>${products}</ul>
              ${fileMetadata}
            </div>`;
          })
          .join("")}
      </div>`;
  },

  renderProposals: (purchDocs) => {
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
              <p><strong>Công việc:</strong> ${proposal.task}</p>
              <p><strong>Trạm:</strong> ${proposal.costCenter}</p>
              <p><strong>Mô tả:</strong> ${proposal.detailsDescription}</p>
              ${
                proposal.fileMetadata
                  ? `<p><strong>Tệp đính kèm:</strong> 
                    <a href="${proposal.fileMetadata.link}" target="_blank" class="file-link">${proposal.fileMetadata.name}</a></p>`
                  : ""
              }
            </div>
          `
          )
          .join("")}
      </div>`;
  },

  renderStatus: (status) => {
    switch (status) {
      case "Approved":
        return `<span class="status approved">Đã phê duyệt</span>`;
      case "Suspended":
        return `<span class="status suspended">Tạm dừng</span>`;
      default:
        return `<span class="status pending">Chưa phê duyệt</span>`;
    }
  },

  renderApprovalStatus: (approvers, approvedBy) => {
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
  },
};

// Table Management
const TableManager = {
  renderTable: (documents) => {
    DOM.paymentDocumentsTable.innerHTML = "";
    documents.forEach((doc) => {
      const row = document.createElement("tr");
      row.innerHTML = TableManager.getTableRowHTML(doc);
      DOM.paymentDocumentsTable.appendChild(row);
    });
  },

  getTableRowHTML: (doc) => {
    const approvalStatus = DocumentRenderer.renderApprovalStatus(
      doc.approvers,
      doc.approvedBy
    );

    return `
      <td><input type="checkbox" name="documentCheckbox" value="${
        doc._id
      }"></td>
      <td>${doc.tag || "-"}</td>
      <td>${doc.content || "-"} ${
      doc.suspendReason ? `(Lý do từ chối tài liệu: ${doc.suspendReason})` : ""
    }${doc.declaration ? `(Kê khai: ${doc.declaration})` : ""}</td>
      <td>${doc.paymentMethod || "-"}</td>
      <td>${Utils.formatCurrency(doc.totalPayment)}</td>
      <td>${doc.paymentDeadline || "-"}</td>
      <td>${DocumentRenderer.renderStatus(doc.status)}</td>
      <td class="approval-status">${approvalStatus}</td>
      <td>
        <button class="btn btn-primary" onclick="showFullView('${doc._id}')">
          <i class="fas fa-eye"></i> Xem
        </button>
        <form action="/exportDocumentToDocx/${
          doc._id
        }" method="GET" style="display:inline;">
          <button class="btn btn-secondary">
            <i class="fas fa-file-export"></i> Xuất
          </button>
        </form>
        ${
          doc.approvedBy.length === 0
            ? `
              <button class="btn btn-secondary" onclick="editDocument('${doc._id}')">
                <i class="fas fa-edit"></i> Sửa
              </button>
              <button class="btn btn-danger" onclick="deleteDocument('${doc._id}')">
                <i class="fas fa-trash"></i> Xóa
              </button>
            `
            : ""
        }
        ${
          doc.status === "Pending"
            ? `
              <button class="btn btn-primary" onclick="approveDocument('${doc._id}')">
                <i class="fas fa-check"></i> Duyệt
              </button>
            `
            : ""
        }
        ${
          doc.status === "Approved"
            ? `
              <button class="btn btn-secondary" onclick="editDeclaration('${doc._id}')">
                <i class="fas fa-edit"></i> Kê khai
              </button>
              <button class="btn btn-danger" onclick="suspendDocument('${doc._id}')">
                <i class="fas fa-ban"></i> Từ chối
              </button>
            `
            : doc.status === "Suspended"
            ? `
              <button class="btn btn-primary" onclick="openDocument('${doc._id}')">
                <i class="fas fa-lock-open"></i> Mở
              </button>
            `
            : `
              <button class="btn btn-danger" onclick="suspendDocument('${doc._id}')">
                <i class="fas fa-ban"></i> Từ chối
              </button>
            `
        }
      </td>
    `;
  },
};

// Summary Management
const SummaryManager = {
  updateSummary: (documents) => {
    const summary = documents.reduce(
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
    document.getElementById("paidSum").textContent = Utils.formatCurrency(
      summary.paidSum
    );
    document.getElementById("approvedSum").textContent = Utils.formatCurrency(
      summary.approvedSum
    );
    document.getElementById("unapprovedSum").textContent = Utils.formatCurrency(
      summary.unapprovedSum
    );
    document.getElementById("approvedDocument").textContent =
      summary.approvedDocument.toLocaleString();
    document.getElementById("unapprovedDocument").textContent =
      summary.unapprovedDocument.toLocaleString();
  },
};

// Pagination Management
const PaginationManager = {
  renderPagination: () => {
    let paginationContainer = document.getElementById("paginationContainer");
    if (!paginationContainer) {
      const table = document.querySelector("table");
      paginationContainer = document.createElement("div");
      paginationContainer.id = "paginationContainer";
      paginationContainer.className = "pagination";
      table.parentNode.insertBefore(paginationContainer, table.nextSibling);
    }

    if (STATE.totalPages > 1) {
      paginationContainer.innerHTML = `
        <div class="pagination-controls">
          <button onclick="changePage(1)" ${
            STATE.currentPage === 1 ? "disabled" : ""
          }>
            <i class="fas fa-angle-double-left"></i> First
          </button>
          <button onclick="changePage(${STATE.currentPage - 1})" ${
        STATE.currentPage === 1 ? "disabled" : ""
      }>
            <i class="fas fa-angle-left"></i> Prev
          </button>
          <span class="page-info">
            Trang/Page ${STATE.currentPage} / ${STATE.totalPages}
          </span>
          <button onclick="changePage(${STATE.currentPage + 1})" ${
        STATE.currentPage === STATE.totalPages ? "disabled" : ""
      }>
            Next <i class="fas fa-angle-right"></i>
          </button>
          <button onclick="changePage(${STATE.totalPages})" ${
        STATE.currentPage === STATE.totalPages ? "disabled" : ""
      }>
            Last <i class="fas fa-angle-double-right"></i>
          </button>
        </div>
      `;
    } else {
      paginationContainer.innerHTML = "";
    }
  },

  changePage: (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= STATE.totalPages &&
      newPage !== STATE.currentPage
    ) {
      STATE.currentPage = newPage;
      loadPaymentDocuments();
      document.querySelector("table").scrollIntoView({ behavior: "smooth" });
    }
  },
};

// Modal Management
const ModalManager = {
  showFullView: async (docId) => {
    try {
      const doc = STATE.paymentDocuments.find((d) => d._id === docId);
      if (!doc) throw new Error("Document not found");

      DOM.fullViewContent.innerHTML = ModalManager.getFullViewHTML(doc);
      DOM.fullViewModal.style.display = "block";
    } catch (err) {
      console.error("Error showing full view:", err);
      Utils.showMessage("Error loading full document details", true);
    }
  },

  getFullViewHTML: (doc) => {
    const submissionDate = doc.submissionDate || "Không có";
    const paymentDeadline = doc.paymentDeadline || "Không có";

    return `
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

      <div class="full-view-section">
        <h3><i class="fas fa-building"></i> Trạm</h3>
        <p style="white-space: pre-wrap;">${
          doc.costCenter || "No content provided"
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
            <span class="detail-value">${Utils.formatCurrency(
              doc.totalPayment
            )}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Tạm ứng:</span>
            <span class="detail-value">${Utils.formatCurrency(
              doc.advancePayment
            )}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Bù trừ:</span>
            <span class="detail-value">${
              doc.totalPayment && doc.advancePayment
                ? Utils.formatCurrency(doc.totalPayment - doc.advancePayment)
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
            : "Không có tệp kèm theo"
        }
      </div>

      <!-- Purchasing Documents Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-shopping-cart"></i> Phiếu mua hàng kèm theo</h3>
        ${
          doc.appendedPurchasingDocuments?.length
            ? DocumentRenderer.renderPurchasingDocuments(
                doc.appendedPurchasingDocuments
              )
            : "Không có phiếu mua hàng kèm theo"
        }
      </div>

      <!-- Proposals Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-lightbulb"></i> Phiếu đề xuất kèm theo</h3>
        ${
          doc.appendedPurchasingDocuments?.length
            ? DocumentRenderer.renderProposals(doc.appendedPurchasingDocuments)
            : "Không có phiếu đề xuất kèm theo"
        }
      </div>

      <!-- Status Section -->
      <div class="full-view-section">
        <h3><i class="fas fa-info-circle"></i> Trạng thái</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Tình trạng:</span>
            <span class="detail-value ${DocumentRenderer.renderStatus(
              doc.status
            )}</span>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <h4><i class="fas fa-user-check"></i> Trạng thái phê duyệt:</h4>
          <div class="approval-status">
            ${DocumentRenderer.renderApprovalStatus(
              doc.approvers,
              doc.approvedBy
            )}
          </div>
        </div>
      </div>
    `;
  },

  closeFullViewModal: () => {
    DOM.fullViewModal.style.display = "none";
  },

  suspendDocument: (docId) => {
    DOM.suspendForm.dataset.docId = docId;
    DOM.suspendModal.style.display = "block";
  },

  closeSuspendModal: () => {
    DOM.suspendModal.style.display = "none";
    DOM.suspendForm.reset();
  },

  handleSuspendSubmit: async (event) => {
    event.preventDefault();
    const docId = event.target.dataset.docId;
    const suspendReason = document.getElementById("suspendReason").value;

    const { success, message } = await API.suspendDocument(
      docId,
      suspendReason
    );
    Utils.showMessage(message, !success);

    if (success) {
      ModalManager.closeSuspendModal();
      loadPaymentDocuments();
    }
  },

  openMassDeclarationModal: () => {
    const selectedIds = Utils.getSelectedDocumentIds();
    if (selectedIds.length === 0) {
      Utils.showMessage(
        "Vui lòng chọn ít nhất một tài liệu để cập nhật kê khai.",
        true
      );
      return;
    }
    DOM.massDeclarationModal.style.display = "block";
  },

  closeMassDeclarationModal: () => {
    DOM.massDeclarationModal.style.display = "none";
    DOM.massDeclarationForm.reset();
  },

  handleMassDeclarationSubmit: async (event) => {
    event.preventDefault();
    const selectedIds = Utils.getSelectedDocumentIds();
    const declaration = document.getElementById("massDeclarationInput").value;

    if (selectedIds.length === 0) {
      Utils.showMessage(
        "Vui lòng chọn ít nhất một tài liệu để cập nhật kê khai.",
        true
      );
      return;
    }

    const { success, message } = await API.massUpdateDeclaration(
      selectedIds,
      declaration
    );
    Utils.showMessage(message, !success);

    if (success) {
      ModalManager.closeMassDeclarationModal();
      loadPaymentDocuments();
    }
  },

  editDocument: async (docId) => {
    try {
      // Ensure modal exists
      if (!DOM.editModal) {
        throw new Error("Edit modal not found in DOM");
      }

      const doc = await API.fetchDocumentDetails(docId);

      // Set form values
      document.getElementById("editDocId").value = docId;
      document.getElementById("editName").value = doc.name || "";
      document.getElementById("editContent").value = doc.content || "";
      document.getElementById("editPaymentMethod").value =
        doc.paymentMethod || "";
      document.getElementById("editTotalPayment").value =
        doc.totalPayment || "";
      document.getElementById("editDeadline").value = doc.paymentDeadline || "";

      // Populate dropdowns
      await ModalManager.populateCostCenterDropdown();
      document.getElementById("editCostCenter").value = doc.costCenter || "";

      // Set approvers
      STATE.currentApprovers = doc.approvers || [];
      ModalManager.renderCurrentApprovers();
      await ModalManager.populateNewApproversDropdown();

      // Show modal
      DOM.editModal.style.display = "block";
    } catch (err) {
      console.error("Error in editDocument:", err);
      Utils.showMessage("Error loading document details: " + err.message, true);
    }
  },

  closeEditModal: () => {
    DOM.editModal.style.display = "none";
    DOM.editForm.reset();
  },

  handleEditSubmit: async (event) => {
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
    );
    formData.append(
      "paymentDeadline",
      document.getElementById("editDeadline").value
    );
    formData.append("approvers", JSON.stringify(STATE.currentApprovers));

    const fileInput = document.getElementById("editFile");
    if (fileInput.files.length > 0) {
      formData.append("file", fileInput.files[0]);
    }

    const { success, result } = await API.updatePaymentDocument(
      docId,
      formData
    );
    if (success) {
      Utils.showMessage("Phiếu cập nhật thành công.");
      ModalManager.closeEditModal();
      loadPaymentDocuments();
    } else {
      Utils.showMessage(result.message || "Error updating document", true);
    }
  },

  populateCostCenterDropdown: async () => {
    try {
      const costCenters = await API.fetchCostCenters();
      const dropdown = document.getElementById("editCostCenter");

      // Clear existing options except the first one
      while (dropdown.options.length > 1) {
        dropdown.remove(1);
      }

      // Add options
      costCenters.forEach((center) => {
        const option = document.createElement("option");
        option.value = center.name;
        option.textContent = center.name;
        dropdown.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading cost centers:", error);
    }
  },

  renderCurrentApprovers: () => {
    const container = document.getElementById("currentApproversList");
    container.innerHTML = STATE.currentApprovers
      .map(
        (approver) => `
      <div class="approver-item" data-id="${approver.approver}">
        <span>${approver.username} (${approver.subRole})</span>
        <input type="text" value="${approver.subRole}" 
               onchange="updateApproverSubRole('${approver.approver}', this.value)">
        <button type="button" class="btn btn-danger" onclick="removeApprover('${approver.approver}')">
          <i class="fas fa-trash"></i> Xóa
        </button>
      </div>
    `
      )
      .join("");
  },

  populateNewApproversDropdown: async () => {
    try {
      const approvers = await API.fetchApprovers();
      const dropdown = document.getElementById("newApproversDropdown");

      // Clear existing options except the first one
      while (dropdown.options.length > 1) {
        dropdown.remove(1);
      }

      // Add options, excluding current approvers
      approvers.forEach((approver) => {
        if (!STATE.currentApprovers.some((a) => a.approver === approver._id)) {
          const option = document.createElement("option");
          option.value = approver._id;
          option.textContent = approver.username;
          dropdown.appendChild(option);
        }
      });
    } catch (error) {
      console.error("Error loading approvers:", error);
    }
  },

  addNewApprover: () => {
    const dropdown = document.getElementById("newApproversDropdown");
    const subRoleInput = document.getElementById("newApproverSubRole");

    if (!dropdown.value || !subRoleInput.value) {
      Utils.showMessage("Xin hãy chọn người phê duyệt và nhập vai trò", true);
      return;
    }

    const newApprover = {
      approver: dropdown.value,
      username: dropdown.options[dropdown.selectedIndex].text,
      subRole: subRoleInput.value,
    };

    STATE.currentApprovers.push(newApprover);
    ModalManager.renderCurrentApprovers();
    ModalManager.populateNewApproversDropdown();

    // Clear inputs
    dropdown.value = "";
    subRoleInput.value = "";
  },

  removeApprover: (approverId) => {
    STATE.currentApprovers = STATE.currentApprovers.filter(
      (a) => a.approver !== approverId
    );
    ModalManager.renderCurrentApprovers();
    ModalManager.populateNewApproversDropdown();
  },

  updateApproverSubRole: (approverId, newSubRole) => {
    const approver = STATE.currentApprovers.find(
      (a) => a.approver === approverId
    );
    if (approver) {
      approver.subRole = newSubRole;
    }
  },
};

// Document Actions
const DocumentActions = {
  toggleSelectAll: () => {
    const selectAllCheckbox = document.getElementById("selectAll");
    const checkboxes = document.querySelectorAll(
      'input[type="checkbox"][name="documentCheckbox"]'
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
    });
  },

  approveDocument: async (documentId) => {
    const { success, message } = await API.approveDocument(documentId);
    Utils.showMessage(message, !success);
    if (success) {
      loadPaymentDocuments();
    }
  },

  deleteDocument: async (documentId) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) {
      return;
    }

    const { success, message } = await API.deleteDocument(documentId);
    Utils.showMessage(message, !success);
    if (success) {
      loadPaymentDocuments();
    }
  },

  openDocument: async (documentId) => {
    const { success, message } = await API.openDocument(documentId);
    Utils.showMessage(message, !success);
    if (success) {
      loadPaymentDocuments();
    }
  },

  editDeclaration: (documentId) => {
    const doc = STATE.paymentDocuments.find((d) => d._id === documentId);
    if (!doc) return;

    const modalHTML = `
      <div id="declarationModal" class="modal">
        <div class="modal-content narrow">
          <span onclick="closeDeclarationModal()" class="close-btn">&times;</span>
          <h2><i class="fas fa-edit"></i> Kê Khai</h2>
          <textarea id="declarationInput" style="width: 100%; height: 150px; padding: 10px; font-size: 16px;">${
            doc.declaration || ""
          }</textarea>
          <div class="form-actions">
            <button onclick="saveDeclaration('${documentId}')" class="btn btn-primary">
              <i class="fas fa-save"></i> Lưu
            </button>
            <button onclick="closeDeclarationModal()" class="btn btn-secondary">
              <i class="fas fa-times"></i> Hủy
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    document.getElementById("declarationModal").style.display = "block";
  },

  closeDeclarationModal: () => {
    const modal = document.getElementById("declarationModal");
    if (modal) {
      modal.remove();
    }
  },

  saveDeclaration: async (documentId) => {
    const declaration = document.getElementById("declarationInput").value;

    const { success, message } = await API.updateDeclaration(
      documentId,
      declaration
    );
    Utils.showMessage(message, !success);

    if (success) {
      DocumentActions.closeDeclarationModal();
      loadPaymentDocuments();
    }
  },
};

// Group Filter Management
const GroupFilterManager = {
  populateGroupFilter: async () => {
    const groups = await API.fetchGroups();
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
  },

  filterByGroup: () => {
    STATE.currentGroupFilter = document.getElementById("groupFilter").value;
    STATE.currentPage = 1;
    loadPaymentDocuments();
  },
};

// Initialization
const initializePage = async () => {
  await API.fetchCurrentUser();

  // Add toggle switch before the table
  const table = document.querySelector("table");
  table.parentElement.insertBefore(createToggleSwitch(), table);

  // Add group filter
  await GroupFilterManager.populateGroupFilter();

  // Add event listeners
  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    STATE.showOnlyPendingApprovals = e.target.checked;
    STATE.currentPage = 1;
    loadPaymentDocuments();
  });

  document.getElementById("paginationToggle").addEventListener("change", () => {
    STATE.paginationEnabled =
      document.getElementById("paginationToggle").checked;
    STATE.currentPage = 1;
    loadPaymentDocuments();
  });

  // Initial load of documents
  loadPaymentDocuments();
};

const createToggleSwitch = () => {
  const toggleContainer = document.createElement("div");
  toggleContainer.style.marginBottom = "1rem";
  toggleContainer.innerHTML = `
    <label class="toggle-switch" style="display: flex; align-items: center; cursor: pointer;">
      <input type="checkbox" id="pendingToggle" style="margin-right: 0.5rem;">
      <span>Chỉ hiện phiếu tôi cần phê duyệt</span>
    </label>
  `;
  return toggleContainer;
};

const loadPaymentDocuments = async () => {
  try {
    // Show loading when fetching documents
    document.getElementById("loadingScreen").style.display = "flex";

    await API.fetchPaymentDocuments();
    const filteredDocuments = DocumentFilters.filterByCurrentUser(
      STATE.paymentDocuments
    );

    // Calculate total pages
    STATE.totalPages = Math.ceil(filteredDocuments.length / STATE.itemsPerPage);

    // Make sure current page is in valid range
    if (STATE.currentPage > STATE.totalPages) {
      STATE.currentPage = STATE.totalPages;
    }
    if (STATE.currentPage < 1) {
      STATE.currentPage = 1;
    }

    // Calculate slice indexes for current page
    const startIndex = (STATE.currentPage - 1) * STATE.itemsPerPage;
    const endIndex = startIndex + STATE.itemsPerPage;

    // Get documents for current page only if pagination is enabled, otherwise show all
    const pageDocuments = STATE.paginationEnabled
      ? filteredDocuments.slice(startIndex, endIndex)
      : filteredDocuments;

    // Reset the "Select All" checkbox
    Utils.resetSelectAllCheckbox();

    // Update UI
    TableManager.renderTable(pageDocuments);
    SummaryManager.updateSummary(filteredDocuments);

    // Render pagination controls if pagination is enabled
    if (STATE.paginationEnabled) {
      PaginationManager.renderPagination();
    } else {
      // Remove pagination if disabled
      let paginationContainer = document.getElementById("paginationContainer");
      if (paginationContainer) {
        paginationContainer.innerHTML = "";
      }
    }
  } catch (error) {
    console.error("Error loading documents:", error);
    Utils.showMessage("Error loading documents", true);
  } finally {
    document.getElementById("loadingScreen").style.display = "none";
  }
};

// Global functions for HTML event handlers
window.toggleSelectAll = DocumentActions.toggleSelectAll;
window.filterByGroup = GroupFilterManager.filterByGroup;
window.changePage = PaginationManager.changePage;
window.showFullView = ModalManager.showFullView;
window.closeFullViewModal = ModalManager.closeFullViewModal;
window.approveDocument = DocumentActions.approveDocument;
window.deleteDocument = DocumentActions.deleteDocument;
window.suspendDocument = ModalManager.suspendDocument;
window.closeSuspendModal = ModalManager.closeSuspendModal;
window.handleSuspendSubmit = ModalManager.handleSuspendSubmit;
window.openDocument = DocumentActions.openDocument;
window.editDocument = ModalManager.editDocument;
window.closeEditModal = ModalManager.closeEditModal;
window.handleEditSubmit = ModalManager.handleEditSubmit;
window.editDeclaration = DocumentActions.editDeclaration;
window.closeDeclarationModal = DocumentActions.closeDeclarationModal;
window.saveDeclaration = DocumentActions.saveDeclaration;
window.openMassDeclarationModal = ModalManager.openMassDeclarationModal;
window.closeMassDeclarationModal = ModalManager.closeMassDeclarationModal;
window.handleMassDeclarationSubmit = ModalManager.handleMassDeclarationSubmit;
window.addNewApprover = ModalManager.addNewApprover;
window.removeApprover = ModalManager.removeApprover;
window.updateApproverSubRole = ModalManager.updateApproverSubRole;

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", initializePage);

// Close modals when clicking outside
window.onclick = function (event) {
  if (event.target === DOM.fullViewModal) {
    ModalManager.closeFullViewModal();
  }
  if (event.target === DOM.suspendModal) {
    ModalManager.closeSuspendModal();
  }
  if (event.target === DOM.massDeclarationModal) {
    ModalManager.closeMassDeclarationModal();
  }
  if (event.target === DOM.editModal) {
    ModalManager.closeEditModal();
  }
};
