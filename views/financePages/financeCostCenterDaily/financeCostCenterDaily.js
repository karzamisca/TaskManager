// views/financePages/financeCostCenterDaily/financeCostCenterDaily.js
const API_BASE = "/financeCostCenterDailyControl";
let currentCostCenterId = null;
let entries = [];
let filteredEntries = [];
let currentSortField = "date";
let currentSortDirection = "desc";
let isAdding = false;
let editingEntryId = null;
let multipleEntryCounter = 0;

let allCostCenters = [];
let allEntries = {};
let allEntriesFlat = []; // Flattened array of all entries with cost center info
let filteredAllEntries = [];
let currentAllSortField = "date";
let currentAllSortDirection = "desc";

let alternativeViewActive = false;
let alternativeViewMode = "column";

let filterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
  searchNote: "",
  predictionFilter: "all",
};

// Filter state for all cost centers view
let allFilterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
  searchNote: "",
  costCenterFilter: "all",
  predictionFilter: "all",
};

document.addEventListener("DOMContentLoaded", loadCostCenters);

// Helper function to get today's date in DD/MM/YYYY format
function getTodayFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
}

// Apply "Today Only" filter for single view
function applyTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("dateFrom").value = today;
  document.getElementById("dateTo").value = today;
  applyFilters();
}

// Apply "Today Only" filter for all stations view
function applyAllTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("allDateFrom").value = today;
  document.getElementById("allDateTo").value = today;
  applyAllFilters();
}

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

    await loadAllCostCentersData();
  } catch (error) {
    console.error("Lỗi khi tải trạm:", error);
    alert("Lỗi khi tải danh sách trạm: " + error.message);
  }
}

// Populate cost center filter dropdown
function populateCostCenterFilter() {
  const select = document.getElementById("allCostCenterFilter");
  if (!select) return;

  // Clear existing options except "Tất cả trạm"
  while (select.options.length > 1) {
    select.remove(1);
  }

  // Add all cost centers
  allCostCenters.forEach((cc) => {
    const option = document.createElement("option");
    option.value = cc._id;
    option.textContent = cc.name;
    select.appendChild(option);
  });
}

async function loadAllCostCentersData() {
  try {
    const loadingPromises = allCostCenters.map(async (costCenter) => {
      try {
        const response = await fetch(`${API_BASE}/${costCenter._id}/entries`);
        const costCenterEntries = await response.json();
        allEntries[costCenter._id] = {
          name: costCenter.name,
          entries: costCenterEntries,
        };
      } catch (error) {
        console.error(
          `Lỗi khi tải dữ liệu cho trạm ${costCenter.name}:`,
          error,
        );
        allEntries[costCenter._id] = {
          name: costCenter.name,
          entries: [],
        };
      }
    });

    await Promise.all(loadingPromises);

    // Flatten all entries with cost center info
    flattenAllEntries();
    calculateGlobalSummary();

    // Populate cost center filter dropdown
    populateCostCenterFilter();

    if (alternativeViewActive) {
      renderAllCostCentersView();
    }
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu toàn hệ thống:", error);
  }
}

function flattenAllEntries() {
  allEntriesFlat = [];

  Object.entries(allEntries).forEach(([costCenterId, data]) => {
    if (data.entries && data.entries.length > 0) {
      data.entries.forEach((entry) => {
        allEntriesFlat.push({
          ...entry,
          costCenterId: costCenterId,
          costCenterName: data.name,
        });
      });
    }
  });

  // Apply filters after flattening
  applyAllFilters();
}

function calculateGlobalSummary() {
  let globalTotalIncome = 0;
  let globalTotalExpense = 0;
  let globalTotalIncomePrediction = 0;
  let globalTotalExpensePrediction = 0;

  Object.values(allEntries).forEach((costCenterData) => {
    if (costCenterData.entries) {
      costCenterData.entries.forEach((entry) => {
        globalTotalIncome += entry.income || 0;
        globalTotalExpense += entry.expense || 0;
        globalTotalIncomePrediction += entry.incomePrediction || 0;
        globalTotalExpensePrediction += entry.expensePrediction || 0;
      });
    }
  });

  const globalTotalProfit = globalTotalIncome - globalTotalExpense;

  document.getElementById("globalTotalIncome").textContent =
    globalTotalIncome.toLocaleString("vi-VN");
  document.getElementById("globalTotalExpense").textContent =
    globalTotalExpense.toLocaleString("vi-VN");
  document.getElementById("globalTotalProfit").textContent =
    globalTotalProfit.toLocaleString("vi-VN");
}

