// views/documentPages/documentSummaryUnapproved/documentSummaryUnapproved.js
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
  refreshBtn: document.getElementById("refreshBtn"),
  modalTitle: document.getElementById("modalTitle"),
  modalDocumentList: document.getElementById("modalDocumentList"),
  documentDetailsModal: document.getElementById("documentDetailsModal"),
  documentDetailsBody: document.getElementById("documentDetailsBody"),
  documentDetailsTitle: document.getElementById("documentDetailsTitle"),
};

// Document type configurations
const documentTypes = {
  generic: {
    name: "Chung",
    icon: "bi-file-earmark-text",
    color: "primary",
    endpoint: "/getDocument",
  },
  proposal: {
    name: "Đề xuất",
    icon: "bi-file-earmark-medical",
    color: "success",
    endpoint: "/getProposalDocument",
  },
  purchasing: {
    name: "Mua hàng",
    icon: "bi-cart",
    color: "info",
    endpoint: "/getPurchasingDocument",
  },
  delivery: {
    name: "Xuất kho",
    icon: "bi-truck",
    color: "warning",
    endpoint: "/getDeliveryDocument",
  },
  receipt: {
    name: "Nhập kho",
    icon: "bi-box-arrow-in-down",
    color: "warning",
    endpoint: "/getReceiptDocument",
  },
  payment: {
    name: "Thanh toán",
    icon: "bi-cash-stack",
    color: "danger",
    endpoint: "/getPaymentDocument",
  },
  advance_payment: {
    name: "Tạm ứng",
    icon: "bi-currency-exchange",
    color: "secondary",
    endpoint: "/getAdvancePaymentDocument",
  },
  advance_reclaim: {
    name: "Thu hồi tạm ứng",
    icon: "bi-arrow-counterclockwise",
    color: "dark",
    endpoint: "/getAdvancePaymentReclaimDocument",
  },
  project_proposal: {
    name: "Đề nghị mở dự án",
    icon: "bi-file-earmark-ppt",
    color: "primary",
    endpoint: "/getProjectProposal",
  },
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

  elements.welcomeMessage.textContent = `Xin chào ${appData.user.username}!`;
  const initials = appData.user.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  elements.userAvatar.innerHTML = `<span>${initials}</span>`;
  elements.usernameDisplay.textContent = appData.user.username;
}

// Render the main dashboard
function renderDashboard() {
  if (!appData.summaries) return;
  renderSummaryCards();
}

