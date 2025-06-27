//views\userPages\userSalaryCalculation\userSalaryCalculation.js
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
      select.innerHTML = '<option value="all">Tất cả trạm</option>';
      costCenters.forEach((cc) => {
        const option = document.createElement("option");
        option.value = cc._id;
        option.textContent = cc.name;
        select.appendChild(option);
      });
    });

    // Update manager dropdowns
    const managerSelects = [
      document.getElementById("user-manager-filter"),
      document.getElementById("new-assigned-manager"),
      document.getElementById("edit-assigned-manager"),
    ];

    managerSelects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="all">Tất cả quản lý</option>';
      managers.forEach((manager) => {
        const option = document.createElement("option");
        option.value = manager._id;
        option.textContent = `${manager.username}`;
        select.appendChild(option);
      });

      // Add "No manager" option to the filter dropdown
      if (select.id === "user-manager-filter") {
        const noneOption = document.createElement("option");
        noneOption.value = "none";
        noneOption.textContent = "Không có quản lý";
        select.appendChild(noneOption);
      } else {
        // For other dropdowns (add/edit forms)
        const noneOption = document.createElement("option");
        noneOption.value = "";
        noneOption.textContent = "Không có";
        select.appendChild(noneOption);
      }
    });
  } catch (err) {
    showError("Không thể tải dữ liệu");
    console.error(err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch("/userControl");
    allUsers = await res.json();
    renderUsers();
  } catch (err) {
    showError("Không thể tải danh sách nhân viên");
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
  const filterManagerId = document.getElementById("user-manager-filter").value;
  const tbody = document.querySelector("#users-table tbody");
  tbody.innerHTML = "";

  let filtered = [...allUsers];

  // Apply cost center filter
  if (filterCostCenterId !== "all") {
    filtered = filtered.filter(
      (u) => u.costCenter && u.costCenter._id === filterCostCenterId
    );
  }

  // Apply manager filter
  if (filterManagerId !== "all") {
    filtered = filtered.filter(
      (u) =>
        (filterManagerId === "none" && !u.assignedManager) ||
        (u.assignedManager && u.assignedManager._id === filterManagerId)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="23" style="text-align:center;">Không tìm thấy nhân viên nào</td></tr>`;
    return;
  }

  filtered.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.costCenter ? user.costCenter.name : "Chưa có"}</td>
      <td>${
        user.assignedManager ? user.assignedManager.username : "Chưa có"
      }</td>
      <td>${user.beneficiaryBank || "Chưa có"}</td>
      <td>${user.bankAccountNumber || "Chưa có"}</td>
      <td>${user.citizenID || "Chưa có"}</td>
      <td>${user.baseSalary.toLocaleString()}</td>
      <td>${user.hourlyWage.toLocaleString()}</td>
      <td>${user.commissionBonus.toLocaleString()}</td>
      <td>${user.responsibility.toLocaleString()}</td>
      <td>${user.weekdayOvertimeHour}</td>
      <td>${user.weekendOvertimeHour}</td>
      <td>${user.holidayOvertimeHour}</td>
      <td>${user.overtimePay.toLocaleString()}</td>
      <td>${user.travelExpense.toLocaleString()}</td>
      <td>${user.grossSalary.toLocaleString()}</td>
      <td>${user.insurableSalary.toLocaleString()}</td>
      <td>${user.mandatoryInsurance.toLocaleString()}</td>
      <td>${user.dependantCount}</td>
      <td>${user.taxableIncome.toLocaleString()}</td>
      <td>${user.tax.toLocaleString()}</td>
      <td>${user.currentSalary.toLocaleString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn" onclick="editUser('${
            user._id
          }')">Chỉnh sửa</button>
          <button class="btn btn-danger" onclick="deleteUser('${
            user._id
          }')">Xóa</button>
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
    beneficiaryBank: document.getElementById("new-beneficiary-bank").value,
    bankAccountNumber: document.getElementById("new-bank-account-number").value,
    citizenID: document.getElementById("new-citizen-id").value,
    baseSalary: parseFloat(document.getElementById("new-base-salary").value),
    commissionBonus: parseFloat(
      document.getElementById("new-commission-bonus").value
    ),
    responsibility: parseFloat(
      document.getElementById("new-responsibility").value
    ),
    weekdayOvertimeHour: parseFloat(
      document.getElementById("new-weekday-overtime").value
    ),
    weekendOvertimeHour: parseFloat(
      document.getElementById("new-weekend-overtime").value
    ),
    holidayOvertimeHour: parseFloat(
      document.getElementById("new-holiday-overtime").value
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
      throw new Error(error.message || "Không thể thêm nhân viên");
    }

    document.getElementById("add-user-form").reset();
    showSuccess("Thêm nhân viên thành công!");
    loadUsers();
  } catch (err) {
    showError(err.message || "Lỗi khi thêm nhân viên");
  }
}

async function editUser(id) {
  const user = allUsers.find((u) => u._id === id);
  if (!user) return;

  document.getElementById("edit-user-id").value = user._id;
  document.getElementById("edit-username").value = user.username;
  document.getElementById("edit-beneficiary-bank").value =
    user.beneficiaryBank || "";
  document.getElementById("edit-bank-account-number").value =
    user.bankAccountNumber || "0";
  document.getElementById("edit-citizen-id").value = user.citizenID || "0";
  document.getElementById("edit-base-salary").value = user.baseSalary;
  document.getElementById("edit-commission-bonus").value = user.commissionBonus;
  document.getElementById("edit-responsibility").value = user.responsibility;
  document.getElementById("edit-weekday-overtime").value =
    user.weekdayOvertimeHour;
  document.getElementById("edit-weekend-overtime").value =
    user.weekendOvertimeHour;
  document.getElementById("edit-holiday-overtime").value =
    user.holidayOvertimeHour;
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
    beneficiaryBank: document.getElementById("edit-beneficiary-bank").value,
    bankAccountNumber: document.getElementById("edit-bank-account-number")
      .value,
    citizenID: document.getElementById("edit-citizen-id").value,
    commissionBonus: parseFloat(
      document.getElementById("edit-commission-bonus").value
    ),
    responsibility: parseFloat(
      document.getElementById("edit-responsibility").value
    ),
    weekdayOvertimeHour: parseFloat(
      document.getElementById("edit-weekday-overtime").value
    ),
    weekendOvertimeHour: parseFloat(
      document.getElementById("edit-weekend-overtime").value
    ),
    holidayOvertimeHour: parseFloat(
      document.getElementById("edit-holiday-overtime").value
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
      throw new Error(
        error.message || "Không thể cập nhật thông tin nhân viên"
      );
    }

    document.getElementById("edit-user-modal").style.display = "none";
    showSuccess("Cập nhật thông tin nhân viên thành công!");
    loadUsers();
  } catch (err) {
    showError(err.message || "Lỗi khi cập nhật thông tin nhân viên");
  }
}

async function deleteUser(id) {
  if (!confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) return;

  try {
    const response = await fetch(`/userControl/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Không thể xóa nhân viên");
    showSuccess("Xóa nhân viên thành công!");
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
