// views/financePages/financeCostCenterBank/financeCostCenterBank.js
const API_BASE = "/financeCostCenterBankControl";
let currentCostCenterId = null;
let entries = [];
let filteredEntries = [];
let currentSortField = "date";
let currentSortDirection = "asc";
let isAdding = false;
let editingEntryId = null;
let multipleEntryCounter = 0;

// Filter state
let filterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
};

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
    document.getElementById("bulkActions").classList.add("hidden");
    document.getElementById("multipleEntryForm").classList.add("hidden");
    document.getElementById("filtersSection").classList.add("hidden");
    return;
  }

  // Hiển thị thông tin trạm được chọn
  const selectedOption =
    document.getElementById("costCenterSelect").selectedOptions[0];
  document.getElementById("costCenterName").textContent =
    selectedOption.textContent;
  document.getElementById("costCenterInfo").classList.remove("hidden");
  document.getElementById("addFormContainer").classList.remove("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  document.getElementById("filtersSection").classList.remove("hidden");

  // Tải các mục
  await loadEntries();
}

// Tải tất cả mục cho trạm hiện tại
async function loadEntries() {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`);
    entries = await response.json();

    // Apply current filters
    applyFilters();

    // Reset states
    resetEditStates();
  } catch (error) {
    alert("Lỗi khi tải dữ liệu: " + error.message);
  }
}

// Reset edit and add states
function resetEditStates() {
  isAdding = false;
  editingEntryId = null;
  showAddButton();
  hideMultipleEntryForm();
}

// Show add button
function showAddButton() {
  document.getElementById("addNewEntryBtn").style.display = "inline-block";
}

// Hide add button
function hideAddButton() {
  document.getElementById("addNewEntryBtn").style.display = "none";
}

// Sort entries
function sortEntries(field, direction) {
  filteredEntries.sort((a, b) => {
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

  filteredEntries.forEach((entry) => {
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

  // Update table info
  document.getElementById("currentEntriesCount").textContent =
    filteredEntries.length;
  document.getElementById("totalEntriesCount").textContent = entries.length;

  if (filteredEntries.length === 0 && !isAdding) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="5" style="text-align: center; color: #666;">
        ${
          entries.length === 0
            ? "Chưa có dữ liệu nào. Hãy thêm mục mới."
            : "Không có kết quả phù hợp với bộ lọc."
        }
      </td>
    `;
    tbody.appendChild(row);
    return;
  }

  filteredEntries.forEach((entry) => {
    const row = document.createElement("tr");

    // Check if this row is being edited
    if (entry._id === editingEntryId) {
      row.className = "editing-row";
      row.innerHTML = `
        <td><input type="text" id="editName_${entry._id}" value="${entry.name}" required></td>
        <td><input type="number" id="editIncome_${entry._id}" value="${entry.income}" step="0.1" required></td>
        <td><input type="number" id="editExpense_${entry._id}" value="${entry.expense}" step="0.1" required></td>
        <td><input type="text" id="editDate_${entry._id}" value="${entry.date}" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
        <td class="actions">
          <button class="save-btn" onclick="saveEdit('${entry._id}')">Lưu</button>
          <button class="cancel-btn" onclick="cancelEdit('${entry._id}')">Hủy</button>
        </td>
      `;
    } else {
      row.innerHTML = `
        <td>${entry.name}</td>
        <td>${entry.income.toLocaleString("vi-VN")}</td>
        <td>${entry.expense.toLocaleString("vi-VN")}</td>
        <td>${entry.date}</td>
        <td class="actions">
          <button class="edit-btn" onclick="startEdit('${
            entry._id
          }')">Sửa</button>
          <button class="delete-btn" onclick="deleteEntry('${
            entry._id
          }')">Xóa</button>
        </td>
      `;
    }
    tbody.appendChild(row);
  });
}

