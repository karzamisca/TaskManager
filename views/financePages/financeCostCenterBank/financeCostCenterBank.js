// views/financePages/financeCostCenterBank/financeCostCenterBank.js
const API_BASE = "/financeCostCenterBankControl";
let currentCostCenterId = null;
let entries = [];
let filteredEntries = [];
let currentSortField = "date";
let currentSortDirection = "desc";
let isAdding = false;
let editingEntryId = null;
let multipleEntryCounter = 0;
let currentFundLimitBank = 0;

// Biến cho tổng kết toàn hệ thống
let allCostCenters = [];
let allEntries = {}; // Lưu entries của từng cost center: { costCenterId: { name: string, entries: array } }
let allEntriesFlat = []; // Flat list for all view
let allFundInfo = {}; // Lưu fund info của từng cost center

// Filter state for single view
let filterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
  searchNote: "",
  predictionFilter: "all",
};

// All view state
let alternativeViewActive = false;
let isAddingInAllView = false;
let addingCostCenterId = null;
let allViewMultipleEntryCounter = 0;
let isAddingMultipleInAllView = false;

// All view filter state
let allFilterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
  searchNote: "",
  costCenterFilter: "all",
  predictionFilter: "all",
};

let filteredAllEntries = [];
let currentAllSortField = "date";
let currentAllSortDirection = "desc";

// Tải trạm khi trang load
document.addEventListener("DOMContentLoaded", loadCostCenters);

function getTodayFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
}

function calculateProfit(income, expense) {
  return (income || 0) - (expense || 0);
}

function getProfitClass(profit) {
  if (profit > 0) return "profit-positive";
  if (profit < 0) return "profit-negative";
  return "profit-neutral";
}

// Parse date from DD/MM/YYYY format
function parseDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
}

// Progressive totals for all view
function buildProgressiveTotals(sortedEntries, direction) {
  const chronological =
    direction === "asc" ? [...sortedEntries] : [...sortedEntries].reverse();

  const dateOrder = [];
  const byDate = {};
  chronological.forEach((e) => {
    if (!byDate[e.date]) {
      byDate[e.date] = { income: 0, expense: 0 };
      dateOrder.push(e.date);
    }
    byDate[e.date].income += e.income || 0;
    byDate[e.date].expense += e.expense || 0;
  });

  let runActual = 0;
  const totalsMap = {};
  dateOrder.forEach((date) => {
    const d = byDate[date];
    runActual += d.income - d.expense;
    totalsMap[date] = { actual: runActual };
  });

  return totalsMap;
}

// Creates the separator row after each day's entries
function createDailyTotalRow(date, actual, colCount, isAllView) {
  const tr = document.createElement("tr");
  tr.className = "daily-progressive-row";
  tr.setAttribute("data-progressive-date", date);

  const actualClass = getProfitClass(actual);
  const actualFmt = actual.toLocaleString("vi-VN");

  if (isAllView) {
    tr.innerHTML = `
      <td colspan="3" class="daily-progressive-label">
        <span class="daily-progressive-date">${date}</span>
        <span class="daily-progressive-title">Lũy kế đến cuối ngày</span>
      </td>
      <td colspan="2" class="daily-progressive-actual ${actualClass}">
        <span class="daily-progressive-value-label">Thực tế:</span> ${actualFmt} VND
      </td>
      <td colspan="2" class="daily-progressive-spacer"></td>
      <td colspan="1" class="daily-progressive-spacer"></td>
      <td colspan="1" class="daily-progressive-spacer"></td>
    `;
  } else {
    tr.innerHTML = `
      <td colspan="2" class="daily-progressive-label">
        <span class="daily-progressive-date">${date}</span>
        <span class="daily-progressive-title">Lũy kế đến cuối ngày</span>
      </td>
      <td colspan="2" class="daily-progressive-actual ${actualClass}">
        <span class="daily-progressive-value-label">Thực tế:</span> ${actualFmt} VND
      </td>
      <td colspan="2" class="daily-progressive-spacer"></td>
      <td colspan="1" class="daily-progressive-spacer"></td>
      <td colspan="1" class="daily-progressive-spacer"></td>
    `;
  }

  return tr;
}

// Apply today red lines
function applyTodayRedLines(tbody, today, colSpan) {
  if (!tbody) return;
  const allRows = Array.from(tbody.querySelectorAll("tr[data-date]"));
  const todayRows = allRows.filter(
    (r) => r.getAttribute("data-date") === today,
  );

  tbody
    .querySelectorAll(".today-first-row, .today-last-row")
    .forEach((r) => r.classList.remove("today-first-row", "today-last-row"));
  tbody.querySelectorAll(".today-sentinel-row").forEach((r) => r.remove());

  if (todayRows.length > 0) {
    todayRows[0].classList.add("today-first-row");
    todayRows[todayRows.length - 1].classList.add("today-last-row");
  } else {
    insertTodaySentinel(tbody, today, colSpan, allRows);
  }
}

function insertTodaySentinel(tbody, today, colSpan, allRows) {
  const todayMs = parseDate(today)?.getTime();
  if (!todayMs) return;
  const dated = allRows
    .map((r) => ({
      row: r,
      ms: parseDate(r.getAttribute("data-date"))?.getTime(),
    }))
    .filter((x) => x.ms != null);

  let insertBefore = null;
  if (dated.length >= 2 && dated[0].ms >= dated[1].ms) {
    for (const { row, ms } of dated) {
      if (ms < todayMs) {
        insertBefore = row;
        break;
      }
    }
  } else {
    for (const { row, ms } of dated) {
      if (ms > todayMs) {
        insertBefore = row;
        break;
      }
    }
  }

  const sentinel = makeSentinelRow(colSpan);
  if (insertBefore) {
    tbody.insertBefore(sentinel, insertBefore);
  } else {
    const addRow = tbody.querySelector(".add-row");
    addRow ? tbody.insertBefore(sentinel, addRow) : tbody.appendChild(sentinel);
  }
}

