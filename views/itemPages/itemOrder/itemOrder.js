// views/itemPages/itemOrder/itemOrder.js
// Biến toàn cục
let availableItems = [];
let cart = [];

// Định dạng tiền tệ
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
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

// Lấy sản phẩm có sẵn
async function fetchAvailableItems() {
  try {
    const response = await fetch("/itemManagementControl", {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Không thể tải sản phẩm");

    availableItems = await response.json();
    renderAvailableItems();
  } catch (error) {
    showAlert("Lỗi tải sản phẩm: " + error.message, "error");
  }
}

// Hiển thị sản phẩm có sẵn
function renderAvailableItems() {
  const container = document.getElementById("items-list");

  if (availableItems.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <h3>Không có sản phẩm nào</h3>
        <p>Tất cả sản phẩm có thể đã bị xóa hoặc không tồn tại</p>
      </div>
    `;
    return;
  }

  container.innerHTML = availableItems
    .map(
      (item) => `
        <div class="item">
          <div class="item-info">
            <h3>${item.name}</h3>
            <div class="item-meta">
              <span>Mã: ${item.code}</span>
              <span>Đơn vị: ${item.unit}</span>
              <span>Giá: ${formatCurrency(item.unitPrice)}</span>
              <span>VAT: ${item.vat}%</span>
            </div>
            <div class="item-vat-info">
              Giá sau VAT: ${formatCurrency(item.unitPriceAfterVAT)}
            </div>
          </div>
          <div class="item-actions">
            <div class="quantity-control">
              <button class="quantity-btn" onclick="decreaseQuantity('${
                item._id
              }')">-</button>
              <input 
                type="number" 
                id="qty-${item._id}" 
                class="quantity-input" 
                value="1" 
                min="1" 
                onchange="updateCartItem('${item._id}', this.value)"
              >
              <button class="quantity-btn" onclick="increaseQuantity('${
                item._id
              }')">+</button>
            </div>
            <button class="add-btn" onclick="addToCart('${item._id}')">
              Thêm
            </button>
          </div>
        </div>
      `
    )
    .join("");
}

// Điều khiển số lượng
function increaseQuantity(itemId) {
  const input = document.getElementById(`qty-${itemId}`);
  input.value = parseInt(input.value) + 1;
}

function decreaseQuantity(itemId) {
  const input = document.getElementById(`qty-${itemId}`);
  if (parseInt(input.value) > 1) {
    input.value = parseInt(input.value) - 1;
  }
}

// Chức năng giỏ hàng
function addToCart(itemId) {
  const quantity =
    parseInt(document.getElementById(`qty-${itemId}`).value) || 1;
  const item = availableItems.find((i) => i._id === itemId);

  if (!item) return;

  // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
  const existingIndex = cart.findIndex(
    (cartItem) => cartItem.itemId === itemId
  );

  if (existingIndex > -1) {
    // Cập nhật số lượng
    cart[existingIndex].quantity += quantity;
    cart[existingIndex].totalPrice =
      cart[existingIndex].quantity * item.unitPrice;
    cart[existingIndex].totalPriceAfterVAT =
      cart[existingIndex].quantity * item.unitPriceAfterVAT;
  } else {
    // Thêm sản phẩm mới
    cart.push({
      itemId: itemId,
      itemName: item.name,
      itemCode: item.code,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vat: item.vat,
      unitPriceAfterVAT: item.unitPriceAfterVAT,
      quantity: quantity,
      totalPrice: quantity * item.unitPrice,
      totalPriceAfterVAT: quantity * item.unitPriceAfterVAT,
    });
  }

  updateCart();
  showAlert(`Đã thêm ${quantity} ${item.name} vào giỏ hàng`, "success");

  // Đặt lại số lượng nhập
  document.getElementById(`qty-${itemId}`).value = 1;
}

function updateCartItem(itemId, quantity) {
  const qty = parseInt(quantity) || 1;
  const item = cart.find((cartItem) => cartItem.itemId === itemId);

  if (item) {
    item.quantity = qty;
    item.totalPrice = qty * item.unitPrice;
    item.totalPriceAfterVAT = qty * item.unitPriceAfterVAT;
    updateCart();
  }
}

function removeFromCart(itemId) {
  cart = cart.filter((item) => item.itemId !== itemId);
  updateCart();
}

function updateCart() {
  const cartItemsContainer = document.getElementById("cart-items");
  const emptyCart = document.getElementById("empty-cart");
  const cartSummary = document.getElementById("cart-summary");

  // Tính tổng giỏ hàng
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const cartTotalAfterVAT = cart.reduce(
    (sum, item) => sum + item.totalPriceAfterVAT,
    0
  );
  const vatAmount = cartTotalAfterVAT - cartTotal;

  // Update display
  document.getElementById("items-total").textContent =
    formatCurrency(cartTotal);
  document.getElementById("vat-total").textContent = formatCurrency(vatAmount);
  document.getElementById("cart-summary-total").textContent =
    formatCurrency(cartTotalAfterVAT);

  // Bật/tắt nút gửi
  document.getElementById("submit-order").disabled = cart.length === 0;

  if (cart.length === 0) {
    // Hiển thị thông báo giỏ hàng trống
    if (emptyCart) {
      emptyCart.style.display = "block";
    }
    if (cartSummary) {
      cartSummary.style.display = "none";
    }
    // Xóa container sản phẩm nhưng giữ div giỏ hàng trống
    const emptyCartDiv = cartItemsContainer.querySelector(".empty-cart");
    cartItemsContainer.innerHTML = "";
    if (emptyCartDiv) {
      cartItemsContainer.appendChild(emptyCartDiv);
    }
  } else {
    // Ẩn thông báo giỏ hàng trống
    if (emptyCart) {
      emptyCart.style.display = "none";
    }
    if (cartSummary) {
      cartSummary.style.display = "block";
    }

    // Hiển thị sản phẩm trong giỏ hàng với VAT information
    cartItemsContainer.innerHTML = cart
      .map(
        (item) => `
          <div class="cart-item">
            <div class="cart-item-info">
              <h4>${item.itemName}</h4>
              <div class="cart-item-details">
                <span>Mã: ${item.itemCode}</span> • 
                <span>Đơn vị: ${item.unit}</span> • 
                <span>Giá: ${formatCurrency(item.unitPrice)}</span> • 
                <span>VAT: ${item.vat}%</span> • 
                <span>SL: ${item.quantity}</span>
              </div>
              <div class="cart-item-vat">
                <span>Giá sau VAT: ${formatCurrency(
                  item.unitPriceAfterVAT
                )}/đơn vị</span>
              </div>
            </div>
            <div class="cart-item-actions">
              <div style="text-align: right;">
                <div class="price-before-vat">${formatCurrency(
                  item.totalPrice
                )}</div>
                <div class="price-after-vat">${formatCurrency(
                  item.totalPriceAfterVAT
                )}</div>
              </div>
              <button class="remove-btn" onclick="removeFromCart('${
                item.itemId
              }')">
                ✕
              </button>
            </div>
          </div>
        `
      )
      .join("");
  }
}

// Gửi đơn hàng
async function submitOrder() {
  if (cart.length === 0) {
    showAlert("Giỏ hàng của bạn đang trống", "error");
    return;
  }

  const notes = document.getElementById("order-notes").value;
  const orderData = {
    items: cart.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
    })),
    notes: notes,
  };

  try {
    const response = await fetch("/itemOrderControl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không thể gửi đơn hàng");
    }

    showAlert(
      "Đơn hàng đã được gửi thành công! Đơn hàng #" + result.order.orderNumber,
      "success"
    );

    // Xóa giỏ hàng
    cart = [];
    updateCart();
    document.getElementById("order-notes").value = "";

    // Làm mới đơn hàng gần đây
    fetchRecentOrders();
  } catch (error) {
    showAlert("Lỗi gửi đơn hàng: " + error.message, "error");
  }
}

// Lấy đơn hàng gần đây
async function fetchRecentOrders() {
  try {
    const response = await fetch("/itemOrderControl/my-orders", {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Không thể tải đơn hàng");

    const orders = await response.json();
    renderRecentOrders(orders);
  } catch (error) {
    console.error("Lỗi tải đơn hàng gần đây:", error);
  }
}

// Hiển thị đơn hàng gần đây
function renderRecentOrders(orders) {
  const container = document.getElementById("recent-orders");

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <h3>Chưa có đơn hàng nào</h3>
        <p>Đơn hàng bạn đã gửi sẽ xuất hiện ở đây</p>
      </div>
    `;
    return;
  }

  container.innerHTML = orders
    .slice(0, 5)
    .map(
      (order) => `
        <div class="order" onclick="viewOrderDetails('${order._id}')">
          <div class="order-header">
            <div>
              <span class="order-number">Đơn hàng #${order.orderNumber}</span>
              <span style="margin-left: 10px; opacity: 0.8;">
                ${order.formattedOrderDate}
              </span>
            </div>
            <span class="order-status ${order.status}">
              ${order.status.toUpperCase()}
            </span>
          </div>
          <div class="order-details">
            <div>
              <strong>Sản phẩm:</strong> ${order.items.length}
            </div>
            <div>
              <strong>Ghi chú:</strong> ${order.notes || "Không có"}
            </div>
            <div>
              <strong>Tổng (chưa VAT):</strong> ${formatCurrency(
                order.totalAmount
              )}
            </div>
            <div>
              <strong>Tổng (sau VAT):</strong> ${formatCurrency(
                order.totalAmountAfterVAT
              )}
            </div>
          </div>
          <div style="text-align: right; margin-top: 10px;">
            <button class="view-order-btn" onclick="event.stopPropagation(); viewOrderDetails('${
              order._id
            }')">
              Xem Chi Tiết
            </button>
          </div>
        </div>
      `
    )
    .join("");
}

