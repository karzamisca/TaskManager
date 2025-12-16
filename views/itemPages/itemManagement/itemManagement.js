// views/itemPages/itemManagement/itemManagement.js
let currentItemId = null;
let showDeleted = false;
let allItems = [];
let currentSort = {
  field: "name",
  order: "asc",
};
let sortStates = {
  code: "none",
  name: "asc",
  unit: "none",
  unitPrice: "none",
  vat: "none",
  unitPriceAfterVAT: "none",
  createdAt: "none",
  "createdBy.username": "none",
};

// Lấy thông tin người dùng hiện tại từ cookie
function getCurrentUser() {
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "user") {
      return JSON.parse(decodeURIComponent(value));
    }
  }
  return null;
}

// Hiển thị thông báo
function showAlert(message, type = "success") {
  const container = document.getElementById("alert-container");
  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  container.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Calculate price after VAT
function calculatePriceAfterVAT() {
  const unitPrice = parseFloat(document.getElementById("unitPrice").value) || 0;
  const vat = parseFloat(document.getElementById("vat").value) || 0;
  const priceAfterVAT = unitPrice * (1 + vat / 100);
  document.getElementById("unitPriceAfterVAT").value = priceAfterVAT.toFixed(2);
}

// Lấy danh sách mặt hàng
async function fetchItems() {
  try {
    const url = showDeleted
      ? `/itemManagementControl/all?sortBy=${currentSort.field}&sortOrder=${currentSort.order}`
      : `/itemManagementControl?sortBy=${currentSort.field}&sortOrder=${currentSort.order}`;

    const response = await fetch(url, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh sách mặt hàng");
    }

    allItems = await response.json();
    renderItems(allItems);
    document.getElementById("loading").style.display = "none";
    document.getElementById("items-table").style.display = "table";
  } catch (error) {
    showAlert("Lỗi khi tải mặt hàng: " + error.message, "error");
  }
}

// Hiển thị danh sách mặt hàng
function renderItems(items) {
  const tbody = document.getElementById("items-body");
  tbody.innerHTML = "";

  if (items.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="10" style="text-align: center; padding: 40px; color: #666;">
        Không có mặt hàng nào để hiển thị
      </td>
    `;
    tbody.appendChild(row);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    if (item.isDeleted) {
      row.className = "deleted-item";
    }

    row.innerHTML = `
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.unit || "cái"}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${item.vat}%</td>
      <td>${formatCurrency(item.unitPriceAfterVAT)}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td>
        <span class="status-badge ${
          item.isDeleted ? "status-deleted" : "status-active"
        }">
          ${item.isDeleted ? "Đã xóa" : "Đang hoạt động"}
        </span>
      </td>
      <td>${item.createdBy?.username || "Không xác định"}</td>
      <td>
        <div class="action-buttons">
          ${
            !item.isDeleted
              ? `
              <button onclick="showEditModal('${item._id}')" class="action-btn btn-primary">Sửa</button>
              <button onclick="showAuditHistory('${item._id}')" class="action-btn btn-secondary">Lịch sử</button>
              <button onclick="deleteItem('${item._id}')" class="action-btn btn-danger">Xóa</button>
            `
              : `
              <button onclick="restoreItem('${item._id}')" class="action-btn btn-success">Khôi phục</button>
              <button onclick="showAuditHistory('${item._id}')" class="action-btn btn-secondary">Lịch sử</button>
            `
          }
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Update sort indicators
  updateSortIndicators();
}

// Sort table
function sortTable(field) {
  // Toggle sort order
  if (currentSort.field === field) {
    currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
  } else {
    currentSort.field = field;
    currentSort.order = "asc";
  }

  // Update sort states
  Object.keys(sortStates).forEach((key) => {
    sortStates[key] = "none";
  });
  sortStates[field] = currentSort.order;

  // Fetch items with new sort
  fetchItems();
}

// Update sort indicators in table headers
function updateSortIndicators() {
  // Reset all indicators
  document.querySelectorAll(".sort-indicator").forEach((indicator) => {
    indicator.textContent = "↕";
  });

  // Set current sort indicator
  const currentField = currentSort.field;
  const currentIndicator = document.getElementById(
    `sort-${currentField.replace(".", "-")}`
  );
  if (currentIndicator) {
    currentIndicator.textContent = currentSort.order === "asc" ? "↑" : "↓";
  }
}

