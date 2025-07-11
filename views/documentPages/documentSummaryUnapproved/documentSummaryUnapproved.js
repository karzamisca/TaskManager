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
  viewAllBtn: document.getElementById("viewAllBtn"),
  exportBtn: document.getElementById("exportBtn"),
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

// Show documents modal for a specific type
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
      .map(
        (doc) => `
        <tr>
          <td>${doc.tag || doc.name || doc.task}</td>
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
      `
      )
      .join("");
  }

  new bootstrap.Modal(document.getElementById("documentsModal")).show();
}

// View document details in modal
async function viewDocumentDetails(type, id) {
  try {
    showLoadingInDetailsModal();

    const typeConfig = documentTypes[type] || documentTypes.generic;
    elements.documentDetailsTitle.innerHTML = `<i class="bi ${typeConfig.icon}"></i> Đang tải chi tiết phiếu...`;

    const modal = new bootstrap.Modal(elements.documentDetailsModal);
    modal.show();

    const response = await fetch(`${typeConfig.endpoint}/${id}`);
    if (!response.ok) throw new Error("Failed to fetch document");

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

  elements.documentDetailsTitle.innerHTML = `<i class="bi ${
    typeConfig.icon
  }"></i> ${document.name || document.title || "Chi tiết phiếu"}`;

  let detailsHtml = `
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
            <p><strong>Ngày gửi:</strong> ${document.submissionDate}</p>
          </div>
          <div class="col-md-6">
            <p><strong>Trạng thái:</strong> <span class="badge bg-${getStatusBadgeColor(
              document.status
            )}">
              ${document.status || "Pending"}
            </span></p>
            ${
              document.costCenter
                ? `<p><strong>Trung tâm chi phí:</strong> ${document.costCenter}</p>`
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
    case "project_proposal":
      detailsHtml += addProjectProposalDetails(document);
      break;
  }

  // Add file attachment if exists
  if (document.fileMetadata?.name) {
    detailsHtml += `
      <hr>
      <h6>Tệp đính kèm</h6>
      <p>
        <a href="${
          document.fileMetadata.link || "#"
        }" target="_blank" class="text-decoration-none">
          <i class="bi bi-file-earmark"></i> ${document.fileMetadata.name}
          ${
            document.fileMetadata.size
              ? `(${formatFileSize(document.fileMetadata.size)})`
              : ""
          }
        </a>
      </p>
    `;
  }

  detailsHtml += `</div></div>`;
  elements.documentDetailsBody.innerHTML = detailsHtml;
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
                  ? `<p><strong>Trung tâm chi phí:</strong> ${document.costCenter}</p>`
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
      default:
        fullViewHtml += addGenericFullView(document);
    }

    // Add file attachment if exists
    if (document.fileMetadata?.name) {
      fullViewHtml += `
        <hr>
        <h6>Tệp đính kèm</h6>
        <p>
          <a href="${
            document.fileMetadata.link || "#"
          }" target="_blank" class="text-decoration-none">
            <i class="bi bi-file-earmark"></i> ${document.fileMetadata.name}
            ${
              document.fileMetadata.size
                ? `(${formatFileSize(document.fileMetadata.size)})`
                : ""
            }
          </a>
        </p>
      `;
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
                proposal.fileMetadata
                  ? `<p><strong>Tệp đính kèm:</strong> 
                     <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></p>`
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
                purchDoc.fileMetadata
                  ? `<div class="file-section mt-3">
                      <p><strong>Tệp đính kèm:</strong> 
                      <a href="${purchDoc.fileMetadata.link}" target="_blank">${purchDoc.fileMetadata.name}</a></p>
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
                            <p><strong>Trạm:</strong> ${proposal.costCenter}</p>
                            <p><strong>Mô tả:</strong> ${
                              proposal.detailsDescription
                            }</p>
                            ${
                              proposal.fileMetadata
                                ? `<p><strong>Tệp đính kèm:</strong> 
                                   <a href="${proposal.fileMetadata.link}" target="_blank">${proposal.fileMetadata.name}</a></p>`
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
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
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

// Add payment-specific details
function addPaymentDetails(document) {
  let html = `
    <hr>
    <h6>Thông tin thanh toán</h6>
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

  if (document.declaration) {
    html += `
      <hr>
      <h6>Kê khai</h6>
      <div class="bg-light p-2 rounded">${document.declaration}</div>
    `;
  }

  return html;
}

// Add advance payment details
function addAdvancePaymentDetails(document, type) {
  const isReclaim = type === "advance_reclaim";
  const title = isReclaim ? "Thu hồi tạm ứng" : "Tạm ứng";
  const amountField = isReclaim ? "advancePaymentReclaim" : "advancePayment";

  return `
    <hr>
    <h6>Thông tin ${title}</h6>
    <p><strong>Số tiền:</strong> ${formatCurrency(document[amountField])}</p>
    <p><strong>Phương thức thanh toán:</strong> ${document.paymentMethod}</p>
    <p><strong>Hạn thanh toán:</strong> ${
      document.paymentDeadline || "Không xác định"
    }</p>
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

// Add delivery-specific details
function addDeliveryDetails(document) {
  let html = "";

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

// Approve document function
async function approveDocument(type, id) {
  if (!confirm("Bạn có chắc chắn muốn phê duyệt phiếu này?")) return;

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
      loadDashboardData(); // Refresh the dashboard

      // Close modals if open
      const docsModal = bootstrap.Modal.getInstance(
        document.getElementById("documentsModal")
      );
      if (docsModal) docsModal.hide();

      const detailsModal = bootstrap.Modal.getInstance(
        document.getElementById("documentDetailsModal")
      );
      if (detailsModal) detailsModal.hide();
    } else {
      showToast("danger", result);
    }
  } catch (error) {
    console.error("Error approving document:", error);
    showToast("danger", "Lỗi khi phê duyệt phiếu");
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
