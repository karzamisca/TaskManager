//views\userPages\userSalaryRecord\userSalaryRecord.js
document.addEventListener("DOMContentLoaded", function () {
  // Initialize current date values
  const currentDate = new Date();
  document.getElementById("month-select").value = currentDate.getMonth() + 1;
  document.getElementById("year-input").value = currentDate.getFullYear();
  document.getElementById("salary-month").value = currentDate.getMonth() + 1;
  document.getElementById("salary-year").value = currentDate.getFullYear();

  // Load initial data
  loadCostCenters();
  loadUsers();
  loadSalaryRecords();

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
  document
    .getElementById("add-salary-record-form")
    .addEventListener("submit", addSalaryRecord);
  document
    .getElementById("salary-user")
    .addEventListener("change", populateBonusRates);

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
  document
    .getElementById("edit-salary-form")
    .addEventListener("submit", updateSalaryRecord);
});

// Global variables
let allUsers = [];
let allSalaryRecords = [];

// Data loading functions
async function loadCostCenters() {
  try {
    const res = await fetch("/userControlCostCenters");
    const costCenters = await res.json();
    const selects = [
      document.getElementById("cost-center-select"),
      document.getElementById("user-cost-center-filter"),
      document.getElementById("new-cost-center"),
      document.getElementById("edit-cost-center"),
    ];

    selects.forEach((select) => {
      if (!select) return;
      select.innerHTML = `<option value="all">Tất cả trạm/All Cost Centers</option>`;
      costCenters.forEach((cc) => {
        const option = document.createElement("option");
        option.value = cc._id;
        option.textContent = cc.name;
        select.appendChild(option);
      });

      if (select.id === "new-cost-center" || select.id === "edit-cost-center") {
        select.removeChild(select.querySelector('option[value="all"]'));
      }
    });
  } catch (err) {
    showError("Failed to load cost centers");
  }
}

async function loadUsers() {
  try {
    const res = await fetch("/userControl");
    allUsers = await res.json();
    renderUsers();
    populateUserDropdowns();
  } catch (err) {
    showError("Failed to load users");
  }
}

async function loadSalaryRecords() {
  try {
    const res = await fetch("/userSalaryRecords");
    allSalaryRecords = await res.json();
    renderSalaryRecords();
  } catch (err) {
    showError("Failed to load salary records");
  }
}

function populateUserDropdowns() {
  const userSelects = [
    document.getElementById("salary-user"),
    document.getElementById("edit-salary-user"),
  ];

  userSelects.forEach((select) => {
    if (!select) return;
    select.innerHTML = "";
    allUsers.forEach((user) => {
      const option = document.createElement("option");
      option.value = user._id;
      option.textContent = user.username;
      select.appendChild(option);
    });
  });

  if (allUsers.length > 0) {
    populateBonusRates();
  }
}

function populateBonusRates() {
  const userId = document.getElementById("salary-user").value;
  if (!userId) return;

  const selectedUser = allUsers.find((user) => user._id === userId);
  if (selectedUser) {
    document.getElementById("holiday-bonus-rate").value =
      selectedUser.holidayBonusPerDay;
    document.getElementById("night-shift-bonus-rate").value =
      selectedUser.nightShiftBonusPerDay;
  }
}