// Tìm kiếm mặt hàng
function searchItems() {
  const searchTerm = document.getElementById("search").value.toLowerCase();
  const filtered = allItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm) ||
      item.code.toLowerCase().includes(searchTerm) ||
      item.unit.toLowerCase().includes(searchTerm) ||
      item.createdBy?.username?.toLowerCase().includes(searchTerm)
  );
  renderItems(filtered);
}

// Chuyển đổi giữa hiển thị mặt hàng đã xóa/chưa xóa
function toggleDeletedItems() {
  showDeleted = !showDeleted;
  const btn = document.querySelector(".btn-secondary");
  btn.textContent = showDeleted
    ? "Hiện mặt hàng đang hoạt động"
    : "Hiện mặt hàng đã xóa";
  fetchItems();
}

// Hiển thị modal thêm mới
function showAddModal() {
  document.getElementById("modal-title").textContent = "Thêm mặt hàng mới";
  document.getElementById("item-form").reset();
  document.getElementById("item-id").value = "";
  document.getElementById("unit").value = "cái";
  document.getElementById("vat").value = "10";
  calculatePriceAfterVAT();
  document.getElementById("item-modal").style.display = "block";

  // Focus on first input
  setTimeout(() => {
    document.getElementById("code").focus();
  }, 100);
}

