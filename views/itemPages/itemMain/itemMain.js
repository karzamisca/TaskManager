// views/itemPages/itemMain/itemMain.js
// Biến toàn cục
let orders = [];
let currentPage = 1;
let itemsPerPage = 20;
let filters = {};

// Các thể hiện Flatpickr
let startDatePicker, endDatePicker;

// Định dạng tiền tệ
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

// Lấy lớp trạng thái
function getStatusClass(status) {
  switch (status) {
    case "pending":
      return "status-pending";
    case "processing":
      return "status-processing";
    case "completed":
      return "status-completed";
    case "cancelled":
      return "status-cancelled";
    default:
      return "";
  }
}

// Hiển thị thông báo
function showAlert(message, type = "success") {
  const alert = document.getElementById("alert");
  alert.textContent = message;
  alert.className = `alert alert-${type}`;
  alert.style.display = "block";

  setTimeout(() => {
    alert.style.display = "none";
  }, 3000);
}

// Khởi tạo flatpickr
function initializeDatePickers() {
  startDatePicker = flatpickr("#start-date", {
    dateFormat: "d-m-Y",
    altInput: true,
    altFormat: "d-m-Y",
    onChange: function (selectedDates, dateStr) {
      if (selectedDates.length > 0) {
        // Đảm bảo ngày kết thúc không trước ngày bắt đầu
        if (
          endDatePicker.selectedDates.length > 0 &&
          selectedDates[0] > endDatePicker.selectedDates[0]
        ) {
          endDatePicker.setDate(selectedDates[0]);
        }
        endDatePicker.set("minDate", selectedDates[0]);
      }
    },
  });

  endDatePicker = flatpickr("#end-date", {
    dateFormat: "d-m-Y",
    altInput: true,
    altFormat: "d-m-Y",
    onChange: function (selectedDates, dateStr) {
      if (selectedDates.length > 0) {
        // Đảm bảo ngày bắt đầu không sau ngày kết thúc
        if (
          startDatePicker.selectedDates.length > 0 &&
          selectedDates[0] < startDatePicker.selectedDates[0]
        ) {
          startDatePicker.setDate(selectedDates[0]);
        }
        startDatePicker.set("maxDate", selectedDates[0]);
      }
    },
  });
}