// Hiển thị hàng thêm mới
function showAddRow() {
  if (isAdding || editingEntryId) {
    // If already adding or editing, don't allow multiple operations
    return;
  }

  const tbody = document.getElementById("entriesBody");

  // Clear any existing add row
  const existingAddRow = document.getElementById("addEntryRow");
  if (existingAddRow) {
    existingAddRow.remove();
  }

  const row = document.createElement("tr");
  row.id = "addEntryRow";
  row.className = "editing-row";
  row.innerHTML = `
    <td><input type="text" id="newName" placeholder="Tên" required></td>
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

  // Set state and hide add button
  isAdding = true;
  hideAddButton();
}

// Hủy thêm mới
function cancelAdd() {
  const addRow = document.getElementById("addEntryRow");
  if (addRow) {
    addRow.remove();
  }

  // Reset state and show add button
  isAdding = false;
  showAddButton();

  // If table is empty after cancel, show empty message
  if (filteredEntries.length === 0) {
    renderEntries();
  }
}

// Lưu mục mới
async function saveNewEntry() {
  if (!currentCostCenterId) return;

  const name = document.getElementById("newName").value;
  const income = parseFloat(document.getElementById("newIncome").value);
  const expense = parseFloat(document.getElementById("newExpense").value);
  const date = document.getElementById("newDate").value;

  // Validate inputs
  if (!name.trim()) {
    alert("Vui lòng nhập tên");
    return;
  }

  if (isNaN(income) || isNaN(expense)) {
    alert("Vui lòng nhập số tiền hợp lệ");
    return;
  }

  // Validate date format
  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày theo định dạng DD/MM/YYYY");
    return;
  }

  const entry = {
    name: name.trim(),
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

// Bắt đầu chỉnh sửa mục
function startEdit(entryId) {
  if (isAdding) {
    // If adding, cancel add first
    cancelAdd();
  }

  editingEntryId = entryId;
  hideAddButton();
  renderEntries();
}

// Hủy chỉnh sửa
function cancelEdit(entryId) {
  editingEntryId = null;
  showAddButton();
  renderEntries();
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

  // Validate inputs
  if (!name.trim()) {
    alert("Vui lòng nhập tên");
    return;
  }

  if (isNaN(income) || isNaN(expense)) {
    alert("Vui lòng nhập số tiền hợp lệ");
    return;
  }

  // Validate date format
  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày theo định dạng DD/MM/YYYY");
    return;
  }

  const entry = {
    id: entryId,
    name: name.trim(),
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
      editingEntryId = null;
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

// Filter Functions
function applyFilters() {
  // Get current filter values
  filterState.dateFrom = document.getElementById("dateFrom").value;
  filterState.dateTo = document.getElementById("dateTo").value;
  filterState.searchName = document
    .getElementById("searchName")
    .value.toLowerCase();

  // Apply filters to entries
  filteredEntries = entries.filter((entry) => {
    // Date filter
    if (
      filterState.dateFrom &&
      !isDateOnOrAfter(entry.date, filterState.dateFrom)
    ) {
      return false;
    }

    if (
      filterState.dateTo &&
      !isDateOnOrBefore(entry.date, filterState.dateTo)
    ) {
      return false;
    }

    // Name search filter
    if (
      filterState.searchName &&
      !entry.name.toLowerCase().includes(filterState.searchName)
    ) {
      return false;
    }

    return true;
  });

  // Sort and render filtered entries
  sortEntries(currentSortField, currentSortDirection);
  renderEntries();
  calculateSummary();
}

function resetFilters() {
  // Reset filter inputs
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  document.getElementById("searchName").value = "";

  // Reset filter state
  filterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
  };

  // Apply reset filters (show all entries)
  applyFilters();
}

// Helper function to compare dates in DD/MM/YYYY format
function isDateOnOrAfter(dateString, compareDateString) {
  const date = parseDate(dateString);
  const compareDate = parseDate(compareDateString);
  return date >= compareDate;
}

function isDateOnOrBefore(dateString, compareDateString) {
  const date = parseDate(dateString);
  const compareDate = parseDate(compareDateString);
  return date <= compareDate;
}

// Multiple Entry Functions
function showMultipleEntryForm() {
  if (isAdding || editingEntryId) {
    alert("Vui lòng hoàn thành thao tác hiện tại trước khi thêm nhiều mục");
    return;
  }

  document.getElementById("multipleEntryForm").classList.remove("hidden");
  document.getElementById("bulkActions").classList.add("hidden");
  hideAddButton();

  // Add initial entry row
  addEntryRow();
}

function hideMultipleEntryForm() {
  document.getElementById("multipleEntryForm").classList.add("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  showAddButton();
  clearMultipleEntries();
}

function addEntryRow() {
  const container = document.getElementById("multipleEntriesContainer");
  const entryId = `entry_${multipleEntryCounter++}`;

  const entryRow = document.createElement("div");
  entryRow.className = "entry-row";
  entryRow.id = entryId;
  entryRow.innerHTML = `
    <input type="text" id="${entryId}_name" placeholder="Tên giao dịch" required>
    <input type="number" id="${entryId}_income" placeholder="Thu nhập (VND)" step="0.1" value="0" required>
    <input type="number" id="${entryId}_expense" placeholder="Chi phí (VND)" step="0.1" value="0" required>
    <input type="text" id="${entryId}_date" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required>
    <button type="button" class="remove-entry-btn" onclick="removeEntryRow('${entryId}')">×</button>
  `;

  container.appendChild(entryRow);
}

function removeEntryRow(entryId) {
  const entryRow = document.getElementById(entryId);
  if (entryRow) {
    entryRow.remove();
  }

  // If no entries left, hide the form
  const container = document.getElementById("multipleEntriesContainer");
  if (container.children.length === 0) {
    hideMultipleEntryForm();
  }
}

function clearMultipleEntries() {
  const container = document.getElementById("multipleEntriesContainer");
  container.innerHTML = "";
  multipleEntryCounter = 0;
}

async function saveMultipleEntries() {
  if (!currentCostCenterId) return;

  const container = document.getElementById("multipleEntriesContainer");
  const entryRows = container.getElementsByClassName("entry-row");

  if (entryRows.length === 0) {
    alert("Vui lòng thêm ít nhất một mục");
    return;
  }

  const entries = [];
  let hasError = false;

  // Validate all entries first
  for (let row of entryRows) {
    const entryId = row.id;
    const name = document.getElementById(`${entryId}_name`).value.trim();
    const income = parseFloat(
      document.getElementById(`${entryId}_income`).value
    );
    const expense = parseFloat(
      document.getElementById(`${entryId}_expense`).value
    );
    const date = document.getElementById(`${entryId}_date`).value;

    // Validate inputs
    if (!name) {
      alert(`Vui lòng nhập tên cho mục ${entryId}`);
      hasError = true;
      break;
    }

    if (isNaN(income) || isNaN(expense)) {
      alert(`Vui lòng nhập số tiền hợp lệ cho mục ${entryId}`);
      hasError = true;
      break;
    }

    if (!isValidDate(date)) {
      alert(`Vui lòng nhập ngày hợp lệ (DD/MM/YYYY) cho mục ${entryId}`);
      hasError = true;
      break;
    }

    entries.push({
      name,
      income,
      expense,
      date,
    });
  }

  if (hasError) return;

  // Show loading state
  const saveBtn = document.querySelector("#multipleEntryForm .save-btn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Đang lưu...";
  saveBtn.disabled = true;

  try {
    let successCount = 0;
    let errorCount = 0;

    // Save entries one by one
    for (const entry of entries) {
      try {
        const response = await fetch(
          `${API_BASE}/${currentCostCenterId}/entries`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(entry),
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    // Reset button
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;

    // Show result
    if (errorCount === 0) {
      alert(`Đã thêm thành công ${successCount} mục!`);
      hideMultipleEntryForm();
      await loadEntries();
    } else {
      alert(
        `Đã thêm ${successCount} mục thành công, ${errorCount} mục thất bại.`
      );
      if (successCount > 0) {
        hideMultipleEntryForm();
        await loadEntries();
      }
    }
  } catch (error) {
    // Reset button
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;

    alert("Lỗi khi lưu các mục: " + error.message);
  }
}

function cancelMultipleEntries() {
  if (
    confirm("Bạn có chắc chắn muốn hủy? Tất cả dữ liệu chưa lưu sẽ bị mất.")
  ) {
    hideMultipleEntryForm();
  }
}
