//views\userPages\userSalaryRecord\userSalaryRecord.js
document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadCostCentersAndManagers();
  loadUsers();

  // Tab functionality
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", function () {
      document
        .querySelectorAll(".tab-pane")
        .forEach((tab) => tab.classList.remove("active"));
      document
        .querySelectorAll(".tab-button")
        .forEach((btn) => btn.classList.remove("active"));
      document
        .getElementById(this.getAttribute("data-tab"))
        .classList.add("active");
      this.classList.add("active");
    });
  });

  // Form submissions
  document
    .getElementById("filter-button")
    .addEventListener("click", applyFilters);
  document.getElementById("add-user-form").addEventListener("submit", addUser);

  // Modal functionality
  document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal").forEach((modal) => {
        modal.style.display = "none";
      });
    });
  });

  window.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal")) {
      event.target.style.display = "none";
    }
  });

  // Edit form submissions
  document
    .getElementById("edit-user-form")
    .addEventListener("submit", updateUser);
});

// Global variables
let allUsers = [];

// Data loading functions
async function loadCostCentersAndManagers() {
  try {
    // Load cost centers
    const costCentersRes = await fetch("/userControlCostCenters");
    const costCenters = await costCentersRes.json();

    // Load managers
    const managersRes = await fetch("/userControlManagers");
    const managers = await managersRes.json();

    // Update cost center dropdowns
    const costCenterSelects = [
      document.getElementById("user-cost-center-filter"),
      document.getElementById("new-cost-center"),
      document.getElementById("edit-cost-center"),
    ];

    costCenterSelects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="all">All Cost Centers</option>';
      costCenters.forEach((cc) => {
        const option = document.createElement("option");
        option.value = cc._id;
        option.textContent = cc.name;
        select.appendChild(option);
      });
    });

    // Update manager dropdowns
    const managerSelects = [
      document.getElementById("new-assigned-manager"),
      document.getElementById("edit-assigned-manager"),
    ];

    managerSelects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="">None</option>';
      managers.forEach((manager) => {
        const option = document.createElement("option");
        option.value = manager._id;
        option.textContent = `${manager.username}`;
        select.appendChild(option);
      });
    });
  } catch (err) {
    showError("Failed to load data");
    console.error(err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch("/userControl");
    allUsers = await res.json();
    renderUsers();
  } catch (err) {
    showError("Failed to load users");
  }
}

// Rendering functions
function applyFilters() {
  renderUsers();
}

