//views/financePages/financeCostCenterConstruction/financeCostCenterConstruction.js
const API_BASE = "/financeCostCenterConstructionControl";
let currentCostCenterId = null;
let entries = [];
let currentSortField = "date";
let currentSortDirection = "asc"; // Ascending by default

// Tải trạm khi trang load
document.addEventListener("DOMContentLoaded", loadCostCenters);

// Tải tất cả trạm cho dropdown
async function loadCostCenters() {
  try {
    const response = await fetch(`${API_BASE}/cost-centers`);
    const costCenters = await response.json();

    const select = document.getElementById("costCenterSelect");
    costCenters.forEach((cc) => {
      const option = document.createElement("option");
      option.value = cc._id;
      option.textContent = cc.name;
      select.appendChild(option);
    });
  } catch (error) {
    alert("Lỗi khi tải trạm: " + error.message);
  }
}

// Tải dữ liệu cho trạm được chọn
async function loadCostCenterData() {
  currentCostCenterId = document.getElementById("costCenterSelect").value;

  if (!currentCostCenterId) {
    document.getElementById("costCenterInfo").classList.add("hidden");
    document.getElementById("addFormContainer").classList.add("hidden");
    document.getElementById("summarySection").classList.add("hidden");
    return;
  }

  // Hiển thị thông tin trạm được chọn
  const selectedOption =
    document.getElementById("costCenterSelect").selectedOptions[0];
  document.getElementById("costCenterName").textContent =
    selectedOption.textContent;
  document.getElementById("costCenterInfo").classList.remove("hidden");
  document.getElementById("addFormContainer").classList.remove("hidden");

  // Tải các mục Mua sắm và Xây dựng
  await loadEntries();
}

// Tải tất cả mục cho trạm hiện tại
async function loadEntries() {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`);
    entries = await response.json();

    // Sort entries by date (ascending by default)
    sortEntries(currentSortField, currentSortDirection);

    renderEntries();
    calculateSummary();
  } catch (error) {
    alert("Lỗi khi tải dữ liệu: " + error.message);
  }
}

// Sort entries
function sortEntries(field, direction) {
  entries.sort((a, b) => {
    let aValue = a[field];
    let bValue = b[field];

    // Special handling for date field
    if (field === "date") {
      aValue = parseDate(aValue);
      bValue = parseDate(bValue);
    }

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  // Update sort indicators
  updateSortIndicators(field, direction);
}

// Parse date from DD/MM/YYYY format
function parseDate(dateString) {
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(0); // Invalid date
}

// Update sort indicators in table headers
function updateSortIndicators(field, direction) {
  const headers = document.querySelectorAll("th.sortable");
  headers.forEach((header) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (header.getAttribute("data-field") === field) {
      header.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

// Sort table when header is clicked
function sortTable(field) {
  if (currentSortField === field) {
    // Toggle direction if same field
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    // New field, default to ascending
    currentSortField = field;
    currentSortDirection = "asc";
  }

  sortEntries(currentSortField, currentSortDirection);
  renderEntries();
}

// Tính toán tổng kết
function calculateSummary() {
  let totalIncome = 0;
  let totalExpense = 0;

  entries.forEach((entry) => {
    totalIncome += entry.income;
    totalExpense += entry.expense;
  });

  const totalProfit = totalIncome - totalExpense;

  document.getElementById("totalIncome").textContent =
    totalIncome.toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent =
    totalExpense.toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent =
    totalProfit.toLocaleString("vi-VN");

  // Hiển thị phần tổng kết
  document.getElementById("summarySection").classList.remove("hidden");
}

// Hiển thị các mục trong bảng
function renderEntries() {
  const tbody = document.getElementById("entriesBody");
  tbody.innerHTML = "";

  if (entries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="5" style="text-align: center; color: #666;">
        Chưa có dữ liệu Mua sắm và Xây dựng nào. Hãy thêm mục mới.
      </td>
    `;
    tbody.appendChild(row);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.income.toLocaleString("vi-VN")}</td>
      <td>${entry.expense.toLocaleString("vi-VN")}</td>
      <td>${entry.date}</td>
      <td class="actions">
        <button class="edit-btn" onclick="editEntry('${
          entry._id
        }')">Sửa</button>
        <button class="delete-btn" onclick="deleteEntry('${
          entry._id
        }')">Xóa</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Hiển thị hàng thêm mới
