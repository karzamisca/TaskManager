//views\userPages\userSalaryCalculation\userSalaryCalculation.js
let selectedUsers = new Set();
let currentFilteredUsers = [];

function toggleSelectUser(userId) {
  if (selectedUsers.has(userId)) {
    selectedUsers.delete(userId);
  } else {
    selectedUsers.add(userId);
  }
}

function toggleSelectAll() {
  const selectAllToggle = document.getElementById("select-all-toggle");
  const allSelected = selectedUsers.size === currentFilteredUsers.length;

  if (allSelected) {
    // Deselect all
    selectedUsers.clear();
    selectAllToggle.checked = false;
  } else {
    // Select all filtered users
    currentFilteredUsers.forEach((user) => selectedUsers.add(user._id));
    selectAllToggle.checked = true;
  }
  renderUsers();
}

async function exportToExcel() {
  if (selectedUsers.size === 0) {
    showError("Vui lòng chọn ít nhất một nhân viên để xuất");
    return;
  }

  const usersToExport = allUsers.filter((user) => selectedUsers.has(user._id));

  // Helper function to safely format numbers
  const safeFormat = (value) => {
    return value !== null && value !== undefined ? value : 0;
  };

  // Helper function to calculate optimal column width
  const calculateColumnWidth = (data, columnIndex, header) => {
    const headerLength = header.length;
    const maxDataLength = Math.max(
      ...data.map((row) => {
        const cellValue = row[columnIndex];
        if (typeof cellValue === "object" && cellValue.v) {
          return cellValue.v.toString().length;
        }
        return cellValue ? cellValue.toString().length : 0;
      })
    );

    // Return the maximum between header length and data length, with some padding
    const optimalWidth = Math.max(headerLength, maxDataLength) + 2;

    // Set minimum and maximum bounds for column width
    return Math.min(Math.max(optimalWidth, 8), 35);
  };

  // Define headers in Vietnamese
  const headers = [
    "Tên đăng nhập",
    "Tên thật",
    "Trạm",
    "Người quản lý",
    "Ngân hàng",
    "Số tài khoản",
    "Căn cước công dân",
    "Lương cơ bản",
    "Lương theo giờ",
    "Hoa hồng",
    "Trách nhiệm",
    "Giờ tăng ca trong tuần",
    "Giờ tăng ca Chủ Nhật",
    "Giờ tăng ca ngày lễ",
    "Lương tăng ca",
    "Công tác phí",
    "Tổng lương",
    "Lương đóng bảo hiểm",
    "Bảo hiểm bắt buộc",
    "Số người phụ thuộc",
    "Thu nhập tính thuế",
    "Thuế thu nhập",
    "Lương thực lĩnh",
  ];

  // Prepare the data
  const data = usersToExport.map((user) => [
    user.username,
    user.realName,
    user.costCenter ? user.costCenter.name : "Chưa có",
    user.assignedManager ? user.assignedManager.username : "Chưa có",
    user.beneficiaryBank || "Chưa có",
    {
      t: "s",
      v: user.bankAccountNumber ? user.bankAccountNumber.toString() : "Chưa có",
    }, // Force string type
    { t: "s", v: user.citizenID ? user.citizenID.toString() : "Chưa có" }, // Force string type
    safeFormat(user.baseSalary),
    safeFormat(user.hourlyWage),
    safeFormat(user.commissionBonus),
    safeFormat(user.responsibility),
    safeFormat(user.weekdayOvertimeHour),
    safeFormat(user.weekendOvertimeHour),
    safeFormat(user.holidayOvertimeHour),
    safeFormat(user.overtimePay),
    safeFormat(user.travelExpense),
    safeFormat(user.grossSalary),
    safeFormat(user.insurableSalary),
    safeFormat(user.mandatoryInsurance),
    safeFormat(user.dependantCount),
    safeFormat(user.taxableIncome),
    safeFormat(user.tax),
    safeFormat(user.currentSalary),
  ]);

  // Create a worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Calculate dynamic column widths
  const columnWidths = headers.map((header, index) => ({
    wch: calculateColumnWidth(data, index, header),
  }));

  // Set dynamic column widths
  ws["!cols"] = columnWidths;

  // Set row heights for better readability
  const rowHeights = [];
  // Header row height
  rowHeights.push({ hpt: 25 });
  // Data rows height
  for (let i = 0; i < data.length; i++) {
    rowHeights.push({ hpt: 20 });
  }
  ws["!rows"] = rowHeights;

  // Apply styling to header row
  const headerRange = XLSX.utils.decode_range(ws["!ref"]);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      font: { bold: true, sz: 11 },
      fill: { fgColor: { rgb: "E6E6FA" } }, // Light lavender background
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  // Apply styling to data rows
  for (let row = 1; row <= data.length; row++) {
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        alignment: { horizontal: "left", vertical: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };

      // Right-align numeric columns
      if (col >= 7) {
        // Numeric columns start from index 7
        ws[cellAddress].s.alignment.horizontal = "right";
      }
    }
  }

  // Auto-filter for the data
  ws["!autofilter"] = { ref: ws["!ref"] };

  // Freeze the header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Create a workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bảng lương");

  // Generate Excel file and download
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bang_luong_${date}.xlsx`);
}

document.addEventListener("DOMContentLoaded", function () {
  // Load initial data
  loadCostCentersAndManagers();
  loadUsers();

  document
    .getElementById("select-all-toggle")
    .addEventListener("change", toggleSelectAll);

  document
    .getElementById("export-xlsx-btn")
    .addEventListener("click", exportToExcel);

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

  currentFilteredUsers = [...allUsers];

  // Apply cost center filter
  if (filterCostCenterId !== "all") {
    currentFilteredUsers = currentFilteredUsers.filter(
      (u) => u.costCenter && u.costCenter._id === filterCostCenterId
    );
  }

  // Apply manager filter
  if (filterManagerId !== "all") {
    currentFilteredUsers = currentFilteredUsers.filter(
      (u) =>
        (filterManagerId === "none" && !u.assignedManager) ||
        (u.assignedManager && u.assignedManager._id === filterManagerId)
    );
  }

  if (currentFilteredUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="24" style="text-align:center;">Không tìm thấy nhân viên nào</td></tr>`;
    return;
  }

  const selectAllToggle = document.getElementById("select-all-toggle");
  if (currentFilteredUsers.length > 0) {
    const allSelected = currentFilteredUsers.every((user) =>
      selectedUsers.has(user._id)
    );
    selectAllToggle.checked = allSelected;
    selectAllToggle.disabled = false;
  } else {
    selectAllToggle.checked = false;
    selectAllToggle.disabled = true;
  }

  currentFilteredUsers.forEach((user) => {
    const formatNumber = (value) => {
      return value !== null && value !== undefined
        ? value.toLocaleString()
        : "0";
    };

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="checkbox-cell">
        <input type="checkbox" ${
          selectedUsers.has(user._id) ? "checked" : ""
        } onchange="toggleSelectUser('${user._id}')">
      </td>
      <td>${user.username}</td>
      <td>${user.realName}</td>
      <td>${user.costCenter ? user.costCenter.name : "Chưa có"}</td>
      <td>${
        user.assignedManager ? user.assignedManager.username : "Chưa có"
      }</td>
      <td>${user.beneficiaryBank || "Chưa có"}</td>
      <td>${user.bankAccountNumber || "Chưa có"}</td>
      <td>${user.citizenID || "Chưa có"}</td>
      <td>${formatNumber(user.baseSalary)}</td>
      <td>${formatNumber(user.hourlyWage)}</td>
      <td>${formatNumber(user.commissionBonus)}</td>
      <td>${formatNumber(user.responsibility)}</td>
      <td>${user.weekdayOvertimeHour || 0}</td>
      <td>${user.weekendOvertimeHour || 0}</td>
      <td>${user.holidayOvertimeHour || 0}</td>
      <td>${formatNumber(user.overtimePay)}</td>
      <td>${formatNumber(user.travelExpense)}</td>
      <td>${formatNumber(user.grossSalary)}</td>
      <td>${formatNumber(user.insurableSalary)}</td>
      <td>${formatNumber(user.mandatoryInsurance)}</td>
      <td>${user.dependantCount || 0}</td>
      <td>${formatNumber(user.taxableIncome)}</td>
      <td>${formatNumber(user.tax)}</td>
      <td>${formatNumber(user.currentSalary)}</td>
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
    realName: document.getElementById("new-real-name").value,
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
  document.getElementById("edit-real-name").value = user.realName;
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
    realName: document.getElementById("edit-real-name").value,
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
