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
let currentFundLimitBank = 0;

// Biến cho tổng kết toàn hệ thống
let allCostCenters = [];
let allEntries = {}; // Lưu entries của từng cost center: { costCenterId: { name: string, entries: array } }
let allFundInfo = {}; // Lưu fund info của từng cost center

// Filter state
let filterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
};

// Tải trạm khi trang load
document.addEventListener("DOMContentLoaded", loadCostCenters);

// Tải tất cả trạm cho dropdown và tổng kết toàn hệ thống
async function loadCostCenters() {
  try {
    const response = await fetch(`${API_BASE}/cost-centers`);
    allCostCenters = await response.json();

    const select = document.getElementById("costCenterSelect");
    select.innerHTML = '<option value="">-- Chọn Trạm --</option>';

    allCostCenters.forEach((cc) => {
      const option = document.createElement("option");
      option.value = cc._id;
      option.textContent = cc.name;
      select.appendChild(option);
    });

    // Tải dữ liệu cho tất cả cost centers
    await loadAllCostCentersData();
  } catch (error) {
    console.error("Lỗi khi tải trạm:", error);
    alert("Lỗi khi tải danh sách trạm: " + error.message);
  }
}

// Tải dữ liệu cho tất cả cost centers
async function loadAllCostCentersData() {
  try {
    const loadingPromises = allCostCenters.map(async (costCenter) => {
      try {
        // Tải entries
        const entriesResponse = await fetch(
          `${API_BASE}/${costCenter._id}/entries`,
        );
        const costCenterEntries = await entriesResponse.json();

        // Tải fund info
        let fundInfo = {
          fundLimitBank: 0,
          totalIncome: 0,
          totalExpense: 0,
          fundAvailableBank: 0,
        };
        try {
          const fundResponse = await fetch(
            `${API_BASE}/${costCenter._id}/fund-info`,
          );
          fundInfo = await fundResponse.json();
        } catch (fundError) {
          console.error(
            `Lỗi khi tải fund info cho trạm ${costCenter.name}:`,
            fundError,
          );
        }

        allEntries[costCenter._id] = {
          name: costCenter.name,
          entries: costCenterEntries,
        };

        allFundInfo[costCenter._id] = fundInfo;
      } catch (error) {
        console.error(
          `Lỗi khi tải dữ liệu cho trạm ${costCenter.name}:`,
          error,
        );
        allEntries[costCenter._id] = {
          name: costCenter.name,
          entries: [],
        };
        allFundInfo[costCenter._id] = {
          fundLimitBank: 0,
          totalIncome: 0,
          totalExpense: 0,
          fundAvailableBank: 0,
        };
      }
    });

    await Promise.all(loadingPromises);

    // Tính toán và hiển thị tổng kết toàn hệ thống
    calculateGlobalSummary();
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu toàn hệ thống:", error);
  }
}

// Tính tổng kết toàn hệ thống
function calculateGlobalSummary() {
  let globalTotalIncome = 0;
  let globalTotalExpense = 0;
  let globalTotalFundLimit = 0;
  let globalTotalFundAvailable = 0;

  // Duyệt qua tất cả cost centers
  Object.values(allFundInfo).forEach((fundInfo) => {
    globalTotalIncome += fundInfo.totalIncome || 0;
    globalTotalExpense += fundInfo.totalExpense || 0;
    globalTotalFundLimit += fundInfo.fundLimitBank || 0;
    globalTotalFundAvailable += fundInfo.fundAvailableBank || 0;
  });

  const globalTotalProfit = globalTotalIncome - globalTotalExpense;

  // Cập nhật UI
  document.getElementById("globalTotalIncome").textContent =
    globalTotalIncome.toLocaleString("vi-VN");
  document.getElementById("globalTotalExpense").textContent =
    globalTotalExpense.toLocaleString("vi-VN");
  document.getElementById("globalTotalProfit").textContent =
    globalTotalProfit.toLocaleString("vi-VN");
  document.getElementById("globalTotalFundLimit").textContent =
    globalTotalFundLimit.toLocaleString("vi-VN");
  document.getElementById("globalTotalFundAvailable").textContent =
    globalTotalFundAvailable.toLocaleString("vi-VN");
}