async function updateGlobalSummary() {
  if (currentCostCenterId) {
    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries`,
      );
      const updatedEntries = await response.json();
      allEntries[currentCostCenterId] = {
        name: document.getElementById("costCenterName").textContent,
        entries: updatedEntries,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật dữ liệu:", error);
    }
  }

  flattenAllEntries();
  calculateGlobalSummary();

  if (alternativeViewActive) {
    renderAllCostCentersView();
  }
}

function toggleView() {
  const toggle = document.getElementById("viewToggle");
  alternativeViewActive = toggle.checked;

  document
    .getElementById("singleViewLabel")
    .classList.toggle("active", !alternativeViewActive);
  document
    .getElementById("alternativeViewLabel")
    .classList.toggle("active", alternativeViewActive);

  document.getElementById("singleCostCenterView").style.display =
    alternativeViewActive ? "none" : "block";
  document
    .getElementById("alternativeView")
    .classList.toggle("active", alternativeViewActive);

  if (alternativeViewActive) {
    // Populate cost center filter if not already populated
    populateCostCenterFilter();
    renderAllCostCentersView();
  }
}

function renderAllCostCentersView() {
  if (!alternativeViewActive) return;

  // Update counts
  const uniqueCostCenters = new Set(
    filteredAllEntries.map((e) => e.costCenterId),
  ).size;
  document.getElementById("totalCostCentersCount").textContent =
    uniqueCostCenters;
  document.getElementById("totalTransactionsCount").textContent =
    filteredAllEntries.length;

  // Calculate prediction stats
  const withPrediction = filteredAllEntries.filter(
    (e) => e.incomePrediction || e.expensePrediction,
  ).length;

  const predictionStats = document.getElementById("allPredictionStats");
  if (withPrediction > 0) {
    predictionStats.classList.remove("hidden");
    document.getElementById("allWithPredictionCount").textContent =
      withPrediction;
  } else {
    predictionStats.classList.add("hidden");
  }

  renderAllEntriesTable();
}

function renderAllEntriesTable() {
  const tbody = document.getElementById("allEntriesBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  const today = getTodayFormatted();

  if (filteredAllEntries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="9" style="text-align: center; color: #888;">
        ${
          allEntriesFlat.length === 0
            ? "Không có dữ liệu nào từ các trạm."
            : "Không có kết quả phù hợp với bộ lọc."
        }
      </td>
    `;
    tbody.appendChild(row);
    return;
  }

  filteredAllEntries.forEach((entry) => {
    const row = document.createElement("tr");
    row.setAttribute("data-cost-center-id", entry.costCenterId);
    row.setAttribute("data-entry-id", entry._id);

    const note = entry.note || "";
    const dateClass = entry.date === today ? "current-date" : "";

    row.innerHTML = `
      <td><strong>${entry.costCenterName}</strong></td>
      <td>${entry.name}</td>
      <td class="${dateClass}">${entry.date}</td>
      <td style="background-color: #e8f5e9;">${(entry.income || 0).toLocaleString("vi-VN")}</td>
      <td style="background-color: #e8f5e9;">${(entry.expense || 0).toLocaleString("vi-VN")}</td>
      <td style="background-color: #fff9e6;">${(entry.incomePrediction || 0).toLocaleString("vi-VN")}</td>
      <td style="background-color: #fff9e6;">${(entry.expensePrediction || 0).toLocaleString("vi-VN")}</td>
      <td>${note.replace(/\n/g, "<br>")}</td>
      <td class="actions">
        <button class="edit-btn" onclick="switchToCostCenterAndEdit('${entry.costCenterId}', '${entry._id}')">Sửa</button>
        <button class="delete-btn" onclick="switchToCostCenterAndDelete('${entry.costCenterId}', '${entry._id}')">Xóa</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// Filter functions for all cost centers view
function applyAllFilters() {
  allFilterState.dateFrom = document.getElementById("allDateFrom")?.value || "";
  allFilterState.dateTo = document.getElementById("allDateTo")?.value || "";
  allFilterState.searchName = (
    document.getElementById("allSearchName")?.value || ""
  ).toLowerCase();
  allFilterState.searchNote = (
    document.getElementById("allSearchNote")?.value || ""
  ).toLowerCase();
  allFilterState.costCenterFilter =
    document.getElementById("allCostCenterFilter")?.value || "all";
  allFilterState.predictionFilter =
    document.getElementById("allPredictionFilter")?.value || "all";

  filteredAllEntries = allEntriesFlat.filter((entry) => {
    // Date from filter
    if (
      allFilterState.dateFrom &&
      !isDateOnOrAfter(entry.date, allFilterState.dateFrom)
    ) {
      return false;
    }

    // Date to filter
    if (
      allFilterState.dateTo &&
      !isDateOnOrBefore(entry.date, allFilterState.dateTo)
    ) {
      return false;
    }

    // Name search filter
    if (
      allFilterState.searchName &&
      !entry.name.toLowerCase().includes(allFilterState.searchName)
    ) {
      return false;
    }

    // Note search filter
    if (
      allFilterState.searchNote &&
      !(entry.note || "").toLowerCase().includes(allFilterState.searchNote)
    ) {
      return false;
    }

    // Cost center filter
    if (
      allFilterState.costCenterFilter !== "all" &&
      entry.costCenterId !== allFilterState.costCenterFilter
    ) {
      return false;
    }

    // Prediction filter
    if (allFilterState.predictionFilter === "withPrediction") {
      if (!entry.incomePrediction && !entry.expensePrediction) {
        return false;
      }
    } else if (allFilterState.predictionFilter === "withoutPrediction") {
      if (entry.incomePrediction || entry.expensePrediction) {
        return false;
      }
    }

    return true;
  });

  if (alternativeViewActive) {
    renderAllCostCentersView();
  }

  sortAllEntries(currentAllSortField, currentAllSortDirection);
}

function resetAllFilters() {
  const dateFrom = document.getElementById("allDateFrom");
  const dateTo = document.getElementById("allDateTo");
  const searchName = document.getElementById("allSearchName");
  const searchNote = document.getElementById("allSearchNote");
  const costCenterFilter = document.getElementById("allCostCenterFilter");
  const predictionFilter = document.getElementById("allPredictionFilter");

  if (dateFrom) dateFrom.value = "";
  if (dateTo) dateTo.value = "";
  if (searchName) searchName.value = "";
  if (searchNote) searchNote.value = "";
  if (costCenterFilter) costCenterFilter.value = "all";
  if (predictionFilter) predictionFilter.value = "all";

  allFilterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
    searchNote: "",
    costCenterFilter: "all",
    predictionFilter: "all",
  };

  applyAllFilters();
}

function sortAllEntries(field, direction) {
  filteredAllEntries.sort((a, b) => {
    let aValue = a[field];
    let bValue = b[field];

    if (field === "date") {
      aValue = parseDate(aValue);
      bValue = parseDate(bValue);
    } else if (field === "costCenter") {
      aValue = a.costCenterName;
      bValue = b.costCenterName;
    } else if (field === "note") {
      aValue = a.note || "";
      bValue = b.note || "";
    }

    if (aValue === undefined || aValue === null)
      aValue = direction === "asc" ? Infinity : -Infinity;
    if (bValue === undefined || bValue === null)
      bValue = direction === "asc" ? Infinity : -Infinity;

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  updateAllSortIndicators(field, direction);

  if (alternativeViewActive) {
    renderAllEntriesTable();
  }
}

function updateAllSortIndicators(field, direction) {
  const headers = document.querySelectorAll("#allCostCentersTable th.sortable");
  headers.forEach((header) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (header.getAttribute("data-field") === field) {
      header.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

function sortAllTable(field) {
  if (currentAllSortField === field) {
    currentAllSortDirection =
      currentAllSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentAllSortField = field;
    currentAllSortDirection = "asc";
  }

  sortAllEntries(currentAllSortField, currentAllSortDirection);
}

function switchToCostCenterAndEdit(costCenterId, entryId) {
  // Switch to single view
  const toggle = document.getElementById("viewToggle");
  if (toggle.checked) {
    toggle.checked = false;
    toggleView();
  }

  // Select the cost center
  document.getElementById("costCenterSelect").value = costCenterId;

  // Load data and start editing
  loadCostCenterData().then(() => {
    setTimeout(() => {
      startEdit(entryId);
    }, 500);
  });
}

function switchToCostCenterAndDelete(costCenterId, entryId) {
  // Switch to single view
  const toggle = document.getElementById("viewToggle");
  if (toggle.checked) {
    toggle.checked = false;
    toggleView();
  }

  // Select the cost center
  document.getElementById("costCenterSelect").value = costCenterId;

  // Load data and delete
  loadCostCenterData().then(() => {
    setTimeout(() => {
      deleteEntry(entryId);
    }, 500);
  });
}

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
  document.getElementById("costCenterInfo").classList.remove("hidden");
  document.getElementById("addFormContainer").classList.remove("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  document.getElementById("filtersSection").classList.remove("hidden");

  await loadEntries();

  allEntries[currentCostCenterId] = {
    name: selectedOption.textContent,
    entries: entries,
  };

  flattenAllEntries();
  calculateGlobalSummary();
}

async function loadEntries() {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`);
    entries = await response.json();
    applyFilters();
    resetEditStates();
  } catch (error) {
    alert("Lỗi khi tải dữ liệu: " + error.message);
  }
}

