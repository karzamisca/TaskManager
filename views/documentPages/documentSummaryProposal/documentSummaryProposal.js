// views/documentPages/documentSummaryProposal/documentSummaryProposal.js
class ProposalDocumentManager {
  constructor() {
    this.currentUser = null;
    this.proposalDocuments = [];
    this.filteredDocuments = [];
    this.showOnlyPendingApprovals = false;
    this.currentApprovers = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalPages = 1;
    this.paginationEnabled = true;
    this.currentDocumentId = null;

    this.init();
  }

  async init() {
    await this.fetchCurrentUser();
    this.setupEventListeners();
    this.fetchProposalDocuments();
  }

  async fetchCurrentUser() {
    try {
      const response = await fetch("/getCurrentUser");
      this.currentUser = await response.json();
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  }

  setupEventListeners() {
    document.getElementById("pendingToggle").addEventListener("change", (e) => {
      this.showOnlyPendingApprovals = e.target.checked;
      this.currentPage = 1;
      this.fetchProposalDocuments();
    });

    document
      .getElementById("paginationToggle")
      .addEventListener("change", () => {
        this.paginationEnabled =
          document.getElementById("paginationToggle").checked;
        this.currentPage = 1;
        this.fetchProposalDocuments();
      });

    window.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal")) {
        event.target.style.display = "none";
      }
    });
  }

  filterDocumentsForCurrentUser(documents) {
    if (!this.currentUser || !this.showOnlyPendingApprovals) return documents;

    return documents.filter((doc) => {
      const isRequiredApprover = doc.approvers.some(
        (approver) => approver.username === this.currentUser.username
      );
      const hasNotApprovedYet = !doc.approvedBy.some(
        (approved) => approved.username === this.currentUser.username
      );
      return isRequiredApprover && hasNotApprovedYet;
    });
  }

  showMessage(message, isError = false) {
    const messageContainer = document.getElementById("messageContainer");
    messageContainer.textContent = message;
    messageContainer.className = `message ${isError ? "error" : "success"}`;
    messageContainer.style.display = "block";

    // Position message below header
    const header = document.querySelector(".page-header");
    const headerBottom = header.getBoundingClientRect().bottom + window.scrollY;
    messageContainer.style.top = `${headerBottom + 10}px`;

    setTimeout(() => {
      messageContainer.style.display = "none";
    }, 5000);
  }

  renderStatus(status) {
    switch (status) {
      case "Approved":
        return `<span class="status approved">Approved</span>`;
      case "Suspended":
        return `<span class="status suspended">Suspended</span>`;
      default:
        return `<span class="status pending">Pending</span>`;
    }
  }

  renderApprovalStatus(approvers, approvedBy) {
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
                ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                : '<div class="approval-date">Pending</div>'
            }
          </div>
        </div>
      `;
      })
      .join("");
  }

  async fetchProposalDocuments() {
    try {
      const response = await fetch("/getProposalDocumentForSeparatedView");
      const data = await response.json();
      this.proposalDocuments = data.proposalDocuments;
      this.filteredDocuments = this.filterDocumentsForCurrentUser(
        this.proposalDocuments
      );

      // Calculate pagination
      this.totalPages = Math.ceil(
        this.filteredDocuments.length / this.itemsPerPage
      );
      this.currentPage = Math.max(
        1,
        Math.min(this.currentPage, this.totalPages)
      );

      // Get documents for current page
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const pageDocuments = this.paginationEnabled
        ? this.filteredDocuments.slice(startIndex, endIndex)
        : this.filteredDocuments;

      this.renderDocumentsTable(pageDocuments);
      this.renderPagination();
      this.updateSummary(data.approvedDocument, data.unapprovedDocument);
    } catch (err) {
      console.error("Error fetching proposal documents:", err);
      this.showMessage("Error fetching proposal documents", true);
    }
  }

  renderDocumentsTable(documents) {
    const tableBody = document.getElementById("proposalDocumentsTable");
    tableBody.innerHTML = "";

    if (documents.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="11" style="text-align: center;">No documents found</td>`;
      tableBody.appendChild(row);
      return;
    }

    documents.forEach((doc) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${doc.task || "-"} 
          ${
            doc.declaration
              ? `<small>(Kê khai: ${doc.declaration})</small>`
              : ""
          }
          ${
            doc.suspendReason
              ? `<small>(Lý do từ chối: ${doc.suspendReason})</small>`
              : ""
          }
        </td>
        <td>${doc.costCenter || "-"}</td>
        <td>${doc.dateOfError || "-"}</td>
        <td>${doc.detailsDescription || "-"}</td>
        <td>${doc.direction || "-"}</td>
        <td>${
          doc.fileMetadata?.link
            ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>`
            : "-"
        }</td>
        <td>${doc.submissionDate || "-"}</td>
        <td>${doc.groupName || "-"}</td>
        <td>${this.renderStatus(doc.status)}</td>
        <td class="approval-status">${this.renderApprovalStatus(
          doc.approvers,
          doc.approvedBy
        )}</td>
        <td>
          <div class="action-buttons">
            <form action="/exportDocumentToDocx/${
              doc._id
            }" method="GET" target="_blank">
              <button type="submit" class="btn btn-primary btn-sm">Xuất DOCX</button>
            </form>
            ${
              doc.approvedBy.length === 0
                ? `
              <button class="btn btn-primary btn-sm" onclick="proposalManager.editDocument('${doc._id}')">Sửa</button>
              <button class="btn btn-danger btn-sm" onclick="proposalManager.deleteDocument('${doc._id}')">Xóa</button>
            `
                : ""
            }
            ${
              doc.status === "Pending"
                ? `
              <button class="btn btn-primary btn-sm" onclick="proposalManager.approveDocument('${doc._id}')">
                Phê duyệt
              </button>
            `
                : ""
            }
            ${
              doc.status === "Approved"
                ? `
              <button class="btn btn-primary btn-sm" onclick="proposalManager.editDeclaration('${doc._id}')">
                Kê khai
              </button>
            `
                : doc.status === "Suspended"
                ? `
              <button class="btn btn-primary btn-sm" onclick="proposalManager.openDocument('${doc._id}')">
                Mở lại
              </button>
            `
                : `
              <button class="btn btn-danger btn-sm" onclick="proposalManager.suspendDocument('${doc._id}')">
                Từ chối
              </button>
            `
            }
            <button class="btn btn-primary btn-sm" onclick="proposalManager.showDocumentsContainingProposal('${
              doc._id
            }')">
              Xem tài liệu
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  renderPagination() {
    const paginationContainer = document.getElementById("paginationContainer");

    if (!this.paginationEnabled || this.totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    paginationContainer.innerHTML = `
      <div class="pagination-controls">
        <button onclick="proposalManager.changePage(1)" ${
          this.currentPage === 1 ? "disabled" : ""
        }>
          &laquo; First
        </button>
        <button onclick="proposalManager.changePage(${this.currentPage - 1})" ${
      this.currentPage === 1 ? "disabled" : ""
    }>
          &lsaquo; Prev
        </button>
        <span class="page-info">
          Trang ${this.currentPage} / ${this.totalPages}
        </span>
        <button onclick="proposalManager.changePage(${this.currentPage + 1})" ${
      this.currentPage === this.totalPages ? "disabled" : ""
    }>
          Next &rsaquo;
        </button>
        <button onclick="proposalManager.changePage(${this.totalPages})" ${
      this.currentPage === this.totalPages ? "disabled" : ""
    }>
          Last &raquo;
        </button>
      </div>
    `;
  }

  changePage(newPage) {
    if (
      newPage >= 1 &&
      newPage <= this.totalPages &&
      newPage !== this.currentPage
    ) {
      this.currentPage = newPage;
      this.fetchProposalDocuments();
      document
        .querySelector(".table-container")
        .scrollIntoView({ behavior: "smooth" });
    }
  }

  updateSummary(approvedCount, unapprovedCount) {
    document.getElementById("approvedDocument").textContent =
      approvedCount.toLocaleString();
    document.getElementById("unapprovedDocument").textContent =
      unapprovedCount.toLocaleString();
  }

  async approveDocument(documentId) {
    try {
      const response = await fetch(`/approveDocument/${documentId}`, {
        method: "POST",
      });
      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        this.fetchProposalDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error approving document:", err);
      this.showMessage("Error approving document", true);
    }
  }

  async deleteDocument(documentId) {
    if (!confirm("Bạn có chắc chắn muốn xóa phiếu đề xuất này?")) return;

    try {
      const response = await fetch(`/deleteDocument/${documentId}`, {
        method: "POST",
      });
      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        this.fetchProposalDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      this.showMessage("Error deleting document", true);
    }
  }

  async editDocument(docId) {
    try {
      const response = await fetch(`/getProposalDocument/${docId}`);
      const doc = await response.json();

      // Populate form
      document.getElementById("editDocId").value = docId;
      document.getElementById("editTask").value = doc.task;
      document.getElementById("editDateOfError").value = doc.dateOfError;
      document.getElementById("editDetailsDescription").value =
        doc.detailsDescription;
      document.getElementById("editDirection").value = doc.direction;

      // Populate cost center dropdown
      await this.populateCostCenterDropdown();
      document.getElementById("editCostCenter").value = doc.costCenter;

      // Populate approvers
      this.currentApprovers = doc.approvers;
      this.renderCurrentApprovers();
      await this.populateNewApproversDropdown();

      // Show modal
      document.getElementById("editModal").style.display = "block";
    } catch (err) {
      console.error("Error fetching document details:", err);
      this.showMessage("Error loading document details", true);
    }
  }

  async populateCostCenterDropdown() {
    try {
      const userResponse = await fetch("/getCurrentUser");
      const userData = await userResponse.json();
      const currentUser = userData.username;

      const costCenterResponse = await fetch("/costCenters");
      const costCenters = await costCenterResponse.json();

      const dropdown = document.getElementById("editCostCenter");
      dropdown.innerHTML =
        '<option value="">Chọn một trạm/Select a center</option>';

      costCenters.forEach((center) => {
        if (
          center.allowedUsers.length === 0 ||
          center.allowedUsers.includes(currentUser)
        ) {
          const option = document.createElement("option");
          option.value = center.name;
          option.textContent = center.name;
          dropdown.appendChild(option);
        }
      });
    } catch (error) {
      console.error("Error fetching cost centers:", error);
    }
  }

  renderCurrentApprovers() {
    const container = document.getElementById("currentApproversList");
    container.innerHTML = this.currentApprovers
      .map(
        (approver) => `
      <div class="approver-item">
        <span>${approver.username} (${approver.subRole})</span>
        <input type="text" value="${approver.subRole}" 
          onchange="proposalManager.updateApproverSubRole('${approver.approver}', this.value)">
        <button type="button" class="btn btn-danger btn-sm" 
          onclick="proposalManager.removeApprover('${approver.approver}')">Xóa</button>
      </div>
    `
      )
      .join("");
  }

  updateApproverSubRole(approverId, newSubRole) {
    const approver = this.currentApprovers.find(
      (a) => a.approver === approverId
    );
    if (approver) approver.subRole = newSubRole;
  }

  removeApprover(approverId) {
    this.currentApprovers = this.currentApprovers.filter(
      (a) => a.approver !== approverId
    );
    this.renderCurrentApprovers();
    this.populateNewApproversDropdown();
  }

  async populateNewApproversDropdown() {
    try {
      const response = await fetch("/approvers");
      const allApprovers = await response.json();

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
    } catch (error) {
      console.error("Error fetching approvers:", error);
    }
  }

  addNewApprover() {
    const dropdown = document.getElementById("newApproversDropdown");
    const subRoleInput = document.getElementById("newApproverSubRole");
    const approverId = dropdown.value;
    const subRole = subRoleInput.value;

    if (!approverId || !subRole) {
      this.showMessage(
        "Vui lòng chọn người phê duyệt và nhập vai trò phụ",
        true
      );
      return;
    }

    const newApprover = {
      approver: approverId,
      username: dropdown.selectedOptions[0].text,
      subRole: subRole,
    };

    this.currentApprovers.push(newApprover);
    this.renderCurrentApprovers();
    this.populateNewApproversDropdown();

    // Clear inputs
    dropdown.value = "";
    subRoleInput.value = "";
  }

  async handleEditSubmit(event) {
    event.preventDefault();
    const docId = document.getElementById("editDocId").value;
    const formData = new FormData();

    formData.append("task", document.getElementById("editTask").value);
    formData.append(
      "costCenter",
      document.getElementById("editCostCenter").value
    );
    formData.append(
      "dateOfError",
      document.getElementById("editDateOfError").value
    );
    formData.append(
      "detailsDescription",
      document.getElementById("editDetailsDescription").value
    );
    formData.append(
      "direction",
      document.getElementById("editDirection").value
    );

    const fileInput = document.getElementById("editFile");
    if (fileInput.files.length > 0) {
      formData.append("file", fileInput.files[0]);
    }

    formData.append("approvers", JSON.stringify(this.currentApprovers));

    try {
      const response = await fetch(`/updateProposalDocument/${docId}`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage("Document updated successfully");
        document.getElementById("editModal").style.display = "none";
        this.fetchProposalDocuments();
      } else {
        this.showMessage(result.message || "Error updating document", true);
      }
    } catch (err) {
      console.error("Error updating document:", err);
      this.showMessage("Error updating document", true);
    }
  }

  editDeclaration(docId) {
    const doc = this.proposalDocuments.find((d) => d._id === docId);
    if (!doc) return;

    this.currentDocumentId = docId;
    document.getElementById("declarationInput").value = doc.declaration || "";
    document.getElementById("declarationModal").style.display = "block";
  }

  async saveDeclaration() {
    const declaration = document.getElementById("declarationInput").value;

    try {
      const response = await fetch(
        `/updateProposalDocumentDeclaration/${this.currentDocumentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ declaration }),
        }
      );

      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        document.getElementById("declarationModal").style.display = "none";
        this.fetchProposalDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error updating declaration:", err);
      this.showMessage("Error updating declaration", true);
    }
  }

  suspendDocument(docId) {
    this.currentDocumentId = docId;
    document.getElementById("suspendForm").reset();
    document.getElementById("suspendModal").style.display = "block";
  }

  async handleSuspendSubmit(event) {
    event.preventDefault();
    const suspendReason = document.getElementById("suspendReason").value;

    try {
      const response = await fetch(
        `/suspendProposalDocument/${this.currentDocumentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suspendReason }),
        }
      );

      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        document.getElementById("suspendModal").style.display = "none";
        this.fetchProposalDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error suspending document:", err);
      this.showMessage("Error suspending document", true);
    }
  }

  async openDocument(docId) {
    try {
      const response = await fetch(`/openProposalDocument/${docId}`, {
        method: "POST",
      });

      const message = await response.text();

      if (response.ok) {
        this.showMessage(message);
        this.fetchProposalDocuments();
      } else {
        this.showMessage(message, true);
      }
    } catch (err) {
      console.error("Error reopening document:", err);
      this.showMessage("Error reopening document", true);
    }
  }

  async showDocumentsContainingProposal(proposalId) {
    try {
      const response = await fetch(
        `/documentsContainingProposal/${proposalId}`
      );
      const data = await response.json();

      if (data.success) {
        this.renderDocumentsContainingModal(data);
      } else {
        this.showMessage(
          "Error fetching documents containing this proposal",
          true
        );
      }
    } catch (error) {
      console.error("Error fetching documents containing proposal:", error);
      this.showMessage(
        "Error fetching documents containing this proposal",
        true
      );
    }
  }

  renderDocumentsContainingModal(data) {
    const modalHTML = `
      <div id="containingDocsModal" class="modal" style="display: block;">
        <div class="modal-content" style="max-width: 1200px;">
          <span class="close-btn" onclick="document.getElementById('containingDocsModal').remove()">&times;</span>
          <h2>Tài liệu chứa đề xuất này/Documents Containing This Proposal</h2>
          
          <h3>Phiếu mua hàng/Purchasing Documents</h3>
          <div class="documents-container">
            ${
              data.purchasingDocuments.length > 0
                ? data.purchasingDocuments
                    .map((doc) => this.renderDocumentCard(doc))
                    .join("")
                : "<p>Không có phiếu mua hàng nào chứa đề xuất này/Not appended to any purchasing documents</p>"
            }
          </div>
          
          <h3>Phiếu xuất kho/Delivery Documents</h3>
          <div class="documents-container">
            ${
              data.deliveryDocuments.length > 0
                ? data.deliveryDocuments
                    .map((doc) => this.renderDocumentCard(doc))
                    .join("")
                : "<p>Không có Phiếu xuất kho nào chứa đề xuất này/Not appended to any delivery documents</p>"
            }
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
  }

  renderDocumentCard(doc) {
    return `
      <div class="document-card">
        <h4>${
          doc.title ||
          (doc.type === "purchasing" ? "Phiếu mua hàng" : "Phiếu xuất kho")
        }</h4>
        <div class="document-details">
          <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
          <div><strong>Ngày nộp:</strong> ${doc.submissionDate || "-"}</div>
          <div><strong>Tình trạng:</strong> ${this.renderStatus(
            doc.status
          )}</div>
          <div><strong>Tổng chi phí:</strong> ${
            doc.grandTotalCost?.toLocaleString() || "-"
          }</div>
          <div><strong>Tệp tin:</strong> ${
            doc.fileMetadata?.link
              ? `<a href="${doc.fileMetadata.link}" target="_blank">${doc.fileMetadata.name}</a>`
              : "-"
          }</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.open('/documentView/${
          doc._id
        }', '_blank')">
          Xem chi tiết
        </button>
      </div>
    `;
  }

  closeDeclarationModal() {
    document.getElementById("declarationModal").style.display = "none";
  }

  closeSuspendModal() {
    document.getElementById("suspendModal").style.display = "none";
  }

  closeEditModal() {
    document.getElementById("editModal").style.display = "none";
  }
}

// Initialize the manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.proposalManager = new ProposalDocumentManager();
});