// Cập nhật dữ liệu toàn hệ thống khi có thay đổi
async function updateGlobalSummary() {
  // Làm mới dữ liệu của cost center hiện tại
  if (currentCostCenterId) {
    try {
      // Tải entries
      const entriesResponse = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries`,
      );
      const updatedEntries = await entriesResponse.json();

      // Tải fund info
      let updatedFundInfo = {};
      try {
        const fundResponse = await fetch(
          `${API_BASE}/${currentCostCenterId}/fund-info`,
        );
        updatedFundInfo = await fundResponse.json();
      } catch (fundError) {
        console.error("Lỗi khi tải fund info:", fundError);
      }

      allEntries[currentCostCenterId] = {
        name: document.getElementById("costCenterName").textContent,
        entries: updatedEntries,
      };

      allFundInfo[currentCostCenterId] = updatedFundInfo;
    } catch (error) {
      console.error("Lỗi khi cập nhật dữ liệu:", error);
    }
  }

  // Tính toán lại tổng kết
  calculateGlobalSummary();
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

  const selectedOption =
    document.getElementById("costCenterSelect").selectedOptions[0];
  document.getElementById("costCenterName").textContent =
    selectedOption.textContent;

  await loadFundInfo();

  document.getElementById("costCenterInfo").classList.remove("hidden");
  document.getElementById("addFormContainer").classList.remove("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  document.getElementById("filtersSection").classList.remove("hidden");

  await loadEntries();

  // Cập nhật dữ liệu trong allEntries và allFundInfo
  allEntries[currentCostCenterId] = {
    name: selectedOption.textContent,
    entries: entries,
  };

  // Tính toán lại tổng kết toàn hệ thống
  await updateGlobalSummary();
}

// Tải thông tin quỹ
async function loadFundInfo() {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(
      `${API_BASE}/${currentCostCenterId}/fund-info`,
    );
    const fundData = await response.json();

    currentFundLimitBank = fundData.fundLimitBank || 0;

    updateFundSummary(fundData);
  } catch (error) {
    console.error("Error loading fund info:", error);
    // Set defaults
    currentFundLimitBank = 0;
    document.getElementById("fundLimitBankSummary").textContent = "0";
    document.getElementById("fundAvailableBank").textContent = "0";
  }
}

// Tải tất cả mục cho trạm hiện tại
async function loadEntries() {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`);
    entries = await response.json();

    applyFilters();

    resetEditStates();

    await loadFundInfo();
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

    if (field === "date") {
      aValue = parseDate(aValue);
      bValue = parseDate(bValue);
    }

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  updateSortIndicators(field, direction);
}

// Parse date from DD/MM/YYYY format
function parseDate(dateString) {
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(0);
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
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
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
  const fundAvailableBank = currentFundLimitBank - totalExpense + totalIncome;

  document.getElementById("totalIncome").textContent =
    totalIncome.toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent =
    totalExpense.toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent =
    totalProfit.toLocaleString("vi-VN");
  document.getElementById("fundLimitBankSummary").textContent =
    currentFundLimitBank.toLocaleString("vi-VN");
  document.getElementById("fundAvailableBank").textContent =
    fundAvailableBank.toLocaleString("vi-VN");

  document.getElementById("summarySection").classList.remove("hidden");
}

// Cập nhật thông tin quỹ
function updateFundSummary(fundData) {
  const fundAvailableBank = fundData.fundAvailableBank || 0;

  document.getElementById("fundLimitBankSummary").textContent =
    fundData.fundLimitBank.toLocaleString("vi-VN");
  document.getElementById("fundAvailableBank").textContent =
    fundAvailableBank.toLocaleString("vi-VN");
  document.getElementById("totalIncome").textContent = (
    fundData.totalIncome || 0
  ).toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent = (
    fundData.totalExpense || 0
  ).toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent = (
    (fundData.totalIncome || 0) - (fundData.totalExpense || 0)
  ).toLocaleString("vi-VN");
}

// Hiển thị các mục trong bảng
function renderEntries() {
  const tbody = document.getElementById("entriesBody");
  tbody.innerHTML = "";

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
    return;
  }

  const tbody = document.getElementById("entriesBody");

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

  tbody.insertBefore(row, tbody.firstChild);

  isAdding = true;
  hideAddButton();
}

// Hủy thêm mới
function cancelAdd() {
  const addRow = document.getElementById("addEntryRow");
  if (addRow) {
    addRow.remove();
  }

  isAdding = false;
  showAddButton();

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

  if (!name.trim()) {
    alert("Vui lòng nhập tên");
    return;
  }

  if (isNaN(income) || isNaN(expense)) {
    alert("Vui lòng nhập số tiền hợp lệ");
    return;
  }

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
      await updateGlobalSummary(); // Cập nhật tổng kết toàn hệ thống
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
    document.getElementById(`editIncome_${entryId}`).value,
  );
  const expense = parseFloat(
    document.getElementById(`editExpense_${entryId}`).value,
  );
  const date = document.getElementById(`editDate_${entryId}`).value;

  if (!name.trim()) {
    alert("Vui lòng nhập tên");
    return;
  }

  if (isNaN(income) || isNaN(expense)) {
    alert("Vui lòng nhập số tiền hợp lệ");
    return;
  }

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
      },
    );

    if (response.ok) {
      editingEntryId = null;
      await loadEntries();
      await updateGlobalSummary(); // Cập nhật tổng kết toàn hệ thống
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
        },
      );

      if (response.ok) {
        await loadEntries();
        await updateGlobalSummary(); // Cập nhật tổng kết toàn hệ thống
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

  if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
    monthLength[1] = 29;
  }

  return day > 0 && day <= monthLength[month - 1];
}