// Rendering functions
function applyFilters() {
  renderUsers();
  renderSalaryRecords();
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No users found</td></tr>`;
    return;
  }

  filtered.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.costCenter ? user.costCenter.name : "N/A"}</td>
      <td>${user.baseSalary.toLocaleString()}</td>
      <td>${user.holidayBonusPerDay.toLocaleString()}</td>
      <td>${user.nightShiftBonusPerDay.toLocaleString()}</td>
      <td>${user.socialInsurance.toLocaleString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn" onclick="editUser('${user._id}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteUser('${
            user._id
          }')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderSalaryRecords() {
  const costCenterId = document.getElementById("cost-center-select").value;
  const month = parseInt(document.getElementById("month-select").value);
  const year = parseInt(document.getElementById("year-input").value);
  const tbody = document.querySelector("#userSalaryRecords-table tbody");
  tbody.innerHTML = "";

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const filtered = allSalaryRecords.filter((record) => {
    const matchCostCenter =
      costCenterId === "all" ||
      (record.costCenter && record.costCenter._id === costCenterId);
    const matchMonth = !month || record.month === month;
    const matchYear = !year || record.year === year;
    return matchCostCenter && matchMonth && matchYear;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No records found</td></tr>`;
    return;
  }

  filtered.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${
        record.username || (record.user ? record.user.username : "Unknown")
      }</td>
      <td>${record.costCenterName || "N/A"}</td>
      <td>${monthNames[record.month - 1]} ${record.year}</td>
      <td>${record.holidayDays}</td>
      <td>${record.nightShiftDays}</td>
      <td>${
        record.holidayBonusRate
          ? record.holidayBonusRate.toLocaleString()
          : "N/A"
      }</td>
      <td>${
        record.nightShiftBonusRate
          ? record.nightShiftBonusRate.toLocaleString()
          : "N/A"
      }</td>
      <td>${record.totalSalary.toLocaleString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn" onclick="editSalaryRecord('${
            record._id
          }')">Edit</button>
          <button class="btn btn-danger" onclick="deleteSalaryRecord('${
            record._id
          }')">Delete</button>
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
    baseSalary: parseFloat(document.getElementById("new-base-salary").value),
    holidayBonusPerDay: parseFloat(
      document.getElementById("new-holiday-bonus").value
    ),
    nightShiftBonusPerDay: parseFloat(
      document.getElementById("new-night-shift-bonus").value
    ),
    socialInsurance: parseFloat(
      document.getElementById("new-social-insurance").value
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

async function addSalaryRecord(e) {
  e.preventDefault();
  const userId = document.getElementById("salary-user").value;
  const month = parseInt(document.getElementById("salary-month").value);
  const year = parseInt(document.getElementById("salary-year").value);
  const holidayDays = parseInt(document.getElementById("holiday-days").value);
  const nightShiftDays = parseInt(
    document.getElementById("night-shift-days").value
  );
  const holidayBonusRate = parseFloat(
    document.getElementById("holiday-bonus-rate").value
  );
  const nightShiftBonusRate = parseFloat(
    document.getElementById("night-shift-bonus-rate").value
  );

  const selectedUser = allUsers.find((user) => user._id === userId);
  if (!selectedUser) {
    showError("Selected user not found");
    return;
  }

  const salaryRecord = {
    user: userId,
    month,
    year,
    holidayDays,
    nightShiftDays,
    holidayBonusRate,
    nightShiftBonusRate,
    totalSalary:
      selectedUser.baseSalary +
      holidayDays * holidayBonusRate +
      nightShiftDays * nightShiftBonusRate -
      selectedUser.socialInsurance,
  };

  try {
    const response = await fetch("/userSalaryRecords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(salaryRecord),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add salary record");
    }

    document.getElementById("add-salary-record-form").reset();
    document.getElementById("salary-month").value = new Date().getMonth() + 1;
    document.getElementById("salary-year").value = new Date().getFullYear();
    showSuccess("Salary record added successfully!");
    loadSalaryRecords();
  } catch (err) {
    showError(err.message || "Error adding salary record");
  }
}

async function editUser(id) {
  const user = allUsers.find((u) => u._id === id);
  if (!user) return;

  document.getElementById("edit-user-id").value = user._id;
  document.getElementById("edit-username").value = user.username;
  document.getElementById("edit-base-salary").value = user.baseSalary;
  document.getElementById("edit-holiday-bonus").value = user.holidayBonusPerDay;
  document.getElementById("edit-night-shift-bonus").value =
    user.nightShiftBonusPerDay;
  document.getElementById("edit-social-insurance").value = user.socialInsurance;

  // Set the correct cost center
  const costCenterSelect = document.getElementById("edit-cost-center");
  if (user.costCenter) {
    Array.from(costCenterSelect.options).forEach((option) => {
      option.selected = option.value === user.costCenter._id;
    });
  }

  document.getElementById("edit-user-modal").style.display = "block";
}

