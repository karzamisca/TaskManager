document.addEventListener("DOMContentLoaded", function () {
  const currentDate = new Date();
  document.getElementById("month-select").value = currentDate.getMonth() + 1;
  document.getElementById("year-input").value = currentDate.getFullYear();
  document.getElementById("salary-month").value = currentDate.getMonth() + 1;
  document.getElementById("salary-year").value = currentDate.getFullYear();

  loadCostCenters();
  loadUsers();
  loadSalaryRecords();

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
});

let allUsers = [];
let allSalaryRecords = [];

async function loadCostCenters() {
  try {
    const res = await fetch("/userControlCostCenters");
    const costCenters = await res.json();
    const selects = [
      document.getElementById("cost-center-select"),
      document.getElementById("user-cost-center-filter"),
      document.getElementById("new-cost-center"),
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
      if (select.id === "new-cost-center") {
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
    populateUserDropdown();
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

function populateUserDropdown() {
  const userSelect = document.getElementById("salary-user");
  userSelect.innerHTML = "";
  allUsers.forEach((user) => {
    const option = document.createElement("option");
    option.value = user._id;
    option.textContent = user.username;
    userSelect.appendChild(option);
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
      (record.user.costCenter && record.user.costCenter._id === costCenterId);
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
          <button class="btn btn-danger" onclick="deleteSalaryRecord('${
            record._id
          }')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newUser),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add user");
    }
    document.getElementById("add-user-form").reset();
    showSuccess("User added successfully!");
    loadUsers();
    document.querySelector('[data-tab="users"]').click();
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
  const baseSalary = selectedUser.baseSalary;
  const holidayBonus = holidayDays * holidayBonusRate;
  const nightShiftBonus = nightShiftDays * nightShiftBonusRate;
  const socialInsurance = selectedUser.socialInsurance;
  const totalSalary =
    baseSalary + holidayBonus + nightShiftBonus - socialInsurance;
  const salaryRecord = {
    user: userId,
    month,
    year,
    holidayDays,
    nightShiftDays,
    holidayBonusRate,
    nightShiftBonusRate,
    totalSalary,
  };
  try {
    const response = await fetch("/userSalaryRecords", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    document.querySelector('[data-tab="userSalaryRecords"]').click();
  } catch (err) {
    showError(err.message || "Error adding salary record");
  }
}

async function deleteUser(id) {
  if (!confirm("Xóa nhân viên/Delete this user?")) return;
  try {
    const response = await fetch(`/userControl/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete user");
    }
    loadUsers();
    loadSalaryRecords();
    showSuccess("User deleted successfully!");
  } catch (err) {
    showError(err.message);
  }
}

async function deleteSalaryRecord(id) {
  if (!confirm("Xóa bảng lương/Delete this salary record?")) return;
  try {
    const response = await fetch(`/userSalaryRecords/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete salary record");
    }
    loadSalaryRecords();
    showSuccess("Salary record deleted successfully!");
  } catch (err) {
    showError(err.message);
  }
}

function showSuccess(message) {
  let successEl = document.querySelector(".success-message");
  if (!successEl) {
    successEl = document.createElement("div");
    successEl.className = "success-message";
    document.querySelector(".container").prepend(successEl);
  }
  successEl.textContent = message;
  successEl.style.display = "block";
  setTimeout(() => {
    successEl.style.display = "none";
  }, 3000);
}

function showError(message) {
  let errorEl = document.querySelector(".error-message");
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.className = "error-message";
    document.querySelector(".container").prepend(errorEl);
  }
  errorEl.textContent = message;
  errorEl.style.display = "block";
  setTimeout(() => {
    errorEl.style.display = "none";
  }, 3000);
}
