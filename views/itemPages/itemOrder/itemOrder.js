// views/itemPages/itemOrder/itemOrder.js
// Global variables
let availableItems = [];
let cart = [];

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
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

// Fetch available items
async function fetchAvailableItems() {
  try {
    const response = await fetch("/itemManagementControl", {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to fetch items");

    availableItems = await response.json();
    renderAvailableItems();
  } catch (error) {
    showAlert("Error loading items: " + error.message, "error");
  }
}

// Render available items
function renderAvailableItems() {
  const container = document.getElementById("items-list");

  if (availableItems.length === 0) {
    container.innerHTML = `
                    <div class="empty-cart">
                        <h3>No items available</h3>
                        <p>All items might be deleted or no items exist</p>
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
                            <span>Code: ${item.code}</span>
                            <span>Price: ${formatCurrency(
                              item.unitPrice
                            )}</span>
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
                                onchange="updateCartItem('${
                                  item._id
                                }', this.value)"
                            >
                            <button class="quantity-btn" onclick="increaseQuantity('${
                              item._id
                            }')">+</button>
                        </div>
                        <button class="add-btn" onclick="addToCart('${
                          item._id
                        }')">
                            Add
                        </button>
                    </div>
                </div>
            `
    )
    .join("");
}

// Quantity controls
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

// Cart functions
function addToCart(itemId) {
  const quantity =
    parseInt(document.getElementById(`qty-${itemId}`).value) || 1;
  const item = availableItems.find((i) => i._id === itemId);

  if (!item) return;

  // Check if item already in cart
  const existingIndex = cart.findIndex(
    (cartItem) => cartItem.itemId === itemId
  );

  if (existingIndex > -1) {
    // Update quantity
    cart[existingIndex].quantity += quantity;
    cart[existingIndex].totalPrice =
      cart[existingIndex].quantity * item.unitPrice;
  } else {
    // Add new item
    cart.push({
      itemId: itemId,
      itemName: item.name,
      itemCode: item.code,
      unitPrice: item.unitPrice,
      quantity: quantity,
      totalPrice: quantity * item.unitPrice,
    });
  }

  updateCart();
  showAlert(`Added ${quantity} ${item.name} to cart`, "success");

  // Reset quantity input
  document.getElementById(`qty-${itemId}`).value = 1;
}

function updateCartItem(itemId, quantity) {
  const qty = parseInt(quantity) || 1;
  const item = cart.find((cartItem) => cartItem.itemId === itemId);

  if (item) {
    item.quantity = qty;
    item.totalPrice = qty * item.unitPrice;
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

  // Calculate cart total
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  document.getElementById("items-total").textContent =
    formatCurrency(cartTotal);
  document.getElementById("cart-summary-total").textContent =
    formatCurrency(cartTotal);

  // Enable/disable submit button
  document.getElementById("submit-order").disabled = cart.length === 0;

  if (cart.length === 0) {
    // Show empty cart message
    if (emptyCart) {
      emptyCart.style.display = "block";
    }
    if (cartSummary) {
      cartSummary.style.display = "none";
    }
    // Clear cart items container but keep empty cart div
    const emptyCartDiv = cartItemsContainer.querySelector(".empty-cart");
    cartItemsContainer.innerHTML = "";
    if (emptyCartDiv) {
      cartItemsContainer.appendChild(emptyCartDiv);
    }
  } else {
    // Hide empty cart message
    if (emptyCart) {
      emptyCart.style.display = "none";
    }
    if (cartSummary) {
      cartSummary.style.display = "block";
    }

    // Render cart items
    cartItemsContainer.innerHTML = cart
      .map(
        (item) => `
                    <div class="cart-item">
                        <div class="cart-item-info">
                            <h4>${item.itemName}</h4>
                            <div class="cart-item-details">
                                <span>Code: ${item.itemCode}</span> • 
                                <span>Price: ${formatCurrency(
                                  item.unitPrice
                                )}</span> • 
                                <span>Qty: ${item.quantity}</span>
                            </div>
                        </div>
                        <div class="cart-item-actions">
                            <span>${formatCurrency(item.totalPrice)}</span>
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

// Submit order
async function submitOrder() {
  if (cart.length === 0) {
    showAlert("Your cart is empty", "error");
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
      throw new Error(result.error || "Failed to submit order");
    }

    showAlert(
      "Order submitted successfully! Order #" + result.order.orderNumber,
      "success"
    );

    // Clear cart
    cart = [];
    updateCart();
    document.getElementById("order-notes").value = "";

    // Refresh recent orders
    fetchRecentOrders();
  } catch (error) {
    showAlert("Error submitting order: " + error.message, "error");
  }
}

// Fetch recent orders
async function fetchRecentOrders() {
  try {
    const response = await fetch("/itemOrderControl/my-orders", {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to fetch orders");

    const orders = await response.json();
    renderRecentOrders(orders);
  } catch (error) {
    console.error("Error loading recent orders:", error);
  }
}

// Render recent orders
function renderRecentOrders(orders) {
  const container = document.getElementById("recent-orders");

  if (orders.length === 0) {
    container.innerHTML = `
                    <div class="empty-cart">
                        <h3>No orders yet</h3>
                        <p>Your submitted orders will appear here</p>
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
                            <span class="order-number">Order #${
                              order.orderNumber
                            }</span>
                            <span style="margin-left: 10px; opacity: 0.8;">
                                ${order.formattedOrderDate}
                            </span>
                        </div>
                        <span class="order-status">
                            ${order.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="order-details">
                        <div>
                            <strong>Items:</strong> ${order.items.length}
                        </div>
                        <div>
                            <strong>Notes:</strong> ${order.notes || "None"}
                        </div>
                    </div>
                    <div class="order-total">
                        Total: ${formatCurrency(order.totalAmount)}
                    </div>
                    <div style="text-align: right; margin-top: 10px;">
                        <button class="view-order-btn" onclick="event.stopPropagation(); viewOrderDetails('${
                          order._id
                        }')">
                            View Details
                        </button>
                    </div>
                </div>
            `
    )
    .join("");
}

// View order details in modal
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
                            <span class="order-status">
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
                    <div class="detail-item">
                        <div class="detail-label">Items Count</div>
                        <div class="detail-value">${order.items.length}</div>
                    </div>
                </div>
                
                ${
                  order.notes
                    ? `
                <div class="detail-item" style="grid-column: 1 / -1; margin-top: 10px;">
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
  // Set up submit button
  document
    .getElementById("submit-order")
    .addEventListener("click", submitOrder);

  // Fetch initial data
  fetchAvailableItems();
  fetchRecentOrders();

  // Close modal when clicking outside
  window.onclick = (event) => {
    const modal = document.getElementById("order-modal");
    if (event.target === modal) {
      closeModal();
    }
  };

  // Close modal with ESC key
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
});
