// views/itemPages/itemManagement/itemManagement.js
let currentItemId = null;
let showDeleted = false;
let allItems = [];

// Get current user from cookie
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

// Show alert message
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

// Fetch all items
async function fetchItems() {
  try {
    const url = showDeleted
      ? "/itemManagementControl/all"
      : "/itemManagementControl";
    const response = await fetch(url, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch items");
    }

    allItems = await response.json();
    renderItems(allItems);
    document.getElementById("loading").style.display = "none";
    document.getElementById("items-table").style.display = "table";
  } catch (error) {
    showAlert("Error loading items: " + error.message, "error");
  }
}

// Render items table
function renderItems(items) {
  const tbody = document.getElementById("items-body");
  tbody.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("tr");
    if (item.isDeleted) {
      row.className = "deleted-item";
    }

    row.innerHTML = `
                    <td>${item.code}</td>
                    <td>${item.name}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>
                        <span class="status-badge ${
                          item.isDeleted ? "status-deleted" : "status-active"
                        }">
                            ${item.isDeleted ? "Deleted" : "Active"}
                        </span>
                    </td>
                    <td>${item.createdBy?.username || "Unknown"}</td>
                    <td>${formatDate(item.createdAt)}</td>
                    <td>
                        <div class="action-buttons">
                            ${
                              !item.isDeleted
                                ? `
                                <button onclick="showEditModal('${item._id}')" class="action-btn btn-primary">Edit</button>
                                <button onclick="showAuditHistory('${item._id}')" class="action-btn btn-secondary">History</button>
                                <button onclick="deleteItem('${item._id}')" class="action-btn btn-danger">Delete</button>
                            `
                                : `
                                <button onclick="restoreItem('${item._id}')" class="action-btn btn-success">Restore</button>
                                <button onclick="showAuditHistory('${item._id}')" class="action-btn btn-secondary">History</button>
                            `
                            }
                        </div>
                    </td>
                `;
    tbody.appendChild(row);
  });
}

// Search items
function searchItems() {
  const searchTerm = document.getElementById("search").value.toLowerCase();
  const filtered = allItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm) ||
      item.code.toLowerCase().includes(searchTerm)
  );
  renderItems(filtered);
}

// Toggle deleted items view
function toggleDeletedItems() {
  showDeleted = !showDeleted;
  const btn = document.querySelector(".btn-secondary");
  btn.textContent = showDeleted ? "Show Active Items" : "Show Deleted Items";
  fetchItems();
}

// Show add modal
function showAddModal() {
  document.getElementById("modal-title").textContent = "Add New Item";
  document.getElementById("item-form").reset();
  document.getElementById("item-id").value = "";
  document.getElementById("item-modal").style.display = "block";
}

// Show edit modal
async function showEditModal(itemId) {
  try {
    const response = await fetch(`/itemManagementControl/${itemId}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch item");
    }

    const item = await response.json();

    document.getElementById("modal-title").textContent = "Edit Item";
    document.getElementById("item-id").value = item._id;
    document.getElementById("code").value = item.code;
    document.getElementById("name").value = item.name;
    document.getElementById("unitPrice").value = item.unitPrice;
    document.getElementById("item-modal").style.display = "block";
  } catch (error) {
    showAlert("Error loading item: " + error.message, "error");
  }
}

// Show audit history
async function showAuditHistory(itemId) {
  try {
    const response = await fetch(`/itemManagementControl/${itemId}/audit`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch audit history");
    }

    const auditHistory = await response.json();

    const tbody = document.getElementById("audit-body");
    tbody.innerHTML = "";

    auditHistory.forEach((audit) => {
      const row = document.createElement("tr");

      // Format changes
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

      const priceChanges = audit.oldUnitPrice
        ? `<span class="old-value">${formatCurrency(
            audit.oldUnitPrice
          )}</span> → <span class="new-value">${formatCurrency(
            audit.newUnitPrice
          )}</span>`
        : `<span class="new-value">${formatCurrency(
            audit.newUnitPrice
          )}</span>`;

      row.innerHTML = `
                        <td>${formatDate(audit.editedAt)}</td>
                        <td><span class="status-badge ${getActionClass(
                          audit.action
                        )}">${audit.action}</span></td>
                        <td>${audit.editedBy?.username || "Unknown"}</td>
                        <td class="change-cell">${nameChanges}</td>
                        <td class="change-cell">${codeChanges}</td>
                        <td class="change-cell">${priceChanges}</td>
                    `;
      tbody.appendChild(row);
    });

    document.getElementById("audit-section").style.display = "block";
    document.getElementById("items-table").style.display = "none";
  } catch (error) {
    showAlert("Error loading audit history: " + error.message, "error");
  }
}

// Hide audit history
function hideAuditHistory() {
  document.getElementById("audit-section").style.display = "none";
  document.getElementById("items-table").style.display = "table";
}

// Handle form submission
async function handleSubmit(event) {
  event.preventDefault();

  const itemId = document.getElementById("item-id").value;
  const code = document.getElementById("code").value.trim();
  const name = document.getElementById("name").value.trim();
  const unitPrice = parseFloat(document.getElementById("unitPrice").value);

  const itemData = { code, name, unitPrice };

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
      throw new Error(error.error || "Failed to save item");
    }

    const result = await response.json();
    showAlert(`Item ${itemId ? "updated" : "created"} successfully!`);
    closeModal();
    fetchItems();
  } catch (error) {
    showAlert("Error: " + error.message, "error");
  }
}

// Delete item
async function deleteItem(itemId) {
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    const response = await fetch(`/itemManagementControl/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to delete item");
    }

    const result = await response.json();
    showAlert("Item deleted successfully!");
    fetchItems();
  } catch (error) {
    showAlert("Error deleting item: " + error.message, "error");
  }
}

// Restore item
async function restoreItem(itemId) {
  if (!confirm("Are you sure you want to restore this item?")) return;

  try {
    const response = await fetch(`/itemManagementControl/${itemId}/restore`, {
      method: "PATCH",
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to restore item");
    }

    const result = await response.json();
    showAlert("Item restored successfully!");
    fetchItems();
  } catch (error) {
    showAlert("Error restoring item: " + error.message, "error");
  }
}

// Close modal
function closeModal() {
  document.getElementById("item-modal").style.display = "none";
}

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (user) {
    document.getElementById("username").textContent = user.username;
  }
  fetchItems();

  // Close modal when clicking outside
  window.onclick = function (event) {
    const modal = document.getElementById("item-modal");
    if (event.target === modal) {
      closeModal();
    }
  };
});