// Render the summary cards
function renderSummaryCards() {
  elements.documentCards.innerHTML = Object.entries(documentTypes)
    .map(([key, type]) => {
      const summary = appData.summaries[key] || { count: 0, documents: [] };
      const badgeClass =
        summary.count > 0 ? `bg-${type.color}` : "bg-secondary";

      return `
        <div class="col">
          <div class="card summary-card ${key.replace(
            "_",
            "-"
          )} h-100" onclick="showDocuments('${key}', '${type.name}')">
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

function getDocumentPriority(document, type) {
  // If document is already approved, return 'approved'
  if (document.status === "approved" || document.fullyApproved) {
    return "approved";
  }

  // For documents with stages, find the highest priority among unapproved stages
  if (document.stages && document.stages.length > 0) {
    const unapprovedStages = document.stages.filter(
      (stage) => stage.status !== "approved" && stage.status !== "Approved"
    );

    if (unapprovedStages.length > 0) {
      // Get priorities of unapproved stages (already in Vietnamese)
      const stagePriorities = unapprovedStages.map((stage) =>
        stage.priority ? stage.priority.toLowerCase() : "trung bình"
      );

      // Determine highest priority (Vietnamese values)
      if (stagePriorities.includes("cao")) return "cao";
      if (stagePriorities.includes("trung bình")) return "trung bình";
      return "thấp";
    }
  }

  // For documents without stages, use document's priority (already in Vietnamese)
  const docPriority = document.priority
    ? document.priority.toLowerCase()
    : "trung bình";

  if (docPriority === "cao") return "cao";
  if (docPriority === "trung bình") return "trung bình";
  if (docPriority === "thấp") return "thấp";

  // Default to trung bình if no priority specified
  return "trung bình";
}

// Helper function to convert Vietnamese priority to English key for CSS classes
function getEnglishPriorityKey(vietnamesePriority) {
  const mapping = {
    cao: "high",
    "trung bình": "medium",
    thấp: "low",
    approved: "approved",
  };
  return mapping[vietnamesePriority] || "medium";
}

// Update the showDocuments function to apply priority coloring
function showDocuments(typeKey, typeName) {
  const summary = appData.summaries[typeKey];
  const typeConfig = documentTypes[typeKey];

  elements.modalTitle.innerHTML = `<i class="bi ${typeConfig.icon}"></i> Phiếu ${typeName} đang chờ phê duyệt`;

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
      .map((doc) => {
        const priority = getDocumentPriority(doc, typeKey);
        const priorityClass = `priority-${getEnglishPriorityKey(priority)}`;
        const priorityBadge = getPriorityBadge(priority, doc);

        return `
        <tr class="${priorityClass}">
          <td>
            <div class="d-flex align-items-center">
              ${doc.tag || doc.name || doc.task}
              ${priorityBadge}
            </div>
          </td>
          <td>${doc.submittedBy}</td>
          <td>${doc.submissionDate}</td>
          <td>
            <div class="d-flex gap-2">
              <button onclick="approveDocument('${typeKey}', '${doc.id}')" 
                      class="btn btn-sm btn-success">
                <i class="bi bi-check-circle"></i> Duyệt
              </button>
              <button onclick="viewDocumentDetails('${typeKey}', '${doc.id}')" 
                      class="btn btn-sm btn-primary">
                <i class="bi bi-eye"></i> Xem chi tiết
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  // Only show modal if it's not already shown
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("documentsModal")
  );
  if (!modal || !modal._isShown) {
    new bootstrap.Modal(document.getElementById("documentsModal")).show();
  }
}

// Helper function to create priority badges
function getPriorityBadge(priority, document) {
  if (priority === "approved") {
    return '<span class="badge bg-success ms-2"><i class="bi bi-check-lg"></i> Đã duyệt</span>';
  }

  const badgeColors = {
    cao: "danger",
    "trung bình": "warning",
    thấp: "success",
  };

  // Check if this is a staged document
  const hasStages = document.stages && document.stages.length > 0;
  const badgeText = hasStages
    ? `${getPriorityDisplayName(priority)}`
    : getPriorityDisplayName(priority);

  return `<span class="badge bg-${badgeColors[priority]} ms-2">${badgeText}</span>`;
}

// View document details in modal
async function viewDocumentDetails(type, id) {
  try {
    // Only show loading if this is not a refresh (modal not already shown)
    const detailsModal = bootstrap.Modal.getInstance(
      elements.documentDetailsModal
    );
    const isRefresh = detailsModal && detailsModal._isShown;

    if (!isRefresh) {
      showLoadingInDetailsModal();
      const modal = new bootstrap.Modal(elements.documentDetailsModal);
      modal.show();
    } else {
      // For refresh, just update the title to indicate loading
      elements.documentDetailsTitle.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Đang cập nhật...`;
    }

    const typeConfig = documentTypes[type] || documentTypes.generic;
    const response = await fetch(`${typeConfig.endpoint}/${id}`);

    if (!response.ok) {
      throw new Error("Failed to fetch document");
    }

    const document = await response.json();
    renderDocumentDetails(type, document);
  } catch (error) {
    console.error("Error loading document details:", error);
    showErrorInDetailsModal("Không thể tải chi tiết phiếu");
  }
}

// Show loading state in details modal
function showLoadingInDetailsModal() {
  elements.documentDetailsBody.innerHTML = `
    <div class="d-flex justify-content-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;
}

// Show error in details modal
function showErrorInDetailsModal(message) {
  elements.documentDetailsBody.innerHTML = `
    <div class="alert alert-danger">
      <i class="bi bi-exclamation-triangle"></i> ${message}
    </div>
  `;
}

// Render document details in modal
function renderDocumentDetails(type, document) {
  const typeConfig = documentTypes[type] || documentTypes.generic;
  const priority = getDocumentPriority(document, type);

  elements.documentDetailsTitle.innerHTML = `<i class="bi ${
    typeConfig.icon
  }"></i> ${document.name || document.title || "Chi tiết phiếu"}
  ${getPriorityBadge(priority, document)}`;

  let detailsHtml = `
    <div class="card mb-3">
      <div class="card-header bg-light">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Thông tin cơ bản</h5>
          <div>
            ${getPriorityBadge(priority, document)}
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-md-6">
            <p><strong>Người gửi:</strong> ${
              document.submittedBy?.username || "Không rõ"
            }</p>
            <p><strong>Ngày gửi:</strong> ${document.submissionDate}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Trạng thái:</strong> <span class="badge bg-${getStatusBadgeColor(
              document.status
            )}">
              ${document.status || "Pending"}
            </span></p>
            <p><strong>Mức độ ưu tiên:</strong> ${getPriorityDisplayName(
              priority
            )}</p>
            ${
              document.costCenter
                ? `<p><strong>Trạm:</strong> ${document.costCenter}</p>`
                : ""
            }
          </div>
        </div>
  `;

  // Add type-specific details
  switch (type) {
    case "proposal":
      detailsHtml += addProposalDetails(document);
      break;
    case "purchasing":
      detailsHtml += addPurchasingDetails(document);
      // Add button to show full view with appended proposals
      detailsHtml += `
        <div class="mt-3">
          <button class="btn btn-primary" onclick="showFullView('${type}', '${document._id}')">
            <i class="bi bi-eye"></i> Xem toàn bộ thông tin
          </button>
        </div>
      `;
      break;
    case "payment":
      detailsHtml += addPaymentDetails(document);
      // Add button to show full view with appended purchasing
      detailsHtml += `
        <div class="mt-3">
          <button class="btn btn-primary" onclick="showFullView('${type}', '${document._id}')">
            <i class="bi bi-eye"></i> Xem toàn bộ thông tin
          </button>
        </div>
      `;
      break;
    case "advance_payment":
    case "advance_reclaim":
      detailsHtml += addAdvancePaymentDetails(document, type);
      break;
    case "delivery":
      detailsHtml += addDeliveryDetails(document);
      break;
    case "receipt":
      detailsHtml += addReceiptDetails(document);
      break;
    case "project_proposal":
      detailsHtml += addProjectProposalDetails(document);
      break;
  }

  // Add file attachment if exists
  if (document.fileMetadata && document.fileMetadata.length > 0) {
    detailsHtml += renderFileAttachments(document.fileMetadata);
  }

  detailsHtml += `</div></div>`;
  elements.documentDetailsBody.innerHTML = detailsHtml;
}

function formatFileDate(dateString) {
  if (!dateString) return "Không rõ ngày";

  try {
    let date;

    if (dateString.includes("T")) {
      // Split into date and time parts
      const [datePart, timePart] = dateString.split("T");

      // Parse date
      const [year, month, day] = datePart.split("-").map(Number);

      // Parse time
      const [hour, minute, second, ms] = timePart.split("-").map(Number);

      // Build a UTC date
      date = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second, ms || 0)
      );
    } else {
      // Fallback: try normal parsing
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return "Ngày không hợp lệ";
    }

    // Format for Vietnamese locale with time
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    };

    return date.toLocaleString("vi-VN", options);
  } catch (error) {
    console.error("Error formatting date:", error, dateString);
    return "Không thể định dạng ngày";
  }
}