// Chuyển đổi định dạng ngày từ dd-mm-yyyy sang yyyy-mm-dd cho API
function convertDateFormat(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Lấy đơn hàng với bộ lọc
async function fetchOrders() {
  try {
    // Xây dựng chuỗi truy vấn từ bộ lọc
    const queryParams = new URLSearchParams();
    if (filters.status && filters.status !== "all") {
      queryParams.append("status", filters.status);
    }
    if (filters.startDate) {
      queryParams.append("startDate", filters.startDate);
    }
    if (filters.endDate) {
      queryParams.append("endDate", filters.endDate);
    }

    const queryString = queryParams.toString();
    const url = `/itemOrderControl${queryString ? "?" + queryString : ""}`;

    const response = await fetch(url, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Không thể tải đơn hàng");

    orders = await response.json();
    renderOrders();
  } catch (error) {
    showAlert("Lỗi tải đơn hàng: " + error.message, "error");
  }
}

// Hiển thị đơn hàng
function renderOrders() {
  const container = document.getElementById("orders-list");

  if (orders.length === 0) {
    container.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px;">
                            <h3>Không tìm thấy đơn hàng</h3>
                            <p>Hãy thử điều chỉnh bộ lọc hoặc kiểm tra lại sau</p>
                        </td>
                    </tr>
                `;
    return;
  }

  // Tính toán phân trang
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageOrders = orders.slice(startIndex, endIndex);

  container.innerHTML = pageOrders
    .map(
      (order) => `
                <tr>
                    <td style="font-weight: bold;">${order.orderNumber}</td>
                    <td>
                        <div>${order.username}</div>
                    </td>
                    <td style="font-size: 0.9rem;">${
                      order.formattedOrderDate
                    }</td>
                    <td>${order.items.length} sản phẩm</td>
                    <td style="font-weight: bold;">${formatCurrency(
                      order.totalAmount
                    )}</td>
                    <td>
                        <span class="status ${getStatusClass(order.status)}">
                            ${order.status.toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <button class="action-btn" onclick="viewOrderDetails('${
                          order._id
                        }')">
                            Xem
                        </button>
                    </td>
                </tr>
            `
    )
    .join("");

  // Hiển thị phân trang
  renderPagination();
}

// Hiển thị phân trang
function renderPagination() {
  const totalPages = Math.ceil(orders.length / itemsPerPage);

  if (totalPages <= 1) return;

  const pagination = document.createElement("div");
  pagination.className = "pagination";

  // Nút trước
  const prevBtn = document.createElement("button");
  prevBtn.className = `page-btn ${currentPage === 1 ? "disabled" : ""}`;
  prevBtn.textContent = "← Trước";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderOrders();
    }
  };

  // Số trang
  const pageNumbers = document.createElement("div");
  pageNumbers.style.display = "flex";
  pageNumbers.style.gap = "5px";

  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = `page-btn ${i === currentPage ? "active" : ""}`;
    pageBtn.textContent = i;
    pageBtn.onclick = () => {
      currentPage = i;
      renderOrders();
    };
    pageNumbers.appendChild(pageBtn);
  }

  // Nút sau
  const nextBtn = document.createElement("button");
  nextBtn.className = `page-btn ${
    currentPage === totalPages ? "disabled" : ""
  }`;
  nextBtn.textContent = "Sau →";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderOrders();
    }
  };

  pagination.appendChild(prevBtn);
  pagination.appendChild(pageNumbers);
  pagination.appendChild(nextBtn);

  // Xóa phân trang hiện có và thêm mới
  const existingPagination = document.querySelector(".pagination");
  if (existingPagination) {
    existingPagination.remove();
  }

  const container = document.getElementById("orders-list");
  container.parentNode.insertBefore(pagination, container.nextSibling);
}

// Áp dụng bộ lọc
function applyFilters() {
  const startDate = startDatePicker.selectedDates[0];
  const endDate = endDatePicker.selectedDates[0];

  filters = {
    status: document.getElementById("status-filter").value,
    startDate: startDate ? startDate.toISOString().split("T")[0] : "",
    endDate: endDate ? endDate.toISOString().split("T")[0] : "",
  };

  currentPage = 1;
  fetchOrders();
}

// Đặt lại bộ lọc
function resetFilters() {
  document.getElementById("status-filter").value = "all";
  startDatePicker.clear();
  endDatePicker.clear();

  filters = {};
  currentPage = 1;
  fetchOrders();
}

// Xem chi tiết đơn hàng
async function viewOrderDetails(orderId) {
  try {
    const response = await fetch(`/itemOrderControl/${orderId}`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Không thể tải chi tiết đơn hàng");

    const order = await response.json();
    renderOrderModal(order);
    document.getElementById("order-modal").style.display = "flex";
  } catch (error) {
    showAlert("Lỗi tải chi tiết đơn hàng: " + error.message, "error");
  }
}

// Hiển thị modal đơn hàng
function renderOrderModal(order) {
  document.getElementById(
    "modal-title"
  ).textContent = `Đơn hàng #${order.orderNumber}`;

  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = `
                <div class="order-details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Khách hàng</div>
                        <div class="detail-value">${order.username}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Ngày đặt hàng</div>
                        <div class="detail-value">${
                          order.formattedOrderDate
                        }</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Cập nhật lần cuối</div>
                        <div class="detail-value">${
                          order.formattedUpdatedAt
                        }</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Trạng thái</div>
                        <div class="detail-value">
                            <span class="status ${getStatusClass(
                              order.status
                            )}">
                                ${order.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Tổng tiền</div>
                        <div class="detail-value">${formatCurrency(
                          order.totalAmount
                        )}</div>
                    </div>
                </div>
                
                ${
                  order.notes
                    ? `
                <div class="detail-item" style="grid-column: 1 / -1; margin-top: 15px;">
                    <div class="detail-label">Ghi chú</div>
                    <div class="detail-value">${order.notes}</div>
                </div>
                `
                    : ""
                }
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Tên sản phẩm</th>
                            <th>Mã sản phẩm</th>
                            <th>Đơn giá</th>
                            <th>Số lượng</th>
                            <th>Tổng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items
                          .map(
                            (item) => `
                            <tr>
                                <td>${item.itemName}</td>
                                <td>${item.itemCode}</td>
                                <td>${formatCurrency(item.unitPrice)}</td>
                                <td>${item.quantity}</td>
                                <td>${formatCurrency(item.totalPrice)}</td>
                            </tr>
                        `
                          )
                          .join("")}
                        <tr style="font-weight: bold; border-top: 1px solid black;">
                            <td colspan="4" style="text-align: right;">Tổng cộng:</td>
                            <td>${formatCurrency(order.totalAmount)}</td>
                        </tr>
                    </tbody>
                </table>
            `;
}

// Đóng modal
function closeModal() {
  document.getElementById("order-modal").style.display = "none";
}

// Khởi tạo
document.addEventListener("DOMContentLoaded", () => {
  // Khởi tạo bộ chọn ngày
  initializeDatePickers();

  // Lấy đơn hàng ban đầu
  fetchOrders();

  // Đóng modal khi click bên ngoài
  window.onclick = (event) => {
    const modal = document.getElementById("order-modal");
    if (event.target === modal) {
      closeModal();
    }
  };
});