// Filter Functions
function applyFilters() {
  filterState.dateFrom = document.getElementById("dateFrom").value;
  filterState.dateTo = document.getElementById("dateTo").value;
  filterState.searchName = document
    .getElementById("searchName")
    .value.toLowerCase();

  filteredEntries = entries.filter((entry) => {
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

    if (
      filterState.searchName &&
      !entry.name.toLowerCase().includes(filterState.searchName)
    ) {
      return false;
    }

    return true;
  });

  sortEntries(currentSortField, currentSortDirection);
  renderEntries();
  calculateSummary();
}

function resetFilters() {
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  document.getElementById("searchName").value = "";

  filterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
  };

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

  const entriesToSave = [];
  let hasError = false;

  for (let row of entryRows) {
    const entryId = row.id;
    const name = document.getElementById(`${entryId}_name`).value.trim();
    const income = parseFloat(
      document.getElementById(`${entryId}_income`).value,
    );
    const expense = parseFloat(
      document.getElementById(`${entryId}_expense`).value,
    );
    const date = document.getElementById(`${entryId}_date`).value;

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

    entriesToSave.push({
      name,
      income,
      expense,
      date,
    });
  }

  if (hasError) return;

  const saveBtn = document.querySelector("#multipleEntryForm .save-btn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Đang lưu...";
  saveBtn.disabled = true;

  try {
    let successCount = 0;
    let errorCount = 0;

    for (const entry of entriesToSave) {
      try {
        const response = await fetch(
          `${API_BASE}/${currentCostCenterId}/entries`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(entry),
          },
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

    saveBtn.textContent = originalText;
    saveBtn.disabled = false;

    if (errorCount === 0) {
      alert(`Đã thêm thành công ${successCount} mục!`);
      hideMultipleEntryForm();
      await loadEntries();
      await updateGlobalSummary(); // Cập nhật tổng kết toàn hệ thống
    } else {
      alert(
        `Đã thêm ${successCount} mục thành công, ${errorCount} mục thất bại.`,
      );
      if (successCount > 0) {
        hideMultipleEntryForm();
        await loadEntries();
        await updateGlobalSummary(); // Cập nhật tổng kết toàn hệ thống
      }
    }
  } catch (error) {
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

// Fund Limit Functions - Simple prompt approach
function showEditFundLimit() {
  if (!currentCostCenterId) {
    alert("Vui lòng chọn trạm trước khi chỉnh sửa hạn mức");
    return;
  }

  const currentValue = currentFundLimitBank.toLocaleString("vi-VN");
  const newValue = prompt(
    "Nhập hạn mức ngân hàng mới (VND):\n\n" +
      `Hạn mức hiện tại: ${currentValue} VND`,
    currentFundLimitBank,
  );

  if (newValue === null) {
    return;
  }

  const newFundLimit = parseFloat(newValue.replace(/[^\d.-]/g, ""));

  if (isNaN(newFundLimit) || newFundLimit < 0) {
    alert("Vui lòng nhập số hợp lệ cho hạn mức ngân hàng (số dương)");
    return;
  }

  if (
    !confirm(
      `Bạn có chắc chắn muốn đổi hạn mức từ ${currentValue} VND thành ${newFundLimit.toLocaleString("vi-VN")} VND?`,
    )
  ) {
    return;
  }

  saveFundLimit(newFundLimit);
}

async function saveFundLimit(newFundLimit) {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(
      `${API_BASE}/${currentCostCenterId}/fund-limit`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fundLimitBank: newFundLimit }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      currentFundLimitBank = newFundLimit;

      document.getElementById("fundLimitBankSummary").textContent =
        newFundLimit.toLocaleString("vi-VN");

      await loadFundInfo();
      await updateGlobalSummary(); // Cập nhật tổng kết toàn hệ thống

      alert(result.message || "Cập nhật hạn mức thành công!");
    } else {
      const error = await response.json();
      alert("Lỗi khi cập nhật: " + (error.message || "Không xác định"));
    }
  } catch (error) {
    alert("Lỗi khi cập nhật hạn mức: " + error.message);
  }
}

// Global Summary Functions
function showGlobalDetails() {
  const modalContent = `
    <div class="modal fade" id="globalDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">📊 Tổng Kết Chi Tiết Toàn Hệ Thống</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="table-responsive">
              <table class="table table-hover table-striped">
                <thead class="table-dark">
                  <tr>
                    <th>Trạm</th>
                    <th>Số Giao Dịch</th>
                    <th>Tổng Thu (VND)</th>
                    <th>Tổng Chi (VND)</th>
                    <th>Lợi Nhuận (VND)</th>
                    <th>Hạn Mức (VND)</th>
                    <th>Quỹ Khả Dụng (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(allEntries)
                    .map(([costCenterId, data]) => {
                      const fundInfo = allFundInfo[costCenterId] || {};
                      const entryCount = data.entries ? data.entries.length : 0;
                      const totalIncome = fundInfo.totalIncome || 0;
                      const totalExpense = fundInfo.totalExpense || 0;
                      const profit = totalIncome - totalExpense;
                      const fundLimit = fundInfo.fundLimitBank || 0;
                      const fundAvailable = fundInfo.fundAvailableBank || 0;

                      const profitClass =
                        profit >= 0
                          ? "text-success fw-bold"
                          : "text-danger fw-bold";
                      const fundAvailableClass =
                        fundAvailable >= 0 ? "text-success" : "text-danger";

                      return `
                        <tr onclick="switchToCostCenter('${costCenterId}')" style="cursor: pointer;" title="Nhấp để xem chi tiết trạm ${data.name}">
                          <td><strong>${data.name}</strong></td>
                          <td>${entryCount}</td>
                          <td>${totalIncome.toLocaleString("vi-VN")}</td>
                          <td>${totalExpense.toLocaleString("vi-VN")}</td>
                          <td class="${profitClass}">${profit.toLocaleString("vi-VN")}</td>
                          <td>${fundLimit.toLocaleString("vi-VN")}</td>
                          <td class="${fundAvailableClass}">${fundAvailable.toLocaleString("vi-VN")}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
                <tfoot class="table-secondary">
                  <tr>
                    <td><strong>TỔNG CỘNG</strong></td>
                    <td><strong>${Object.values(allEntries).reduce(
                      (sum, data) =>
                        sum + (data.entries ? data.entries.length : 0),
                      0,
                    )}</strong></td>
                    <td><strong>${Object.values(allFundInfo)
                      .reduce(
                        (sum, fundInfo) => sum + (fundInfo.totalIncome || 0),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                    <td><strong>${Object.values(allFundInfo)
                      .reduce(
                        (sum, fundInfo) => sum + (fundInfo.totalExpense || 0),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                    <td><strong class="${
                      Object.values(allFundInfo).reduce(
                        (sum, fundInfo) =>
                          sum +
                          ((fundInfo.totalIncome || 0) -
                            (fundInfo.totalExpense || 0)),
                        0,
                      ) >= 0
                        ? "text-success"
                        : "text-danger"
                    }">
                      ${Object.values(allFundInfo)
                        .reduce(
                          (sum, fundInfo) =>
                            sum +
                            ((fundInfo.totalIncome || 0) -
                              (fundInfo.totalExpense || 0)),
                          0,
                        )
                        .toLocaleString("vi-VN")}
                    </strong></td>
                    <td><strong>${Object.values(allFundInfo)
                      .reduce(
                        (sum, fundInfo) => sum + (fundInfo.fundLimitBank || 0),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                    <td><strong class="${
                      Object.values(allFundInfo).reduce(
                        (sum, fundInfo) =>
                          sum + (fundInfo.fundAvailableBank || 0),
                        0,
                      ) >= 0
                        ? "text-success"
                        : "text-danger"
                    }">
                      ${Object.values(allFundInfo)
                        .reduce(
                          (sum, fundInfo) =>
                            sum + (fundInfo.fundAvailableBank || 0),
                          0,
                        )
                        .toLocaleString("vi-VN")}
                    </strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="mt-3">
              <small class="text-muted">* Nhấp vào tên trạm để chuyển sang xem chi tiết</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
            <button type="button" class="btn btn-primary" onclick="refreshGlobalData()">
              🔄 Làm Mới Dữ Liệu
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Thêm modal vào DOM nếu chưa có
  const existingModal = document.getElementById("globalDetailsModal");
  if (existingModal) {
    existingModal.remove();
  }

  document.body.insertAdjacentHTML("beforeend", modalContent);

  // Hiển thị modal
  const modal = new bootstrap.Modal(
    document.getElementById("globalDetailsModal"),
  );
  modal.show();
}

// Hàm chuyển sang cost center khi click
function switchToCostCenter(costCenterId) {
  // Đóng modal
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("globalDetailsModal"),
  );
  if (modal) modal.hide();

  // Chọn cost center trong dropdown
  document.getElementById("costCenterSelect").value = costCenterId;

  // Tải dữ liệu cho cost center đó
  loadCostCenterData();
}

// Hàm làm mới dữ liệu toàn hệ thống
async function refreshGlobalData() {
  await loadAllCostCentersData();
  alert("Đã cập nhật dữ liệu toàn hệ thống!");
}