// Hiển thị modal chỉnh sửa
async function showEditModal(itemId) {
  try {
    const response = await fetch(`/itemManagementControl/${itemId}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Không thể tải thông tin mặt hàng");
    }

    const item = await response.json();

    document.getElementById("modal-title").textContent = "Sửa mặt hàng";
    document.getElementById("item-id").value = item._id;
    document.getElementById("code").value = item.code;
    document.getElementById("name").value = item.name;
    document.getElementById("unit").value = item.unit || "cái";
    document.getElementById("unitPrice").value = item.unitPrice;
    document.getElementById("vat").value = item.vat;
    document.getElementById("unitPriceAfterVAT").value =
      item.unitPriceAfterVAT.toFixed(2);
    document.getElementById("item-modal").style.display = "block";

    // Focus on first input
    setTimeout(() => {
      document.getElementById("code").focus();
    }, 100);
  } catch (error) {
    showAlert("Lỗi khi tải mặt hàng: " + error.message, "error");
  }
}

// Hiển thị lịch sử thay đổi
async function showAuditHistory(itemId) {
  try {
    const response = await fetch(`/itemManagementControl/${itemId}/audit`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Không thể tải lịch sử thay đổi");
    }

    const auditHistory = await response.json();

    const tbody = document.getElementById("audit-body");
    tbody.innerHTML = "";

    if (auditHistory.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
          Không có lịch sử thay đổi nào
        </td>
      `;
      tbody.appendChild(row);
    } else {
      auditHistory.forEach((audit) => {
        const row = document.createElement("tr");

        // Định dạng thay đổi
        const nameChanges = audit.oldName
          ? `<span class="old-value">${
              audit.oldName
            }</span> → <span class="new-value">${audit.newName || ""}</span>`
          : `<span class="new-value">${audit.newName}</span>`;

        const codeChanges = audit.oldCode
          ? `<span class="old-value">${
              audit.oldCode
            }</span> → <span class="new-value">${audit.newCode || ""}</span>`
          : `<span class="new-value">${audit.newCode}</span>`;

        const unitChanges = audit.oldUnit
          ? `<span class="old-value">${
              audit.oldUnit
            }</span> → <span class="new-value">${audit.newUnit || ""}</span>`
          : `<span class="new-value">${audit.newUnit || "cái"}</span>`;

        const priceChanges = audit.oldUnitPrice
          ? `<span class="old-value">${formatCurrency(
              audit.oldUnitPrice
            )}</span> → <span class="new-value">${formatCurrency(
              audit.newUnitPrice
            )}</span>`
          : `<span class="new-value">${formatCurrency(
              audit.newUnitPrice
            )}</span>`;

        const vatChanges =
          audit.oldVAT !== undefined
            ? `<span class="old-value">${audit.oldVAT}%</span> → <span class="new-value">${audit.newVAT}%</span>`
            : `<span class="new-value">${audit.newVAT}%</span>`;

        const priceAfterVATChanges =
          audit.oldUnitPriceAfterVAT !== undefined
            ? `<span class="old-value">${formatCurrency(
                audit.oldUnitPriceAfterVAT
              )}</span> → <span class="new-value">${formatCurrency(
                audit.newUnitPriceAfterVAT
              )}</span>`
            : `<span class="new-value">${formatCurrency(
                audit.newUnitPriceAfterVAT
              )}</span>`;

        row.innerHTML = `
          <td>${formatDate(audit.editedAt)}</td>
          <td><span class="status-badge ${getActionClass(audit.action)}">${
          audit.action
        }</span></td>
          <td>${audit.editedBy?.username || "Không xác định"}</td>
          <td class="change-cell">${nameChanges}</td>
          <td class="change-cell">${codeChanges}</td>
          <td class="change-cell">${unitChanges}</td>
          <td class="change-cell">${priceChanges}</td>
          <td class="change-cell">${vatChanges}</td>
          <td class="change-cell">${priceAfterVATChanges}</td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById("audit-section").style.display = "block";
    document.getElementById("items-table").style.display = "none";
  } catch (error) {
    showAlert("Lỗi khi tải lịch sử: " + error.message, "error");
  }
}

// Ẩn lịch sử thay đổi
function hideAuditHistory() {
  document.getElementById("audit-section").style.display = "none";
  document.getElementById("items-table").style.display = "table";
}

// Xử lý gửi form
async function handleSubmit(event) {
  event.preventDefault();

  const itemId = document.getElementById("item-id").value;
  const code = document.getElementById("code").value.trim();
  const name = document.getElementById("name").value.trim();
  const unit = document.getElementById("unit").value.trim();
  const unitPrice = parseFloat(document.getElementById("unitPrice").value);
  const vat = parseFloat(document.getElementById("vat").value);

  // Validation
  if (!code || !name || !unit || isNaN(unitPrice) || unitPrice < 0) {
    showAlert("Vui lòng nhập đầy đủ và chính xác thông tin!", "error");
    return;
  }

  if (vat < 0 || vat > 100) {
    showAlert("VAT phải nằm trong khoảng 0-100%!", "error");
    return;
  }

  const itemData = { code, name, unit, unitPrice, vat };

  const url = itemId
    ? `/itemManagementControl/${itemId}`
    : "/itemManagementControl";
  const method = itemId ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(itemData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Không thể lưu mặt hàng");
    }

    const result = await response.json();
    showAlert(`Mặt hàng đã được ${itemId ? "cập nhật" : "tạo"} thành công!`);
    closeModal();
    fetchItems();
  } catch (error) {
    showAlert("Lỗi: " + error.message, "error");
  }
}

// Xóa mặt hàng
async function deleteItem(itemId) {
  if (!confirm("Bạn có chắc chắn muốn xóa mặt hàng này?")) return;

  try {
    const response = await fetch(`/itemManagementControl/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Không thể xóa mặt hàng");
    }

    const result = await response.json();
    showAlert("Đã xóa mặt hàng thành công!");
    fetchItems();
  } catch (error) {
    showAlert("Lỗi khi xóa mặt hàng: " + error.message, "error");
  }
}

// Khôi phục mặt hàng
async function restoreItem(itemId) {
  if (!confirm("Bạn có chắc chắn muốn khôi phục mặt hàng này?")) return;

  try {
    const response = await fetch(`/itemManagementControl/${itemId}/restore`, {
      method: "PATCH",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Không thể khôi phục mặt hàng");
    }

    const result = await response.json();
    showAlert("Đã khôi phục mặt hàng thành công!");
    fetchItems();
  } catch (error) {
    showAlert("Lỗi khi khôi phục mặt hàng: " + error.message, "error");
  }
}

// Đóng modal
function closeModal() {
  document.getElementById("item-modal").style.display = "none";
}

// Hàm hỗ trợ
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return (
      "Hôm nay, " +
      date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    );
  } else if (diffDays === 1) {
    return (
      "Hôm qua, " +
      date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    );
  } else if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  } else {
    return date.toLocaleDateString("vi-VN");
  }
}

function getActionClass(action) {
  switch (action) {
    case "create":
      return "status-active";
    case "update":
      return "status-badge";
    case "delete":
      return "status-deleted";
    default:
      return "";
  }
}

// Khởi tạo
document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (user) {
    // User info is already in header
  }

  // Initial fetch
  fetchItems();

  // Setup event listeners for price calculation
  document
    .getElementById("unitPrice")
    .addEventListener("input", calculatePriceAfterVAT);
  document
    .getElementById("vat")
    .addEventListener("input", calculatePriceAfterVAT);

  // Đóng modal khi click bên ngoài
  window.onclick = function (event) {
    const modal = document.getElementById("item-modal");
    if (event.target === modal) {
      closeModal();
    }
  };

  // Close modal with ESC key
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeModal();
    }
  });
});
