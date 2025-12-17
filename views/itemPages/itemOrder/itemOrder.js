// views/itemPages/itemOrder/itemOrder.js
// Biến toàn cục với cấu trúc nested groups
let availableItems = [];
let cart = [];
let editingOrder = null;
let originalOrderItems = [];
let groups = []; // Mỗi group chứa items bên trong
let existingOrderNumbers = new Set();

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

// Lấy mặt hàng có sẵn
async function fetchAvailableItems() {
  try {
    const response = await fetch("/itemManagementControl", {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Không thể tải mặt hàng");

    availableItems = await response.json();
    renderAvailableItems();
  } catch (error) {
    showAlert("Lỗi tải mặt hàng: " + error.message, "error");
  }
}

// Hiển thị mặt hàng có sẵn
function renderAvailableItems() {
  const container = document.getElementById("items-list");

  if (availableItems.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <h3>Không có mặt hàng nào</h3>
        <p>Tất cả mặt hàng có thể đã bị xóa hoặc không tồn tại</p>
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

  // Kiểm tra xem mặt hàng đã có trong giỏ hàng chưa
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
    // Thêm mặt hàng mới
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
  // Remove from all groups
  groups.forEach((group) => {
    const index = group.items.indexOf(itemId);
    if (index > -1) {
      group.items.splice(index, 1);
      updateGroupUI(group);
    }
  });

  // Remove from cart
  cart = cart.filter((item) => item.itemId !== itemId);

  // Remove empty groups
  groups = groups.filter((group) => group.items.length > 0);
  if (groups.length === 0) {
    document.getElementById("clear-groups-btn").disabled = true;
  }

  updateCart();
}

// ORDER NUMBER FUNCTIONS
async function loadExistingOrderNumbers() {
  try {
    const response = await fetch("/itemOrderControl/all-order-numbers", {
      credentials: "include",
    });

    if (response.ok) {
      const orderNumbers = await response.json();
      orderNumbers.forEach((num) =>
        existingOrderNumbers.add(num.toUpperCase())
      );
    }
  } catch (error) {
    console.error("Error loading order numbers:", error);
  }
}

async function checkOrderNumber(orderNumber) {
  if (!orderNumber) {
    clearOrderNumberWarning();
    return false;
  }

  const normalizedNumber = orderNumber.trim().toUpperCase();

  if (existingOrderNumbers.has(normalizedNumber)) {
    showOrderNumberWarning();
    return true;
  }

  try {
    const response = await fetch(
      `/itemOrderControl/check-order/${encodeURIComponent(normalizedNumber)}`,
      {
        credentials: "include",
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.exists) {
        existingOrderNumbers.add(normalizedNumber);
        showOrderNumberWarning();
        return true;
      } else {
        clearOrderNumberWarning();
        return false;
      }
    }
  } catch (error) {
    console.error("Error checking order number:", error);
  }

  clearOrderNumberWarning();
  return false;
}

function showOrderNumberWarning() {
  const warning = document.getElementById("order-number-warning");
  warning.classList.add("show");
}

function clearOrderNumberWarning() {
  const warning = document.getElementById("order-number-warning");
  warning.classList.remove("show");
}

// GROUP MANAGEMENT FUNCTIONS
function createGroup() {
  const groupNameInput = document.getElementById("new-group-name");
  const groupName = groupNameInput.value.trim();

  if (!groupName) {
    showAlert("Vui lòng nhập tên nhóm", "error");
    return;
  }

  // Kiểm tra tên nhóm đã tồn tại
  if (groups.some((g) => g.name.toLowerCase() === groupName.toLowerCase())) {
    showAlert("Tên nhóm đã tồn tại", "error");
    return;
  }

  const groupId = `group-${Date.now()}`;
  const newGroup = {
    id: groupId,
    name: groupName,
    items: [], // Items nested inside group
  };

  groups.push(newGroup);
  addGroupToUI(newGroup);

  groupNameInput.value = "";
  groupNameInput.focus();

  document.getElementById("clear-groups-btn").disabled = false;
  updateCart();

  showAlert(`Đã tạo nhóm "${groupName}"`, "success");
}

function addGroupToUI(group) {
  const groupList = document.getElementById("group-list");

  const groupElement = document.createElement("div");
  groupElement.className = "item-group";
  groupElement.id = `group-${group.id}`;
  groupElement.innerHTML = `
    <div class="group-header" onclick="toggleGroup('${group.id}')">
      <h4>
        <span class="group-toggle">▼</span>
        ${group.name}
        <span class="group-badge">${group.items.length} mặt hàng</span>
      </h4>
      <div class="group-actions">
        <button class="group-action-btn" onclick="event.stopPropagation(); renameGroup('${
          group.id
        }')" title="Đổi tên">
          ✏️
        </button>
        <button class="group-action-btn" onclick="event.stopPropagation(); deleteGroup('${
          group.id
        }')" title="Xóa nhóm">
          🗑️
        </button>
      </div>
    </div>
    <div class="group-content" id="group-content-${group.id}">
      ${
        group.items.length > 0
          ? group.items
              .map((itemId) => {
                const item = cart.find((i) => i.itemId === itemId);
                return item
                  ? `
            <div class="group-item">
              <div class="group-item-info">
                <h5>${item.itemName}</h5>
                <div class="group-item-details">
                  Mã: ${item.itemCode} • SL: ${item.quantity} • 
                  ${formatCurrency(item.totalPriceAfterVAT)}
                </div>
              </div>
              <div class="group-item-actions">
                <button class="group-action-btn" onclick="removeItemFromGroup('${
                  group.id
                }', '${itemId}')" title="Xóa khỏi nhóm">
                  ✕
                </button>
              </div>
            </div>
          `
                  : "";
              })
              .join("")
          : '<div style="padding: 20px; text-align: center; color: #666;">Chưa có mặt hàng trong nhóm</div>'
      }
    </div>
  `;

  groupList.appendChild(groupElement);
}

function toggleGroup(groupId) {
  const content = document.getElementById(`group-content-${groupId}`);
  const header = content.parentElement.querySelector(".group-header");

  if (content.classList.contains("collapsed")) {
    content.classList.remove("collapsed");
    header.classList.remove("collapsed");
  } else {
    content.classList.add("collapsed");
    header.classList.add("collapsed");
  }
}

function renameGroup(groupId) {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return;

  const newName = prompt("Nhập tên mới cho nhóm:", group.name);
  if (!newName || newName.trim() === group.name) return;

  const trimmedName = newName.trim();

  if (
    groups.some(
      (g) =>
        g.id !== groupId && g.name.toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    showAlert("Tên nhóm đã tồn tại", "error");
    return;
  }

  group.name = trimmedName;

  const groupElement = document.getElementById(`group-${groupId}`);
  const groupNameElement = groupElement.querySelector("h4");
  groupNameElement.innerHTML = `
    <span class="group-toggle">▼</span>
    ${group.name}
    <span class="group-badge">${group.items.length} mặt hàng</span>
  `;

  updateCart();
  showAlert(`Đã đổi tên nhóm thành "${group.name}"`, "success");
}

function deleteGroup(groupId) {
  if (
    !confirm(
      "Bạn có chắc chắn muốn xóa nhóm này? Các mặt hàng trong nhóm sẽ được chuyển sang không nhóm."
    )
  ) {
    return;
  }

  const groupIndex = groups.findIndex((g) => g.id === groupId);
  if (groupIndex === -1) return;

  const deletedGroup = groups.splice(groupIndex, 1)[0];

  const groupElement = document.getElementById(`group-${groupId}`);
  if (groupElement) {
    groupElement.remove();
  }

  if (groups.length === 0) {
    document.getElementById("clear-groups-btn").disabled = true;
  }

  updateCart();
  showAlert(`Đã xóa nhóm "${deletedGroup.name}"`, "success");
}

function removeItemFromGroup(groupId, itemId) {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return;

  const itemIndex = group.items.indexOf(itemId);
  if (itemIndex === -1) return;

  group.items.splice(itemIndex, 1);
  updateGroupUI(group);
  updateCart();

  showAlert("Đã xóa mặt hàng khỏi nhóm", "info");
}

function updateGroupUI(group) {
  const groupElement = document.getElementById(`group-${group.id}`);
  if (!groupElement) return;

  const groupBadge = groupElement.querySelector(".group-badge");
  if (groupBadge) {
    groupBadge.textContent = `${group.items.length} mặt hàng`;
  }

  const groupContent = groupElement.querySelector(`#group-content-${group.id}`);
  if (groupContent) {
    groupContent.innerHTML =
      group.items.length > 0
        ? group.items
            .map((itemId) => {
              const item = cart.find((i) => i.itemId === itemId);
              return item
                ? `
          <div class="group-item">
            <div class="group-item-info">
              <h5>${item.itemName}</h5>
              <div class="group-item-details">
                Mã: ${item.itemCode} • SL: ${item.quantity} • 
                ${formatCurrency(item.totalPriceAfterVAT)}
              </div>
            </div>
            <div class="group-item-actions">
              <button class="group-action-btn" onclick="removeItemFromGroup('${
                group.id
              }', '${itemId}')" title="Xóa khỏi nhóm">
                ✕
              </button>
            </div>
          </div>
        `
                : "";
            })
            .join("")
        : '<div style="padding: 20px; text-align: center; color: #666;">Chưa có mặt hàng trong nhóm</div>';
  }
}

function clearAllGroups() {
  if (cart.length === 0) {
    showAlert("Giỏ hàng đang trống", "info");
    return;
  }

  if (
    !confirm(
      "Bạn có chắc chắn muốn xóa tất cả nhóm? Các mặt hàng sẽ được chuyển sang không nhóm."
    )
  ) {
    return;
  }

  groups = [];
  const groupList = document.getElementById("group-list");
  groupList.innerHTML = "";
  document.getElementById("clear-groups-btn").disabled = true;
  updateCart();
  showAlert("Đã xóa tất cả nhóm", "success");
}

function assignItemToGroup(itemId, groupId) {
  const item = cart.find((i) => i.itemId === itemId);
  if (!item) return;

  // Remove from all groups
  groups.forEach((group) => {
    const index = group.items.indexOf(itemId);
    if (index > -1) {
      group.items.splice(index, 1);
      updateGroupUI(group);
    }
  });

  // Add to new group
  const group = groups.find((g) => g.id === groupId);
  if (group && !group.items.includes(itemId)) {
    group.items.push(itemId);
    updateGroupUI(group);
  }

  updateCart();
  showAlert("Đã thêm mặt hàng vào nhóm", "success");
}

function getGroupForItem(itemId) {
  return groups.find((group) => group.items.includes(itemId));
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
    if (emptyCart) emptyCart.style.display = "block";
    if (cartSummary) cartSummary.style.display = "none";

    const emptyCartDiv = cartItemsContainer.querySelector(".empty-cart");
    cartItemsContainer.innerHTML = "";
    if (emptyCartDiv) cartItemsContainer.appendChild(emptyCartDiv);

    groups = [];
    document.getElementById("group-list").innerHTML = "";
    document.getElementById("clear-groups-btn").disabled = true;
  } else {
    if (emptyCart) emptyCart.style.display = "none";
    if (cartSummary) cartSummary.style.display = "block";

    renderCartWithGroups();
  }
}

function renderCartWithGroups() {
  const cartItemsContainer = document.getElementById("cart-items");

  // Phân loại items: có nhóm và không nhóm
  const itemsByGroup = {};
  const ungroupedItems = [];

  cart.forEach((item) => {
    const group = getGroupForItem(item.itemId);
    if (group) {
      if (!itemsByGroup[group.id]) {
        itemsByGroup[group.id] = {
          group: group,
          items: [],
        };
      }
      itemsByGroup[group.id].items.push(item);
    } else {
      ungroupedItems.push(item);
    }
  });

  let html = "";

  // Render các groups với items bên trong
  groups.forEach((group) => {
    const groupData = itemsByGroup[group.id];
    if (groupData && groupData.items.length > 0) {
      html += `
        <div class="item-group">
          <div class="group-header" onclick="toggleGroup('${group.id}')">
            <h4>
              <span class="group-toggle">▼</span>
              ${group.name}
              <span class="group-badge">${
                groupData.items.length
              } mặt hàng</span>
            </h4>
          </div>
          <div class="group-content" id="group-content-${group.id}">
            ${groupData.items
              .map((item) => renderCartItem(item, group))
              .join("")}
          </div>
        </div>
      `;
    }
  });

  // Render items không có nhóm
  if (ungroupedItems.length > 0) {
    html += `
      <div class="ungrouped-items-section">
        <h4>📦 Mặt hàng không nhóm (${ungroupedItems.length})</h4>
        ${ungroupedItems.map((item) => renderCartItem(item, null)).join("")}
      </div>
    `;
  }

  cartItemsContainer.innerHTML = html;
}

function renderCartItem(item, group) {
  return `
    <div class="cart-item" data-item-id="${item.itemId}">
      <div class="cart-item-info">
        ${
          group
            ? `<div class="cart-item-group"><span class="group-indicator">${group.name}</span></div>`
            : ""
        }
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
        <div class="group-control">
          ${
            group
              ? `
            <button class="remove-from-group-btn" onclick="removeItemFromGroup('${group.id}', '${item.itemId}')">
              ✕ Xóa khỏi nhóm
            </button>
          `
              : `
            <select class="group-select" onchange="assignItemToGroup('${
              item.itemId
            }', this.value)" style="margin-right: 10px;">
              <option value="">-- Chọn nhóm --</option>
              ${groups
                .map((g) => `<option value="${g.id}">${g.name}</option>`)
                .join("")}
            </select>
            ${
              groups.length > 0
                ? `
              <button class="move-to-group-btn" onclick="assignItemToGroup('${item.itemId}', this.previousElementSibling.value)">
                Thêm vào nhóm
              </button>
            `
                : ""
            }
          `
          }
        </div>
      </div>
      <div class="cart-item-actions">
        <div style="text-align: right;">
          <div class="price-before-vat">${formatCurrency(item.totalPrice)}</div>
          <div class="price-after-vat">${formatCurrency(
            item.totalPriceAfterVAT
          )}</div>
        </div>
        <button class="remove-btn" onclick="removeFromCart('${item.itemId}')">
          ✕
        </button>
      </div>
    </div>
  `;
}

// Gửi đơn hàng
async function submitOrder() {
  if (cart.length === 0) {
    showAlert("Giỏ hàng của bạn đang trống", "error");
    return;
  }

  const notes = document.getElementById("order-notes").value;
  const customOrderNumber = document
    .getElementById("order-number-input")
    .value.trim();

  // Check if custom order number already exists
  if (customOrderNumber) {
    const exists = await checkOrderNumber(customOrderNumber);
    if (exists) {
      showAlert("Số đơn hàng đã tồn tại. Vui lòng chọn số khác.", "error");
      return;
    }
  }

  // Prepare groups data
  const orderGroups = groups.map((group) => ({
    name: group.name,
    items: group.items, // Just item IDs
  }));

  const orderData = {
    items: cart.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
    })),
    notes: notes,
    customOrderNumber: customOrderNumber || undefined,
    groups: orderGroups,
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

    // Clear everything
    cart = [];
    groups = [];

    // Clear form fields
    document.getElementById("order-notes").value = "";
    document.getElementById("order-number-input").value = "";
    document.getElementById("new-group-name").value = "";
    clearOrderNumberWarning();

    // Clear group list
    document.getElementById("group-list").innerHTML = "";
    document.getElementById("clear-groups-btn").disabled = true;

    // Update cart and load recent orders
    updateCart();
    fetchRecentOrders();

    // Add new order number to cache
    if (result.order.orderNumber) {
      existingOrderNumbers.add(result.order.orderNumber.toUpperCase());
    }
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
              <strong>Mặt hàng:</strong> ${order.items.length}
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