function renderFileAttachments(fileMetadataArray) {
  if (!fileMetadataArray || fileMetadataArray.length === 0) {
    return "";
  }

  let html = `
    <hr>
    <h6>Tệp đính kèm (${fileMetadataArray.length})</h6>
    <div class="file-list">
  `;

  fileMetadataArray.forEach((file, index) => {
    const fileIcon = getFileIcon(file.mimeType || file.name);
    html += `
      <div class="file-item">
        <div class="file-icon">${fileIcon}</div>
        <div class="file-info">
          <div class="file-name">
            <a href="${
              file.link || "#"
            }" target="_blank" class="text-decoration-none">
              ${
                file.name ||
                file.displayName ||
                file.actualFilename ||
                `File ${index + 1}`
              }
            </a>
          </div>
          <div class="file-size">
            ${file.size ? formatFileSize(file.size) : ""}
            ${
              file.uploadTimestamp
                ? ` - ${formatFileDate(file.uploadTimestamp)}`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// Add helper function to get appropriate file icons
function getFileIcon(mimeTypeOrFileName) {
  if (!mimeTypeOrFileName) {
    return '<i class="bi bi-file-earmark"></i>';
  }

  const mimeType = mimeTypeOrFileName.toLowerCase();
  const fileName = mimeTypeOrFileName.toLowerCase();

  if (mimeType.includes("pdf")) {
    return '<i class="bi bi-file-pdf text-danger"></i>';
  } else if (mimeType.includes("word") || mimeType.includes("doc")) {
    return '<i class="bi bi-file-word text-primary"></i>';
  } else if (mimeType.includes("excel") || mimeType.includes("xls")) {
    return '<i class="bi bi-file-excel text-success"></i>';
  } else if (mimeType.includes("powerpoint") || mimeType.includes("ppt")) {
    return '<i class="bi bi-file-ppt text-warning"></i>';
  } else if (
    mimeType.includes("image") ||
    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)
  ) {
    return '<i class="bi bi-file-image text-info"></i>';
  } else if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z")
  ) {
    return '<i class="bi bi-file-zip text-secondary"></i>';
  } else if (mimeType.includes("text") || /\.(txt|md|log)$/i.test(fileName)) {
    return '<i class="bi bi-file-text text-muted"></i>';
  } else {
    return '<i class="bi bi-file-earmark"></i>';
  }
}

// Show full view modal for documents
async function showFullView(type, id) {
  try {
    const typeConfig = documentTypes[type] || documentTypes.generic;
    const response = await fetch(`${typeConfig.endpoint}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch document");

    const document = await response.json();

    // Format date strings
    const submissionDate = document.submissionDate || "Không có";

    let fullViewHtml = `
      <!-- Basic Information Section -->
      <div class="card mb-3">
        <div class="card-header bg-light">
          <h5 class="mb-0">Thông tin cơ bản</h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6">
              <p><strong>Người gửi:</strong> ${
                document.submittedBy?.username || "Không rõ"
              }</p>
              <p><strong>Ngày gửi:</strong> ${submissionDate}</p>
            </div>
            <div class="col-md-6">
              <p><strong>Trạng thái:</strong> <span class="badge bg-${getStatusBadgeColor(
                document.status
              )}">
                ${document.status || "Pending"}
              </span></p>
              ${
                document.costCenter
                  ? `<p><strong>Trạm:</strong> ${document.costCenter}</p>`
                  : ""
              }
            </div>
          </div>
    `;

    // Add type-specific full view content
    switch (type) {
      case "purchasing":
        fullViewHtml += addPurchasingFullView(document);
        break;
      case "payment":
        fullViewHtml += addPaymentFullView(document);
        break;
      case "delivery":
        fullViewHtml += addDeliveryFullView(document);
        break;
      case "receipt":
        fullViewHtml += addReceiptFullView(document);
        break;
      case "advance_payment":
        fullViewHtml += addAdvancePaymentFullView(document, false);
        break;
      case "advance_reclaim":
        fullViewHtml += addAdvancePaymentFullView(document, true);
        break;
      default:
        fullViewHtml += addGenericFullView(document);
    }

    // Add file attachment if exists
    if (document.fileMetadata && document.fileMetadata.length > 0) {
      fullViewHtml += renderFileAttachments(document.fileMetadata);
    }

    fullViewHtml += `</div></div>`;

    // Replace the document details body with full view
    elements.documentDetailsBody.innerHTML = fullViewHtml;
  } catch (error) {
    console.error("Error showing full view:", error);
    showToast("danger", "Không thể tải toàn bộ thông tin phiếu");
  }
}

// Add purchasing-specific full view
function addPurchasingFullView(document) {
  let html = `
    <hr>
    <h6>Thông tin mua hàng</h6>
    <p><strong>Trạm:</strong> ${document.costCenter || "Không có"}</p>
    <p><strong>Nhóm:</strong> ${document.groupName || "Không có"}</p>
  `;

  if (document.products?.length > 0) {
    html += `
      <hr>
      <h6>Danh sách sản phẩm</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Trạm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>VAT (%)</th>
              <th>Thành tiền</th>
              <th>Sau VAT</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${document.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.costCenter}</td>
                <td>${product.amount}</td>
                <td>${formatCurrency(product.costPerUnit)}</td>
                <td>${product.vat}</td>
                <td>${formatCurrency(product.totalCost)}</td>
                <td>${formatCurrency(product.totalCostAfterVat)}</td>
                <td>${product.note || ""}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="text-end fw-bold">Tổng cộng: ${formatCurrency(
        document.grandTotalCost
      )}</p>
    `;
  }

  // Add appended proposals if they exist
  if (document.appendedProposals?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu đề xuất kèm theo</h6>
      <div class="proposals-container">
        ${document.appendedProposals
          .map(
            (proposal) => `
          <div class="proposal-item card mb-2">
            <div class="card-body">
              <h5 class="card-title">${
                proposal.task || "Đề xuất không có tiêu đề"
              }</h5>
              <div class="row">
                <div class="col-md-6">            
                  <p><strong>Trạm:</strong> ${
                    proposal.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    proposal.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Ngày phát sinh:</strong> ${
                    proposal.dateOfError || "Không có"
                  }</p>
                  <p><strong>Người nộp:</strong> ${
                    proposal.submittedBy?.username || "Không rõ"
                  }</p>
                </div>
              </div>
              <p><strong>Mô tả:</strong> ${proposal.detailsDescription}</p>
              <p><strong>Hướng giải quyết:</strong> ${proposal.direction}</p>
              ${
                proposal.fileMetadata && proposal.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(proposal.fileMetadata)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Add payment-specific full view
function addPaymentFullView(document) {
  let html = `
    <hr>
    <h6>Thông tin thanh toán</h6>
    <p><strong>Nội dung:</strong> ${document.content}</p>
    <p><strong>Phương thức thanh toán:</strong> ${document.paymentMethod}</p>
    <p><strong>Tổng thanh toán:</strong> ${formatCurrency(
      document.totalPayment
    )}</p>
    ${
      document.advancePayment
        ? `<p><strong>Đã tạm ứng:</strong> ${formatCurrency(
            document.advancePayment
          )}</p>`
        : ""
    }
    <p><strong>Hạn thanh toán:</strong> ${
      document.paymentDeadline || "Không xác định"
    }</p>
    <p><strong>Mức độ ưu tiên:</strong> ${
      document.priority || "Không xác định"
    }</p>
  `;

  if (document.stages?.length > 0) {
    html += `
      <hr>
      <h6>Các giai đoạn thanh toán</h6>
      <div class="accordion" id="paymentStagesAccordion">
        ${document.stages
          .map(
            (stage, index) => `
          <div class="accordion-item">
            <h2 class="accordion-header" id="stageHeading${index}">
              <button class="accordion-button ${index > 0 ? "collapsed" : ""}" 
                      type="button" data-bs-toggle="collapse" 
                      data-bs-target="#stageCollapse${index}" 
                      aria-expanded="${index === 0 ? "true" : "false"}" 
                      aria-controls="stageCollapse${index}">
                Giai đoạn ${index + 1}: ${stage.name} - ${formatCurrency(
              stage.amount
            )}
                <span class="badge bg-${getStatusBadgeColor(
                  stage.status
                )} ms-2">
                  ${stage.status || "Pending"}
                </span>
              </button>
            </h2>
            <div id="stageCollapse${index}" 
                 class="accordion-collapse collapse ${
                   index === 0 ? "show" : ""
                 }" 
                 aria-labelledby="stageHeading${index}" 
                 data-bs-parent="#paymentStagesAccordion">
              <div class="accordion-body">
                <p><strong>Hạn thanh toán:</strong> ${
                  stage.deadline || "Không xác định"
                }</p>
                <p><strong>Mức độ ưu tiên:</strong> ${
                  stage.priority || "Không xác định"
                }</p>                
                <p><strong>Phương thức thanh toán:</strong> ${
                  stage.paymentMethod || document.paymentMethod
                }</p>
                ${
                  stage.notes
                    ? `<p><strong>Ghi chú:</strong> ${stage.notes}</p>`
                    : ""
                }
                ${
                  stage.approvedBy?.length > 0
                    ? `
                  <hr>
                  <h6>Người đã phê duyệt</h6>
                  <ul class="list-unstyled">
                    ${stage.approvedBy
                      .map(
                        (approval) => `
                      <li>
                        <i class="bi bi-check-circle-fill text-success"></i>
                        ${approval.username} (${approval.role}) - ${approval.approvalDate}
                      </li>
                    `
                      )
                      .join("")}
                  </ul>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  // Add appended purchasing documents if they exist
  if (document.appendedPurchasingDocuments?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu mua hàng kèm theo</h6>
      <div class="purchasing-documents-container">
        ${document.appendedPurchasingDocuments
          .map(
            (purchDoc) => `
          <div class="purchasing-document card mb-3">
            <div class="card-body">
              <h5 class="card-title">${purchDoc.name || "Phiếu mua hàng"}</h5>
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Người gửi:</strong> ${
                    purchDoc.submittedBy?.username || "Không rõ"
                  }</p>                
                  <p><strong>Trạm:</strong> ${
                    purchDoc.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    purchDoc.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Tổng chi phí:</strong> ${formatCurrency(
                    purchDoc.grandTotalCost
                  )}</p>
                </div>
              </div>
              
              <div class="products-section mt-3">
                <h6>Danh sách sản phẩm</h6>
                <div class="table-responsive">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Tên sản phẩm</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>VAT (%)</th>
                        <th>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${purchDoc.products
                        .map(
                          (product) => `
                        <tr>
                          <td>${product.productName}</td>
                          <td>${product.amount}</td>
                          <td>${formatCurrency(product.costPerUnit)}</td>
                          <td>${product.vat}</td>
                          <td>${formatCurrency(product.totalCost)}</td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
              
              ${
                purchDoc.fileMetadata && purchDoc.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(purchDoc.fileMetadata)}
                    </div>`
                  : ""
              }
              
              ${
                purchDoc.appendedProposals?.length > 0
                  ? `
                  <div class="proposals-section mt-3">
                    <h6>Phiếu đề xuất kèm theo</h6>
                    <div class="proposals-list">
                      ${purchDoc.appendedProposals
                        .map(
                          (proposal) => `
                        <div class="proposal-item card mb-2">
                          <div class="card-body">
                            <h6 class="card-title">${
                              proposal.task || "Đề xuất"
                            }</h6>
                            <p><strong>Người gửi:</strong> ${
                              proposal.submittedBy?.username || "Không rõ"
                            }</p>                              
                            <p><strong>Trạm:</strong> ${proposal.costCenter}</p>
                            <p><strong>Mô tả:</strong> ${
                              proposal.detailsDescription
                            }</p>
                            ${
                              proposal.fileMetadata &&
                              proposal.fileMetadata.length > 0
                                ? `<div class="file-section mt-3">
                                    <strong>Tệp đính kèm:</strong>
                                    ${renderFileAttachments(
                                      proposal.fileMetadata
                                    )}
                                  </div>`
                                : ""
                            }
                          </div>
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Add delivery-specific full view
function addDeliveryFullView(document) {
  let html = `
    <hr>
    <h6>Thông tin xuất kho</h6>
    <p><strong>Trạm:</strong> ${document.costCenter || "Không có"}</p>
    <p><strong>Nhóm:</strong> ${document.groupName || "Không có"}</p>
  `;

  if (document.products?.length > 0) {
    html += `
      <hr>
      <h6>Danh sách sản phẩm</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${document.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.amount}</td>
                <td>${formatCurrency(product.costPerUnit)}</td>
                <td>${formatCurrency(product.totalCost)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="text-end fw-bold">Tổng cộng: ${formatCurrency(
        document.grandTotalCost
      )}</p>
    `;
  }

  // Add appended proposals if they exist
  if (document.appendedProposals?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu đề xuất kèm theo</h6>
      <div class="proposals-container">
        ${document.appendedProposals
          .map(
            (proposal) => `
          <div class="proposal-item card mb-2">
            <div class="card-body">
              <h5 class="card-title">${
                proposal.task || "Đề xuất không có tiêu đề"
              }</h5>
              <div class="row">
                <div class="col-md-6">               
                  <p><strong>Trạm:</strong> ${
                    proposal.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    proposal.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Ngày phát sinh:</strong> ${
                    proposal.dateOfError || "Không có"
                  }</p>
                  <p><strong>Người nộp:</strong> ${
                    proposal.submittedBy?.username || "Không rõ"
                  }</p>
                </div>
              </div>
              <p><strong>Mô tả:</strong> ${proposal.detailsDescription}</p>
              <p><strong>Hướng giải quyết:</strong> ${proposal.direction}</p>
              ${
                proposal.fileMetadata && proposal.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(proposal.fileMetadata)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Add receipt-specific full view
function addReceiptFullView(document) {
  let html = `
    <hr>
    <h6>Thông tin nhập kho</h6>
    <p><strong>Trạm:</strong> ${document.costCenter || "Không có"}</p>
    <p><strong>Nhóm:</strong> ${document.groupName || "Không có"}</p>
  `;

  if (document.products?.length > 0) {
    html += `
      <hr>
      <h6>Danh sách sản phẩm</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${document.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.amount}</td>
                <td>${formatCurrency(product.costPerUnit)}</td>
                <td>${formatCurrency(product.totalCost)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="text-end fw-bold">Tổng cộng: ${formatCurrency(
        document.grandTotalCost
      )}</p>
    `;
  }

  // Add appended proposals if they exist
  if (document.appendedProposals?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu đề xuất kèm theo</h6>
      <div class="proposals-container">
        ${document.appendedProposals
          .map(
            (proposal) => `
          <div class="proposal-item card mb-2">
            <div class="card-body">
              <h5 class="card-title">${
                proposal.task || "Đề xuất không có tiêu đề"
              }</h5>
              <div class="row">
                <div class="col-md-6">               
                  <p><strong>Trạm:</strong> ${
                    proposal.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    proposal.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Ngày phát sinh:</strong> ${
                    proposal.dateOfError || "Không có"
                  }</p>
                  <p><strong>Người nộp:</strong> ${
                    proposal.submittedBy?.username || "Không rõ"
                  }</p>
                </div>
              </div>
              <p><strong>Mô tả:</strong> ${proposal.detailsDescription}</p>
              <p><strong>Hướng giải quyết:</strong> ${proposal.direction}</p>
              ${
                proposal.fileMetadata && proposal.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(proposal.fileMetadata)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Add advance payment full view
function addAdvancePaymentFullView(document, isReclaim) {
  const title = isReclaim ? "Thu hồi tạm ứng" : "Tạm ứng";
  const amountField = isReclaim ? "advancePaymentReclaim" : "advancePayment";

  let html = `
    <hr>
    <h6>Thông tin ${title}</h6>
    <p><strong>Nội dung:</strong> ${document.content}</p>
    <p><strong>Số tiền:</strong> ${formatCurrency(document[amountField])}</p>
    <p><strong>Phương thức thanh toán:</strong> ${document.paymentMethod}</p>
    <p><strong>Hạn thanh toán:</strong> ${
      document.paymentDeadline || "Không xác định"
    }</p>
  `;

  // Add appended purchasing documents if they exist
  if (document.appendedPurchasingDocuments?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu mua hàng kèm theo</h6>
      <div class="purchasing-documents-container">
        ${document.appendedPurchasingDocuments
          .map(
            (purchDoc) => `
          <div class="purchasing-document card mb-3">
            <div class="card-body">
              <h5 class="card-title">${purchDoc.name || "Phiếu mua hàng"}</h5>
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Người gửi:</strong> ${
                    purchDoc.submittedBy?.username || "Không rõ"
                  }</p>                
                  <p><strong>Trạm:</strong> ${
                    purchDoc.costCenter || "Không có"
                  }</p>                
                  <p><strong>Nhóm:</strong> ${
                    purchDoc.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Tổng chi phí:</strong> ${formatCurrency(
                    purchDoc.grandTotalCost
                  )}</p>
                </div>
              </div>
              
              <div class="products-section mt-3">
                <h6>Danh sách sản phẩm</h6>
                <div class="table-responsive">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Tên sản phẩm</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>VAT (%)</th>
                        <th>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${purchDoc.products
                        .map(
                          (product) => `
                        <tr>
                          <td>${product.productName}</td>
                          <td>${product.amount}</td>
                          <td>${formatCurrency(product.costPerUnit)}</td>
                          <td>${product.vat}</td>
                          <td>${formatCurrency(product.totalCost)}</td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
              
              ${
                purchDoc.fileMetadata && purchDoc.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(purchDoc.fileMetadata)}
                    </div>`
                  : ""
              }
              
              ${
                purchDoc.appendedProposals?.length > 0
                  ? `
                  <div class="proposals-section mt-3">
                    <h6>Phiếu đề xuất kèm theo</h6>
                    <div class="proposals-list">
                      ${purchDoc.appendedProposals
                        .map(
                          (proposal) => `
                        <div class="proposal-item card mb-2">
                          <div class="card-body">
                            <h6 class="card-title">${
                              proposal.task || "Đề xuất"
                            }</h6>
                            <p><strong>Người gửi:</strong> ${
                              proposal.submittedBy?.username || "Không rõ"
                            }</p>                             
                            <p><strong>Trạm:</strong> ${proposal.costCenter}</p>
                            <p><strong>Mô tả:</strong> ${
                              proposal.detailsDescription
                            }</p>
                            ${
                              proposal.fileMetadata &&
                              proposal.fileMetadata.length > 0
                                ? `<div class="file-section mt-3">
                                    <strong>Tệp đính kèm:</strong>
                                    ${renderFileAttachments(
                                      proposal.fileMetadata
                                    )}
                                  </div>`
                                : ""
                            }
                          </div>
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Add generic full view for other document types
function addGenericFullView(document) {
  let html = "";

  if (document.content) {
    html += `
      <hr>
      <h6>Nội dung</h6>
      <div class="bg-light p-2 rounded">${document.content}</div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Helper function to get badge color based on status
function getStatusBadgeColor(status) {
  switch (status?.toLowerCase()) {
    case "approved":
      return "success";
    case "suspended":
      return "danger";
    default:
      return "warning";
  }
}

// Format file size
function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " bytes";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Format currency
function formatCurrency(amount) {
  if (typeof amount !== "number") return "N/A";

  const isInteger = Number.isInteger(amount);
  const [integerPart, decimalPart] = amount.toFixed(2).split(".");

  // Format integer part with comma as thousand separator
  const withThousandSeparator = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );

  return isInteger
    ? `${withThousandSeparator} ₫`
    : `${withThousandSeparator}.${decimalPart} ₫`;
}

// Add proposal-specific details
function addProposalDetails(document) {
  return `
    <hr>
    <h6>Thông tin đề xuất</h6>
    <p><strong>Công việc:</strong> ${document.task}</p>
    <p><strong>Ngày phát sinh:</strong> ${document.dateOfError}</p>
    <p><strong>Mô tả:</strong> ${document.detailsDescription}</p>
    <p><strong>Hướng giải quyết:</strong> ${document.direction}</p>
    ${
      document.declaration
        ? `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `
        : ""
    }
  `;
}

// Add purchasing-specific details
function addPurchasingDetails(document) {
  let html = `
    <hr>
    <h6>Thông tin mua hàng</h6>
    <p><strong>Trạm:</strong> ${document.costCenter || "Không có"}</p>
    <p><strong>Nhóm:</strong> ${document.groupName || "Không có"}</p>
  `;

  if (document.products?.length > 0) {
    html += `
      <hr>
      <h6>Danh sách sản phẩm</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Trạm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>VAT</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${document.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.costCenter}</td>
                <td>${product.amount}</td>
                <td>${formatCurrency(product.costPerUnit)}</td>
                <td>${product.vat}%</td>
                <td>${formatCurrency(product.totalCostAfterVat)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="text-end fw-bold">Tổng cộng: ${formatCurrency(
        document.grandTotalCost
      )}</p>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Helper function to get display name for priority
function getPriorityDisplayName(priority) {
  const names = {
    cao: "Cao",
    "trung bình": "Trung bình",
    thấp: "Thấp",
    approved: "Đã duyệt",
  };
  return names[priority] || "Trung bình";
}

// Update payment stage display to show priority
function addPaymentDetails(document) {
  let html = `
    <hr>
    <h6>Thông tin thanh toán</h6>
    <p><strong>Nội dung:</strong> ${document.content}</p>
    <p><strong>Phương thức thanh toán:</strong> ${document.paymentMethod}</p>
    <p><strong>Tổng thanh toán:</strong> ${formatCurrency(
      document.totalPayment
    )}</p>
    ${
      document.advancePayment
        ? `<p><strong>Đã tạm ứng:</strong> ${formatCurrency(
            document.advancePayment
          )}</p>`
        : ""
    }
    <p><strong>Hạn thanh toán:</strong> ${
      document.paymentDeadline || "Không xác định"
    }</p>
    <p><strong>Mức độ ưu tiên tổng thể:</strong> ${getPriorityDisplayName(
      getDocumentPriority(document, "payment")
    )}</p>    
  `;

  if (document.stages?.length > 0) {
    html += `
      <hr>
      <h6>Các giai đoạn thanh toán</h6>
      <div class="stages-container">
        ${document.stages
          .map((stage, index) => {
            const isApprover = stage.approvers.some(
              (a) => a.approver.toString() === appData.user.id
            );
            const hasApproved = stage.approvedBy.some(
              (a) => a.user.toString() === appData.user.id
            );
            const canApprove =
              isApprover && !hasApproved && stage.status === "Pending";
            const stagePriority = stage.priority
              ? stage.priority.toLowerCase()
              : "trung bình";

            return `
            <div class="stage-card card mb-3 ${
              stage.status === "Approved" ? "border-success" : ""
            }">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Giai đoạn ${index + 1}: ${stage.name}</h6>
                <div>
                  <span class="badge bg-${getPriorityBadgeColor(
                    stagePriority
                  )} me-2">
                    ${getPriorityDisplayName(stagePriority)}
                  </span>
                  <span class="badge bg-${getStatusBadgeColor(stage.status)}">
                    ${
                      stage.status === "Approved"
                        ? "Đã phê duyệt"
                        : "Chờ phê duyệt"
                    }
                  </span>
                </div>
              </div>
              <div class="card-body">
                <p><strong>Số tiền:</strong> ${formatCurrency(stage.amount)}</p>
                <p><strong>Hạn thanh toán:</strong> ${
                  stage.deadline || "Không xác định"
                }</p>
                <p><strong>Mức độ ưu tiên:</strong> ${getPriorityDisplayName(
                  stagePriority
                )}</p>                    
                <p><strong>Phương thức thanh toán:</strong> ${
                  stage.paymentMethod || document.paymentMethod
                }</p>
                ${
                  stage.notes
                    ? `<p><strong>Ghi chú:</strong> ${stage.notes}</p>`
                    : ""
                }
                
                ${
                  stage.approvedBy?.length > 0
                    ? `
                  <hr>
                  <h6>Người đã phê duyệt</h6>
                  <ul class="list-unstyled">
                    ${stage.approvedBy
                      .map(
                        (approval) => `
                      <li>
                        <i class="bi bi-check-circle-fill text-success"></i>
                        ${approval.username} (${approval.role}) - ${approval.approvalDate}
                      </li>
                    `
                      )
                      .join("")}
                  </ul>
                `
                    : ""
                }
                
                ${
                  canApprove
                    ? `
                  <button onclick="approvePaymentStage('${document._id}', ${index})" 
                          class="btn btn-sm btn-success mt-2">
                    <i class="bi bi-check-circle"></i> Phê duyệt giai đoạn này
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;

    // Check if all stages are approved and show document approval button
    const allStagesApproved = document.stages.every(
      (s) => s.status === "Approved"
    );
    if (allStagesApproved && document.approvers.length > 0) {
      const isDocApprover = document.approvers.some(
        (a) => a.approver.toString() === appData.user.id
      );
      const hasDocApproved = document.approvedBy.some(
        (a) => a.user.toString() === appData.user.id
      );

      if (isDocApprover && !hasDocApproved) {
        html += `
          <div class="alert alert-success mt-3">
            <h6><i class="bi bi-check-circle"></i> Tất cả giai đoạn đã được phê duyệt</h6>
            <button onclick="approveDocument('payment', '${document._id}')" 
                    class="btn btn-success">
              <i class="bi bi-check-all"></i> Phê duyệt toàn bộ phiếu thanh toán
            </button>
          </div>
        `;
      }
    }
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Helper function for priority badge colors
function getPriorityBadgeColor(priority) {
  const colors = {
    cao: "danger",
    "trung bình": "warning",
    thấp: "success",
    approved: "success",
  };
  return colors[priority] || "secondary";
}

// Add advance payment details
function addAdvancePaymentDetails(document, type) {
  const isReclaim = type === "advance_reclaim";
  const title = isReclaim ? "Thu hồi tạm ứng" : "Tạm ứng";
  const amountField = isReclaim ? "advancePaymentReclaim" : "advancePayment";

  let html = `
    <hr>
    <h6>Thông tin ${title}</h6>
    <p><strong>Nội dung:</strong> ${document.content}</p>
    <p><strong>Số tiền:</strong> ${formatCurrency(document[amountField])}</p>
    <p><strong>Phương thức thanh toán:</strong> ${document.paymentMethod}</p>
    <p><strong>Hạn thanh toán:</strong> ${
      document.paymentDeadline || "Không xác định"
    }</p>
  `;

  // Add appended purchasing documents if they exist
  if (document.appendedPurchasingDocuments?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu mua hàng kèm theo</h6>
      <div class="purchasing-documents-container">
        ${document.appendedPurchasingDocuments
          .map(
            (purchDoc) => `
          <div class="purchasing-document card mb-3">
            <div class="card-body">
              <h5 class="card-title">${purchDoc.name || "Phiếu mua hàng"}</h5>
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Người gửi:</strong> ${
                    purchDoc.submittedBy?.username || "Không rõ"
                  }</p>                
                  <p><strong>Trạm:</strong> ${
                    purchDoc.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    purchDoc.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Tổng chi phí:</strong> ${formatCurrency(
                    purchDoc.grandTotalCost
                  )}</p>
                </div>
              </div>
              
              <div class="products-section mt-3">
                <h6>Danh sách sản phẩm</h6>
                <div class="table-responsive">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Tên sản phẩm</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>VAT (%)</th>
                        <th>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${purchDoc.products
                        .map(
                          (product) => `
                        <tr>
                          <td>${product.productName}</td>
                          <td>${product.amount}</td>
                          <td>${formatCurrency(product.costPerUnit)}</td>
                          <td>${product.vat}</td>
                          <td>${formatCurrency(product.totalCost)}</td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
              
              ${
                purchDoc.fileMetadata && purchDoc.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(purchDoc.fileMetadata)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  // Add button to show full view with appended purchasing
  if (document.appendedPurchasingDocuments?.length > 0) {
    html += `
      <div class="mt-3">
        <button class="btn btn-primary" onclick="showFullView('${type}', '${document._id}')">
          <i class="bi bi-eye"></i> Xem toàn bộ thông tin
        </button>
      </div>
    `;
  }

  return html;
}

// Add delivery-specific details
function addDeliveryDetails(document) {
  let html = `
    <hr>
    <h6>Thông tin xuất kho</h6>
    <p><strong>Trạm:</strong> ${document.costCenter || "Không có"}</p>
    <p><strong>Nhóm:</strong> ${document.groupName || "Không có"}</p>
  `;

  if (document.products?.length > 0) {
    html += `
      <hr>
      <h6>Danh sách sản phẩm</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${document.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.amount}</td>
                <td>${formatCurrency(product.costPerUnit)}</td>
                <td>${formatCurrency(product.totalCost)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="text-end fw-bold">Tổng cộng: ${formatCurrency(
        document.grandTotalCost
      )}</p>
    `;
  }

  // Add appended proposals if they exist
  if (document.appendedProposals?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu đề xuất kèm theo</h6>
      <div class="proposals-container">
        ${document.appendedProposals
          .map(
            (proposal) => `
          <div class="proposal-item card mb-2">
            <div class="card-body">
              <h5 class="card-title">${
                proposal.task || "Đề xuất không có tiêu đề"
              }</h5>
              <div class="row">
                <div class="col-md-6">               
                  <p><strong>Trạm:</strong> ${
                    proposal.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    proposal.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Ngày phát sinh:</strong> ${
                    proposal.dateOfError || "Không có"
                  }</p>
                  <p><strong>Người nộp:</strong> ${
                    proposal.submittedBy?.username || "Không rõ"
                  }</p>
                </div>
              </div>
              <p><strong>Mô tả:</strong> ${proposal.detailsDescription}</p>
              <p><strong>Hướng giải quyết:</strong> ${proposal.direction}</p>
              ${
                proposal.fileMetadata && proposal.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(proposal.fileMetadata)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  // Add button to show full view with appended proposals
  if (document.appendedProposals?.length > 0) {
    html += `
      <div class="mt-3">
        <button class="btn btn-primary" onclick="showFullView('delivery', '${document._id}')">
          <i class="bi bi-eye"></i> Xem toàn bộ thông tin
        </button>
      </div>
    `;
  }

  return html;
}

// Add receipt-specific details
function addReceiptDetails(document) {
  let html = `
    <hr>
    <h6>Thông tin nhập kho</h6>
    <p><strong>Trạm:</strong> ${document.costCenter || "Không có"}</p>
    <p><strong>Nhóm:</strong> ${document.groupName || "Không có"}</p>
  `;

  if (document.products?.length > 0) {
    html += `
      <hr>
      <h6>Danh sách sản phẩm</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${document.products
              .map(
                (product) => `
              <tr>
                <td>${product.productName}</td>
                <td>${product.amount}</td>
                <td>${formatCurrency(product.costPerUnit)}</td>
                <td>${formatCurrency(product.totalCost)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="text-end fw-bold">Tổng cộng: ${formatCurrency(
        document.grandTotalCost
      )}</p>
    `;
  }

  // Add appended proposals if they exist
  if (document.appendedProposals?.length > 0) {
    html += `
      <hr>
      <h6>Phiếu đề xuất kèm theo</h6>
      <div class="proposals-container">
        ${document.appendedProposals
          .map(
            (proposal) => `
          <div class="proposal-item card mb-2">
            <div class="card-body">
              <h5 class="card-title">${
                proposal.task || "Đề xuất không có tiêu đề"
              }</h5>
              <div class="row">
                <div class="col-md-6">               
                  <p><strong>Trạm:</strong> ${
                    proposal.costCenter || "Không có"
                  }</p>
                  <p><strong>Nhóm:</strong> ${
                    proposal.groupName || "Không có"
                  }</p>
                </div>
                <div class="col-md-6">
                  <p><strong>Ngày phát sinh:</strong> ${
                    proposal.dateOfError || "Không có"
                  }</p>
                  <p><strong>Người nộp:</strong> ${
                    proposal.submittedBy?.username || "Không rõ"
                  }</p>
                </div>
              </div>
              <p><strong>Mô tả:</strong> ${proposal.detailsDescription}</p>
              <p><strong>Hướng giải quyết:</strong> ${proposal.direction}</p>
              ${
                proposal.fileMetadata && proposal.fileMetadata.length > 0
                  ? `<div class="file-section mt-3">
                      <strong>Tệp đính kèm:</strong>
                      ${renderFileAttachments(proposal.fileMetadata)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  // Add button to show full view with appended proposals
  if (document.appendedProposals?.length > 0) {
    html += `
      <div class="mt-3">
        <button class="btn btn-primary" onclick="showFullView('receipt', '${document._id}')">
          <i class="bi bi-eye"></i> Xem toàn bộ thông tin
        </button>
      </div>
    `;
  }

  return html;
}

// Add project proposal details
function addProjectProposalDetails(document) {
  let html = "";

  if (document.content?.length > 0) {
    html += `
      <hr>
      <h6>Nội dung đề xuất</h6>
      ${document.content
        .map(
          (item) => `
        <div class="mb-3">
          <h6>${item.name}</h6>
          <div class="bg-light p-2 rounded">${item.text}</div>
        </div>
      `
        )
        .join("")}
    `;
  }

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

async function approvePaymentStage(docId, stageIndex) {
  if (
    !confirm(`Bạn có chắc chắn muốn phê duyệt giai đoạn ${stageIndex + 1} này?`)
  )
    return;

  try {
    const response = await fetch(
      `/approvePaymentStage/${docId}/${stageIndex}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (result.message) {
      showToast("success", result.message);

      // Refresh dashboard data
      await loadDashboardData();

      // Refresh the document details modal if it's open
      const detailsModal = bootstrap.Modal.getInstance(
        document.getElementById("documentDetailsModal")
      );
      if (detailsModal && detailsModal._isShown) {
        await viewDocumentDetails("payment", docId);
      }

      // Refresh the documents list modal if it's open
      const docsModal = bootstrap.Modal.getInstance(
        document.getElementById("documentsModal")
      );
      if (docsModal && docsModal._isShown) {
        showDocuments("payment", "Thanh toán");
      }
    } else {
      showToast("danger", "Lỗi khi phê duyệt giai đoạn");
    }
  } catch (error) {
    console.error("Error approving payment stage:", error);
    showToast("danger", "Lỗi khi phê duyệt giai đoạn");
  }
}

// Approve document function
async function approveDocument(type, id) {
  // For payment documents, we need to check if all stages are approved
  if (type === "payment") {
    try {
      // First get the current document state
      const response = await fetch(`/getPaymentDocument/${id}`);
      const document = await response.json();

      // Check if all stages are approved
      const allStagesApproved = document.stages.every(
        (s) => s.status === "Approved"
      );
      if (!allStagesApproved) {
        return showToast(
          "warning",
          "Vui lòng phê duyệt tất cả các giai đoạn trước khi phê duyệt toàn bộ phiếu"
        );
      }
    } catch (error) {
      console.error("Error checking document stages:", error);
      return showToast("danger", "Lỗi khi kiểm tra trạng thái giai đoạn");
    }
  }

  if (
    !confirm(
      `Bạn có chắc chắn muốn phê duyệt ${
        type === "payment" ? "toàn bộ phiếu thanh toán" : "phiếu này"
      }?`
    )
  )
    return;

  try {
    const response = await fetch(`/approveDocument/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.text();

    if (result.includes("thành công") || result.includes("hoàn toàn")) {
      showToast("success", result);

      // Refresh dashboard data
      await loadDashboardData();

      // Check which modals are open and refresh them
      const docsModal = bootstrap.Modal.getInstance(
        document.getElementById("documentsModal")
      );
      const detailsModal = bootstrap.Modal.getInstance(
        document.getElementById("documentDetailsModal")
      );

      // If documents list modal is open, refresh it
      if (docsModal && docsModal._isShown) {
        const typeConfig = documentTypes[type] || documentTypes.generic;
        showDocuments(type, typeConfig.name);
      }

      // If details modal is open, refresh it or close it if document no longer needs approval
      if (detailsModal && detailsModal._isShown) {
        // Check if this document still exists in our summaries (meaning it still needs approval)
        const summary = appData.summaries[type];
        const documentStillExists =
          summary && summary.documents.some((doc) => doc.id === id);

        if (documentStillExists) {
          // Refresh the details view
          await viewDocumentDetails(type, id);
        } else {
          // Document no longer needs approval, close details modal
          detailsModal.hide();
          showToast(
            "info",
            "Phiếu đã được phê duyệt hoàn toàn và không còn cần xem xét"
          );
        }
      }
    } else {
      showToast("danger", result);
    }
  } catch (error) {
    console.error("Error approving document:", error);
    showToast("danger", "Lỗi khi phê duyệt phiếu");
  }
}

// Helper function to refresh modal content after approval
async function refreshModalContent(type, id) {
  try {
    // Refresh dashboard data first
    await loadDashboardData();

    // Check which modals are currently shown
    const docsModal = bootstrap.Modal.getInstance(
      document.getElementById("documentsModal")
    );
    const detailsModal = bootstrap.Modal.getInstance(
      document.getElementById("documentDetailsModal")
    );

    // Refresh documents list modal if open
    if (docsModal && docsModal._isShown) {
      const typeConfig = documentTypes[type] || documentTypes.generic;
      showDocuments(type, typeConfig.name);
    }

    // Refresh document details modal if open
    if (detailsModal && detailsModal._isShown) {
      const summary = appData.summaries[type];
      const documentStillExists =
        summary && summary.documents.some((doc) => doc.id === id);

      if (documentStillExists) {
        await viewDocumentDetails(type, id);
      } else {
        detailsModal.hide();
        showToast(
          "info",
          "Phiếu đã được xử lý xong và không còn hiển thị trong danh sách cần phê duyệt"
        );
      }
    }
  } catch (error) {
    console.error("Error refreshing modal content:", error);
  }
}

// Show toast notification
function showToast(type, message) {
  const toastContainer =
    document.getElementById("toastContainer") || createToastContainer();
  const toastId = "toast-" + Date.now();

  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${
            type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"
          } me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML("beforeend", toastHtml);
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl);
  toast.show();

  // Remove toast after it hides
  toastEl.addEventListener("hidden.bs.toast", () => {
    toastEl.remove();
  });
}

// Create toast container if not exists
function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "position-fixed bottom-0 end-0 p-3";
  container.style.zIndex = "11";
  document.body.appendChild(container);
  return container;
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

// Format date for display
function formatDate(dateString) {
  if (!dateString) return "Không rõ ngày";
  const date = new Date(dateString);
  return (
    date.toLocaleDateString("vi-VN") +
    " " +
    date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
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