function renderUsers() {
  const filterCostCenterId = document.getElementById(
    "user-cost-center-filter"
  ).value;
  const tbody = document.querySelector("#users-table tbody");
  tbody.innerHTML = "";

  const filtered =
    filterCostCenterId === "all"
      ? allUsers
      : allUsers.filter(
          (u) => u.costCenter && u.costCenter._id === filterCostCenterId
        );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="17" style="text-align:center;">No users found</td></tr>`;
    return;
  }

  filtered.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.costCenter ? user.costCenter.name : "N/A"}</td>
      <td>${user.assignedManager ? user.assignedManager.username : "N/A"}</td>
      <td>${user.baseSalary.toLocaleString()}</td>
      <td>${user.commissionBonus.toLocaleString()}</td>
      <td>${user.currentHolidayDays}</td>
      <td>${user.currentNightShiftDays}</td>
      <td>${user.holidayBonusPerDay.toLocaleString()}</td>
      <td>${user.nightShiftBonusPerDay.toLocaleString()}</td>
      <td>${user.travelExpense.toLocaleString()}</td>
      <td>${user.grossSalary.toLocaleString()}</td>
      <td>${user.insurableSalary.toLocaleString()}</td>
      <td>${user.mandatoryInsurance.toLocaleString()}</td>
      <td>${user.dependantCount.toLocaleString()}</td>
      <td>${user.taxableIncome.toLocaleString()}</td>
      <td>${user.tax.toLocaleString()}</td>
      <td>${user.currentSalary.toLocaleString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn" onclick="editUser('${
            user._id
          }')">Chỉnh sửa/Edit</button>
          <button class="btn btn-danger" onclick="deleteUser('${
            user._id
          }')">Xóa/Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// CRUD Operations
async function addUser(e) {
  e.preventDefault();

  const newUser = {
    username: document.getElementById("new-username").value,
    costCenter: document.getElementById("new-cost-center").value,
    assignedManager:
      document.getElementById("new-assigned-manager").value || undefined,
    baseSalary: parseFloat(document.getElementById("new-base-salary").value),
    commissionBonus: parseFloat(
      document.getElementById("new-commission-bonus").value
    ),
    currentHolidayDays: parseInt(
      document.getElementById("new-holiday-days").value
    ),
    currentNightShiftDays: parseInt(
      document.getElementById("new-night-shift-days").value
    ),
    holidayBonusPerDay: parseFloat(
      document.getElementById("new-holiday-bonus").value
    ),
    nightShiftBonusPerDay: parseFloat(
      document.getElementById("new-night-shift-bonus").value
    ),
    travelExpense: parseFloat(
      document.getElementById("new-travel-expense").value
    ),
    insurableSalary: parseFloat(
      document.getElementById("new-insurable-salary").value
    ),
    dependantCount: parseInt(
      document.getElementById("new-dependant-count").value
    ),
  };

  try {
    const response = await fetch("/userControl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add user");
    }

    document.getElementById("add-user-form").reset();
    showSuccess("User added successfully!");
    loadUsers();
  } catch (err) {
    showError(err.message || "Error adding user");
  }
}

async function editUser(id) {
  const user = allUsers.find((u) => u._id === id);
  if (!user) return;

  document.getElementById("edit-user-id").value = user._id;
  document.getElementById("edit-username").value = user.username;
  document.getElementById("edit-base-salary").value = user.baseSalary;
  document.getElementById("edit-commission-bonus").value = user.commissionBonus;
  document.getElementById("edit-holiday-days").value = user.currentHolidayDays;
  document.getElementById("edit-night-shift-days").value =
    user.currentNightShiftDays;
  document.getElementById("edit-holiday-bonus").value = user.holidayBonusPerDay;
  document.getElementById("edit-night-shift-bonus").value =
    user.nightShiftBonusPerDay;
  document.getElementById("edit-travel-expense").value = user.travelExpense;
  document.getElementById("edit-insurable-salary").value = user.insurableSalary;
  document.getElementById("edit-dependant-count").value = user.dependantCount;

  // Set the correct cost center
  const costCenterSelect = document.getElementById("edit-cost-center");
  if (user.costCenter) {
    Array.from(costCenterSelect.options).forEach((option) => {
      option.selected = option.value === user.costCenter._id;
    });
  }

  const assignedManagerSelect = document.getElementById(
    "edit-assigned-manager"
  );
  if (user.assignedManager) {
    Array.from(assignedManagerSelect.options).forEach((option) => {
      option.selected = option.value === user.assignedManager._id;
    });
  } else {
    assignedManagerSelect.value = "";
  }

  document.getElementById("edit-user-modal").style.display = "block";
}

async function updateUser(e) {
  e.preventDefault();

  const userId = document.getElementById("edit-user-id").value;
  const userData = {
    username: document.getElementById("edit-username").value,
    costCenter: document.getElementById("edit-cost-center").value,
    assignedManager:
      document.getElementById("edit-assigned-manager").value || undefined,
    baseSalary: parseFloat(document.getElementById("edit-base-salary").value),
    commissionBonus: parseFloat(
      document.getElementById("edit-commission-bonus").value
    ),
    currentHolidayDays: parseInt(
      document.getElementById("edit-holiday-days").value
    ),
    currentNightShiftDays: parseInt(
      document.getElementById("edit-night-shift-days").value
    ),
    holidayBonusPerDay: parseFloat(
      document.getElementById("edit-holiday-bonus").value
    ),
    nightShiftBonusPerDay: parseFloat(
      document.getElementById("edit-night-shift-bonus").value
    ),
    travelExpense: parseFloat(
      document.getElementById("edit-travel-expense").value
    ),
    insurableSalary: parseFloat(
      document.getElementById("edit-insurable-salary").value
    ),
    dependantCount: parseInt(
      document.getElementById("edit-dependant-count").value
    ),
  };

  try {
    const response = await fetch(`/userControl/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update user");
    }

    document.getElementById("edit-user-modal").style.display = "none";
    showSuccess("User updated successfully!");
    loadUsers();
  } catch (err) {
    showError(err.message || "Error updating user");
  }
}

async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;

  try {
    const response = await fetch(`/userControl/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete user");
    showSuccess("User deleted successfully!");
    loadUsers();
  } catch (err) {
    showError(err.message);
  }
}

// Utility functions
function showSuccess(message) {
  const successEl =
    document.querySelector(".success-message") ||
    createMessageElement("success-message");
  successEl.textContent = message;
  successEl.style.display = "block";
  setTimeout(() => (successEl.style.display = "none"), 3000);
}

function showError(message) {
  const errorEl =
    document.querySelector(".error-message") ||
    createMessageElement("error-message");
  errorEl.textContent = message;
  errorEl.style.display = "block";
  setTimeout(() => (errorEl.style.display = "none"), 3000);
}

function createMessageElement(className) {
  const el = document.createElement("div");
  el.className = className;
  document.querySelector(".container").prepend(el);
  return el;
}
