// Global data store
let appData = {
  user: null,
  summaries: null,
  lastUpdated: null,
};

// DOM Elements
const elements = {
  welcomeMessage: document.getElementById("welcomeMessage"),
  userAvatar: document.getElementById("userAvatar"),
  usernameDisplay: document.getElementById("usernameDisplay"),
  lastUpdated: document.getElementById("lastUpdated"),
  documentCards: document.getElementById("documentCards"),
  recentDocuments: document.getElementById("recentDocuments"),
  refreshBtn: document.getElementById("refreshBtn"),
  viewAllBtn: document.getElementById("viewAllBtn"),
  exportBtn: document.getElementById("exportBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalDocumentList: document.getElementById("modalDocumentList"),
};

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
  elements.refreshBtn.addEventListener("click", loadDashboardData);
});

// Main data loading function
async function loadDashboardData() {
  try {
    setLoadingState(true);

    const response = await fetch("/unapprovedDocumentsSummary");
    const data = await response.json();

    if (data.success) {
      appData = {
        user: data.data.user,
        summaries: data.data.summaries,
        lastUpdated: data.data.lastUpdated,
      };

      updateUserInfo();
      renderDashboard();
      updateLastUpdated();
      enableButtons();
    } else {
      showError("Không thể tải dữ liệu phê duyệt");
    }
  } catch (error) {
    console.error("Lỗi:", error);
    showError("Không thể kết nối đến máy chủ");
  } finally {
    setLoadingState(false);
  }
}

// Update user information display
function updateUserInfo() {
  if (!appData.user) return;

  // Set welcome message
  elements.welcomeMessage.textContent = `Xin chào ${appData.user.username}!`;

  // Update user avatar and info
  const initials = appData.user.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  elements.userAvatar.innerHTML = `<span>${initials}</span>`;
  elements.usernameDisplay.textContent = appData.user.username;
}

// Render the main dashboard cards
function renderDashboard() {
  if (!appData.summaries) return;

  renderSummaryCards();
  renderRecentDocuments();
}