function makeSentinelRow(colSpan) {
  const tr = document.createElement("tr");
  tr.className = "today-sentinel-row";
  const td = document.createElement("td");
  td.colSpan = colSpan;
  tr.appendChild(td);
  return tr;
}

// Today filter functions
function applyTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("dateFrom").value = today;
  document.getElementById("dateTo").value = today;
  applyFilters();
}

function applyAllTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("allDateFrom").value = today;
  document.getElementById("allDateTo").value = today;
  applyAllFilters();
}

// Toggle view
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
    isAdding = false;
    editingEntryId = null;
    isAddingMultipleInAllView = false;
    populateCostCenterFilter();
    renderAllCostCentersView();
  } else {
    isAddingInAllView = false;
    addingCostCenterId = null;
    isAddingMultipleInAllView = false;
    hideAllViewMultipleEntryForm();
  }
}

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

// Populate cost center filter in all view
function populateCostCenterFilter() {
  const select = document.getElementById("allCostCenterFilter");
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  allCostCenters.forEach((cc) => {
    const option = document.createElement("option");
    option.value = cc._id;
    option.textContent = cc.name;
    select.appendChild(option);
  });
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
          totalIncomePrediction: 0,
          totalExpensePrediction: 0,
          predictedFundAvailableBank: 0,
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
          totalIncomePrediction: 0,
          totalExpensePrediction: 0,
          predictedFundAvailableBank: 0,
        };
      }
    });

    await Promise.all(loadingPromises);

    flattenAllEntries();
    calculateGlobalSummary();
    populateCostCenterFilter();
    if (alternativeViewActive) renderAllCostCentersView();
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu toàn hệ thống:", error);
  }
}

// Flatten all entries for all view
function flattenAllEntries() {
  allEntriesFlat = [];
  Object.entries(allEntries).forEach(([costCenterId, data]) => {
    if (data.entries && data.entries.length > 0) {
      data.entries.forEach((entry) => {
        allEntriesFlat.push({
          ...entry,
          costCenterId,
          costCenterName: data.name,
        });
      });
    }
  });
  applyAllFilters();
}