// Hiển thị modal đơn hàng với groups
function renderOrderModal(order) {
  document.getElementById(
    "modal-title"
  ).textContent = `Đơn hàng #${order.orderNumber}`;

  // Create groups HTML if exists
  let groupsHtml = "";
  if (order.groups && order.groups.length > 0) {
    groupsHtml = order.groups
      .map((group) => {
        const groupItems = order.items.filter((item) =>
          group.items.includes(item.itemId)
        );

        return `
        <div class="group-in-modal">
          <h5>📁 ${group.name} (${groupItems.length} mặt hàng)</h5>
          <div class="group-items-list">
            ${groupItems
              .map(
                (item) => `
              <div class="group-item-in-modal">
                <span class="item-name">${item.itemName}</span>
                <span class="item-details">
                  • Mã: ${item.itemCode} • SL: ${item.quantity} • 
                  ${formatCurrency(item.totalPriceAfterVAT)}
                </span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
      })
      .join("");
  }

  const modalBody = document.getElementById("modal-body");
  modalBody.innerHTML = `
    <div class="order-details-grid">
      <div class="detail-item">
        <div class="detail-label">Người nộp</div>
        <div class="detail-value">${order.username}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Ngày đặt</div>
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
        <div class="detail-label">Số lượng mặt hàng</div>
        <div class="detail-value">${order.items.length}</div>
      </div>
    </div>
    
    ${
      groupsHtml
        ? `
      <div style="margin: 20px 0;">
        <h4 style="margin-bottom: 15px; color: #333;">Nhóm Mặt hàng</h4>
        ${groupsHtml}
      </div>
    `
        : ""
    }
    
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
    
    <h4 style="margin: 20px 0 10px 0; color: #333;">Chi Tiết Mặt hàng</h4>
    <table class="items-table">
      <thead>
        <tr>
          <th>Tên mặt hàng</th>
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
    originalOrderItems = JSON.parse(JSON.stringify(order.items));

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
      <div class="edit-order-number-section">
        <label for="edit-order-number-input">Số Đơn Hàng:</label>
        <input 
          type="text" 
          id="edit-order-number-input" 
          class="edit-order-number-input"
          value="${order.orderNumber}"
          placeholder="Nhập số đơn hàng mới..."
        >
        <div class="edit-order-number-warning" id="edit-order-number-warning">
          ⚠️ Số đơn hàng này đã tồn tại. Vui lòng chọn số khác.
        </div>
      </div>
      
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
      <h3>Mặt hàng trong đơn hàng</h3>
      <div id="current-order-items">
        ${renderEditOrderItems(order.items)}
      </div>
    </div>

    <div class="add-items-section">
      <h3>Thêm mặt hàng mới</h3>
      <div class="available-items-edit" id="available-items-edit">
        <!-- Mặt hàng có sẵn sẽ được tải ở đây -->
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

  loadAvailableItemsForEdit();

  // Setup order number validation
  const orderNumberInput = document.getElementById("edit-order-number-input");
  if (orderNumberInput) {
    let timeout;
    orderNumberInput.addEventListener("input", (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        checkEditOrderNumber(e.target.value, order.orderNumber);
      }, 500);
    });
  }
}

async function checkEditOrderNumber(newOrderNumber, currentOrderNumber) {
  if (!newOrderNumber || newOrderNumber === currentOrderNumber) {
    clearEditOrderNumberWarning();
    return false;
  }

  const normalizedNumber = newOrderNumber.trim().toUpperCase();

  if (existingOrderNumbers.has(normalizedNumber)) {
    showEditOrderNumberWarning();
    return true;
  }

  try {
    const response = await fetch(
      `/itemOrderControl/check-order/${encodeURIComponent(normalizedNumber)}`,
      {
        credentials: "include",
      }
    );

    if (response.ok) {
      const result = await response.json();
      if (result.exists) {
        existingOrderNumbers.add(normalizedNumber);
        showEditOrderNumberWarning();
        return true;
      } else {
        clearEditOrderNumberWarning();
        return false;
      }
    }
  } catch (error) {
    console.error("Error checking edit order number:", error);
  }

  clearEditOrderNumberWarning();
  return false;
}

function showEditOrderNumberWarning() {
  const warning = document.getElementById("edit-order-number-warning");
  warning.classList.add("show");
}

function clearEditOrderNumberWarning() {
  const warning = document.getElementById("edit-order-number-warning");
  warning.classList.remove("show");
}

function renderEditOrderItems(items) {
  if (items.length === 0) {
    return '<div class="no-items-message">Chưa có mặt hàng nào trong đơn hàng</div>';
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

function loadAvailableItemsForEdit() {
  const container = document.getElementById("available-items-edit");

  if (availableItems.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        Không có mặt hàng nào có sẵn để thêm
      </div>
    `;
    return;
  }

  const existingItemIds = editingOrder.items.map((item) => item.itemId);
  const filteredAvailableItems = availableItems.filter(
    (item) => !existingItemIds.includes(item._id) && !item.isDeleted
  );

  if (filteredAvailableItems.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        Tất cả mặt hàng đã có trong đơn hàng
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

function addNewItemToOrder(itemId) {
  const item = availableItems.find((i) => i._id === itemId);

  if (!item) {
    showAlert("Không tìm thấy mặt hàng", "error");
    return;
  }

  const quantity =
    parseInt(document.getElementById(`new-qty-${itemId}`).value) || 1;

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

  document.getElementById("current-order-items").innerHTML =
    renderEditOrderItems(editingOrder.items);
  updateEditSummary();

  const itemElement = document
    .querySelector(`[onclick*="addNewItemToOrder('${itemId}')"]`)
    ?.closest(".item");
  if (itemElement) {
    itemElement.remove();
  }

  const container = document.getElementById("available-items-edit");
  const remainingItems = container.querySelectorAll(".item");
  if (remainingItems.length === 0) {
    container.innerHTML = `
      <div class="no-items-message">
        Tất cả mặt hàng đã có trong đơn hàng
      </div>
    `;
  }

  document.getElementById(`new-qty-${itemId}`).value = 1;
  showAlert(`Đã thêm ${quantity} ${item.name} vào đơn hàng`, "success");
}

function removeEditItem(index) {
  if (!confirm("Bạn có chắc chắn muốn xóa mặt hàng này khỏi đơn hàng?")) {
    return;
  }

  const removedItem = editingOrder.items[index];
  editingOrder.items.splice(index, 1);

  document.getElementById("current-order-items").innerHTML =
    renderEditOrderItems(editingOrder.items);
  updateEditSummary();

  loadAvailableItemsForEdit();
  showAlert(`Đã xóa ${removedItem.itemName} khỏi đơn hàng`, "success");
}

function calculateEditTotal() {
  if (!editingOrder || !editingOrder.items) return 0;
  return editingOrder.items.reduce(
    (sum, item) => sum + item.totalPriceAfterVAT,
    0
  );
}

function updateEditSummary() {
  const total = calculateEditTotal();
  document.getElementById("edit-summary-total").textContent =
    formatCurrency(total);
}

async function updateOrder() {
  if (!editingOrder || editingOrder.items.length === 0) {
    showAlert("Đơn hàng không thể trống", "error");
    return;
  }

  const notes = document.getElementById("edit-order-notes").value;
  const customOrderNumber = document
    .getElementById("edit-order-number-input")
    ?.value.trim();

  if (customOrderNumber && customOrderNumber !== editingOrder.orderNumber) {
    const exists = await checkEditOrderNumber(
      customOrderNumber,
      editingOrder.orderNumber
    );
    if (exists) {
      showAlert("Số đơn hàng đã tồn tại. Vui lòng chọn số khác.", "error");
      return;
    }
  }

  const itemsChanged =
    JSON.stringify(editingOrder.items) !== JSON.stringify(originalOrderItems);
  const notesChanged = notes !== editingOrder.notes;
  const orderNumberChanged =
    customOrderNumber && customOrderNumber !== editingOrder.orderNumber;

  if (!itemsChanged && !notesChanged && !orderNumberChanged) {
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
    customOrderNumber: orderNumberChanged ? customOrderNumber : undefined,
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

    if (orderNumberChanged) {
      existingOrderNumbers.delete(editingOrder.orderNumber.toUpperCase());
      existingOrderNumbers.add(customOrderNumber.toUpperCase());
    }

    fetchRecentOrders();
    closeEditModal();
  } catch (error) {
    showAlert("Lỗi cập nhật đơn hàng: " + error.message, "error");
  }
}

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
    fetchRecentOrders();
  } catch (error) {
    showAlert("Lỗi xóa đơn hàng: " + error.message, "error");
  }
}

function closeEditModal() {
  editingOrder = null;
  originalOrderItems = [];
  document.getElementById("edit-order-modal").style.display = "none";
}

// Khởi tạo
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("submit-order")
    .addEventListener("click", submitOrder);

  const orderNumberInput = document.getElementById("order-number-input");
  if (orderNumberInput) {
    let timeout;
    orderNumberInput.addEventListener("input", (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        checkOrderNumber(e.target.value);
      }, 500);
    });
  }

  const groupNameInput = document.getElementById("new-group-name");
  if (groupNameInput) {
    groupNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        createGroup();
      }
    });
  }

  fetchAvailableItems();
  fetchRecentOrders();
  loadExistingOrderNumbers();

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