function resetEditStates() {
  isAdding = false;
  editingEntryId = null;
  showAddButton();
  hideMultipleEntryForm();
}

function showAddButton() {
  const addButton = document.getElementById("addNewEntryBtn");
  if (addButton) {
    addButton.style.display = "inline-block";
  }
}

function hideAddButton() {
  const addButton = document.getElementById("addNewEntryBtn");
  if (addButton) {
    addButton.style.display = "none";
  }
}

function hideMultipleEntryForm() {
  document.getElementById("multipleEntryForm").classList.add("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  showAddButton();
  clearMultipleEntries();
}

function sortEntries(field, direction) {
  filteredEntries.sort((a, b) => {
    let aValue = a[field];
    let bValue = b[field];

    if (field === "date") {
      aValue = parseDate(aValue);
      bValue = parseDate(bValue);
    }

    if (aValue === undefined || aValue === null)
      aValue = direction === "asc" ? Infinity : -Infinity;
    if (bValue === undefined || bValue === null)
      bValue = direction === "asc" ? Infinity : -Infinity;

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  updateSortIndicators(field, direction);
}

function parseDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
}

function updateSortIndicators(field, direction) {
  const headers = document.querySelectorAll("#entriesTable th.sortable");
  headers.forEach((header) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (header.getAttribute("data-field") === field) {
      header.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

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

function calculateSummary() {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalIncomePrediction = 0;
  let totalExpensePrediction = 0;
  let entriesWithPrediction = 0;

  filteredEntries.forEach((entry) => {
    totalIncome += entry.income || 0;
    totalExpense += entry.expense || 0;
    totalIncomePrediction += entry.incomePrediction || 0;
    totalExpensePrediction += entry.expensePrediction || 0;
    if (entry.incomePrediction || entry.expensePrediction) {
      entriesWithPrediction++;
    }
  });

  const totalProfit = totalIncome - totalExpense;

  document.getElementById("totalIncome").textContent =
    totalIncome.toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent =
    totalExpense.toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent =
    totalProfit.toLocaleString("vi-VN");
  document.getElementById("totalIncomePrediction").textContent =
    totalIncomePrediction.toLocaleString("vi-VN");
  document.getElementById("totalExpensePrediction").textContent =
    totalExpensePrediction.toLocaleString("vi-VN");

  const predictionStats = document.getElementById("predictionStats");
  if (entriesWithPrediction > 0) {
    predictionStats.classList.remove("hidden");
    document.getElementById("withPredictionCount").textContent =
      entriesWithPrediction;
  } else {
    predictionStats.classList.add("hidden");
  }

  document.getElementById("summarySection").classList.remove("hidden");
}

function renderEntries() {
  const tbody = document.getElementById("entriesBody");
  tbody.innerHTML = "";

  document.getElementById("currentEntriesCount").textContent =
    filteredEntries.length;
  document.getElementById("totalEntriesCount").textContent = entries.length;

  if (filteredEntries.length === 0 && !isAdding) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="8" style="text-align: center; color: #888;">
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

  const today = getTodayFormatted();

  filteredEntries.forEach((entry) => {
    const row = document.createElement("tr");

    if (entry._id === editingEntryId) {
      row.className = "editing-row";
      row.innerHTML = `
        <td><input type="text" id="editName_${entry._id}" value="${entry.name}" required></td>
        <td><input type="text" id="editDate_${entry._id}" value="${entry.date}" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
        <td><input type="number" id="editIncome_${entry._id}" value="${entry.income}" step="0.1" required></td>
        <td><input type="number" id="editExpense_${entry._id}" value="${entry.expense}" step="0.1" required></td>
        <td><input type="number" id="editIncomePrediction_${entry._id}" value="${entry.incomePrediction || 0}" step="0.1"></td>
        <td><input type="number" id="editExpensePrediction_${entry._id}" value="${entry.expensePrediction || 0}" step="0.1"></td>
        <td><textarea id="editNote_${entry._id}" placeholder="Ghi chú">${entry.note || ""}</textarea></td>
        <td class="actions">
          <button class="save-btn" onclick="saveEdit('${entry._id}')">Lưu</button>
          <button class="cancel-btn" onclick="cancelEdit('${entry._id}')">Hủy</button>
        </td>
      `;
    } else {
      const note = entry.note || "";
      const dateClass = entry.date === today ? "current-date" : "";

      row.innerHTML = `
        <td>${entry.name}</td>
        <td class="${dateClass}">${entry.date}</td>
        <td style="background-color: #e8f5e9;">${entry.income.toLocaleString("vi-VN")}</td>
        <td style="background-color: #e8f5e9;">${entry.expense.toLocaleString("vi-VN")}</td>
        <td style="background-color: #fff9e6;">${(entry.incomePrediction || 0).toLocaleString("vi-VN")}</td>
        <td style="background-color: #fff9e6;">${(entry.expensePrediction || 0).toLocaleString("vi-VN")}</td>
        <td>${note.replace(/\n/g, "<br>")}</td>
        <td class="actions">
          <button class="edit-btn" onclick="startEdit('${entry._id}')">Sửa</button>
          <button class="delete-btn" onclick="deleteEntry('${entry._id}')">Xóa</button>
        </td>
      `;
    }
    tbody.appendChild(row);
  });

  if (isAdding) {
    const addRow = createAddRow();
    tbody.insertBefore(addRow, tbody.firstChild);
  }
}

function createAddRow() {
  const row = document.createElement("tr");
  row.id = "addEntryRow";
  row.className = "editing-row";

  const today = getTodayFormatted();

  row.innerHTML = `
    <td><input type="text" id="newName" placeholder="Tên giao dịch" required></td>
    <td><input type="text" id="newDate" value="${today}" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
    <td><input type="number" id="newIncome" placeholder="Thu nhập" step="0.1" value="0" required></td>
    <td><input type="number" id="newExpense" placeholder="Chi phí" step="0.1" value="0" required></td>
    <td><input type="number" id="newIncomePrediction" placeholder="Dự báo thu" step="0.1" value="0"></td>
    <td><input type="number" id="newExpensePrediction" placeholder="Dự báo chi" step="0.1" value="0"></td>
    <td><textarea id="newNote" placeholder="Ghi chú"></textarea></td>
    <td class="actions">
      <button class="save-btn" onclick="saveNewEntry()">Lưu</button>
      <button class="cancel-btn" onclick="cancelAdd()">Hủy</button>
    </td>
  `;

  return row;
}

function showAddRow() {
  if (isAdding || editingEntryId) {
    return;
  }

  isAdding = true;
  hideAddButton();
  renderEntries();
}

function cancelAdd() {
  isAdding = false;
  showAddButton();
  renderEntries();
}

async function saveNewEntry() {
  if (!currentCostCenterId) return;

  const name = document.getElementById("newName").value;
  const income = parseFloat(document.getElementById("newIncome").value);
  const expense = parseFloat(document.getElementById("newExpense").value);
  const date = document.getElementById("newDate").value;
  const incomePrediction =
    parseFloat(document.getElementById("newIncomePrediction").value) || 0;
  const expensePrediction =
    parseFloat(document.getElementById("newExpensePrediction").value) || 0;
  const note = document.getElementById("newNote").value.trim();

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
    incomePrediction,
    expensePrediction,
    note,
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
      await updateGlobalSummary();
      alert("Thêm mục thành công!");
    } else {
      const errorData = await response.json();
      alert("Lỗi khi thêm mục: " + (errorData.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi khi thêm mục: " + error.message);
  }
}

function startEdit(entryId) {
  if (isAdding) {
    cancelAdd();
  }

  editingEntryId = entryId;
  hideAddButton();
  renderEntries();
}

function cancelEdit(entryId) {
  editingEntryId = null;
  showAddButton();
  renderEntries();
}

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
  const incomePrediction = parseFloat(
    document.getElementById(`editIncomePrediction_${entryId}`).value || 0,
  );
  const expensePrediction = parseFloat(
    document.getElementById(`editExpensePrediction_${entryId}`).value || 0,
  );
  const note = document.getElementById(`editNote_${entryId}`).value.trim();

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
    incomePrediction,
    expensePrediction,
    note,
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
      await updateGlobalSummary();
      alert("Cập nhật thành công!");
    } else {
      const errorData = await response.json();
      alert("Lỗi khi cập nhật mục: " + (errorData.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi khi cập nhật mục: " + error.message);
  }
}

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
        await updateGlobalSummary();
        alert("Xóa mục thành công!");
      } else {
        alert("Lỗi khi xóa mục");
      }
    } catch (error) {
      alert("Lỗi khi xóa mục: " + error.message);
    }
  }
}

function isValidDate(dateString) {
  if (!dateString) return false;
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

function applyFilters() {
  filterState.dateFrom = document.getElementById("dateFrom").value;
  filterState.dateTo = document.getElementById("dateTo").value;
  filterState.searchName = document
    .getElementById("searchName")
    .value.toLowerCase();
  filterState.searchNote = document
    .getElementById("searchNote")
    .value.toLowerCase();
  filterState.predictionFilter =
    document.getElementById("predictionFilter").value;

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

    if (
      filterState.searchNote &&
      !(entry.note || "").toLowerCase().includes(filterState.searchNote)
    ) {
      return false;
    }

    if (filterState.predictionFilter === "withPrediction") {
      if (!entry.incomePrediction && !entry.expensePrediction) {
        return false;
      }
    } else if (filterState.predictionFilter === "withoutPrediction") {
      if (entry.incomePrediction || entry.expensePrediction) {
        return false;
      }
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
  document.getElementById("searchNote").value = "";
  document.getElementById("predictionFilter").value = "all";

  filterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
    searchNote: "",
    predictionFilter: "all",
  };

  applyFilters();
}

function isDateOnOrAfter(dateString, compareDateString) {
  const date = parseDate(dateString);
  const compareDate = parseDate(compareDateString);
  if (!date || !compareDate) return true;
  return date >= compareDate;
}

function isDateOnOrBefore(dateString, compareDateString) {
  const date = parseDate(dateString);
  const compareDate = parseDate(compareDateString);
  if (!date || !compareDate) return true;
  return date <= compareDate;
}

function clearMultipleEntries() {
  const container = document.getElementById("multipleEntriesContainer");
  container.innerHTML = "";
  multipleEntryCounter = 0;
}

function showMultipleEntryForm() {
  if (isAdding || editingEntryId) {
    alert("Vui lòng hoàn thành thao tác hiện tại trước khi thêm nhiều mục");
    return;
  }

  clearMultipleEntries();

  document.getElementById("multipleEntryForm").classList.remove("hidden");
  document.getElementById("bulkActions").classList.add("hidden");
  hideAddButton();

  addEntryRow();
}

function addEntryRow() {
  const container = document.getElementById("multipleEntriesContainer");
  const entryId = `entry_${multipleEntryCounter++}`;

  const today = getTodayFormatted();

  const entryRow = document.createElement("div");
  entryRow.className = "entry-row";
  entryRow.id = entryId;
  entryRow.innerHTML = `
    <input type="text" id="${entryId}_name" placeholder="Tên giao dịch" required>
    <input type="text" id="${entryId}_date" value="${today}" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required>
    <input type="number" id="${entryId}_income" placeholder="Thu nhập (VND)" step="0.1" value="0" required>
    <input type="number" id="${entryId}_expense" placeholder="Chi phí (VND)" step="0.1" value="0" required>
    <input type="number" id="${entryId}_incomePrediction" placeholder="Dự báo thu" step="0.1" value="0">
    <input type="number" id="${entryId}_expensePrediction" placeholder="Dự báo chi" step="0.1" value="0">
    <textarea id="${entryId}_note" placeholder="Ghi chú"></textarea>
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
    addEntryRow();
  }
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
    const date = document.getElementById(`${entryId}_date`).value;
    const income = parseFloat(
      document.getElementById(`${entryId}_income`).value,
    );
    const expense = parseFloat(
      document.getElementById(`${entryId}_expense`).value,
    );
    const incomePrediction = parseFloat(
      document.getElementById(`${entryId}_incomePrediction`).value || 0,
    );
    const expensePrediction = parseFloat(
      document.getElementById(`${entryId}_expensePrediction`).value || 0,
    );
    const note = document.getElementById(`${entryId}_note`).value.trim();

    if (!name) {
      alert(`Vui lòng nhập tên cho mục này`);
      hasError = true;
      break;
    }

    if (isNaN(income) || isNaN(expense)) {
      alert(`Vui lòng nhập số tiền hợp lệ cho mục này`);
      hasError = true;
      break;
    }

    if (!isValidDate(date)) {
      alert(`Vui lòng nhập ngày hợp lệ (DD/MM/YYYY) cho mục này`);
      hasError = true;
      break;
    }

    entriesToSave.push({
      name,
      date,
      income,
      expense,
      incomePrediction,
      expensePrediction,
      note,
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

      clearMultipleEntries();
      hideMultipleEntryForm();

      await loadEntries();
      await updateGlobalSummary();
    } else {
      alert(
        `Đã thêm ${successCount} mục thành công, ${errorCount} mục thất bại.`,
      );

      if (successCount > 0 && errorCount === 0) {
        clearMultipleEntries();
        hideMultipleEntryForm();
        await loadEntries();
        await updateGlobalSummary();
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

async function exportData() {
  if (!currentCostCenterId || filteredEntries.length === 0) {
    alert("Không có dữ liệu để xuất");
    return;
  }

  try {
    let csvContent =
      "Tên giao dịch,Ngày,Thu nhập (VND),Chi phí (VND),Dự báo thu (VND),Dự báo chi (VND),Ghi chú\n";

    filteredEntries.forEach((entry) => {
      const row = [
        `"${entry.name}"`,
        entry.date,
        entry.income,
        entry.expense,
        entry.incomePrediction || 0,
        entry.expensePrediction || 0,
        `"${entry.note || ""}"`,
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `daily_finance_${currentCostCenterId}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Lỗi khi xuất dữ liệu: " + error.message);
  }
}

function showGlobalDetails() {
  const costCentersWithEntries = Object.entries(allEntries).filter(
    ([costCenterId, data]) => {
      if (!data.entries || data.entries.length === 0) return false;
      return data.entries.some(
        (entry) =>
          (entry.income && entry.income > 0) ||
          (entry.expense && entry.expense > 0),
      );
    },
  );

  if (costCentersWithEntries.length === 0) {
    alert("Không có trạm nào có dữ liệu thực tế hàng ngày.");
    return;
  }

  const modalContent = `
    <div class="modal fade" id="globalDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
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
                    <th>Có Dự Báo</th>
                    <th>Tổng Thu (VND)</th>
                    <th>Tổng Chi (VND)</th>
                    <th>Lợi Nhuận (VND)</th>
                    <th>Tổng Dự Báo Thu</th>
                    <th>Tổng Dự Báo Chi</th>
                  </tr>
                </thead>
                <tbody>
                  ${costCentersWithEntries
                    .map(([costCenterId, data]) => {
                      const totals = data.entries.reduce(
                        (acc, entry) => {
                          acc.totalIncome += entry.income || 0;
                          acc.totalExpense += entry.expense || 0;
                          acc.totalIncomePrediction +=
                            entry.incomePrediction || 0;
                          acc.totalExpensePrediction +=
                            entry.expensePrediction || 0;
                          if (
                            entry.incomePrediction ||
                            entry.expensePrediction
                          ) {
                            acc.withPrediction++;
                          }
                          return acc;
                        },
                        {
                          totalIncome: 0,
                          totalExpense: 0,
                          totalIncomePrediction: 0,
                          totalExpensePrediction: 0,
                          withPrediction: 0,
                        },
                      );

                      const profit = totals.totalIncome - totals.totalExpense;
                      const profitClass =
                        profit >= 0
                          ? "text-success fw-bold"
                          : "text-danger fw-bold";

                      return `
                        <tr onclick="switchToCostCenter('${costCenterId}')" style="cursor: pointer;" title="Nhấp để xem chi tiết trạm ${data.name}">
                          <td><strong>${data.name}</strong></td>
                          <td>${data.entries.length}</td>
                          <td>${totals.withPrediction}</td>
                          <td>${totals.totalIncome.toLocaleString("vi-VN")}</td>
                          <td>${totals.totalExpense.toLocaleString("vi-VN")}</td>
                          <td class="${profitClass}">${profit.toLocaleString("vi-VN")}</td>
                          <td>${totals.totalIncomePrediction.toLocaleString("vi-VN")}</td>
                          <td>${totals.totalExpensePrediction.toLocaleString("vi-VN")}</td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
                <tfoot class="table-secondary">
                  <tr>
                    <td><strong>TỔNG CỘNG</strong></td>
                    <td><strong>${costCentersWithEntries.reduce(
                      (sum, [_, data]) => sum + data.entries.length,
                      0,
                    )}</strong></td>
                    <td><strong>${costCentersWithEntries.reduce(
                      (sum, [_, data]) =>
                        sum +
                        data.entries.filter(
                          (e) => e.incomePrediction || e.expensePrediction,
                        ).length,
                      0,
                    )}</strong></td>
                    <td><strong>${costCentersWithEntries
                      .reduce(
                        (sum, [_, data]) =>
                          sum +
                          data.entries.reduce(
                            (acc, entry) => acc + (entry.income || 0),
                            0,
                          ),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                    <td><strong>${costCentersWithEntries
                      .reduce(
                        (sum, [_, data]) =>
                          sum +
                          data.entries.reduce(
                            (acc, entry) => acc + (entry.expense || 0),
                            0,
                          ),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                    <td><strong class="${
                      costCentersWithEntries.reduce((sum, [_, data]) => {
                        const costCenterTotal = data.entries.reduce(
                          (acc, entry) => {
                            acc.income += entry.income || 0;
                            acc.expense += entry.expense || 0;
                            return acc;
                          },
                          { income: 0, expense: 0 },
                        );
                        return (
                          sum +
                          (costCenterTotal.income - costCenterTotal.expense)
                        );
                      }, 0) >= 0
                        ? "text-success"
                        : "text-danger"
                    }">
                      ${costCentersWithEntries
                        .reduce((sum, [_, data]) => {
                          const costCenterTotal = data.entries.reduce(
                            (acc, entry) => {
                              acc.income += entry.income || 0;
                              acc.expense += entry.expense || 0;
                              return acc;
                            },
                            { income: 0, expense: 0 },
                          );
                          return (
                            sum +
                            (costCenterTotal.income - costCenterTotal.expense)
                          );
                        }, 0)
                        .toLocaleString("vi-VN")}
                    </strong></td>
                    <td><strong>${costCentersWithEntries
                      .reduce(
                        (sum, [_, data]) =>
                          sum +
                          data.entries.reduce(
                            (acc, entry) => acc + (entry.incomePrediction || 0),
                            0,
                          ),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                    <td><strong>${costCentersWithEntries
                      .reduce(
                        (sum, [_, data]) =>
                          sum +
                          data.entries.reduce(
                            (acc, entry) =>
                              acc + (entry.expensePrediction || 0),
                            0,
                          ),
                        0,
                      )
                      .toLocaleString("vi-VN")}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="mt-3">
              <small class="text-muted">* Chỉ hiển thị các trạm có dữ liệu thực tế hàng ngày</small>
              <br>
              <small class="text-muted">* Nhấp vào tên trạm để chuyển sang xem chi tiết</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
            <button type="button" class="btn btn-primary" onclick="refreshGlobalData()">
              🔄 Làm Mới Dữ Liệu
            </button>
            <button type="button" class="btn btn-success" onclick="exportAllData()">
              📁 Xuất Toàn Bộ
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById("globalDetailsModal");
  if (existingModal) {
    existingModal.remove();
  }

  document.body.insertAdjacentHTML("beforeend", modalContent);

  const modal = new bootstrap.Modal(
    document.getElementById("globalDetailsModal"),
  );
  modal.show();
}

function switchToCostCenter(costCenterId) {
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("globalDetailsModal"),
  );
  if (modal) modal.hide();

  // Switch to single view
  const toggle = document.getElementById("viewToggle");
  if (toggle.checked) {
    toggle.checked = false;
    toggleView();
  }

  document.getElementById("costCenterSelect").value = costCenterId;
  loadCostCenterData();
}

async function refreshGlobalData() {
  await loadAllCostCentersData();
  alert("Đã cập nhật dữ liệu toàn hệ thống!");
}

async function exportAllData() {
  try {
    const costCentersWithEntries = Object.entries(allEntries).filter(
      ([costCenterId, data]) => {
        if (!data.entries || data.entries.length === 0) return false;
        return data.entries.some(
          (entry) =>
            (entry.income && entry.income > 0) ||
            (entry.expense && entry.expense > 0),
        );
      },
    );

    if (costCentersWithEntries.length === 0) {
      alert("Không có dữ liệu thực tế để xuất");
      return;
    }

    let csvContent =
      "Trạm,Tên giao dịch,Ngày,Thu nhập (VND),Chi phí (VND),Dự báo thu (VND),Dự báo chi (VND),Ghi chú\n";

    costCentersWithEntries.forEach(([costCenterId, data]) => {
      if (data.entries && data.entries.length > 0) {
        data.entries.forEach((entry) => {
          const row = [
            `"${data.name}"`,
            `"${entry.name}"`,
            entry.date,
            entry.income,
            entry.expense,
            entry.incomePrediction || 0,
            entry.expensePrediction || 0,
            `"${entry.note || ""}"`,
          ];
          csvContent += row.join(",") + "\n";
        });
      }
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `all_daily_finance_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Lỗi khi xuất dữ liệu: " + error.message);
  }
}

async function refreshAllData() {
  await loadAllCostCentersData();
  // Re-apply filters after data refresh
  applyAllFilters();
  alert("Đã làm mới dữ liệu toàn hệ thống!");
}

async function exportAlternativeView() {
  try {
    if (filteredAllEntries.length === 0) {
      alert("Không có dữ liệu thực tế để xuất");
      return;
    }

    let csvContent =
      "Trạm,Tên giao dịch,Ngày,Thu nhập (VND),Chi phí (VND),Dự báo thu (VND),Dự báo chi (VND),Ghi chú\n";

    filteredAllEntries.forEach((entry) => {
      const row = [
        `"${entry.costCenterName}"`,
        `"${entry.name}"`,
        entry.date,
        entry.income,
        entry.expense,
        entry.incomePrediction || 0,
        entry.expensePrediction || 0,
        `"${entry.note || ""}"`,
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `all_cost_centers_daily_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Lỗi khi xuất dữ liệu: " + error.message);
  }
}