// Tính tổng kết toàn hệ thống
function calculateGlobalSummary() {
  let globalTotalIncome = 0;
  let globalTotalExpense = 0;
  let globalTotalIncomePrediction = 0;
  let globalTotalExpensePrediction = 0;
  let globalTotalFundLimit = 0;
  let globalTotalFundAvailable = 0;
  let globalTotalPredictedFundAvailable = 0;

  // Duyệt qua tất cả cost centers
  Object.values(allFundInfo).forEach((fundInfo) => {
    globalTotalIncome += fundInfo.totalIncome || 0;
    globalTotalExpense += fundInfo.totalExpense || 0;
    globalTotalIncomePrediction += fundInfo.totalIncomePrediction || 0;
    globalTotalExpensePrediction += fundInfo.totalExpensePrediction || 0;
    globalTotalFundLimit += fundInfo.fundLimitBank || 0;
    globalTotalFundAvailable += fundInfo.fundAvailableBank || 0;
    globalTotalPredictedFundAvailable +=
      fundInfo.predictedFundAvailableBank || 0;
  });

  const globalTotalProfit = globalTotalIncome - globalTotalExpense;
  const globalTotalProfitPrediction =
    globalTotalIncomePrediction - globalTotalExpensePrediction;

  // Cập nhật UI
  document.getElementById("globalTotalIncome").textContent =
    globalTotalIncome.toLocaleString("vi-VN");
  document.getElementById("globalTotalExpense").textContent =
    globalTotalExpense.toLocaleString("vi-VN");
  document.getElementById("globalTotalProfit").textContent =
    globalTotalProfit.toLocaleString("vi-VN");
  document.getElementById("globalTotalProfitPrediction").textContent =
    globalTotalProfitPrediction.toLocaleString("vi-VN");
  document.getElementById("globalTotalFundLimit").textContent =
    globalTotalFundLimit.toLocaleString("vi-VN");
  document.getElementById("globalTotalFundAvailable").textContent =
    globalTotalFundAvailable.toLocaleString("vi-VN");
  document.getElementById("globalTotalPredictedFundAvailable").textContent =
    globalTotalPredictedFundAvailable.toLocaleString("vi-VN");
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

  flattenAllEntries();
  calculateGlobalSummary();
  if (alternativeViewActive) renderAllCostCentersView();
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
    document.getElementById("predictedFundAvailableBank").textContent = "0";
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

// Hide multiple entry form
function hideMultipleEntryForm() {
  document.getElementById("multipleEntryForm").classList.add("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  showAddButton();
  clearMultipleEntries();
}

// Clear multiple entries
function clearMultipleEntries() {
  const container = document.getElementById("multipleEntriesContainer");
  container.innerHTML = "";
  multipleEntryCounter = 0;
}

// Sort entries for single view
function sortEntries(field, direction) {
  if (field !== "date") return;
  filteredEntries.sort((a, b) => {
    const aValue = parseDate(a[field]);
    const bValue = parseDate(b[field]);
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });
  updateSortIndicators(field, direction);
}

// Update sort indicators in table headers
function updateSortIndicators(field, direction) {
  const headers = document.querySelectorAll("#entriesTable th.sortable");
  headers.forEach((header) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (header.getAttribute("data-field") === field) {
      header.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

// Sort table when header is clicked
function sortTable(field) {
  if (field !== "date") return;
  if (currentSortField === field) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortField = field;
    currentSortDirection = "asc";
  }

  sortEntries(currentSortField, currentSortDirection);
  renderEntries();
}

// Tính toán tổng kết cho single view
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
    if (entry.incomePrediction || entry.expensePrediction)
      entriesWithPrediction++;
  });

  const totalProfit = totalIncome - totalExpense;
  const totalProfitPrediction = totalIncomePrediction - totalExpensePrediction;
  const fundAvailableBank = currentFundLimitBank - totalExpense + totalIncome;
  const predictedFundAvailableBank =
    currentFundLimitBank - totalExpensePrediction + totalIncomePrediction;

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
  document.getElementById("totalProfitPrediction").textContent =
    totalProfitPrediction.toLocaleString("vi-VN");
  document.getElementById("fundLimitBankSummary").textContent =
    currentFundLimitBank.toLocaleString("vi-VN");
  document.getElementById("fundAvailableBank").textContent =
    fundAvailableBank.toLocaleString("vi-VN");
  document.getElementById("predictedFundAvailableBank").textContent =
    predictedFundAvailableBank.toLocaleString("vi-VN");

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

// Cập nhật thông tin quỹ
function updateFundSummary(fundData) {
  const fundAvailableBank = fundData.fundAvailableBank || 0;
  const predictedFundAvailableBank = fundData.predictedFundAvailableBank || 0;

  document.getElementById("fundLimitBankSummary").textContent = (
    fundData.fundLimitBank || 0
  ).toLocaleString("vi-VN");
  document.getElementById("fundAvailableBank").textContent =
    fundAvailableBank.toLocaleString("vi-VN");
  document.getElementById("predictedFundAvailableBank").textContent =
    predictedFundAvailableBank.toLocaleString("vi-VN");
  document.getElementById("totalIncome").textContent = (
    fundData.totalIncome || 0
  ).toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent = (
    fundData.totalExpense || 0
  ).toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent = (
    (fundData.totalIncome || 0) - (fundData.totalExpense || 0)
  ).toLocaleString("vi-VN");
  document.getElementById("totalIncomePrediction").textContent = (
    fundData.totalIncomePrediction || 0
  ).toLocaleString("vi-VN");
  document.getElementById("totalExpensePrediction").textContent = (
    fundData.totalExpensePrediction || 0
  ).toLocaleString("vi-VN");
  document.getElementById("totalProfitPrediction").textContent = (
    (fundData.totalIncomePrediction || 0) -
    (fundData.totalExpensePrediction || 0)
  ).toLocaleString("vi-VN");
}

// Hiển thị các mục trong bảng cho single view
function renderEntries() {
  const tbody = document.getElementById("entriesBody");
  tbody.innerHTML = "";

  document.getElementById("currentEntriesCount").textContent =
    filteredEntries.length;
  document.getElementById("totalEntriesCount").textContent = entries.length;

  const today = getTodayFormatted();

  if (filteredEntries.length === 0 && !isAdding) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="8" style="text-align: center; color: #666; padding: 20px;">
        ${
          entries.length === 0
            ? "Chưa có dữ liệu nào. Hãy thêm mục mới."
            : "Không có kết quả phù hợp với bộ lọc."
        }
      </td>
    `;
    tbody.appendChild(row);
    applyTodayRedLines(tbody, today, 8);
    return;
  }

  if (isAdding) {
    tbody.appendChild(createAddRow());
  }

  filteredEntries.forEach((entry, idx) => {
    const row = document.createElement("tr");
    row.setAttribute("data-date", entry.date);

    const profit = calculateProfit(entry.income, entry.expense);
    const profitPrediction = calculateProfit(
      entry.incomePrediction,
      entry.expensePrediction,
    );

    if (entry._id === editingEntryId) {
      row.className = "editing-row";
      row.innerHTML = `
        <td><input type="text" id="editName_${entry._id}" value="${entry.name}" required></td>
        <td><input type="text" id="editDate_${entry._id}" value="${entry.date}" placeholder="DD/MM/YYYY" required></td>
        <td><input type="number" id="editIncome_${entry._id}" value="${entry.income || 0}" step="0.1" required></td>
        <td><input type="number" id="editExpense_${entry._id}" value="${entry.expense || 0}" step="0.1" required></td>
        <td><input type="number" id="editIncomePrediction_${entry._id}" value="${entry.incomePrediction || 0}" step="0.1"></td>
        <td><input type="number" id="editExpensePrediction_${entry._id}" value="${entry.expensePrediction || 0}" step="0.1"></td>
        <td><textarea id="editNote_${entry._id}">${entry.note || ""}</textarea></td>
        <td class="actions">
          <button class="save-btn" onclick="saveEdit('${entry._id}')">Lưu</button>
          <button class="cancel-btn" onclick="cancelEdit('${entry._id}')">Hủy</button>
        </td>
      `;
    } else {
      const dateClass = entry.date === today ? "current-date" : "";
      const note = entry.note || "";
      row.innerHTML = `
        <td>${entry.name}</td>
        <td class="${dateClass}">${entry.date}</td>
        <td>${(entry.income || 0).toLocaleString("vi-VN")}</td>
        <td>${(entry.expense || 0).toLocaleString("vi-VN")}</td>
        <td>${(entry.incomePrediction || 0).toLocaleString("vi-VN")}</td>
        <td>${(entry.expensePrediction || 0).toLocaleString("vi-VN")}</td>
        <td>${note.replace(/\n/g, " ")}</td>
        <td class="actions">
          <button class="edit-btn" onclick="startEdit('${entry._id}')">Sửa</button>
          <button class="delete-btn" onclick="deleteEntry('${entry._id}')">Xóa</button>
        </td>
      `;
    }
    tbody.appendChild(row);
  });

  applyTodayRedLines(tbody, today, 8);
}

// Create add row for single view
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

// Show add row
function showAddRow() {
  if (isAdding || editingEntryId) return;
  isAdding = true;
  hideAddButton();
  renderEntries();
}

// Cancel add
function cancelAdd() {
  isAdding = false;
  showAddButton();
  renderEntries();
}

// Save new entry
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

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        income,
        expense,
        date,
        incomePrediction,
        expensePrediction,
        note,
      }),
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

// Start edit
function startEdit(entryId) {
  if (isAdding) {
    cancelAdd();
  }

  editingEntryId = entryId;
  hideAddButton();
  renderEntries();
}

// Cancel edit
function cancelEdit(entryId) {
  editingEntryId = null;
  showAddButton();
  renderEntries();
}

// Save edit
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
  const incomePrediction =
    parseFloat(
      document.getElementById(`editIncomePrediction_${entryId}`).value,
    ) || 0;
  const expensePrediction =
    parseFloat(
      document.getElementById(`editExpensePrediction_${entryId}`).value,
    ) || 0;
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

  try {
    const response = await fetch(
      `${API_BASE}/${currentCostCenterId}/entries/${entryId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          income,
          expense,
          date,
          incomePrediction,
          expensePrediction,
          note,
        }),
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

// Delete entry
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

// Validate date format
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

// Filter Functions for single view
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
      if (!entry.incomePrediction && !entry.expensePrediction) return false;
    } else if (filterState.predictionFilter === "withoutPrediction") {
      if (entry.incomePrediction || entry.expensePrediction) return false;
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

// Helper function to compare dates in DD/MM/YYYY format
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

// Multiple Entry Functions for single view
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
    const incomePrediction =
      parseFloat(
        document.getElementById(`${entryId}_incomePrediction`).value,
      ) || 0;
    const expensePrediction =
      parseFloat(
        document.getElementById(`${entryId}_expensePrediction`).value,
      ) || 0;
    const note = document.getElementById(`${entryId}_note`).value.trim();

    if (!name) {
      alert("Vui lòng nhập tên cho mục này");
      hasError = true;
      break;
    }

    if (isNaN(income) || isNaN(expense)) {
      alert("Vui lòng nhập số tiền hợp lệ cho mục này");
      hasError = true;
      break;
    }

    if (!isValidDate(date)) {
      alert("Vui lòng nhập ngày hợp lệ (DD/MM/YYYY) cho mục này");
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
      hideMultipleEntryForm();
      await loadEntries();
      await updateGlobalSummary();
    } else {
      alert(
        `Đã thêm ${successCount} mục thành công, ${errorCount} mục thất bại.`,
      );
      if (successCount > 0) {
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

// Export data for single view
async function exportData() {
  if (!currentCostCenterId || filteredEntries.length === 0) {
    alert("Không có dữ liệu để xuất");
    return;
  }

  try {
    let csvContent =
      "Tên giao dịch,Ngày,Thu nhập (VND),Chi phí (VND),Dự báo thu (VND),Dự báo chi (VND),Ghi chú\n";
    filteredEntries.forEach((entry) => {
      csvContent +=
        [
          `"${entry.name}"`,
          entry.date,
          entry.income || 0,
          entry.expense || 0,
          entry.incomePrediction || 0,
          entry.expensePrediction || 0,
          `"${entry.note || ""}"`,
        ].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute(
      "download",
      `bank_finance_${currentCostCenterId}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Lỗi khi xuất dữ liệu: " + error.message);
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
      await updateGlobalSummary();

      alert(result.message || "Cập nhật hạn mức thành công!");
    } else {
      const error = await response.json();
      alert("Lỗi khi cập nhật: " + (error.message || "Không xác định"));
    }
  } catch (error) {
    alert("Lỗi khi cập nhật hạn mức: " + error.message);
  }
}

// ==================== ALL VIEW FUNCTIONS ====================

// Render all cost centers view
function renderAllCostCentersView() {
  if (!alternativeViewActive) return;

  const uniqueCostCenters = new Set(
    filteredAllEntries.map((e) => e.costCenterId),
  ).size;
  document.getElementById("totalCostCentersCount").textContent =
    uniqueCostCenters;
  document.getElementById("totalTransactionsCount").textContent =
    filteredAllEntries.length;

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

// Render all entries table
function renderAllEntriesTable() {
  const tbody = document.getElementById("allEntriesBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const today = getTodayFormatted();

  if (isAddingInAllView) {
    tbody.appendChild(
      createAllViewAddRow(addingCostCenterId || allCostCenters[0]?._id),
    );
  }

  if (
    filteredAllEntries.length === 0 &&
    !isAddingInAllView &&
    !isAddingMultipleInAllView
  ) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="9" style="text-align:center;color:#666;padding:20px;">${
      allEntriesFlat.length === 0
        ? "Không có dữ liệu nào từ các trạm."
        : "Không có kết quả phù hợp với bộ lọc."
    }</td>`;
    tbody.appendChild(row);
    const addNewRow = document.createElement("tr");
    addNewRow.className = "add-row";
    addNewRow.innerHTML = `<td colspan="9"><button class="add-btn" onclick="showAllViewAddRow()">+ Thêm Mục Mới Cho Trạm</button></td>`;
    tbody.appendChild(addNewRow);
    applyTodayRedLines(tbody, today, 9);
    return;
  }

  // Build progressive totals for the visible filtered set
  const progressiveTotals = buildProgressiveTotals(
    filteredAllEntries,
    currentAllSortDirection,
  );
  const renderedProgressiveDates = new Set();

  filteredAllEntries.forEach((entry, idx) => {
    const row = document.createElement("tr");
    row.setAttribute("data-cost-center-id", entry.costCenterId);
    row.setAttribute("data-entry-id", entry._id);
    row.setAttribute("data-date", entry.date);

    const note = entry.note || "";
    const dateClass = entry.date === today ? "current-date" : "";

    row.innerHTML = `
      <td>${entry.costCenterName}</td>
      <td>${entry.name}</td>
      <td class="${dateClass}">${entry.date}</td>
      <td>${(entry.income || 0).toLocaleString("vi-VN")}</td>
      <td>${(entry.expense || 0).toLocaleString("vi-VN")}</td>
      <td>${(entry.incomePrediction || 0).toLocaleString("vi-VN")}</td>
      <td>${(entry.expensePrediction || 0).toLocaleString("vi-VN")}</td>
      <td>${note.replace(/\n/g, " ")}</td>
      <td class="actions">
        <button class="edit-btn" onclick="switchToCostCenterAndEdit('${entry.costCenterId}', '${entry._id}')">Sửa</button>
        <button class="delete-btn" onclick="switchToCostCenterAndDelete('${entry.costCenterId}', '${entry._id}')">Xóa</button>
      </td>`;
    tbody.appendChild(row);

    // Insert progressive total row at each date boundary
    const nextEntry = filteredAllEntries[idx + 1];
    const isDateBoundary = !nextEntry || nextEntry.date !== entry.date;
    if (isDateBoundary && !renderedProgressiveDates.has(entry.date)) {
      renderedProgressiveDates.add(entry.date);
      const totals = progressiveTotals[entry.date];
      if (totals) {
        tbody.appendChild(
          createDailyTotalRow(entry.date, totals.actual, 9, true),
        );
      }
    }
  });

  const addNewRow = document.createElement("tr");
  addNewRow.className = "add-row";
  addNewRow.innerHTML = `<td colspan="9"><button class="add-btn" onclick="showAllViewAddRow()">+ Thêm Mục Mới Cho Trạm</button></td>`;
  tbody.appendChild(addNewRow);

  applyTodayRedLines(tbody, today, 9);
}

// Create add row for all view
function createAllViewAddRow(costCenterId) {
  const row = document.createElement("tr");
  row.id = "allViewAddRow";
  row.className = "editing-row";
  const today = getTodayFormatted();
  row.innerHTML = `
    <td>
      <select id="allViewNewCostCenter" class="form-select" style="width:100%;">
        ${allCostCenters.map((cc) => `<option value="${cc._id}" ${cc._id === costCenterId ? "selected" : ""}>${cc.name}</option>`).join("")}
      </select>
    </td>
    <td><input type="text" id="allViewNewName" placeholder="Tên giao dịch" class="form-control" required></td>
    <td><input type="text" id="allViewNewDate" value="${today}" placeholder="DD/MM/YYYY" class="form-control" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
    <td><input type="number" id="allViewNewIncome" placeholder="Thu nhập" class="form-control" step="0.1" value="0" required></td>
    <td><input type="number" id="allViewNewExpense" placeholder="Chi phí" class="form-control" step="0.1" value="0" required></td>
    <td><input type="number" id="allViewNewIncomePrediction" placeholder="Dự báo thu" class="form-control" step="0.1" value="0"></td>
    <td><input type="number" id="allViewNewExpensePrediction" placeholder="Dự báo chi" class="form-control" step="0.1" value="0"></td>
    <td><textarea id="allViewNewNote" placeholder="Ghi chú" class="form-control" rows="2"></textarea></td>
    <td class="actions">
      <button class="save-btn btn btn-sm btn-success" onclick="saveAllViewNewEntry()">Lưu</button>
      <button class="cancel-btn btn btn-sm btn-secondary" onclick="cancelAllViewAdd()">Hủy</button>
    </td>
  `;
  return row;
}

// Show add row in all view
function showAllViewAddRow() {
  if (isAddingInAllView || isAddingMultipleInAllView) return;
  addingCostCenterId =
    allFilterState.costCenterFilter !== "all"
      ? allFilterState.costCenterFilter
      : allCostCenters[0]?._id || null;
  isAddingInAllView = true;
  renderAllEntriesTable();
}

// Cancel add in all view
function cancelAllViewAdd() {
  isAddingInAllView = false;
  addingCostCenterId = null;
  renderAllEntriesTable();
}

// Save new entry in all view
async function saveAllViewNewEntry() {
  const costCenterId = document.getElementById("allViewNewCostCenter").value;
  const name = document.getElementById("allViewNewName").value;
  const income = parseFloat(document.getElementById("allViewNewIncome").value);
  const expense = parseFloat(
    document.getElementById("allViewNewExpense").value,
  );
  const date = document.getElementById("allViewNewDate").value;
  const incomePrediction =
    parseFloat(document.getElementById("allViewNewIncomePrediction").value) ||
    0;
  const expensePrediction =
    parseFloat(document.getElementById("allViewNewExpensePrediction").value) ||
    0;
  const note = document.getElementById("allViewNewNote").value.trim();

  if (!costCenterId) {
    alert("Vui lòng chọn trạm");
    return;
  }
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

  try {
    const response = await fetch(`${API_BASE}/${costCenterId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        income,
        expense,
        date,
        incomePrediction,
        expensePrediction,
        note,
      }),
    });
    if (response.ok) {
      isAddingInAllView = false;
      addingCostCenterId = null;
      await loadAllCostCentersData();
      applyAllFilters();
      alert("Thêm mục thành công!");
    } else {
      const errorData = await response.json();
      alert("Lỗi khi thêm mục: " + (errorData.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi khi thêm mục: " + error.message);
  }
}

// Show multiple entry form in all view
function showAllViewMultipleEntryForm() {
  if (isAddingInAllView || isAddingMultipleInAllView) {
    alert("Vui lòng hoàn thành thao tác hiện tại trước khi thêm nhiều mục");
    return;
  }
  clearAllViewMultipleEntries();
  document
    .getElementById("allViewMultipleEntryForm")
    .classList.remove("hidden");
  isAddingMultipleInAllView = true;
  addAllViewEntryRow();
}

// Clear all view multiple entries
function clearAllViewMultipleEntries() {
  const container = document.getElementById("allViewMultipleEntriesContainer");
  container.innerHTML = "";
  allViewMultipleEntryCounter = 0;
}

// Add entry row in all view multiple form
function addAllViewEntryRow() {
  const container = document.getElementById("allViewMultipleEntriesContainer");
  const entryId = `allViewEntry_${allViewMultipleEntryCounter++}`;
  const today = getTodayFormatted();
  const costCenterOptions = allCostCenters
    .map((cc) => `<option value="${cc._id}">${cc.name}</option>`)
    .join("");
  const entryRow = document.createElement("div");
  entryRow.className = "entry-row";
  entryRow.id = entryId;
  entryRow.innerHTML = `
    <select id="${entryId}_costCenter" class="form-select" style="min-width:150px;" required>
      <option value="">-- Chọn Trạm --</option>
      ${costCenterOptions}
    </select>
    <input type="text" id="${entryId}_name" placeholder="Tên giao dịch" required>
    <input type="text" id="${entryId}_date" value="${today}" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required>
    <input type="number" id="${entryId}_income" placeholder="Thu nhập" step="0.1" value="0" required>
    <input type="number" id="${entryId}_expense" placeholder="Chi phí" step="0.1" value="0" required>
    <input type="number" id="${entryId}_incomePrediction" placeholder="Dự báo thu" step="0.1" value="0">
    <input type="number" id="${entryId}_expensePrediction" placeholder="Dự báo chi" step="0.1" value="0">
    <textarea id="${entryId}_note" placeholder="Ghi chú" rows="2"></textarea>
    <button type="button" class="remove-entry-btn" onclick="removeAllViewEntryRow('${entryId}')">×</button>
  `;
  container.appendChild(entryRow);
}

// Remove entry row in all view multiple form
function removeAllViewEntryRow(entryId) {
  const entryRow = document.getElementById(entryId);
  if (entryRow) entryRow.remove();
  const container = document.getElementById("allViewMultipleEntriesContainer");
  if (container.children.length === 0) addAllViewEntryRow();
}

// Cancel all view multiple entries
function cancelAllViewMultipleEntries() {
  if (
    confirm("Bạn có chắc chắn muốn hủy? Tất cả dữ liệu chưa lưu sẽ bị mất.")
  ) {
    hideAllViewMultipleEntryForm();
  }
}

// Hide all view multiple entry form
function hideAllViewMultipleEntryForm() {
  document.getElementById("allViewMultipleEntryForm").classList.add("hidden");
  isAddingMultipleInAllView = false;
  clearAllViewMultipleEntries();
}

// Save all view multiple entries
async function saveAllViewMultipleEntries() {
  const container = document.getElementById("allViewMultipleEntriesContainer");
  const entryRows = container.getElementsByClassName("entry-row");
  if (entryRows.length === 0) {
    alert("Vui lòng thêm ít nhất một mục");
    return;
  }

  const entriesToSave = [];
  let hasError = false;

  for (let row of entryRows) {
    const entryId = row.id;
    const costCenterId = document.getElementById(`${entryId}_costCenter`).value;
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

    if (!costCenterId) {
      alert("Vui lòng chọn trạm cho mục này");
      hasError = true;
      break;
    }
    if (!name) {
      alert("Vui lòng nhập tên cho mục này");
      hasError = true;
      break;
    }
    if (isNaN(income) || isNaN(expense)) {
      alert("Vui lòng nhập số tiền hợp lệ cho mục này");
      hasError = true;
      break;
    }
    if (!isValidDate(date)) {
      alert("Vui lòng nhập ngày hợp lệ (DD/MM/YYYY) cho mục này");
      hasError = true;
      break;
    }

    entriesToSave.push({
      costCenterId,
      entry: {
        name,
        date,
        income,
        expense,
        incomePrediction,
        expensePrediction,
        note,
      },
    });
  }

  if (hasError) return;

  const saveBtn = document.querySelector("#allViewMultipleEntryForm .save-btn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Đang lưu...";
  saveBtn.disabled = true;

  try {
    let successCount = 0,
      errorCount = 0;
    for (const item of entriesToSave) {
      try {
        const response = await fetch(
          `${API_BASE}/${item.costCenterId}/entries`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.entry),
          },
        );
        if (response.ok) successCount++;
        else errorCount++;
      } catch (error) {
        errorCount++;
      }
    }
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    if (errorCount === 0) {
      alert(`Đã thêm thành công ${successCount} mục!`);
      hideAllViewMultipleEntryForm();
      await loadAllCostCentersData();
      applyAllFilters();
    } else {
      alert(
        `Đã thêm ${successCount} mục thành công, ${errorCount} mục thất bại.`,
      );
      if (successCount > 0) {
        hideAllViewMultipleEntryForm();
        await loadAllCostCentersData();
        applyAllFilters();
      }
    }
  } catch (error) {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    alert("Lỗi khi lưu các mục: " + error.message);
  }
}

// Apply all filters
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
    if (
      allFilterState.dateFrom &&
      !isDateOnOrAfter(entry.date, allFilterState.dateFrom)
    )
      return false;
    if (
      allFilterState.dateTo &&
      !isDateOnOrBefore(entry.date, allFilterState.dateTo)
    )
      return false;
    if (
      allFilterState.searchName &&
      !entry.name.toLowerCase().includes(allFilterState.searchName)
    )
      return false;
    if (
      allFilterState.searchNote &&
      !(entry.note || "").toLowerCase().includes(allFilterState.searchNote)
    )
      return false;
    if (
      allFilterState.costCenterFilter !== "all" &&
      entry.costCenterId !== allFilterState.costCenterFilter
    )
      return false;
    if (allFilterState.predictionFilter === "withPrediction") {
      if (!entry.incomePrediction && !entry.expensePrediction) return false;
    } else if (allFilterState.predictionFilter === "withoutPrediction") {
      if (entry.incomePrediction || entry.expensePrediction) return false;
    }
    return true;
  });

  if (alternativeViewActive) renderAllCostCentersView();
  sortAllEntries(currentAllSortField, currentAllSortDirection);
}

// Reset all filters
function resetAllFilters() {
  ["allDateFrom", "allDateTo", "allSearchName", "allSearchNote"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    },
  );
  const ccf = document.getElementById("allCostCenterFilter");
  if (ccf) ccf.value = "all";
  const pf = document.getElementById("allPredictionFilter");
  if (pf) pf.value = "all";

  allFilterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
    searchNote: "",
    costCenterFilter: "all",
    predictionFilter: "all",
  };
  isAddingInAllView = false;
  addingCostCenterId = null;
  isAddingMultipleInAllView = false;
  hideAllViewMultipleEntryForm();
  applyAllFilters();
}

// Sort all entries
function sortAllEntries(field, direction) {
  if (field !== "date") return;
  filteredAllEntries.sort((a, b) => {
    const aValue = parseDate(a[field]);
    const bValue = parseDate(b[field]);
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });
  updateAllSortIndicators(field, direction);
  if (alternativeViewActive) renderAllEntriesTable();
}

// Update all sort indicators
function updateAllSortIndicators(field, direction) {
  const headers = document.querySelectorAll("#allCostCentersTable th.sortable");
  headers.forEach((header) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (header.getAttribute("data-field") === field) {
      header.classList.add(direction === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

// Sort all table
function sortAllTable(field) {
  if (field !== "date") return;
  if (currentAllSortField === field) {
    currentAllSortDirection =
      currentAllSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentAllSortField = field;
    currentAllSortDirection = "asc";
  }
  sortAllEntries(currentAllSortField, currentAllSortDirection);
}

// Switch to cost center and edit
function switchToCostCenterAndEdit(costCenterId, entryId) {
  const toggle = document.getElementById("viewToggle");
  if (toggle.checked) {
    toggle.checked = false;
    toggleView();
  }
  document.getElementById("costCenterSelect").value = costCenterId;
  loadCostCenterData().then(() => {
    setTimeout(() => {
      startEdit(entryId);
    }, 500);
  });
}

// Switch to cost center and delete
function switchToCostCenterAndDelete(costCenterId, entryId) {
  const toggle = document.getElementById("viewToggle");
  if (toggle.checked) {
    toggle.checked = false;
    toggleView();
  }
  document.getElementById("costCenterSelect").value = costCenterId;
  loadCostCenterData().then(() => {
    setTimeout(() => {
      deleteEntry(entryId);
    }, 500);
  });
}

// Refresh all data
async function refreshAllData() {
  await loadAllCostCentersData();
  applyAllFilters();
  alert("Đã làm mới dữ liệu toàn hệ thống!");
}

// Export alternative view
async function exportAlternativeView() {
  try {
    if (filteredAllEntries.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }
    let csvContent =
      "Trạm,Tên giao dịch,Ngày,Thu nhập (VND),Chi phí (VND),Dự báo thu (VND),Dự báo chi (VND),Ghi chú\n";
    filteredAllEntries.forEach((entry) => {
      csvContent +=
        [
          `"${entry.costCenterName}"`,
          `"${entry.name}"`,
          entry.date,
          entry.income || 0,
          entry.expense || 0,
          entry.incomePrediction || 0,
          entry.expensePrediction || 0,
          `"${entry.note || ""}"`,
        ].join(",") + "\n";
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute(
      "download",
      `all_cost_centers_bank_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Lỗi khi xuất dữ liệu: " + error.message);
  }
}

// ==================== GLOBAL SUMMARY FUNCTIONS ====================

function showGlobalDetails() {
  const costCentersWithEntries = Object.entries(allEntries).filter(
    ([_, data]) => {
      if (!data.entries || data.entries.length === 0) return false;
      return data.entries.some(
        (e) => (e.income && e.income > 0) || (e.expense && e.expense > 0),
      );
    },
  );

  if (costCentersWithEntries.length === 0) {
    alert("Không có trạm nào có dữ liệu thực tế.");
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
                    <th>Trạm</th><th>Số Giao Dịch</th><th>Có Dự Báo</th>
                    <th>Tổng Thu (VND)</th><th>Tổng Chi (VND)</th><th>Lợi Nhuận (VND)</th>
                    <th>Tổng Dự Báo Thu</th><th>Tổng Dự Báo Chi</th><th>Lợi Nhuận Dự Báo</th>
                    <th>Hạn Mức (VND)</th><th>Quỹ Khả Dụng</th><th>Quỹ Khả Dụng Dự Báo</th>
                  </tr>
                </thead>
                <tbody>
                  ${costCentersWithEntries
                    .map(([costCenterId, data]) => {
                      const fundInfo = allFundInfo[costCenterId] || {};
                      const t = data.entries.reduce(
                        (acc, e) => {
                          acc.totalIncome += e.income || 0;
                          acc.totalExpense += e.expense || 0;
                          acc.totalIncomePrediction += e.incomePrediction || 0;
                          acc.totalExpensePrediction +=
                            e.expensePrediction || 0;
                          if (e.incomePrediction || e.expensePrediction)
                            acc.withPrediction++;
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
                      const profit = t.totalIncome - t.totalExpense;
                      const profitPrediction =
                        t.totalIncomePrediction - t.totalExpensePrediction;
                      const fundLimit = fundInfo.fundLimitBank || 0;
                      const fundAvailable = fundInfo.fundAvailableBank || 0;
                      const predictedFundAvailable =
                        fundInfo.predictedFundAvailableBank || 0;
                      const profitClass =
                        profit >= 0
                          ? "text-success fw-bold"
                          : "text-danger fw-bold";
                      const profitPredictionClass =
                        profitPrediction >= 0 ? "text-success" : "text-danger";
                      const fundAvailableClass =
                        fundAvailable >= 0 ? "text-success" : "text-danger";
                      const predictedFundAvailableClass =
                        predictedFundAvailable >= 0
                          ? "text-success"
                          : "text-danger";
                      return `<tr onclick="switchToCostCenter('${costCenterId}')" style="cursor:pointer;">
                      <td><strong>${data.name}</strong></td>
                      <td>${data.entries.length}</td>
                      <td>${t.withPrediction}</td>
                      <td>${t.totalIncome.toLocaleString("vi-VN")}</td>
                      <td>${t.totalExpense.toLocaleString("vi-VN")}</td>
                      <td class="${profitClass}">${profit.toLocaleString("vi-VN")}</td>
                      <td>${t.totalIncomePrediction.toLocaleString("vi-VN")}</td>
                      <td>${t.totalExpensePrediction.toLocaleString("vi-VN")}</td>
                      <td class="${profitPredictionClass}">${profitPrediction.toLocaleString("vi-VN")}</td>
                      <td>${fundLimit.toLocaleString("vi-VN")}</td>
                      <td class="${fundAvailableClass}">${fundAvailable.toLocaleString("vi-VN")}</td>
                      <td class="${predictedFundAvailableClass}">${predictedFundAvailable.toLocaleString("vi-VN")}</td>
                    </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
            <div class="mt-3">
              <small class="text-muted">* Chỉ hiển thị các trạm có dữ liệu thực tế</small><br>
              <small class="text-muted">* Nhấp vào tên trạm để chuyển sang xem chi tiết</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
            <button type="button" class="btn btn-primary" onclick="refreshGlobalData()">🔄 Làm Mới Dữ Liệu</button>
            <button type="button" class="btn btn-success" onclick="exportAllData()">📁 Xuất Toàn Bộ</button>
          </div>
        </div>
      </div>
    </div>`;

  const existingModal = document.getElementById("globalDetailsModal");
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML("beforeend", modalContent);
  new bootstrap.Modal(document.getElementById("globalDetailsModal")).show();
}

function switchToCostCenter(costCenterId) {
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("globalDetailsModal"),
  );
  if (modal) modal.hide();
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
      ([_, data]) => {
        if (!data.entries || data.entries.length === 0) return false;
        return data.entries.some(
          (e) => (e.income && e.income > 0) || (e.expense && e.expense > 0),
        );
      },
    );
    if (costCentersWithEntries.length === 0) {
      alert("Không có dữ liệu thực tế để xuất");
      return;
    }

    let csvContent =
      "Trạm,Tên giao dịch,Ngày,Thu nhập (VND),Chi phí (VND),Dự báo thu (VND),Dự báo chi (VND),Ghi chú\n";
    costCentersWithEntries.forEach(([_, data]) => {
      (data.entries || []).forEach((entry) => {
        csvContent +=
          [
            `"${data.name}"`,
            `"${entry.name}"`,
            entry.date,
            entry.income || 0,
            entry.expense || 0,
            entry.incomePrediction || 0,
            entry.expensePrediction || 0,
            `"${entry.note || ""}"`,
          ].join(",") + "\n";
      });
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute(
      "download",
      `all_bank_finance_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Lỗi khi xuất dữ liệu: " + error.message);
  }
}