function showAddRow() {
  const tbody = document.getElementById("entriesBody");

  // Check if we already have an add row
  if (document.getElementById("addEntryRow")) {
    return;
  }

  const row = document.createElement("tr");
  row.id = "addEntryRow";
  row.className = "editing-row";
  row.innerHTML = `
    <td><input type="text" id="newName" placeholder="Tên công trình" required></td>
    <td><input type="number" id="newIncome" placeholder="Thu nhập" step="0.1" required></td>
    <td><input type="number" id="newExpense" placeholder="Chi phí" step="0.1" required></td>
    <td><input type="text" id="newDate" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
    <td class="actions">
      <button class="save-btn" onclick="saveNewEntry()">Lưu</button>
      <button class="cancel-btn" onclick="cancelAdd()">Hủy</button>
    </td>
  `;

  // Insert at the beginning of the table
  tbody.insertBefore(row, tbody.firstChild);

  // Hide the add button
  document.getElementById("addNewEntryBtn").style.display = "none";
}

// Hủy thêm mới
function cancelAdd() {
  const addRow = document.getElementById("addEntryRow");
  if (addRow) {
    addRow.remove();
  }

  // Show the add button again
  document.getElementById("addNewEntryBtn").style.display = "inline-block";
}

// Lưu mục mới
async function saveNewEntry() {
  if (!currentCostCenterId) return;

  const name = document.getElementById("newName").value;
  const income = parseFloat(document.getElementById("newIncome").value);
  const expense = parseFloat(document.getElementById("newExpense").value);
  const date = document.getElementById("newDate").value;

  // Validate date format
  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày theo định dạng DD/MM/YYYY");
    return;
  }

  const entry = {
    name,
    income,
    expense,
    date,
  };

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    if (response.ok) {
      cancelAdd();
      await loadEntries();
      alert("Thêm mục thành công!");
    } else {
      alert("Lỗi khi thêm mục");
    }
  } catch (error) {
    alert("Lỗi khi thêm mục: " + error.message);
  }
}

// Chỉnh sửa mục
function editEntry(entryId) {
  const entry = entries.find((e) => e._id === entryId);
  if (!entry) return;

  const row = document.querySelector(
    `tr:has(button[onclick="editEntry('${entryId}')"])`
  );
  if (!row) return;

  row.className = "editing-row";
  row.innerHTML = `
    <td><input type="text" id="editName_${entryId}" value="${entry.name}" required></td>
    <td><input type="number" id="editIncome_${entryId}" value="${entry.income}" step="0.1" required></td>
    <td><input type="number" id="editExpense_${entryId}" value="${entry.expense}" step="0.1" required></td>
    <td><input type="text" id="editDate_${entryId}" value="${entry.date}" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
    <td class="actions">
      <button class="save-btn" onclick="saveEdit('${entryId}')">Lưu</button>
      <button class="cancel-btn" onclick="cancelEdit('${entryId}')">Hủy</button>
    </td>
  `;
}

// Hủy chỉnh sửa
function cancelEdit(entryId) {
  // Reload entries to revert changes
  loadEntries();
}

// Lưu chỉnh sửa
async function saveEdit(entryId) {
  if (!currentCostCenterId) return;

  const name = document.getElementById(`editName_${entryId}`).value;
  const income = parseFloat(
    document.getElementById(`editIncome_${entryId}`).value
  );
  const expense = parseFloat(
    document.getElementById(`editExpense_${entryId}`).value
  );
  const date = document.getElementById(`editDate_${entryId}`).value;

  // Validate date format
  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày theo định dạng DD/MM/YYYY");
    return;
  }

  const entry = {
    id: entryId,
    name,
    income,
    expense,
    date,
  };

  try {
    const response = await fetch(
      `${API_BASE}/${currentCostCenterId}/entries/${entryId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      }
    );

    if (response.ok) {
      await loadEntries();
      alert("Cập nhật thành công!");
    } else {
      alert("Lỗi khi cập nhật mục");
    }
  } catch (error) {
    alert("Lỗi khi cập nhật mục: " + error.message);
  }
}

// Xóa mục
async function deleteEntry(entryId) {
  if (!currentCostCenterId) return;

  if (confirm("Bạn có chắc chắn muốn xóa mục này không?")) {
    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries/${entryId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        await loadEntries();
        alert("Xóa mục thành công!");
      } else {
        alert("Lỗi khi xóa mục");
      }
    } catch (error) {
      alert("Lỗi khi xóa mục: " + error.message);
    }
  }
}

// Validate date format
function isValidDate(dateString) {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!regex.test(dateString)) return false;

  const parts = dateString.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (year < 1000 || year > 3000 || month === 0 || month > 12) return false;

  const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Adjust for leap years
  if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
    monthLength[1] = 29;
  }

  return day > 0 && day <= monthLength[month - 1];
}
