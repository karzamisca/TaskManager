// views/documentPages/documentSummaryProposal/documentSummaryProposal.js
// Helper functions
const fetchData = async (url, options = {}) => {
  try {
    // Show loading screen
    document.getElementById("loadingScreen").style.display = "flex";

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(response.statusText);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  } finally {
    // Hide loading screen when done
    document.getElementById("loadingScreen").style.display = "none";
  }
};

const showMessage = (message, isError = false) => {
  const messageContainer = document.getElementById("messageContainer");
  messageContainer.textContent = message;
  messageContainer.className = `message ${isError ? "error" : "success"}`;
  messageContainer.style.display = "block";

  const header = document.querySelector(".page-header");
  const headerBottom = header.getBoundingClientRect().bottom + window.scrollY;
  messageContainer.style.top = `${headerBottom + 10}px`;

  setTimeout(() => {
    messageContainer.style.display = "none";
  }, 5000);
};

const renderStatus = (status) => {
  const statusClasses = {
    Approved: "approved",
    Suspended: "suspended",
    Pending: "pending",
  };

  return `<span class="status ${
    statusClasses[status] || "pending"
  }">${status}</span>`;
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
                ? `<div class="approval-date">Approved on: ${hasApproved.approvalDate}</div>`
                : '<div class="approval-date">Pending</div>'
            }
          </div>
        </div>
      `;
    })
    .join("");
};

// Main state management
const createProposalManager = () => {
  let state = {
    currentUser: null,
    proposalDocuments: [],
    filteredDocuments: [],
    showOnlyPendingApprovals: false,
    currentApprovers: [],
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1,
    paginationEnabled: true,
    currentDocumentId: null,
  };

  const updateState = (newState) => {
    state = { ...state, ...newState };
  };

  // Core functions
  const filterDocumentsForCurrentUser = (
    documents,
    currentUser,
    showOnlyPendingApprovals
  ) => {
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
  };

  const renderDocumentsTable = (documents) => {
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
        <td>${renderStatus(doc.status)}</td>
        <td class="approval-status">${renderApprovalStatus(
          doc.approvers,
          doc.approvedBy
        )}</td>
        <td>
          <div class="action-buttons">
            <form action="/exportDocumentToDocx/${doc._id}" method="GET">
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
              Liên quan
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  };

  const renderPagination = () => {
    const paginationContainer = document.getElementById("paginationContainer");

    if (!state.paginationEnabled || state.totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    paginationContainer.innerHTML = `
      <div class="pagination-controls">
        <button onclick="proposalManager.changePage(1)" ${
          state.currentPage === 1 ? "disabled" : ""
        }>
          &laquo; First
        </button>
        <button onclick="proposalManager.changePage(${
          state.currentPage - 1
        })" ${state.currentPage === 1 ? "disabled" : ""}>
          &lsaquo; Prev
        </button>
        <span class="page-info">
          Trang ${state.currentPage} / ${state.totalPages}
        </span>
        <button onclick="proposalManager.changePage(${
          state.currentPage + 1
        })" ${state.currentPage === state.totalPages ? "disabled" : ""}>
          Next &rsaquo;
        </button>
        <button onclick="proposalManager.changePage(${state.totalPages})" ${
      state.currentPage === state.totalPages ? "disabled" : ""
    }>
          Last &raquo;
        </button>
      </div>
    `;
  };

  const updateSummary = (approvedCount, unapprovedCount) => {
    document.getElementById("approvedDocument").textContent =
      approvedCount.toLocaleString();
    document.getElementById("unapprovedDocument").textContent =
      unapprovedCount.toLocaleString();
  };

  // Public API
  return {
    init: async () => {
      try {
        const currentUser = await fetchData("/getCurrentUser");
        updateState({ currentUser });

        document
          .getElementById("pendingToggle")
          .addEventListener("change", (e) => {
            updateState({
              showOnlyPendingApprovals: e.target.checked,
              currentPage: 1,
            });
            proposalManager.fetchProposalDocuments();
          });

        document
          .getElementById("paginationToggle")
          .addEventListener("change", () => {
            updateState({
              paginationEnabled:
                document.getElementById("paginationToggle").checked,
              currentPage: 1,
            });
            proposalManager.fetchProposalDocuments();
          });

        window.addEventListener("click", (event) => {
          if (event.target.classList.contains("modal")) {
            event.target.style.display = "none";
          }
        });

        proposalManager.fetchProposalDocuments();
      } catch (error) {
        showMessage("Error initializing proposal manager", true);
      }
    },

    fetchProposalDocuments: async () => {
      try {
        const data = await fetchData("/getProposalDocumentForSeparatedView");
        const filteredDocuments = filterDocumentsForCurrentUser(
          data.proposalDocuments,
          state.currentUser,
          state.showOnlyPendingApprovals
        );

        const totalPages = Math.ceil(
          filteredDocuments.length / state.itemsPerPage
        );
        const currentPage = Math.max(
          1,
          Math.min(state.currentPage, totalPages)
        );

        updateState({
          proposalDocuments: data.proposalDocuments,
          filteredDocuments,
          totalPages,
          currentPage,
        });

        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const pageDocuments = state.paginationEnabled
          ? state.filteredDocuments.slice(startIndex, endIndex)
          : state.filteredDocuments;

        renderDocumentsTable(pageDocuments);
        renderPagination();
        updateSummary(data.approvedDocument, data.unapprovedDocument);
      } catch (err) {
        showMessage("Error fetching proposal documents", true);
      }
    },

    changePage: (newPage) => {
      if (
        newPage >= 1 &&
        newPage <= state.totalPages &&
        newPage !== state.currentPage
      ) {
        updateState({ currentPage: newPage });
        proposalManager.fetchProposalDocuments();
        document
          .querySelector(".table-container")
          .scrollIntoView({ behavior: "smooth" });
      }
    },

    approveDocument: async (documentId) => {
      try {
        const response = await fetch(`/approveDocument/${documentId}`, {
          method: "POST",
        });
        const message = await response.text();

        if (response.ok) {
          showMessage(message);
          proposalManager.fetchProposalDocuments();
        } else {
          showMessage(message, true);
        }
      } catch (err) {
        showMessage("Error approving document", true);
      }
    },

    deleteDocument: async (documentId) => {
      if (!confirm("Bạn có chắc chắn muốn xóa phiếu đề xuất này?")) return;

      try {
        const response = await fetch(`/deleteDocument/${documentId}`, {
          method: "POST",
        });
        const message = await response.text();

        if (response.ok) {
          showMessage(message);
          proposalManager.fetchProposalDocuments();
        } else {
          showMessage(message, true);
        }
      } catch (err) {
        showMessage("Error deleting document", true);
      }
    },

    editDocument: async (docId) => {
      try {
        const doc = await fetchData(`/getProposalDocument/${docId}`);

        // Populate form
        document.getElementById("editDocId").value = docId;
        document.getElementById("editTask").value = doc.task;
        document.getElementById("editDateOfError").value = doc.dateOfError;
        document.getElementById("editDetailsDescription").value =
          doc.detailsDescription;
        document.getElementById("editDirection").value = doc.direction;

        // Populate cost center dropdown
        await proposalManager.populateCostCenterDropdown();
        document.getElementById("editCostCenter").value = doc.costCenter;

        // Populate approvers
        updateState({ currentApprovers: doc.approvers });
        proposalManager.renderCurrentApprovers();
        await proposalManager.populateNewApproversDropdown();

        // Show modal
        document.getElementById("editModal").style.display = "block";
      } catch (err) {
        showMessage("Error loading document details", true);
      }
    },

    populateCostCenterDropdown: async () => {
      try {
        const userData = await fetchData("/getCurrentUser");
        const currentUser = userData.username;

        const costCenters = await fetchData("/costCenters");

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
        showMessage("Error loading cost centers", true);
      }
    },

    renderCurrentApprovers: () => {
      const container = document.getElementById("currentApproversList");
      container.innerHTML = state.currentApprovers
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
    },

    updateApproverSubRole: (approverId, newSubRole) => {
      const updatedApprovers = state.currentApprovers.map((approver) =>
        approver.approver === approverId
          ? { ...approver, subRole: newSubRole }
          : approver
      );
      updateState({ currentApprovers: updatedApprovers });
    },

    removeApprover: (approverId) => {
      const updatedApprovers = state.currentApprovers.filter(
        (a) => a.approver !== approverId
      );
      updateState({ currentApprovers: updatedApprovers });
      proposalManager.renderCurrentApprovers();
      proposalManager.populateNewApproversDropdown();
    },

    populateNewApproversDropdown: async () => {
      try {
        const allApprovers = await fetchData("/approvers");

        const availableApprovers = allApprovers.filter(
          (approver) =>
            !state.currentApprovers.some((a) => a.approver === approver._id)
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
        showMessage("Error loading approvers", true);
      }
    },

    addNewApprover: () => {
      const dropdown = document.getElementById("newApproversDropdown");
      const subRoleInput = document.getElementById("newApproverSubRole");
      const approverId = dropdown.value;
      const subRole = subRoleInput.value;

      if (!approverId || !subRole) {
        showMessage("Vui lòng chọn người phê duyệt và nhập vai trò phụ", true);
        return;
      }

      const newApprover = {
        approver: approverId,
        username: dropdown.selectedOptions[0].text,
        subRole: subRole,
      };

      updateState({
        currentApprovers: [...state.currentApprovers, newApprover],
      });

      proposalManager.renderCurrentApprovers();
      proposalManager.populateNewApproversDropdown();

      // Clear inputs
      dropdown.value = "";
      subRoleInput.value = "";
    },

    handleEditSubmit: async (event) => {
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

      formData.append("approvers", JSON.stringify(state.currentApprovers));

      try {
        const response = await fetch(`/updateProposalDocument/${docId}`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          showMessage("Document updated successfully");
          document.getElementById("editModal").style.display = "none";
          proposalManager.fetchProposalDocuments();
        } else {
          showMessage(result.message || "Error updating document", true);
        }
      } catch (err) {
        showMessage("Error updating document", true);
      }
    },

    editDeclaration: (docId) => {
      const doc = state.proposalDocuments.find((d) => d._id === docId);
      if (!doc) return;

      updateState({ currentDocumentId: docId });
      document.getElementById("declarationInput").value = doc.declaration || "";
      document.getElementById("declarationModal").style.display = "block";
    },

    saveDeclaration: async () => {
      const declaration = document.getElementById("declarationInput").value;

      try {
        const response = await fetch(
          `/updateProposalDocumentDeclaration/${state.currentDocumentId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ declaration }),
          }
        );

        const message = await response.text();

        if (response.ok) {
          showMessage(message);
          document.getElementById("declarationModal").style.display = "none";
          proposalManager.fetchProposalDocuments();
        } else {
          showMessage(message, true);
        }
      } catch (err) {
        showMessage("Error updating declaration", true);
      }
    },

    suspendDocument: (docId) => {
      updateState({ currentDocumentId: docId });
      document.getElementById("suspendForm").reset();
      document.getElementById("suspendModal").style.display = "block";
    },

    handleSuspendSubmit: async (event) => {
      event.preventDefault();
      const suspendReason = document.getElementById("suspendReason").value;

      try {
        const response = await fetch(
          `/suspendProposalDocument/${state.currentDocumentId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suspendReason }),
          }
        );

        const message = await response.text();

        if (response.ok) {
          showMessage(message);
          document.getElementById("suspendModal").style.display = "none";
          proposalManager.fetchProposalDocuments();
        } else {
          showMessage(message, true);
        }
      } catch (err) {
        showMessage("Error suspending document", true);
      }
    },

    openDocument: async (docId) => {
      try {
        const response = await fetch(`/openProposalDocument/${docId}`, {
          method: "POST",
        });

        const message = await response.text();

        if (response.ok) {
          showMessage(message);
          proposalManager.fetchProposalDocuments();
        } else {
          showMessage(message, true);
        }
      } catch (err) {
        showMessage("Error reopening document", true);
      }
    },

    showDocumentsContainingProposal: async (proposalId) => {
      try {
        const data = await fetchData(
          `/documentsContainingProposal/${proposalId}`
        );

        if (data.success) {
          proposalManager.renderDocumentsContainingModal(data);
        } else {
          showMessage(
            "Error fetching documents containing this proposal",
            true
          );
        }
      } catch (error) {
        showMessage("Error fetching documents containing this proposal", true);
      }
    },

    renderDocumentsContainingModal: (data) => {
      const modalHTML = `
        <div id="containingDocsModal" class="modal" style="display: block;">
          <div class="modal-content" style="max-width: 1200px;">
            <span class="close-btn" onclick="document.getElementById('containingDocsModal').remove()">&times;</span>
            <h2>Tài liệu chứa đề xuất này</h2>
            
            <h3>Phiếu mua hàng</h3>
            <div class="documents-container">
              ${
                data.purchasingDocuments.length > 0
                  ? data.purchasingDocuments
                      .map((doc) => proposalManager.renderDocumentCard(doc))
                      .join("")
                  : "<p>Không có phiếu mua hàng nào chứa đề xuất này</p>"
              }
            </div>
            
            <h3>Phiếu xuất kho</h3>
            <div class="documents-container">
              ${
                data.deliveryDocuments.length > 0
                  ? data.deliveryDocuments
                      .map((doc) => proposalManager.renderDocumentCard(doc))
                      .join("")
                  : "<p>Không có Phiếu xuất kho nào chứa đề xuất này</p>"
              }
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHTML);
    },

    renderDocumentCard: (doc) => {
      return `
        <div class="document-card">
          <h4>${
            doc.title ||
            (doc.type === "purchasing" ? "Phiếu mua hàng" : "Phiếu xuất kho")
          }</h4>
          <div class="document-details">
            <div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div>
            <div><strong>Ngày nộp:</strong> ${doc.submissionDate || "-"}</div>
            <div><strong>Tình trạng:</strong> ${renderStatus(doc.status)}</div>
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
    },

    closeDeclarationModal: () => {
      document.getElementById("declarationModal").style.display = "none";
    },

    closeSuspendModal: () => {
      document.getElementById("suspendModal").style.display = "none";
    },

    closeEditModal: () => {
      document.getElementById("editModal").style.display = "none";
    },
  };
};

// Initialize the manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.proposalManager = createProposalManager();
  proposalManager.init();
});
