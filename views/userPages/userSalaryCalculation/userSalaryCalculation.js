// views/userPages/userSalaryCalculation/userSalaryCalculation.js
let selectedUsers = new Set();
let currentFilteredUsers = [];
let allUsers = [];
let currentHistoryData = null;
let currentHistoryUserId = null;
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentSortColumn = "costCenter";
let currentSortDirection = "asc";

function sortUsers(users, column, direction) {
  return [...users].sort((a, b) => {
    let valueA, valueB;

    switch (column) {
      case "costCenter":
        valueA = (a.costCenter?.name || "Chưa có").toLowerCase();
        valueB = (b.costCenter?.name || "Chưa có").toLowerCase();
        break;
      case "username":
        valueA = (a.username || "").toLowerCase();
        valueB = (b.username || "").toLowerCase();
        break;
      case "realName":
        valueA = (a.realName || "").toLowerCase();
        valueB = (b.realName || "").toLowerCase();
        break;
      case "email":
        valueA = (a.email || "").toLowerCase();
        valueB = (b.email || "").toLowerCase();
        break;
      case "manager":
        valueA = (a.assignedManager?.username || "Chưa có").toLowerCase();
        valueB = (b.assignedManager?.username || "Chưa có").toLowerCase();
        break;
      case "bank":
        valueA = (a.beneficiaryBank || "").toLowerCase();
        valueB = (b.beneficiaryBank || "").toLowerCase();
        break;
      case "baseSalary":
        valueA = a.baseSalary || 0;
        valueB = b.baseSalary || 0;
        break;
      case "grossSalary":
        valueA = a.grossSalary || 0;
        valueB = b.grossSalary || 0;
        break;
      case "currentSalary":
        valueA = a.currentSalary || 0;
        valueB = b.currentSalary || 0;
        break;
      default:
        return 0;
    }

    if (valueA < valueB) return direction === "asc" ? -1 : 1;
    if (valueA > valueB) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

function updateSortIndicators() {
  document
    .querySelectorAll("#users-table th .sort-indicator")
    .forEach((indicator) => {
      indicator.remove();
    });

  const th = document.querySelector(
    `#users-table th[data-sort="${currentSortColumn}"]`,
  );
  if (th) {
    const indicator = document.createElement("span");
    indicator.className = "sort-indicator";
    indicator.textContent = currentSortDirection === "asc" ? " ▲" : " ▼";
    indicator.style.fontSize = "12px";
    indicator.style.marginLeft = "5px";
    th.appendChild(indicator);
  }
}

function toggleSelectUser(userId) {
  if (selectedUsers.has(userId)) {
    selectedUsers.delete(userId);
  } else {
    selectedUsers.add(userId);
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  document.getElementById("selected-count").textContent = selectedUsers.size;
}

function toggleSelectAll() {
  const selectAllToggle = document.getElementById("select-all-toggle");
  const allSelected = selectedUsers.size === currentFilteredUsers.length;

  if (allSelected) {
    selectedUsers.clear();
    selectAllToggle.checked = false;
  } else {
    currentFilteredUsers.forEach((user) => selectedUsers.add(user._id));
    selectAllToggle.checked = true;
  }
  updateSelectedCount();
  renderUsers();
}

// Lock salary calculation for selected users
async function lockSalaryCalculation() {
  if (selectedUsers.size === 0) {
    showError("Vui lòng chọn ít nhất một nhân viên để khóa");
    return;
  }

  if (
    !confirm(
      `Bạn có chắc muốn KHÓA chỉnh sửa lương cho ${selectedUsers.size} nhân viên đã chọn?`,
    )
  ) {
    return;
  }

  const lockBtn = document.getElementById("lock-salary-btn");
  const originalText = lockBtn.textContent;
  lockBtn.textContent = "Đang xử lý...";
  lockBtn.disabled = true;

  try {
    const response = await fetch("/lockSalaryCalculation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: Array.from(selectedUsers),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Không thể khóa chỉnh sửa lương");
    }

    showSuccess(result.message);
    loadUsers();
  } catch (err) {
    showError(err.message || "Lỗi khi khóa chỉnh sửa lương");
  } finally {
    lockBtn.textContent = originalText;
    lockBtn.disabled = false;
  }
}

// Unlock salary calculation for selected users
async function unlockSalaryCalculation() {
  if (selectedUsers.size === 0) {
    showError("Vui lòng chọn ít nhất một nhân viên để mở khóa");
    return;
  }

  if (
    !confirm(
      `Bạn có chắc muốn MỞ KHÓA chỉnh sửa lương cho ${selectedUsers.size} nhân viên đã chọn?`,
    )
  ) {
    return;
  }

  const unlockBtn = document.getElementById("unlock-salary-btn");
  const originalText = unlockBtn.textContent;
  unlockBtn.textContent = "Đang xử lý...";
  unlockBtn.disabled = true;

  try {
    const response = await fetch("/unlockSalaryCalculation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: Array.from(selectedUsers),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Không thể mở khóa chỉnh sửa lương");
    }

    showSuccess(result.message);
    loadUsers();
  } catch (err) {
    showError(err.message || "Lỗi khi mở khóa chỉnh sửa lương");
  } finally {
    unlockBtn.textContent = originalText;
    unlockBtn.disabled = false;
  }
}

async function exportToExcel() {
  if (selectedUsers.size === 0) {
    showError("Vui lòng chọn ít nhất một nhân viên để xuất");
    return;
  }

  const usersToExport = allUsers.filter((user) => selectedUsers.has(user._id));

  usersToExport.sort((a, b) => {
    const costCenterA = (a.costCenter?.name || "Chưa có").toLowerCase();
    const costCenterB = (b.costCenter?.name || "Chưa có").toLowerCase();

    if (costCenterA < costCenterB) return -1;
    if (costCenterA > costCenterB) return 1;
    return 0;
  });

  const safeFormat = (value) => {
    return value !== null && value !== undefined ? value : 0;
  };

  const calculateColumnWidth = (data, columnIndex, header) => {
    const headerLength = header.length;
    const maxDataLength = Math.max(
      ...data.map((row) => {
        const cellValue = row[columnIndex];
        if (typeof cellValue === "object" && cellValue.v) {
          return cellValue.v.toString().length;
        }
        return cellValue ? cellValue.toString().length : 0;
      }),
    );

    const optimalWidth = Math.max(headerLength, maxDataLength) + 2;
    return Math.min(Math.max(optimalWidth, 8), 35);
  };

  const headers = [
    "Tên đăng nhập",
    "Tên thật",
    "Email",
    "Trạm",
    "Người quản lý",
    "Ngân hàng",
    "Số tài khoản",
    "Căn cước công dân",
    "Khóa chỉnh sửa",
    "Lương cơ bản",
    "Lương theo giờ",
    "Hoa hồng",
    "Thưởng khác",
    "Trách nhiệm",
    "Phụ cấp chung",
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

  const data = usersToExport.map((user) => [
    user.username,
    user.realName,
    user.email || "Chưa có",
    user.costCenter ? user.costCenter.name : "Chưa có",
    user.assignedManager ? user.assignedManager.username : "Chưa có",
    user.beneficiaryBank || "Chưa có",
    {
      t: "s",
      v: user.bankAccountNumber ? user.bankAccountNumber.toString() : "Chưa có",
    },
    { t: "s", v: user.citizenID ? user.citizenID.toString() : "Chưa có" },
    user.userSalaryCalculationLocked ? "Đã khóa" : "Mở",
    safeFormat(user.baseSalary),
    safeFormat(user.hourlyWage),
    safeFormat(user.commissionBonus),
    safeFormat(user.otherBonus),
    safeFormat(user.responsibility),
    safeFormat(user.allowanceGeneral || 0),
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

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  const columnWidths = headers.map((header, index) => ({
    wch: calculateColumnWidth(data, index, header),
  }));

  ws["!cols"] = columnWidths;

  const rowHeights = [];
  rowHeights.push({ hpt: 25 });
  for (let i = 0; i < data.length; i++) {
    rowHeights.push({ hpt: 20 });
  }
  ws["!rows"] = rowHeights;

  const headerRange = XLSX.utils.decode_range(ws["!ref"]);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      font: { bold: true, sz: 11 },
      fill: { fgColor: { rgb: "E6E6FA" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

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

      if (col >= 9) {
        ws[cellAddress].s.alignment.horizontal = "right";
      }
    }
  }

  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bảng lương");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bang_luong_${date}.xlsx`);

  showSuccess("Xuất Excel thành công!");
}

async function viewUserHistory(userId, username, realName) {
  try {
    currentHistoryUserId = userId;

    document.getElementById("history-user-name").textContent = realName;
    document.getElementById("history-username").textContent = username;
    document.getElementById("history-table-body").innerHTML = `
      <tr>
        <td colspan="22" style="text-align: center; padding: 20px;">
          Đang tải dữ liệu...
        </td>
      </tr>
    `;

    document.getElementById("user-history-modal").style.display = "block";

    const response = await fetch(`/userMonthlyRecords/${userId}`);

    if (!response.ok) {
      throw new Error("Không thể tải lịch sử lương");
    }

    const records = await response.json();
    currentHistoryData = records;

    renderHistoryTable(records);

    const exportBtn = document.getElementById("export-history-btn");
    if (records.length > 0) {
      exportBtn.style.display = "inline-block";
    } else {
      exportBtn.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading history:", error);
    document.getElementById("history-table-body").innerHTML = `
      <tr>
        <td colspan="22" style="text-align: center; color: #dc3545; padding: 20px;">
          Lỗi khi tải lịch sử: ${error.message}
        </td>
      </tr>
    `;
    document.getElementById("export-history-btn").style.display = "none";
  }
}

function renderHistoryTable(records) {
  const tbody = document.getElementById("history-table-body");

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="22" style="text-align: center; padding: 20px;">
          Không có dữ liệu lịch sử lương
        </td>
      </tr>
    `;
    return;
  }

  const formatNumber = (value) => {
    return value !== null && value !== undefined ? value.toLocaleString() : "0";
  };

  tbody.innerHTML = records
    .map(
      (record) => `
    <tr>
      <td style="text-align: center;">${record.recordMonth}</td>
      <td style="text-align: center;">${record.recordYear}</td>
      <td style="text-align: right;">${formatNumber(record.baseSalary)}</td>
      <td style="text-align: right;">${formatNumber(record.commissionBonus)}</td>
      <td style="text-align: right;">${formatNumber(record.responsibility)}</td>
      <td style="text-align: right;">${formatNumber(record.otherBonus)}</td>
      <td style="text-align: right;">${formatNumber(record.allowanceGeneral || 0)}</td>
      <td style="text-align: center;">${record.weekdayOvertimeHour || 0}</td>
      <td style="text-align: center;">${record.weekendOvertimeHour || 0}</td>
      <td style="text-align: center;">${record.holidayOvertimeHour || 0}</td>
      <td style="text-align: right;">${formatNumber(record.overtimePay)}</td>
      <td style="text-align: right;">${formatNumber(record.travelExpense)}</td>
      <td style="text-align: right; font-weight: bold;">${formatNumber(record.grossSalary)}</td>
      <td style="text-align: right; color: #dc3545;">${formatNumber(record.tax)}</td>
      <td style="text-align: right; font-weight: bold; color: #28a745;">${formatNumber(record.currentSalary)}</td>
      <td style="text-align: right;">${formatNumber(record.insurableSalary)}</td>
      <td style="text-align: right;">${formatNumber(record.mandatoryInsurance)}</td>
      <td style="text-align: center;">${record.dependantCount || 0}</td>
      <td style="text-align: right;">${formatNumber(record.taxableIncome)}</td>
      <td>${record.costCenter ? record.costCenter.name : "N/A"}</td>
      <td>${record.assignedManager ? record.assignedManager.username : "N/A"}</td>
      <td>${new Date(record.recordDate).toLocaleDateString("vi-VN")}</td>
    </tr>
  `,
    )
    .join("");
}

async function exportHistoryToExcel() {
  if (!currentHistoryData || currentHistoryData.length === 0) {
    showError("Không có dữ liệu để xuất");
    return;
  }

  const formatNumber = (value) => {
    return value !== null && value !== undefined ? value : 0;
  };

  const user = allUsers.find((u) => u._id === currentHistoryUserId);
  const userName = user ? user.realName : "N/A";
  const username = user ? user.username : "N/A";

  const headers = [
    "Tháng",
    "Năm",
    "Lương cơ bản",
    "Hoa hồng",
    "Trách nhiệm",
    "Thưởng khác",
    "Phụ cấp chung",
    "Giờ tăng ca trong tuần",
    "Giờ tăng ca Chủ Nhật",
    "Giờ tăng ca ngày lễ",
    "Lương tăng ca",
    "Công tác phí",
    "Lương gộp",
    "Thuế",
    "Lương thực lĩnh",
    "Lương đóng bảo hiểm",
    "Bảo hiểm bắt buộc",
    "Số người phụ thuộc",
    "Thu nhập tính thuế",
    "Trạm",
    "Người quản lý",
    "Ngày ghi nhận",
  ];

  const data = currentHistoryData.map((record) => [
    record.recordMonth,
    record.recordYear,
    formatNumber(record.baseSalary),
    formatNumber(record.commissionBonus),
    formatNumber(record.responsibility),
    formatNumber(record.otherBonus),
    formatNumber(record.allowanceGeneral || 0),
    formatNumber(record.weekdayOvertimeHour),
    formatNumber(record.weekendOvertimeHour),
    formatNumber(record.holidayOvertimeHour),
    formatNumber(record.overtimePay),
    formatNumber(record.travelExpense),
    formatNumber(record.grossSalary),
    formatNumber(record.tax),
    formatNumber(record.currentSalary),
    formatNumber(record.insurableSalary),
    formatNumber(record.mandatoryInsurance),
    formatNumber(record.dependantCount),
    formatNumber(record.taxableIncome),
    record.costCenter ? record.costCenter.name : "N/A",
    record.assignedManager ? record.assignedManager.username : "N/A",
    new Date(record.recordDate).toLocaleDateString("vi-VN"),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  const headerRange = XLSX.utils.decode_range(ws["!ref"]);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;

    ws[cellAddress].s = {
      font: { bold: true, sz: 11 },
      fill: { fgColor: { rgb: "E6E6FA" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lịch sử lương");

  const safeUserName = userName.replace(/[^\w\s]/gi, "").replace(/\s+/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `lich_su_luong_${safeUserName}_${date}.xlsx`);

  showSuccess("Xuất lịch sử lương thành công!");
}

async function sendSalaryEmails() {
  if (selectedUsers.size === 0) {
    showError("Vui lòng chọn ít nhất một nhân viên để gửi email");
    return;
  }

  const month = document.getElementById("send-month").value;
  const year = document.getElementById("send-year").value;

  if (!month || !year) {
    showError("Vui lòng chọn tháng và năm");
    return;
  }

  if (month < 1 || month > 12) {
    showError("Tháng phải từ 1 đến 12");
    return;
  }

  if (year < 2020 || year > 2030) {
    showError("Năm phải từ 2020 đến 2030");
    return;
  }

  if (
    !confirm(
      `Bạn có chắc muốn gửi bảng lương tháng ${month}/${year} cho ${selectedUsers.size} nhân viên đã chọn?`,
    )
  ) {
    return;
  }

  const sendBtn = document.getElementById("send-email-btn");
  const originalText = sendBtn.textContent;
  sendBtn.textContent = "Đang gửi...";
  sendBtn.disabled = true;

  try {
    const response = await fetch("/sendSalaryEmails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: Array.from(selectedUsers),
        month: parseInt(month),
        year: parseInt(year),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (response.status === 400 && result.usersWithoutEmail) {
        let errorMessage = result.message + "\n\n";
        result.usersWithoutEmail.forEach((user) => {
          errorMessage += `• ${user.name}\n`;
        });
        errorMessage +=
          "\nVui lòng cập nhật email cho các nhân viên trên trước khi gửi.";

        if (
          confirm(
            errorMessage + "\n\nBạn có muốn cập nhật email ngay bây giờ không?",
          )
        ) {
          const firstUser = allUsers.find(
            (u) => u._id === result.usersWithoutEmail[0].id,
          );
          if (firstUser) {
            editUser(firstUser._id);
          }
        }
        return;
      }
      throw new Error(result.message || "Không thể gửi email");
    }

    showEmailResults(result);
  } catch (err) {
    showError(err.message || "Lỗi khi gửi email");
  } finally {
    sendBtn.textContent = originalText;
    sendBtn.disabled = false;
  }
}

function showEmailResults(result) {
  const modal = document.getElementById("email-results-modal");
  const content = document.getElementById("email-results-content");

  let html = `
    <div style="margin-bottom: 20px;">
      <p style="font-size: 16px; margin-bottom: 10px;">
        <strong>Tổng kết:</strong> ${result.message}
      </p>
      <p><strong>Tổng số:</strong> ${result.total} nhân viên</p>
      <p><strong>Gửi thành công:</strong> <span class="email-status-success">${result.successful}</span></p>
      <p><strong>Gửi thất bại:</strong> <span class="email-status-failed">${result.failed}</span></p>
    </div>
  `;

  if (result.details && result.details.length > 0) {
    html += `
      <h3>Chi tiết:</h3>
      <div class="table-container">
        <table class="email-results-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Trạng thái</th>
              <th>Thông tin</th>
            </tr>
          </thead>
          <tbody>
    `;

    result.details.forEach((detail) => {
      const statusClass =
        detail.status === "success"
          ? "email-status-success"
          : detail.status === "failed"
            ? "email-status-failed"
            : "email-status-warning";

      html += `
        <tr>
          <td>${detail.realName} (${detail.username})</td>
          <td>${detail.email || "Không có"}</td>
          <td class="${statusClass}">${detail.status === "success" ? "Thành công" : "Thất bại"}</td>
          <td>${detail.reason || detail.messageId || ""}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  content.innerHTML = html;
  modal.style.display = "block";
}

document.addEventListener("DOMContentLoaded", function () {
  loadCostCentersAndManagers();
  loadUsers();

  document.getElementById("send-month").value = currentMonth;
  document.getElementById("send-year").value = currentYear;

  document
    .getElementById("select-all-toggle")
    .addEventListener("change", toggleSelectAll);

  document
    .getElementById("export-xlsx-btn")
    .addEventListener("click", exportToExcel);

  document
    .getElementById("export-history-btn")
    .addEventListener("click", exportHistoryToExcel);

  document
    .getElementById("lock-salary-btn")
    .addEventListener("click", lockSalaryCalculation);

  document
    .getElementById("unlock-salary-btn")
    .addEventListener("click", unlockSalaryCalculation);

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
    .getElementById("send-email-btn")
    .addEventListener("click", sendSalaryEmails);

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

  document
    .getElementById("edit-user-form")
    .addEventListener("submit", updateUser);

  document.querySelectorAll("#users-table th[data-sort]").forEach((th) => {
    th.addEventListener("click", function () {
      const sortColumn = this.getAttribute("data-sort");
      if (!sortColumn) return;

      if (currentSortColumn === sortColumn) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortColumn = sortColumn;
        currentSortDirection = "asc";
      }

      renderUsers();
    });
  });
});

async function loadCostCentersAndManagers() {
  try {
    const costCentersRes = await fetch("/userControlCostCenters");
    const costCenters = await costCentersRes.json();

    const managersRes = await fetch("/userControlManagers");
    const managers = await managersRes.json();

    const costCenterSelects = [
      document.getElementById("user-cost-center-filter"),
      document.getElementById("new-cost-center"),
      document.getElementById("edit-cost-center"),
    ];

    costCenterSelects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="">Chọn trạm</option>';
      costCenters.forEach((cc) => {
        const option = document.createElement("option");
        option.value = cc._id;
        option.textContent = cc.name;
        select.appendChild(option);
      });
    });

    const managerSelects = [
      document.getElementById("user-manager-filter"),
      document.getElementById("new-assigned-manager"),
      document.getElementById("edit-assigned-manager"),
    ];

    managerSelects.forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="">Chọn quản lý</option>';
      managers.forEach((manager) => {
        const option = document.createElement("option");
        option.value = manager._id;
        option.textContent = `${manager.username}`;
        select.appendChild(option);
      });

      if (select.id === "user-manager-filter") {
        const noneOption = document.createElement("option");
        noneOption.value = "none";
        noneOption.textContent = "Không có quản lý";
        select.appendChild(noneOption);
      } else {
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

function applyFilters() {
  currentSortColumn = "costCenter";
  currentSortDirection = "asc";
  renderUsers();
}

function renderUsers() {
  const filterCostCenterId = document.getElementById(
    "user-cost-center-filter",
  ).value;
  const filterManagerId = document.getElementById("user-manager-filter").value;
  const tbody = document.querySelector("#users-table tbody");
  tbody.innerHTML = "";

  currentFilteredUsers = [...allUsers];

  if (filterCostCenterId !== "all") {
    currentFilteredUsers = currentFilteredUsers.filter(
      (u) => u.costCenter && u.costCenter._id === filterCostCenterId,
    );
  }

  if (filterManagerId !== "all") {
    currentFilteredUsers = currentFilteredUsers.filter(
      (u) =>
        (filterManagerId === "none" && !u.assignedManager) ||
        (u.assignedManager && u.assignedManager._id === filterManagerId),
    );
  }

  currentFilteredUsers = sortUsers(
    currentFilteredUsers,
    currentSortColumn,
    currentSortDirection,
  );

  updateSortIndicators();

  if (currentFilteredUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="29" style="text-align:center;">Không tìm thấy nhân viên nào</td></tr>`;
    return;
  }

  const selectAllToggle = document.getElementById("select-all-toggle");
  if (currentFilteredUsers.length > 0) {
    const allSelected = currentFilteredUsers.every((user) =>
      selectedUsers.has(user._id),
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

    const hasEmail = user.email && user.email.trim() !== "";
    const emailDisplay = hasEmail
      ? user.email
      : '<span style="color: #dc3545; font-size: 0.8em;">(Chưa có email)</span>';

    const lockStatus = user.userSalaryCalculationLocked
      ? '<span style="color: #e74c3c; font-size: 0.9em;">🔒 Đã khóa</span>'
      : '<span style="color: #27ae60; font-size: 0.9em;">🔓 Mở</span>';

    let editButton;
    if (user.userSalaryCalculationLocked) {
      editButton = `<button class="btn" style="background: #95a5a6; cursor: not-allowed; opacity: 0.7;" disabled title="Đã khóa chỉnh sửa">🔒 Đã khóa</button>`;
    } else {
      editButton = `<button class="btn" onclick="editUser('${user._id}')">Chỉnh sửa</button>`;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="checkbox-cell">
        <input type="checkbox" ${
          selectedUsers.has(user._id) ? "checked" : ""
        } onchange="toggleSelectUser('${user._id}')">
      </td>
      <td>${user.username}</td>
      <td>${user.realName}</td>
      <td>${emailDisplay}</td>
      <td>${user.costCenter ? user.costCenter.name : "Chưa có"}</td>
      <td>${
        user.assignedManager ? user.assignedManager.username : "Chưa có"
      }</td>
      <td>${user.beneficiaryBank || "Chưa có"}</td>
      <td>${user.bankAccountNumber || "Chưa có"}</td>
      <td>${user.citizenID || "Chưa có"}</td>
      <td>${lockStatus}</td>
      <td>${formatNumber(user.baseSalary)}</td>
      <td>${formatNumber(user.hourlyWage)}</td>
      <td>${formatNumber(user.commissionBonus)}</td>
      <td>${formatNumber(user.otherBonus)}</td>
      <td>${formatNumber(user.responsibility)}</td>
      <td>${formatNumber(user.allowanceGeneral || 0)}</td>
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
          ${editButton}
          <button class="btn btn-danger" onclick="deleteUser('${user._id}')">Xóa</button>
          <button class="btn btn-history" onclick="viewUserHistory('${user._id}', '${user.username}', '${user.realName}')">
            Lịch sử
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  updateSelectedCount();
}

async function addUser(e) {
  e.preventDefault();

  const newUser = {
    username: document.getElementById("new-username").value,
    realName: document.getElementById("new-real-name").value,
    email: document.getElementById("new-email").value.trim() || "",
    costCenter: document.getElementById("new-cost-center").value,
    assignedManager:
      document.getElementById("new-assigned-manager").value || undefined,
    beneficiaryBank: document.getElementById("new-beneficiary-bank").value,
    bankAccountNumber: document.getElementById("new-bank-account-number").value,
    citizenID: document.getElementById("new-citizen-id").value,
    baseSalary: parseFloat(document.getElementById("new-base-salary").value),
    commissionBonus: parseFloat(
      document.getElementById("new-commission-bonus").value,
    ),
    otherBonus:
      parseFloat(document.getElementById("new-other-bonus").value) || 0,
    responsibility: parseFloat(
      document.getElementById("new-responsibility").value,
    ),
    allowanceGeneral:
      parseFloat(document.getElementById("new-allowance-general").value) || 0,
    weekdayOvertimeHour: parseFloat(
      document.getElementById("new-weekday-overtime").value,
    ),
    weekendOvertimeHour: parseFloat(
      document.getElementById("new-weekend-overtime").value,
    ),
    holidayOvertimeHour: parseFloat(
      document.getElementById("new-holiday-overtime").value,
    ),
    travelExpense: parseFloat(
      document.getElementById("new-travel-expense").value,
    ),
    insurableSalary: parseFloat(
      document.getElementById("new-insurable-salary").value,
    ),
    dependantCount: parseInt(
      document.getElementById("new-dependant-count").value,
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

  if (user.userSalaryCalculationLocked) {
    showError(
      "Nhân viên này đã bị khóa chỉnh sửa lương. Vui lòng mở khóa trước khi chỉnh sửa.",
    );
    return;
  }

  document.getElementById("edit-user-id").value = user._id;
  document.getElementById("edit-username").value = user.username;
  document.getElementById("edit-real-name").value = user.realName;
  document.getElementById("edit-email").value = user.email || "";
  document.getElementById("edit-beneficiary-bank").value =
    user.beneficiaryBank || "";
  document.getElementById("edit-bank-account-number").value =
    user.bankAccountNumber || "0";
  document.getElementById("edit-citizen-id").value = user.citizenID || "0";
  document.getElementById("edit-base-salary").value = user.baseSalary;
  document.getElementById("edit-commission-bonus").value = user.commissionBonus;
  document.getElementById("edit-other-bonus").value = user.otherBonus || 0;
  document.getElementById("edit-responsibility").value = user.responsibility;
  document.getElementById("edit-allowance-general").value =
    user.allowanceGeneral || 0;
  document.getElementById("edit-weekday-overtime").value =
    user.weekdayOvertimeHour;
  document.getElementById("edit-weekend-overtime").value =
    user.weekendOvertimeHour;
  document.getElementById("edit-holiday-overtime").value =
    user.holidayOvertimeHour;
  document.getElementById("edit-travel-expense").value = user.travelExpense;
  document.getElementById("edit-insurable-salary").value = user.insurableSalary;
  document.getElementById("edit-dependant-count").value = user.dependantCount;

  const costCenterSelect = document.getElementById("edit-cost-center");
  if (user.costCenter) {
    Array.from(costCenterSelect.options).forEach((option) => {
      option.selected = option.value === user.costCenter._id;
    });
  }

  const assignedManagerSelect = document.getElementById(
    "edit-assigned-manager",
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

  const user = allUsers.find((u) => u._id === userId);
  if (user && user.userSalaryCalculationLocked) {
    showError("Nhân viên này đã bị khóa chỉnh sửa lương. Không thể cập nhật.");
    document.getElementById("edit-user-modal").style.display = "none";
    return;
  }

  const userData = {
    username: document.getElementById("edit-username").value,
    realName: document.getElementById("edit-real-name").value,
    email: document.getElementById("edit-email").value.trim() || "",
    costCenter: document.getElementById("edit-cost-center").value,
    assignedManager:
      document.getElementById("edit-assigned-manager").value || undefined,
    baseSalary: parseFloat(document.getElementById("edit-base-salary").value),
    beneficiaryBank: document.getElementById("edit-beneficiary-bank").value,
    bankAccountNumber: document.getElementById("edit-bank-account-number")
      .value,
    citizenID: document.getElementById("edit-citizen-id").value,
    commissionBonus: parseFloat(
      document.getElementById("edit-commission-bonus").value,
    ),
    otherBonus:
      parseFloat(document.getElementById("edit-other-bonus").value) || 0,
    responsibility: parseFloat(
      document.getElementById("edit-responsibility").value,
    ),
    allowanceGeneral:
      parseFloat(document.getElementById("edit-allowance-general").value) || 0,
    weekdayOvertimeHour: parseFloat(
      document.getElementById("edit-weekday-overtime").value,
    ),
    weekendOvertimeHour: parseFloat(
      document.getElementById("edit-weekend-overtime").value,
    ),
    holidayOvertimeHour: parseFloat(
      document.getElementById("edit-holiday-overtime").value,
    ),
    travelExpense: parseFloat(
      document.getElementById("edit-travel-expense").value,
    ),
    insurableSalary: parseFloat(
      document.getElementById("edit-insurable-salary").value,
    ),
    dependantCount: parseInt(
      document.getElementById("edit-dependant-count").value,
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
        error.message || "Không thể cập nhật thông tin nhân viên",
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