// Render the summary cards
function renderSummaryCards() {
  const documentTypes = [
    {
      name: "Chung",
      key: "generic",
      icon: "bi-file-earmark-text",
      color: "primary",
    },
    {
      name: "Đề xuất",
      key: "proposal",
      icon: "bi-file-earmark-medical",
      color: "success",
    },
    {
      name: "Mua hàng",
      key: "purchasing",
      icon: "bi-cart",
      color: "info",
    },
    {
      name: "Xuất kho",
      key: "delivery",
      icon: "bi-truck",
      color: "warning",
    },
    {
      name: "Thanh toán",
      key: "payment",
      icon: "bi-cash-stack",
      color: "danger",
    },
    {
      name: "Tạm ứng",
      key: "advance_payment",
      icon: "bi-currency-exchange",
      color: "secondary",
    },
    {
      name: "Thu hồi tạm ứng",
      key: "advance_reclaim",
      icon: "bi-arrow-counterclockwise",
      color: "dark",
    },
    {
      name: "Đề nghị mở dự án",
      key: "project_proposal",
      icon: "bi-file-earmark-ppt",
      color: "primary",
    },
  ];

  elements.documentCards.innerHTML = documentTypes
    .map((type) => {
      const summary = appData.summaries[type.key] || {
        count: 0,
        documents: [],
      };
      const cardClass = `summary-card ${type.key.replace("_", "-")}`;
      const badgeClass =
        summary.count > 0 ? `bg-${type.color}` : "bg-secondary";

      return `
          <div class="col">
            <div class="card ${cardClass} h-100" onclick="showDocuments('${
        type.key
      }', '${type.name}')">
              <div class="card-body text-center">
                <div class="document-icon text-${type.color}">
                  <i class="bi ${type.icon}"></i>
                </div>
                <h5 class="card-title">${type.name}</h5>
                <span class="badge ${badgeClass} badge-count">${
        summary.count
      }</span>
                <p class="card-text mt-2 text-muted">
                  ${summary.count > 0 ? "Cần bạn phê duyệt" : "Đã cập nhật"}
                </p>
                ${
                  summary.count > 0
                    ? `
                  <button class="btn btn-sm btn-outline-${type.color} mt-2">
                    <i class="bi bi-eye"></i> Xem lại
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        `;
    })
    .join("");
}

// Render recent documents list
function renderRecentDocuments() {
  if (!appData.summaries) return;

  // Get all documents from all categories, sorted by date
  const allDocuments = Object.values(appData.summaries)
    .flatMap((summary) => summary.documents)
    .sort((a, b) => b.submissionDate - a.submissionDate)
    .slice(0, 5); // Show only 5 most recent

  if (allDocuments.length === 0) {
    elements.recentDocuments.innerHTML = `
          <div class="alert alert-info mb-0">
            <i class="bi bi-check-circle"></i> Không có phiếu nào đang chờ phê duyệt
          </div>
        `;
    return;
  }

  elements.recentDocuments.innerHTML = allDocuments
    .map(
      (doc) => `
        <a href="/viewDocument/${
          doc.id
        }" class="list-group-item list-group-item-action document-item">
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${doc.tag || doc.name || doc.task}</h6>
            <small>${doc.submissionDate}</small>
          </div>
          <p class="mb-1">Gửi bởi ${doc.submittedBy}</p>
          <small class="text-muted">Nhấn để xem lại</small>
        </a>
      `
    )
    .join("");
}

// Show documents modal for a specific type
function showDocuments(typeKey, typeName) {
  const summary = appData.summaries[typeKey];

  elements.modalTitle.innerHTML = `<i class="bi ${getDocumentIcon(
    typeKey
  )}"></i> Phiếu ${typeName} đang chờ phê duyệt`;

  if (!summary || summary.count === 0) {
    elements.modalDocumentList.innerHTML = `
            <tr>
              <td colspan="4" class="text-center py-4">
                <div class="alert alert-info mb-0">
                  <i class="bi bi-check-circle"></i> Không có phiếu ${typeName.toLowerCase()} nào cần bạn phê duyệt
                </div>
              </td>
            </tr>
          `;
  } else {
    elements.modalDocumentList.innerHTML = summary.documents
      .map(
        (doc) => `
              <tr>
                <td>${doc.tag || doc.name || doc.task}</td>
                <td>${doc.submittedBy}</td>
                <td>${doc.submissionDate}</td>
                <td>
                  <div class="d-flex gap-2">
                    <button onclick="approveDocument('${typeKey}', '${
          doc.id
        }')" class="btn btn-sm btn-success">
                      <i class="bi bi-check-circle"></i> Duyệt
                    </button>
                    <a href="/viewDocument/${
                      doc.id
                    }" class="btn btn-sm btn-primary">
                      <i class="bi bi-eye"></i> Xem đầy đủ
                    </a>
                  </div>
                </td>
              </tr>
            `
      )
      .join("");
  }

  new bootstrap.Modal(document.getElementById("documentsModal")).show();
}

// Approve document function
async function approveDocument(type, id) {
  try {
    const response = await fetch(`/approveDocument/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.text();

    if (result.includes("thành công") || result.includes("hoàn toàn")) {
      alert(result);
      loadDashboardData(); // Refresh the dashboard
      bootstrap.Modal.getInstance(
        document.getElementById("documentsModal")
      ).hide();
    } else {
      alert(result);
    }
  } catch (error) {
    console.error("Error approving document:", error);
    alert("Lỗi khi phê duyệt phiếu");
  }
}

// Helper function to get document icon by type
function getDocumentIcon(typeKey) {
  const icons = {
    generic: "bi-file-earmark-text",
    proposal: "bi-file-earmark-medical",
    purchasing: "bi-cart",
    delivery: "bi-truck",
    payment: "bi-cash-stack",
    advance_payment: "bi-currency-exchange",
    advance_reclaim: "bi-arrow-counterclockwise",
    project_proposal: "bi-file-earmark-ppt",
  };
  return icons[typeKey] || "bi-file-earmark";
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return "Không rõ ngày";
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// Update last updated timestamp
function updateLastUpdated() {
  if (!appData.lastUpdated) return;
  elements.lastUpdated.innerHTML = `
        <i class="bi bi-clock-history"></i> Cập nhật: ${formatDate(
          appData.lastUpdated
        )}
      `;
}

// Enable action buttons
function enableButtons() {
  elements.viewAllBtn.disabled = false;
  elements.exportBtn.disabled = false;
}

// Set loading state
function setLoadingState(isLoading) {
  if (isLoading) {
    elements.refreshBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status"></span>';
    elements.refreshBtn.disabled = true;
  } else {
    elements.refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    elements.refreshBtn.disabled = false;
  }
}

// Show error message
function showError(message) {
  elements.documentCards.innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle"></i> ${message}
          </div>
        </div>
      `;
}