async function updateUser(e) {
  e.preventDefault();
  const userId = document.getElementById("edit-user-id").value;
  const userData = {
    username: document.getElementById("edit-username").value,
    costCenter: document.getElementById("edit-cost-center").value,
    baseSalary: parseFloat(document.getElementById("edit-base-salary").value),
    holidayBonusPerDay: parseFloat(
      document.getElementById("edit-holiday-bonus").value
    ),
    nightShiftBonusPerDay: parseFloat(
      document.getElementById("edit-night-shift-bonus").value
    ),
    socialInsurance: parseFloat(
      document.getElementById("edit-social-insurance").value
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

async function editSalaryRecord(id) {
  const record = allSalaryRecords.find((r) => r._id === id);
  if (!record) return;

  document.getElementById("edit-salary-id").value = record._id;
  document.getElementById("edit-salary-month").value = record.month;
  document.getElementById("edit-salary-year").value = record.year;
  document.getElementById("edit-holiday-days").value = record.holidayDays;
  document.getElementById("edit-night-shift-days").value =
    record.nightShiftDays;
  document.getElementById("edit-holiday-bonus-rate").value =
    record.holidayBonusRate;
  document.getElementById("edit-night-shift-bonus-rate").value =
    record.nightShiftBonusRate;

  // Set the correct user
  const userSelect = document.getElementById("edit-salary-user");
  if (record.user) {
    Array.from(userSelect.options).forEach((option) => {
      option.selected = option.value === (record.user._id || record.user);
    });
  }

  document.getElementById("edit-salary-modal").style.display = "block";
}

async function updateSalaryRecord(e) {
  e.preventDefault();
  const recordId = document.getElementById("edit-salary-id").value;
  const salaryRecord = {
    user: document.getElementById("edit-salary-user").value,
    month: parseInt(document.getElementById("edit-salary-month").value),
    year: parseInt(document.getElementById("edit-salary-year").value),
    holidayDays: parseInt(document.getElementById("edit-holiday-days").value),
    nightShiftDays: parseInt(
      document.getElementById("edit-night-shift-days").value
    ),
    holidayBonusRate: parseFloat(
      document.getElementById("edit-holiday-bonus-rate").value
    ),
    nightShiftBonusRate: parseFloat(
      document.getElementById("edit-night-shift-bonus-rate").value
    ),
  };

  // Calculate total salary
  const user = allUsers.find((u) => u._id === salaryRecord.user);
  if (user) {
    salaryRecord.totalSalary =
      user.baseSalary +
      salaryRecord.holidayDays * salaryRecord.holidayBonusRate +
      salaryRecord.nightShiftDays * salaryRecord.nightShiftBonusRate -
      user.socialInsurance;
  }

  try {
    const response = await fetch(`/userSalaryRecords/${recordId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(salaryRecord),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update salary record");
    }

    document.getElementById("edit-salary-modal").style.display = "none";
    showSuccess("Salary record updated successfully!");
    loadSalaryRecords();
  } catch (err) {
    showError(err.message || "Error updating salary record");
  }
}

async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;

  try {
    const response = await fetch(`/userControl/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete user");

    showSuccess("User deleted successfully!");
    loadUsers();
    loadSalaryRecords();
  } catch (err) {
    showError(err.message);
  }
}

async function deleteSalaryRecord(id) {
  if (!confirm("Delete this salary record?")) return;

  try {
    const response = await fetch(`/userSalaryRecords/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete salary record");

    showSuccess("Salary record deleted successfully!");
    loadSalaryRecords();
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
