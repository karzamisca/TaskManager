// views/itemPages/itemMain/itemMain.js
// Global variables
let orders = [];
let currentPage = 1;
let itemsPerPage = 20;
let filters = {};

// Flatpickr instances
let startDatePicker, endDatePicker;

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Get status class
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

// Show alert message
function showAlert(message, type = "success") {
  const alert = document.getElementById("alert");
  alert.textContent = message;
  alert.className = `alert alert-${type}`;
  alert.style.display = "block";

  setTimeout(() => {
    alert.style.display = "none";
  }, 3000);
}

// Initialize flatpickr
function initializeDatePickers() {
  startDatePicker = flatpickr("#start-date", {
    dateFormat: "d-m-Y",
    altInput: true,
    altFormat: "d-m-Y",
    onChange: function (selectedDates, dateStr) {
      if (selectedDates.length > 0) {
        // Ensure end date is not before start date
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
        // Ensure start date is not after end date
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

// Convert dd-mm-yyyy to yyyy-mm-dd for API
function convertDateFormat(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Fetch orders with filters
async function fetchOrders() {
  try {
    // Build query string from filters
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

    if (!response.ok) throw new Error("Failed to fetch orders");

    orders = await response.json();
    renderOrders();
  } catch (error) {
    showAlert("Error loading orders: " + error.message, "error");
  }
}

// Render orders
function renderOrders() {
  const container = document.getElementById("orders-list");

  if (orders.length === 0) {
    container.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px;">
                            <h3>No orders found</h3>
                            <p>Try adjusting your filters or check back later</p>
                        </td>
                    </tr>
                `;
    return;
  }

  // Calculate pagination
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
                    <td>${order.items.length} items</td>
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
                            View
                        </button>
                    </td>
                </tr>
            `
    )
    .join("");

  // Render pagination
  renderPagination();
}

// Render pagination
function renderPagination() {
  const totalPages = Math.ceil(orders.length / itemsPerPage);

  if (totalPages <= 1) return;

  const pagination = document.createElement("div");
  pagination.className = "pagination";

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.className = `page-btn ${currentPage === 1 ? "disabled" : ""}`;
  prevBtn.textContent = "← Previous";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderOrders();
    }
  };

  // Page numbers
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

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.className = `page-btn ${
    currentPage === totalPages ? "disabled" : ""
  }`;
  nextBtn.textContent = "Next →";
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

  // Clear existing pagination and add new one
  const existingPagination = document.querySelector(".pagination");
  if (existingPagination) {
    existingPagination.remove();
  }

  const container = document.getElementById("orders-list");
  container.parentNode.insertBefore(pagination, container.nextSibling);
}

// Apply filters
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

// Reset filters
function resetFilters() {
  document.getElementById("status-filter").value = "all";
  startDatePicker.clear();
  endDatePicker.clear();

  filters = {};
  currentPage = 1;
  fetchOrders();
}

// View order details
async function viewOrderDetails(orderId) {
  try {
    const response = await fetch(`/itemOrderControl/${orderId}`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to fetch order details");

    const order = await response.json();
    renderOrderModal(order);
    document.getElementById("order-modal").style.display = "flex";
  } catch (error) {
    showAlert("Error loading order details: " + error.message, "error");
  }
}

// Render order modal
function renderOrderModal(order) {
  document.getElementById(
    "modal-title"
  ).textContent = `Order #${order.orderNumber}`;

  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = `
                <div class="order-details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Customer</div>
                        <div class="detail-value">${order.username}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Order Date</div>
                        <div class="detail-value">${
                          order.formattedOrderDate
                        }</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Last Updated</div>
                        <div class="detail-value">${
                          order.formattedUpdatedAt
                        }</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="status ${getStatusClass(
                              order.status
                            )}">
                                ${order.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Total Amount</div>
                        <div class="detail-value">${formatCurrency(
                          order.totalAmount
                        )}</div>
                    </div>
                </div>
                
                ${
                  order.notes
                    ? `
                <div class="detail-item" style="grid-column: 1 / -1; margin-top: 15px;">
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">${order.notes}</div>
                </div>
                `
                    : ""
                }
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Code</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                            <th>Total</th>
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
                            <td colspan="4" style="text-align: right;">Grand Total:</td>
                            <td>${formatCurrency(order.totalAmount)}</td>
                        </tr>
                    </tbody>
                </table>
            `;
}

// Close modal
function closeModal() {
  document.getElementById("order-modal").style.display = "none";
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Initialize date pickers
  initializeDatePickers();

  // Fetch initial orders
  fetchOrders();

  // Close modal when clicking outside
  window.onclick = (event) => {
    const modal = document.getElementById("order-modal");
    if (event.target === modal) {
      closeModal();
    }
  };
});
