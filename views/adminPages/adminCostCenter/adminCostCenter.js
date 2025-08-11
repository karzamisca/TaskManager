//views/adminPages/adminCostCenter/adminCostCenter.js
// Utility functions
const showNotification = (message, type = "success") => {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
                <i class="fas fa-${
                  type === "success" ? "check-circle" : "exclamation-circle"
                }"></i>
                ${message}
            `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
};

const showLoading = (button) => {
  const originalText = button.innerHTML;
  button.innerHTML = '<span class="loading"></span> Loading...';
  button.disabled = true;
  return () => {
    button.innerHTML = originalText;
    button.disabled = false;
  };
};

// Fetch all existing cost centers and render them on page load
window.onload = function () {
  fetch("/getCostCenterAdmin")
    .then((response) => response.json())
    .then((data) => renderCostCenters(data))
    .catch((error) => {
      console.error("Error fetching cost centers:", error);
      showNotification("Error loading cost centers", "error");
    });
};

const renderCostCenters = (costCenters) => {
  const tableBody = document.querySelector("#costCentersTable tbody");
  tableBody.innerHTML = "";

  if (costCenters.length === 0) {
    tableBody.innerHTML = `
                    <tr>
                        <td colspan="3" class="empty-state">
                            <i class="fas fa-folder-open"></i><br>
                            No cost centers found. Add one to get started.
                        </td>
                    </tr>
                `;
    return;
  }

  costCenters.forEach((costCenter) => {
    const row = document.createElement("tr");

    // Name column
    const nameCell = document.createElement("td");
    nameCell.innerHTML = `<strong>${costCenter.name}</strong>`;
    row.appendChild(nameCell);

    // Allowed users column
    const usersCell = document.createElement("td");
    if (costCenter.allowedUsers.length === 0) {
      usersCell.innerHTML =
        '<span class="empty-state">Tất cả người dùng được truy cập</span>';
    } else {
      const userTags = costCenter.allowedUsers
        .map((user) => `<span class="user-tag">${user}</span>`)
        .join("");
      usersCell.innerHTML = `<div class="user-tags">${userTags}</div>`;
    }
    row.appendChild(usersCell);

    // Actions column
    const actionsCell = document.createElement("td");
    actionsCell.innerHTML = `
                    <div class="actions">
                        <button class="btn btn-primary btn-sm" onclick="editCostCenter('${
                          costCenter._id
                        }', '${
      costCenter.name
    }', '${costCenter.allowedUsers.join(", ")}')">
                            <i class="fas fa-edit"></i> Sửa
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCostCenter('${
                          costCenter._id
                        }')">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
                    </div>
                `;
    row.appendChild(actionsCell);

    tableBody.appendChild(row);
  });
};

// Add a new cost center
document
  .getElementById("addCostCenterForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    const hideLoading = showLoading(submitButton);

    const name = document.getElementById("name").value;
    const allowedUsers = document.getElementById("allowedUsers").value;

    fetch("/addCostCenter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `name=${encodeURIComponent(name)}&allowedUsers=${encodeURIComponent(
        allowedUsers
      )}`,
    })
      .then((response) => {
        hideLoading();
        if (response.redirected) {
          showNotification("Cost center added successfully!");
          document.getElementById("addCostCenterForm").reset();
          window.location.reload();
        } else {
          showNotification("Error adding cost center", "error");
        }
      })
      .catch((error) => {
        hideLoading();
        console.error("Error adding cost center:", error);
        showNotification("Error adding cost center", "error");
      });
  });

// Edit an existing cost center
const editCostCenter = (id, name, allowedUsers) => {
  document.getElementById("editName").value = name;
  const usersArray = allowedUsers
    ? allowedUsers.split(", ").filter((user) => user.trim())
    : [];

  const allowedUsersContainer = document.getElementById(
    "allowedUsersContainer"
  );
  allowedUsersContainer.innerHTML = "";

  // Always add at least one input field for better UX
  if (usersArray.length === 0) {
    addUserInput();
  } else {
    usersArray.forEach((user) => addUserInput(user));
  }

  const form = document.getElementById("editForm");
  form.onsubmit = function (event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    const hideLoading = showLoading(submitButton);

    const formData = new FormData(form);
    const name = formData.get("name");
    const allowedUsers = Array.from(formData.getAll("allowedUsers[]"))
      .map((user) => user.trim())
      .filter((user) => user !== ""); // Remove empty strings

    // Send empty string when no users (represents "all users allowed")
    const allowedUsersString =
      allowedUsers.length === 0 ? "" : allowedUsers.join(",");

    fetch(`/editCostCenter/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `name=${encodeURIComponent(name)}&allowedUsers=${encodeURIComponent(
        allowedUsersString
      )}`,
    })
      .then((response) => {
        hideLoading();
        if (response.redirected) {
          showNotification("Cost center updated successfully!");
          closeModal();
          window.location.reload();
        } else {
          showNotification("Error updating cost center", "error");
        }
      })
      .catch((error) => {
        hideLoading();
        console.error("Error updating cost center:", error);
        showNotification("Error updating cost center", "error");
      });
  };

  document.getElementById("editModal").classList.add("show");
};

// Delete a cost center
const deleteCostCenter = (id) => {
  if (confirm("Bạn có chắc muốn xóa trạm này?")) {
    fetch(`/deleteCostCenter/${id}`, { method: "DELETE" })
      .then((response) => response.json())
      .then((data) => {
        if (data.message === "Cost Center deleted successfully") {
          showNotification("Cost center deleted successfully!");
          window.location.reload();
        } else {
          showNotification("Error deleting cost center", "error");
        }
      })
      .catch((error) => {
        console.error("Error deleting cost center:", error);
        showNotification("Error deleting cost center", "error");
      });
  }
};

// Add a new input field for an allowed user
const addUserInput = (user = "") => {
  const container = document.getElementById("allowedUsersContainer");
  const userInputGroup = document.createElement("div");
  userInputGroup.className = "user-input-group";
  userInputGroup.innerHTML = `
                <input type="text" name="allowedUsers[]" value="${user}" class="form-input" placeholder="Nhập người dùng..." />
                <button type="button" class="btn btn-danger btn-sm" onclick="removeUserInput(this)">
                    <i class="fas fa-times"></i>
                </button>
            `;
  container.appendChild(userInputGroup);
};

// Remove an input field
const removeUserInput = (button) => {
  button.parentElement.remove();
};

// Close the edit modal
const closeModal = () => {
  document.getElementById("editModal").classList.remove("show");
};

// Close modal when clicking outside
document
  .getElementById("editModal")
  .addEventListener("click", function (event) {
    if (event.target === this) {
      closeModal();
    }
  });