// Xem chi tiết đơn hàng trong modal
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
        <div class="detail-value">${order.formattedOrderDate}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Cập nhật lần cuối</div>
        <div class="detail-value">${order.formattedUpdatedAt}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Trạng thái</div>
        <div class="detail-value">
          <span class="order-status ${order.status}">
            ${order.status.toUpperCase()}
          </span>
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Tổng tiền (chưa VAT)</div>
        <div class="detail-value">${formatCurrency(order.totalAmount)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Tổng tiền (sau VAT)</div>
        <div class="detail-value total-vat">${formatCurrency(
          order.totalAmountAfterVAT
        )}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Số lượng sản phẩm</div>
        <div class="detail-value">${order.items.length}</div>
      </div>
    </div>
    
    ${
      order.notes
        ? `
    <div class="detail-item" style="grid-column: 1 / -1; margin-top: 10px;">
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
          <th>Mã</th>
          <th class="text-center">Đơn vị</th>
          <th class="text-right">Đơn giá</th>
          <th class="text-center">VAT</th>
          <th class="text-right">Đơn giá sau VAT</th>
          <th class="text-center">SL</th>
          <th class="text-right">Tổng (chưa VAT)</th>
          <th class="text-right">Tổng (sau VAT)</th>
        </tr>
      </thead>
      <tbody>
        ${order.items
          .map(
            (item) => `
          <tr>
            <td>${item.itemName}</td>
            <td>${item.itemCode}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right">${formatCurrency(item.unitPrice)}</td>
            <td class="text-center">${item.vat}%</td>
            <td class="text-right">${formatCurrency(
              item.unitPriceAfterVAT
            )}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.totalPrice)}</td>
            <td class="text-right vat-amount">${formatCurrency(
              item.totalPriceAfterVAT
            )}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" class="text-right">Tổng cộng (chưa VAT):</td>
          <td class="text-right">${formatCurrency(order.totalAmount)}</td>
          <td></td>
        </tr>
        <tr>
          <td colspan="7" class="text-right">Tổng cộng (sau VAT):</td>
          <td></td>
          <td class="text-right vat-total">${formatCurrency(
            order.totalAmountAfterVAT
          )}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

// Đóng modal
function closeModal() {
  document.getElementById("order-modal").style.display = "none";
}

// Khởi tạo
document.addEventListener("DOMContentLoaded", () => {
  // Thiết lập nút gửi
  document
    .getElementById("submit-order")
    .addEventListener("click", submitOrder);

  // Lấy dữ liệu ban đầu
  fetchAvailableItems();
  fetchRecentOrders();

  // Đóng modal khi click bên ngoài
  window.onclick = (event) => {
    const modal = document.getElementById("order-modal");
    if (event.target === modal) {
      closeModal();
    }
  };

  // Đóng modal bằng phím ESC
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
});
