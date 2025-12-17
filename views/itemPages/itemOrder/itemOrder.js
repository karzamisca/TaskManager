// views/itemPages/itemOrder/itemOrder.js
// Biến toàn cục
let availableItems = [];
let cart = [];
let editingOrder = null;
let originalOrderItems = [];

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
          <div class="order-actions">
            <button class="view-order-btn" onclick="event.stopPropagation(); viewOrderDetails('${
              order._id
            }')">
              Xem Chi Tiết
            </button>
            <button class="edit-order-btn" onclick="event.stopPropagation(); openEditOrderModal('${
              order._id
            }')" ${order.status !== "pending" ? "disabled" : ""}>
              Chỉnh Sửa
            </button>
            <button class="delete-order-history-btn" onclick="event.stopPropagation(); deleteOrderFromHistory('${
              order._id
            }')" ${order.status !== "pending" ? "disabled" : ""}>
              Xóa Đơn Hàng
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

// Mở modal chỉnh sửa
async function openEditOrderModal(orderId) {
  try {
    const response = await fetch(`/itemOrderControl/${orderId}`, {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Không thể tải đơn hàng để chỉnh sửa");

    const order = await response.json();

    editingOrder = order;
    originalOrderItems = JSON.parse(JSON.stringify(order.items)); // Deep copy

    renderEditModal(order);
    document.getElementById("edit-order-modal").style.display = "flex";
  } catch (error) {
    showAlert("Lỗi tải đơn hàng để chỉnh sửa: " + error.message, "error");
  }
}

// Hiển thị modal chỉnh sửa
function renderEditModal(order) {
  document.getElementById(
    "edit-modal-title"
  ).textContent = `Chỉnh Sửa Đơn Hàng #${order.orderNumber}`;

  const modalBody = document.getElementById("edit-modal-body");

  modalBody.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div class="detail-item">
        <div class="detail-label">Khách hàng</div>
        <div class="detail-value">${order.username}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Ngày đặt hàng</div>
        <div class="detail-value">${order.formattedOrderDate}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Trạng thái</div>
        <div class="detail-value">
          <span class="order-status ${order.status}">
            ${order.status.toUpperCase()}
          </span>
        </div>
      </div>
    </div>

    <div id="edit-items-container">
      <h3>Sản phẩm trong đơn hàng</h3>
      <div id="current-order-items">
        ${renderEditOrderItems(order.items)}
      </div>
    </div>

    <div class="add-items-section">
      <h3>Thêm sản phẩm mới</h3>
      <div class="available-items-edit" id="available-items-edit">
        <!-- Sản phẩm có sẵn sẽ được tải ở đây -->
      </div>
    </div>

    <div class="edit-summary">
      <div>
        <strong>Tổng tiền tạm tính:</strong>
      </div>
      <div class="edit-summary-total" id="edit-summary-total">
        ${formatCurrency(calculateEditTotal())}
      </div>
    </div>

    <div class="notes" style="margin-top: 20px;">
      <label for="edit-order-notes">Ghi chú:</label>
      <textarea
        id="edit-order-notes"
        placeholder="Cập nhật ghi chú cho đơn hàng..."
      >${order.notes || ""}</textarea>
    </div>

    <div class="edit-modal-actions">
      <button class="edit-modal-btn cancel-edit-btn" onclick="closeEditModal()">
        Hủy
      </button>
      <button class="edit-modal-btn update-order-btn" onclick="updateOrder()">
        Cập Nhật Đơn Hàng
      </button>
    </div>
  `;

  // Tải sản phẩm có sẵn cho modal
  loadAvailableItemsForEdit();
}

// Hiển thị sản phẩm trong modal chỉnh sửa
function renderEditOrderItems(items) {
  if (items.length === 0) {
    return '<div class="no-items-message">Chưa có sản phẩm nào trong đơn hàng</div>';
  }

  return items
    .map(
      (item, index) => `
        <div class="edit-item-row" id="edit-item-${index}">
          <div class="edit-item-info">
            <h4>${item.itemName}</h4>
            <div class="edit-item-meta">
              <span>Mã: ${item.itemCode}</span>
              <span>Đơn vị: ${item.unit}</span>
              <span>VAT: ${item.vat}%</span>
            </div>
            <div class="edit-item-vat">
              Giá sau VAT: ${formatCurrency(item.unitPriceAfterVAT)}/đơn vị
            </div>
          </div>
          <div class="edit-item-price">
            <div class="price-breakdown">
              <div class="price-before-vat-small">
                ${formatCurrency(item.totalPrice)}
              </div>
              <div class="price-after-vat-small">
                ${formatCurrency(item.totalPriceAfterVAT)}
              </div>
            </div>
          </div>
          <div class="edit-item-controls">
            <div class="edit-quantity-control">
              <button class="quantity-btn" onclick="decreaseEditQuantity(${index})">-</button>
              <input 
                type="number" 
                id="edit-qty-${index}" 
                class="edit-quantity-input" 
                value="${item.quantity}" 
                min="1" 
                onchange="updateEditItemQuantity(${index}, this.value)"
              >
              <button class="quantity-btn" onclick="increaseEditQuantity(${index})">+</button>
            </div>
            <button class="remove-item-btn" onclick="removeEditItem(${index})">
              ✕
            </button>
          </div>
        </div>
      `
    )
    .join("");
}

// Tải sản phẩm có sẵn cho modal
function loadAvailableItemsForEdit() {
  const container = document.getElementById("available-items-edit");

  // Sử dụng danh sách sản phẩm đã tải sẵn
  if (availableItems.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        Không có sản phẩm nào có sẵn để thêm
      </div>
    `;
    return;
  }

  // Lọc ra các sản phẩm chưa có trong đơn hàng
  const existingItemIds = editingOrder.items.map((item) => item.itemId);
  const filteredAvailableItems = availableItems.filter(
    (item) => !existingItemIds.includes(item._id) && !item.isDeleted
  );

  if (filteredAvailableItems.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        Tất cả sản phẩm đã có trong đơn hàng
      </div>
    `;
    return;
  }

  container.innerHTML = filteredAvailableItems
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
              <button class="quantity-btn" onclick="decreaseNewItemQuantity('${
                item._id
              }')">-</button>
              <input 
                type="number" 
                id="new-qty-${item._id}" 
                class="quantity-input" 
                value="1" 
                min="1" 
              >
              <button class="quantity-btn" onclick="increaseNewItemQuantity('${
                item._id
              }')">+</button>
            </div>
            <button class="add-btn" onclick="addNewItemToOrder('${item._id}')">
              Thêm Vào Đơn Hàng
            </button>
          </div>
        </div>
      `
    )
    .join("");
}

// Điều khiển số lượng trong modal chỉnh sửa - FIXED VERSION
function increaseEditQuantity(index) {
  const input = document.getElementById(`edit-qty-${index}`);
  input.value = parseInt(input.value) + 1;
  updateEditItemQuantity(index, input.value);
}

function decreaseEditQuantity(index) {
  const input = document.getElementById(`edit-qty-${index}`);
  if (parseInt(input.value) > 1) {
    input.value = parseInt(input.value) - 1;
    updateEditItemQuantity(index, input.value);
  }
}

function updateEditItemQuantity(index, quantity) {
  const qty = parseInt(quantity) || 1;
  editingOrder.items[index].quantity = qty;
  editingOrder.items[index].totalPrice =
    qty * editingOrder.items[index].unitPrice;
  editingOrder.items[index].totalPriceAfterVAT =
    qty * editingOrder.items[index].unitPriceAfterVAT;

  // Cập nhật hiển thị
  const itemRow = document.getElementById(`edit-item-${index}`);
  if (itemRow) {
    const priceElements = itemRow.querySelectorAll(
      ".price-before-vat-small, .price-after-vat-small"
    );
    if (priceElements[0]) {
      priceElements[0].textContent = formatCurrency(
        editingOrder.items[index].totalPrice
      );
    }
    if (priceElements[1]) {
      priceElements[1].textContent = formatCurrency(
        editingOrder.items[index].totalPriceAfterVAT
      );
    }
  }

  updateEditSummary();
}

function increaseNewItemQuantity(itemId) {
  const input = document.getElementById(`new-qty-${itemId}`);
  input.value = parseInt(input.value) + 1;
}

function decreaseNewItemQuantity(itemId) {
  const input = document.getElementById(`new-qty-${itemId}`);
  if (parseInt(input.value) > 1) {
    input.value = parseInt(input.value) - 1;
  }
}

// Thêm sản phẩm mới vào đơn hàng
function addNewItemToOrder(itemId) {
  const item = availableItems.find((i) => i._id === itemId);

  if (!item) {
    showAlert("Không tìm thấy sản phẩm", "error");
    return;
  }

  const quantity =
    parseInt(document.getElementById(`new-qty-${itemId}`).value) || 1;

  // Thêm vào mảng items
  editingOrder.items.push({
    itemId: item._id,
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

  // Cập nhật hiển thị
  document.getElementById("current-order-items").innerHTML =
    renderEditOrderItems(editingOrder.items);
  updateEditSummary();

  // Xóa sản phẩm khỏi danh sách có sẵn
  const itemElement = document
    .querySelector(`[onclick*="addNewItemToOrder('${itemId}')"]`)
    ?.closest(".item");
  if (itemElement) {
    itemElement.remove();
  }

  // Kiểm tra xem còn sản phẩm nào không
  const container = document.getElementById("available-items-edit");
  const remainingItems = container.querySelectorAll(".item");
  if (remainingItems.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        Tất cả sản phẩm đã có trong đơn hàng
      </div>
    `;
  }

  // Đặt lại số lượng nhập
  document.getElementById(`new-qty-${itemId}`).value = 1;

  showAlert(`Đã thêm ${quantity} ${item.name} vào đơn hàng`, "success");
}

// Xóa sản phẩm khỏi đơn hàng đang chỉnh sửa
function removeEditItem(index) {
  if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này khỏi đơn hàng?")) {
    return;
  }

  const removedItem = editingOrder.items[index];
  editingOrder.items.splice(index, 1);

  // Cập nhật hiển thị
  document.getElementById("current-order-items").innerHTML =
    renderEditOrderItems(editingOrder.items);
  updateEditSummary();

  // Thêm sản phẩm trở lại danh sách có sẵn
  loadAvailableItemsForEdit();

  showAlert(`Đã xóa ${removedItem.itemName} khỏi đơn hàng`, "success");
}

// Tính tổng tiền trong modal chỉnh sửa
function calculateEditTotal() {
  if (!editingOrder || !editingOrder.items) return 0;
  return editingOrder.items.reduce(
    (sum, item) => sum + item.totalPriceAfterVAT,
    0
  );
}

// Cập nhật tổng tiền
function updateEditSummary() {
  const total = calculateEditTotal();
  document.getElementById("edit-summary-total").textContent =
    formatCurrency(total);
}

// Cập nhật đơn hàng
async function updateOrder() {
  if (!editingOrder || editingOrder.items.length === 0) {
    showAlert("Đơn hàng không thể trống", "error");
    return;
  }

  const notes = document.getElementById("edit-order-notes").value;

  // Kiểm tra xem có thay đổi không
  const itemsChanged =
    JSON.stringify(editingOrder.items) !== JSON.stringify(originalOrderItems);
  const notesChanged = notes !== editingOrder.notes;

  if (!itemsChanged && !notesChanged) {
    showAlert("Không có thay đổi nào để cập nhật", "info");
    closeEditModal();
    return;
  }

  const orderData = {
    items: editingOrder.items.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
    })),
    notes: notes,
  };

  try {
    const response = await fetch(`/itemOrderControl/${editingOrder._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không thể cập nhật đơn hàng");
    }

    showAlert("Đơn hàng đã được cập nhật thành công!", "success");

    // Làm mới đơn hàng gần đây
    fetchRecentOrders();

    // Đóng modal
    closeEditModal();
  } catch (error) {
    showAlert("Lỗi cập nhật đơn hàng: " + error.message, "error");
  }
}

// Xóa đơn hàng từ lịch sử
async function deleteOrderFromHistory(orderId) {
  if (
    !confirm(
      "Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này không thể hoàn tác."
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/itemOrderControl/${orderId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không thể xóa đơn hàng");
    }

    showAlert("Đơn hàng đã được xóa thành công!", "success");

    // Làm mới đơn hàng gần đây
    fetchRecentOrders();
  } catch (error) {
    showAlert("Lỗi xóa đơn hàng: " + error.message, "error");
  }
}

// Đóng modal chỉnh sửa
function closeEditModal() {
  editingOrder = null;
  originalOrderItems = [];
  document.getElementById("edit-order-modal").style.display = "none";
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
    const editModal = document.getElementById("edit-order-modal");

    if (event.target === modal) {
      closeModal();
    }
    if (event.target === editModal) {
      closeEditModal();
    }
  };

  // Đóng modal bằng phím ESC
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = document.getElementById("order-modal");
      const editModal = document.getElementById("edit-order-modal");

      if (modal.style.display === "flex") {
        closeModal();
      }
      if (editModal.style.display === "flex") {
        closeEditModal();
      }
    }
  });
});
