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
let allEntries = {};
let allEntriesFlat = [];
let allFundInfo = {};

// Filter state for single view
let filterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
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
  costCenterFilter: "all",
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

// Helper function to compare dates
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

// Preview loan schedule
async function previewLoanSchedule(loanData) {
  try {
    const response = await fetch(`${API_BASE}/preview-loan-schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loanData),
    });

    if (response.ok) {
      const result = await response.json();
      displayLoanPreview(result);
    } else {
      const error = await response.json();
      alert("Lỗi khi xem trước: " + (error.message || "Không xác định"));
    }
  } catch (error) {
    alert("Lỗi khi xem trước: " + error.message);
  }
}

function displayLoanPreview(data) {
  const modalContent = document.getElementById("loanPreviewContent");

  let scheduleHtml = `
    <div class="table-responsive">
      <table class="table table-striped table-bordered">
        <thead class="table-dark">
          <tr>
            <th>Kỳ</th>
            <th>Ngày trả</th>
            <th>Tiền lãi (VND)</th>
            <th>Tiền gốc (VND)</th>
            <th>Tổng trả (VND)</th>
            <th>Dư nợ còn lại (VND)</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const payment of data.schedule) {
    const graceNote = payment.isGracePeriod ? "Ân hạn" : "";
    scheduleHtml += `
      <tr>
        <td>${payment.period}</td>
        <td>${payment.deductionDate}</td>
        <td class="${payment.interestExpense > 0 ? "text-danger" : ""}">${payment.interestExpense.toLocaleString("vi-VN")}</td>
        <td class="${payment.principalRepayment > 0 ? "text-success" : ""}">${payment.principalRepayment.toLocaleString("vi-VN")}</td>
        <td><strong>${payment.totalPayment.toLocaleString("vi-VN")}</strong></td>
        <td>${payment.outstandingBalance.toLocaleString("vi-VN")}</td>
        <td>${graceNote}</td>
      </tr>
    `;
  }

  scheduleHtml += `
        </tbody>
        <tfoot class="table-secondary">
          <tr>
            <th colspan="2">Tổng cộng</th>
            <th>${data.summary.totalInterest.toLocaleString("vi-VN")}</th>
            <th>${data.summary.totalPrincipal.toLocaleString("vi-VN")}</th>
            <th>${data.summary.totalPayments.toLocaleString("vi-VN")}</th>
            <th colspan="2"></th>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="mt-3">
      <strong>Số kỳ trả:</strong> ${data.summary.numberOfPayments} kỳ<br>
      <strong>Tổng lãi phải trả:</strong> ${data.summary.totalInterest.toLocaleString("vi-VN")} VND<br>
      <strong>Tổng gốc phải trả:</strong> ${data.summary.totalPrincipal.toLocaleString("vi-VN")} VND<br>
      <strong>Tổng số tiền phải trả:</strong> ${data.summary.totalPayments.toLocaleString("vi-VN")} VND
    </div>
  `;

  modalContent.innerHTML = scheduleHtml;
  new bootstrap.Modal(document.getElementById("loanPreviewModal")).show();
}

// Regenerate loan entries
async function regenerateLoanEntries() {
  if (!currentCostCenterId) {
    alert("Vui lòng chọn trạm trước");
    return;
  }

  if (
    confirm(
      "Bạn có chắc chắn muốn tạo lại tất cả các khoản lãi vay? Các bản ghi cũ sẽ bị xóa và tạo mới.",
    )
  ) {
    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/regenerate-loans`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        await loadEntries();
        await updateGlobalSummary();
      } else {
        const error = await response.json();
        alert("Lỗi: " + (error.message || "Không xác định"));
      }
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  }
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
        const entriesResponse = await fetch(
          `${API_BASE}/${costCenter._id}/entries`,
        );
        const costCenterEntries = await entriesResponse.json();

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
  let globalTotalFundLimit = 0;
  let globalTotalFundAvailable = 0;

  Object.values(allFundInfo).forEach((fundInfo) => {
    globalTotalIncome += fundInfo.totalIncome || 0;
    globalTotalExpense += fundInfo.totalExpense || 0;
    globalTotalFundLimit += fundInfo.fundLimitBank || 0;
    globalTotalFundAvailable += fundInfo.fundAvailableBank || 0;
  });

  const globalTotalProfit = globalTotalIncome - globalTotalExpense;

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

  allEntries[currentCostCenterId] = {
    name: selectedOption.textContent,
    entries: entries,
  };

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

function showAddButton() {
  const btn = document.getElementById("addNewEntryBtn");
  if (btn) btn.style.display = "inline-block";
}

function hideAddButton() {
  const btn = document.getElementById("addNewEntryBtn");
  if (btn) btn.style.display = "none";
}

function hideMultipleEntryForm() {
  const form = document.getElementById("multipleEntryForm");
  if (form) form.classList.add("hidden");
  const bulk = document.getElementById("bulkActions");
  if (bulk) bulk.classList.remove("hidden");
  showAddButton();
  clearMultipleEntries();
}

function clearMultipleEntries() {
  const container = document.getElementById("multipleEntriesContainer");
  if (container) container.innerHTML = "";
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

  filteredEntries.forEach((entry) => {
    totalIncome += entry.income || 0;
    totalExpense += entry.expense || 0;
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

function updateFundSummary(fundData) {
  const fundAvailableBank = fundData.fundAvailableBank || 0;

  document.getElementById("fundLimitBankSummary").textContent = (
    fundData.fundLimitBank || 0
  ).toLocaleString("vi-VN");
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

// Hiển thị các mục trong bảng cho single view
function renderEntries() {
  const tbody = document.getElementById("entriesBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  document.getElementById("currentEntriesCount").textContent =
    filteredEntries.length;
  document.getElementById("totalEntriesCount").textContent = entries.length;

  const today = getTodayFormatted();

  if (filteredEntries.length === 0 && !isAdding) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="9" style="text-align: center; color: #666; padding: 20px;">
        ${
          entries.length === 0
            ? "Chưa có dữ liệu nào. Hãy thêm khoản vay mới."
            : "Không có kết quả phù hợp với bộ lọc."
        }
       </td>
    `;
    tbody.appendChild(row);
    return;
  }

  if (isAdding) {
    tbody.appendChild(createAddRow());
  }

  filteredEntries.forEach((entry, idx) => {
    const row = document.createElement("tr");
    row.setAttribute("data-date", entry.date);

    if (entry._id === editingEntryId) {
      row.className = "editing-row";
      row.innerHTML = `
        <td><input type="text" id="editName_${entry._id}" value="${escapeHtml(entry.name)}" required></td>
        <td><input type="text" id="editDate_${entry._id}" value="${entry.date}" placeholder="DD/MM/YYYY" required></td>
        <td><input type="number" id="editIncome_${entry._id}" value="${entry.income}" step="0.1" required></td>
        <td><input type="number" id="editExpense_${entry._id}" value="${entry.expense}" step="0.1" required></td>
        <td><input type="number" id="editInterestRate_${entry._id}" value="${entry.interestRate}" step="0.01" required></td>
        <td><input type="text" id="editDeductionDate_${entry._id}" value="${entry.deductionDate || ""}" placeholder="DD/MM/YYYY"></td>
        <td><input type="number" id="editMonthsWithNoPrincipalRepayment_${entry._id}" value="${entry.monthsWithNoPrincipalRepayment || 0}" step="1"></td>
        <td><input type="text" id="editMaturityDate_${entry._id}" value="${entry.maturityDate || ""}" placeholder="DD/MM/YYYY"></td>
        <td class="actions">
          <button class="save-btn" onclick="saveEdit('${entry._id}')">Lưu</button>
          <button class="cancel-btn" onclick="cancelEdit('${entry._id}')">Hủy</button>
        </td>
      `;
    } else {
      const dateClass = entry.date === today ? "current-date" : "";
      const outstandingBalance = (entry.income || 0) - (entry.expense || 0);
      row.innerHTML = `
        <td>${escapeHtml(entry.name)}</td>
        <td class="${dateClass}">${entry.date}</td>
        <td>${(entry.income || 0).toLocaleString("vi-VN")}</td>
        <td>${(entry.expense || 0).toLocaleString("vi-VN")}</td>
        <td>${entry.interestRate || 0}%</td>
        <td>${entry.deductionDate || "-"}</td>
        <td>${entry.monthsWithNoPrincipalRepayment || 0}</td>
        <td>${entry.maturityDate || "-"}</td>
        <td class="actions">
          <button class="edit-btn" onclick="startEdit('${entry._id}')">Sửa</button>
          <button class="delete-btn" onclick="deleteEntry('${entry._id}')">Xóa</button>
          <button class="preview-btn" onclick="previewLoanFromEntry('${entry._id}')" style="background:#17a2b8;">Xem lịch</button>
        </td>
      `;
    }
    tbody.appendChild(row);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

function previewLoanFromEntry(entryId) {
  const entry = entries.find((e) => e._id === entryId);
  if (entry) {
    previewLoanSchedule({
      loanAmount: entry.income,
      interestRate: entry.interestRate,
      loanDisbursementDate: entry.date,
      deductionDate: entry.deductionDate,
      monthsWithNoPrincipalRepayment: entry.monthsWithNoPrincipalRepayment,
      maturityDate: entry.maturityDate,
    });
  }
}

// Create add row for single view
function createAddRow() {
  const row = document.createElement("tr");
  row.id = "addEntryRow";
  row.className = "editing-row";
  const today = getTodayFormatted();
  row.innerHTML = `
    <td><input type="text" id="newName" placeholder="Tên khoản vay" required></td>
    <td><input type="text" id="newDate" value="${today}" placeholder="DD/MM/YYYY" required></td>
    <td><input type="number" id="newIncome" placeholder="Số tiền vay" step="0.1" value="0" required></td>
    <td><input type="number" id="newExpense" placeholder="Đã trả gốc" step="0.1" value="0" required></td>
    <td><input type="number" id="newInterestRate" placeholder="Lãi suất %" step="0.01" value="0" required></td>
    <td><input type="text" id="newDeductionDate" placeholder="Ngày trừ nợ (DD/MM/YYYY)" required></td>
    <td><input type="number" id="newMonthsWithNoPrincipalRepayment" placeholder="Tháng ân hạn" step="1" value="0"></td>
    <td><input type="text" id="newMaturityDate" placeholder="Ngày đáo hạn (DD/MM/YYYY)" required></td>
    <td class="actions">
      <button class="preview-btn" onclick="previewNewLoan()" style="background:#17a2b8;">Xem trước</button>
      <button class="save-btn" onclick="saveNewEntry()">Lưu</button>
      <button class="cancel-btn" onclick="cancelAdd()">Hủy</button>
    </td>
  `;
  return row;
}

function previewNewLoan() {
  const loanData = {
    loanAmount: parseFloat(document.getElementById("newIncome").value) || 0,
    interestRate:
      parseFloat(document.getElementById("newInterestRate").value) || 0,
    loanDisbursementDate: document.getElementById("newDate").value,
    deductionDate: document.getElementById("newDeductionDate").value,
    monthsWithNoPrincipalRepayment:
      parseInt(
        document.getElementById("newMonthsWithNoPrincipalRepayment").value,
      ) || 0,
    maturityDate: document.getElementById("newMaturityDate").value,
  };

  if (
    !loanData.loanDisbursementDate ||
    !loanData.deductionDate ||
    !loanData.maturityDate
  ) {
    alert("Vui lòng nhập đầy đủ ngày giải ngân, ngày trừ nợ và ngày đáo hạn");
    return;
  }

  previewLoanSchedule(loanData);
}

function showAddRow() {
  if (isAdding || editingEntryId) return;
  isAdding = true;
  hideAddButton();
  renderEntries();
}

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
  const interestRate = parseFloat(
    document.getElementById("newInterestRate").value,
  );
  const deductionDate = document.getElementById("newDeductionDate").value;
  const monthsWithNoPrincipalRepayment =
    parseInt(
      document.getElementById("newMonthsWithNoPrincipalRepayment").value,
    ) || 0;
  const maturityDate = document.getElementById("newMaturityDate").value;

  if (!name.trim()) {
    alert("Vui lòng nhập tên khoản vay");
    return;
  }

  if (isNaN(income) || income < 0) {
    alert("Vui lòng nhập số tiền vay hợp lệ");
    return;
  }

  if (isNaN(expense) || expense < 0) {
    alert("Vui lòng nhập số tiền đã trả gốc hợp lệ");
    return;
  }

  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày giải ngân theo định dạng DD/MM/YYYY");
    return;
  }

  if (isNaN(interestRate) || interestRate < 0) {
    alert("Vui lòng nhập lãi suất hợp lệ");
    return;
  }

  if (!deductionDate || !isValidDate(deductionDate)) {
    alert("Vui lòng nhập ngày trừ nợ theo định dạng DD/MM/YYYY");
    return;
  }

  if (!maturityDate || !isValidDate(maturityDate)) {
    alert("Vui lòng nhập ngày đáo hạn theo định dạng DD/MM/YYYY");
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
        interestRate,
        deductionDate,
        monthsWithNoPrincipalRepayment,
        maturityDate,
        loanDisbursementDate: date,
      }),
    });

    if (response.ok) {
      cancelAdd();
      await loadEntries();
      await updateGlobalSummary();
      alert("Thêm khoản vay thành công!");
    } else {
      const errorData = await response.json();
      alert("Lỗi khi thêm: " + (errorData.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi khi thêm: " + error.message);
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
  const interestRate = parseFloat(
    document.getElementById(`editInterestRate_${entryId}`).value,
  );
  const deductionDate = document.getElementById(
    `editDeductionDate_${entryId}`,
  ).value;
  const monthsWithNoPrincipalRepayment =
    parseInt(
      document.getElementById(`editMonthsWithNoPrincipalRepayment_${entryId}`)
        .value,
    ) || 0;
  const maturityDate = document.getElementById(
    `editMaturityDate_${entryId}`,
  ).value;

  if (!name.trim()) {
    alert("Vui lòng nhập tên");
    return;
  }

  if (isNaN(income) || income < 0) {
    alert("Vui lòng nhập số tiền vay hợp lệ");
    return;
  }

  if (isNaN(expense) || expense < 0) {
    alert("Vui lòng nhập số tiền đã trả gốc hợp lệ");
    return;
  }

  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày theo định dạng DD/MM/YYYY");
    return;
  }

  if (isNaN(interestRate) || interestRate < 0) {
    alert("Vui lòng nhập lãi suất hợp lệ");
    return;
  }

  if (deductionDate && !isValidDate(deductionDate)) {
    alert("Vui lòng nhập ngày trừ nợ theo định dạng DD/MM/YYYY");
    return;
  }

  if (maturityDate && !isValidDate(maturityDate)) {
    alert("Vui lòng nhập ngày đáo hạn theo định dạng DD/MM/YYYY");
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
          interestRate,
          deductionDate,
          monthsWithNoPrincipalRepayment,
          maturityDate,
          loanDisbursementDate: date,
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
      alert("Lỗi khi cập nhật: " + (errorData.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi khi cập nhật: " + error.message);
  }
}

// Delete entry
async function deleteEntry(entryId) {
  if (!currentCostCenterId) return;

  if (
    confirm(
      "Bạn có chắc chắn muốn xóa khoản vay này không? Các khoản lãi liên quan cũng sẽ bị xóa.",
    )
  ) {
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
        alert("Xóa thành công!");
      } else {
        alert("Lỗi khi xóa");
      }
    } catch (error) {
      alert("Lỗi khi xóa: " + error.message);
    }
  }
}

// Apply filters
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

function applyTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("dateFrom").value = today;
  document.getElementById("dateTo").value = today;
  applyFilters();
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
    <input type="text" id="${entryId}_name" placeholder="Tên khoản vay" required>
    <input type="text" id="${entryId}_date" value="${today}" placeholder="Ngày giải ngân" required>
    <input type="number" id="${entryId}_income" placeholder="Số tiền vay" step="0.1" value="0" required>
    <input type="number" id="${entryId}_expense" placeholder="Đã trả gốc" step="0.1" value="0" required>
    <input type="number" id="${entryId}_interestRate" placeholder="Lãi suất %" step="0.01" value="0" required>
    <input type="text" id="${entryId}_deductionDate" placeholder="Ngày trừ nợ" required>
    <input type="number" id="${entryId}_monthsWithNoPrincipalRepayment" placeholder="Tháng ân hạn" step="1" value="0">
    <input type="text" id="${entryId}_maturityDate" placeholder="Ngày đáo hạn" required>
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
    const interestRate = parseFloat(
      document.getElementById(`${entryId}_interestRate`).value,
    );
    const deductionDate = document.getElementById(
      `${entryId}_deductionDate`,
    ).value;
    const monthsWithNoPrincipalRepayment =
      parseInt(
        document.getElementById(`${entryId}_monthsWithNoPrincipalRepayment`)
          .value,
      ) || 0;
    const maturityDate = document.getElementById(
      `${entryId}_maturityDate`,
    ).value;

    if (!name) {
      alert("Vui lòng nhập tên cho mục này");
      hasError = true;
      break;
    }

    if (isNaN(income) || income < 0) {
      alert("Vui lòng nhập số tiền vay hợp lệ");
      hasError = true;
      break;
    }

    if (isNaN(expense) || expense < 0) {
      alert("Vui lòng nhập số tiền đã trả gốc hợp lệ");
      hasError = true;
      break;
    }

    if (!isValidDate(date)) {
      alert("Vui lòng nhập ngày giải ngân hợp lệ (DD/MM/YYYY)");
      hasError = true;
      break;
    }

    if (isNaN(interestRate) || interestRate < 0) {
      alert("Vui lòng nhập lãi suất hợp lệ");
      hasError = true;
      break;
    }

    if (!deductionDate || !isValidDate(deductionDate)) {
      alert("Vui lòng nhập ngày trừ nợ hợp lệ (DD/MM/YYYY)");
      hasError = true;
      break;
    }

    if (!maturityDate || !isValidDate(maturityDate)) {
      alert("Vui lòng nhập ngày đáo hạn hợp lệ (DD/MM/YYYY)");
      hasError = true;
      break;
    }

    entriesToSave.push({
      name,
      income,
      expense,
      date,
      interestRate,
      deductionDate,
      monthsWithNoPrincipalRepayment,
      maturityDate,
      loanDisbursementDate: date,
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
      alert(`Đã thêm thành công ${successCount} khoản vay!`);
      hideMultipleEntryForm();
      await loadEntries();
      await updateGlobalSummary();
    } else {
      alert(
        `Đã thêm ${successCount} khoản thành công, ${errorCount} khoản thất bại.`,
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
      "Tên khoản vay,Ngày giải ngân,Số tiền vay,Đã trả gốc,Lãi suất %,Ngày trừ nợ,Tháng ân hạn,Ngày đáo hạn\n";
    filteredEntries.forEach((entry) => {
      csvContent +=
        [
          `"${entry.name}"`,
          entry.date,
          entry.income || 0,
          entry.expense || 0,
          entry.interestRate || 0,
          entry.deductionDate || "",
          entry.monthsWithNoPrincipalRepayment || 0,
          entry.maturityDate || "",
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

// Fund Limit Functions
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

// Update global summary
async function updateGlobalSummary() {
  if (currentCostCenterId) {
    try {
      const entriesResponse = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries`,
      );
      const updatedEntries = await entriesResponse.json();

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

// ==================== ALL VIEW FUNCTIONS ====================

function renderAllCostCentersView() {
  if (!alternativeViewActive) return;

  const uniqueCostCenters = new Set(
    filteredAllEntries.map((e) => e.costCenterId),
  ).size;
  document.getElementById("totalCostCentersCount").textContent =
    uniqueCostCenters;
  document.getElementById("totalTransactionsCount").textContent =
    filteredAllEntries.length;

  renderAllEntriesTable();
}

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
    row.innerHTML = `<td colspan="10" style="text-align:center;color:#666;padding:20px;">${
      allEntriesFlat.length === 0
        ? "Không có dữ liệu nào từ các trạm."
        : "Không có kết quả phù hợp với bộ lọc."
    }</td>`;
    tbody.appendChild(row);
    const addNewRow = document.createElement("tr");
    addNewRow.className = "add-row";
    addNewRow.innerHTML = `<td colspan="10"><button class="add-btn" onclick="showAllViewAddRow()">+ Thêm Khoản Vay Mới</button></td>`;
    tbody.appendChild(addNewRow);
    return;
  }

  filteredAllEntries.forEach((entry) => {
    const row = document.createElement("tr");
    row.setAttribute("data-cost-center-id", entry.costCenterId);
    row.setAttribute("data-entry-id", entry._id);
    row.setAttribute("data-date", entry.date);

    const dateClass = entry.date === today ? "current-date" : "";

    row.innerHTML = `
      <td>${escapeHtml(entry.costCenterName)}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td class="${dateClass}">${entry.date}</td>
      <td>${(entry.income || 0).toLocaleString("vi-VN")}</td>
      <td>${(entry.expense || 0).toLocaleString("vi-VN")}</td>
      <td>${entry.interestRate || 0}%</td>
      <td>${entry.deductionDate || "-"}</td>
      <td>${entry.monthsWithNoPrincipalRepayment || 0}</td>
      <td>${entry.maturityDate || "-"}</td>
      <td class="actions">
        <button class="edit-btn" onclick="switchToCostCenterAndEdit('${entry.costCenterId}', '${entry._id}')">Sửa</button>
        <button class="delete-btn" onclick="switchToCostCenterAndDelete('${entry.costCenterId}', '${entry._id}')">Xóa</button>
        <button class="preview-btn" onclick="previewLoanFromAllView('${entry.costCenterId}', '${entry._id}')" style="background:#17a2b8;">Xem lịch</button>
      </td>`;
    tbody.appendChild(row);
  });

  const addNewRow = document.createElement("tr");
  addNewRow.className = "add-row";
  addNewRow.innerHTML = `<td colspan="10"><button class="add-btn" onclick="showAllViewAddRow()">+ Thêm Khoản Vay Mới</button></td>`;
  tbody.appendChild(addNewRow);
}

async function previewLoanFromAllView(costCenterId, entryId) {
  try {
    const response = await fetch(`${API_BASE}/${costCenterId}/entries`);
    const entries = await response.json();
    const entry = entries.find((e) => e._id === entryId);
    if (entry) {
      previewLoanSchedule({
        loanAmount: entry.income,
        interestRate: entry.interestRate,
        loanDisbursementDate: entry.date,
        deductionDate: entry.deductionDate,
        monthsWithNoPrincipalRepayment: entry.monthsWithNoPrincipalRepayment,
        maturityDate: entry.maturityDate,
      });
    }
  } catch (error) {
    alert("Lỗi khi xem trước: " + error.message);
  }
}

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
    <td><input type="text" id="allViewNewName" placeholder="Tên khoản vay" required></td>
    <td><input type="text" id="allViewNewDate" value="${today}" placeholder="Ngày giải ngân" required></td>
    <td><input type="number" id="allViewNewIncome" placeholder="Số tiền vay" step="0.1" value="0" required></td>
    <td><input type="number" id="allViewNewExpense" placeholder="Đã trả gốc" step="0.1" value="0" required></td>
    <td><input type="number" id="allViewNewInterestRate" placeholder="Lãi suất %" step="0.01" value="0" required></td>
    <td><input type="text" id="allViewNewDeductionDate" placeholder="Ngày trừ nợ" required></td>
    <td><input type="number" id="allViewNewMonthsWithNoPrincipalRepayment" placeholder="Tháng ân hạn" step="1" value="0"></td>
    <td><input type="text" id="allViewNewMaturityDate" placeholder="Ngày đáo hạn" required></td>
    <td class="actions">
      <button class="preview-btn" onclick="previewAllViewNewLoan()" style="background:#17a2b8;">Xem trước</button>
      <button class="save-btn" onclick="saveAllViewNewEntry()">Lưu</button>
      <button class="cancel-btn" onclick="cancelAllViewAdd()">Hủy</button>
    </td>
  `;
  return row;
}

function previewAllViewNewLoan() {
  const loanData = {
    loanAmount:
      parseFloat(document.getElementById("allViewNewIncome").value) || 0,
    interestRate:
      parseFloat(document.getElementById("allViewNewInterestRate").value) || 0,
    loanDisbursementDate: document.getElementById("allViewNewDate").value,
    deductionDate: document.getElementById("allViewNewDeductionDate").value,
    monthsWithNoPrincipalRepayment:
      parseInt(
        document.getElementById("allViewNewMonthsWithNoPrincipalRepayment")
          .value,
      ) || 0,
    maturityDate: document.getElementById("allViewNewMaturityDate").value,
  };

  if (
    !loanData.loanDisbursementDate ||
    !loanData.deductionDate ||
    !loanData.maturityDate
  ) {
    alert("Vui lòng nhập đầy đủ ngày giải ngân, ngày trừ nợ và ngày đáo hạn");
    return;
  }

  previewLoanSchedule(loanData);
}

function showAllViewAddRow() {
  if (isAddingInAllView || isAddingMultipleInAllView) return;
  addingCostCenterId =
    allFilterState.costCenterFilter !== "all"
      ? allFilterState.costCenterFilter
      : allCostCenters[0]?._id || null;
  isAddingInAllView = true;
  renderAllEntriesTable();
}

function cancelAllViewAdd() {
  isAddingInAllView = false;
  addingCostCenterId = null;
  renderAllEntriesTable();
}

async function saveAllViewNewEntry() {
  const costCenterId = document.getElementById("allViewNewCostCenter").value;
  const name = document.getElementById("allViewNewName").value;
  const income = parseFloat(document.getElementById("allViewNewIncome").value);
  const expense = parseFloat(
    document.getElementById("allViewNewExpense").value,
  );
  const date = document.getElementById("allViewNewDate").value;
  const interestRate = parseFloat(
    document.getElementById("allViewNewInterestRate").value,
  );
  const deductionDate = document.getElementById(
    "allViewNewDeductionDate",
  ).value;
  const monthsWithNoPrincipalRepayment =
    parseInt(
      document.getElementById("allViewNewMonthsWithNoPrincipalRepayment").value,
    ) || 0;
  const maturityDate = document.getElementById("allViewNewMaturityDate").value;

  if (!costCenterId) {
    alert("Vui lòng chọn trạm");
    return;
  }
  if (!name.trim()) {
    alert("Vui lòng nhập tên khoản vay");
    return;
  }
  if (isNaN(income) || income < 0) {
    alert("Vui lòng nhập số tiền vay hợp lệ");
    return;
  }
  if (isNaN(expense) || expense < 0) {
    alert("Vui lòng nhập số tiền đã trả gốc hợp lệ");
    return;
  }
  if (!isValidDate(date)) {
    alert("Vui lòng nhập ngày giải ngân theo định dạng DD/MM/YYYY");
    return;
  }
  if (isNaN(interestRate) || interestRate < 0) {
    alert("Vui lòng nhập lãi suất hợp lệ");
    return;
  }
  if (!deductionDate || !isValidDate(deductionDate)) {
    alert("Vui lòng nhập ngày trừ nợ theo định dạng DD/MM/YYYY");
    return;
  }
  if (!maturityDate || !isValidDate(maturityDate)) {
    alert("Vui lòng nhập ngày đáo hạn theo định dạng DD/MM/YYYY");
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
        interestRate,
        deductionDate,
        monthsWithNoPrincipalRepayment,
        maturityDate,
        loanDisbursementDate: date,
      }),
    });
    if (response.ok) {
      isAddingInAllView = false;
      addingCostCenterId = null;
      await loadAllCostCentersData();
      applyAllFilters();
      alert("Thêm khoản vay thành công!");
    } else {
      const errorData = await response.json();
      alert("Lỗi khi thêm: " + (errorData.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi khi thêm: " + error.message);
  }
}

// Multiple entry functions for all view
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

function clearAllViewMultipleEntries() {
  const container = document.getElementById("allViewMultipleEntriesContainer");
  if (container) container.innerHTML = "";
  allViewMultipleEntryCounter = 0;
}

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
    <select id="${entryId}_costCenter" style="min-width:150px;" required>
      <option value="">-- Chọn Trạm --</option>
      ${costCenterOptions}
    </select>
    <input type="text" id="${entryId}_name" placeholder="Tên khoản vay" required>
    <input type="text" id="${entryId}_date" value="${today}" placeholder="Ngày giải ngân" required>
    <input type="number" id="${entryId}_income" placeholder="Số tiền vay" step="0.1" value="0" required>
    <input type="number" id="${entryId}_expense" placeholder="Đã trả gốc" step="0.1" value="0" required>
    <input type="number" id="${entryId}_interestRate" placeholder="Lãi suất %" step="0.01" value="0" required>
    <input type="text" id="${entryId}_deductionDate" placeholder="Ngày trừ nợ" required>
    <input type="number" id="${entryId}_monthsWithNoPrincipalRepayment" placeholder="Tháng ân hạn" step="1" value="0">
    <input type="text" id="${entryId}_maturityDate" placeholder="Ngày đáo hạn" required>
    <button type="button" class="remove-entry-btn" onclick="removeAllViewEntryRow('${entryId}')">×</button>
  `;
  container.appendChild(entryRow);
}

function removeAllViewEntryRow(entryId) {
  const entryRow = document.getElementById(entryId);
  if (entryRow) entryRow.remove();
  const container = document.getElementById("allViewMultipleEntriesContainer");
  if (container.children.length === 0) addAllViewEntryRow();
}

function cancelAllViewMultipleEntries() {
  if (
    confirm("Bạn có chắc chắn muốn hủy? Tất cả dữ liệu chưa lưu sẽ bị mất.")
  ) {
    hideAllViewMultipleEntryForm();
  }
}

function hideAllViewMultipleEntryForm() {
  const form = document.getElementById("allViewMultipleEntryForm");
  if (form) form.classList.add("hidden");
  isAddingMultipleInAllView = false;
  clearAllViewMultipleEntries();
}

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
    const interestRate = parseFloat(
      document.getElementById(`${entryId}_interestRate`).value,
    );
    const deductionDate = document.getElementById(
      `${entryId}_deductionDate`,
    ).value;
    const monthsWithNoPrincipalRepayment =
      parseInt(
        document.getElementById(`${entryId}_monthsWithNoPrincipalRepayment`)
          .value,
      ) || 0;
    const maturityDate = document.getElementById(
      `${entryId}_maturityDate`,
    ).value;

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
    if (isNaN(income) || income < 0) {
      alert("Vui lòng nhập số tiền vay hợp lệ");
      hasError = true;
      break;
    }
    if (isNaN(expense) || expense < 0) {
      alert("Vui lòng nhập số tiền đã trả gốc hợp lệ");
      hasError = true;
      break;
    }
    if (!isValidDate(date)) {
      alert("Vui lòng nhập ngày giải ngân hợp lệ (DD/MM/YYYY)");
      hasError = true;
      break;
    }
    if (isNaN(interestRate) || interestRate < 0) {
      alert("Vui lòng nhập lãi suất hợp lệ");
      hasError = true;
      break;
    }
    if (!deductionDate || !isValidDate(deductionDate)) {
      alert("Vui lòng nhập ngày trừ nợ hợp lệ (DD/MM/YYYY)");
      hasError = true;
      break;
    }
    if (!maturityDate || !isValidDate(maturityDate)) {
      alert("Vui lòng nhập ngày đáo hạn hợp lệ (DD/MM/YYYY)");
      hasError = true;
      break;
    }

    entriesToSave.push({
      costCenterId,
      entry: {
        name,
        income,
        expense,
        date,
        interestRate,
        deductionDate,
        monthsWithNoPrincipalRepayment,
        maturityDate,
        loanDisbursementDate: date,
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
      alert(`Đã thêm thành công ${successCount} khoản vay!`);
      hideAllViewMultipleEntryForm();
      await loadAllCostCentersData();
      applyAllFilters();
    } else {
      alert(
        `Đã thêm ${successCount} khoản thành công, ${errorCount} khoản thất bại.`,
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
  allFilterState.costCenterFilter =
    document.getElementById("allCostCenterFilter")?.value || "all";

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
      allFilterState.costCenterFilter !== "all" &&
      entry.costCenterId !== allFilterState.costCenterFilter
    )
      return false;
    return true;
  });

  if (alternativeViewActive) renderAllCostCentersView();
  sortAllEntries(currentAllSortField, currentAllSortDirection);
}

function resetAllFilters() {
  ["allDateFrom", "allDateTo", "allSearchName"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const ccf = document.getElementById("allCostCenterFilter");
  if (ccf) ccf.value = "all";

  allFilterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
    costCenterFilter: "all",
  };
  isAddingInAllView = false;
  addingCostCenterId = null;
  isAddingMultipleInAllView = false;
  hideAllViewMultipleEntryForm();
  applyAllFilters();
}

function applyAllTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("allDateFrom").value = today;
  document.getElementById("allDateTo").value = today;
  applyAllFilters();
}

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

async function refreshAllData() {
  await loadAllCostCentersData();
  applyAllFilters();
  alert("Đã làm mới dữ liệu toàn hệ thống!");
}

async function exportAlternativeView() {
  try {
    if (filteredAllEntries.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }
    let csvContent =
      "Trạm,Tên khoản vay,Ngày giải ngân,Số tiền vay,Đã trả gốc,Lãi suất %,Ngày trừ nợ,Tháng ân hạn,Ngày đáo hạn\n";
    filteredAllEntries.forEach((entry) => {
      csvContent +=
        [
          `"${entry.costCenterName}"`,
          `"${entry.name}"`,
          entry.date,
          entry.income || 0,
          entry.expense || 0,
          entry.interestRate || 0,
          entry.deductionDate || "",
          entry.monthsWithNoPrincipalRepayment || 0,
          entry.maturityDate || "",
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

// Global summary functions
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
                    <th>Trạm</th><th>Số Khoản Vay</th>
                    <th>Tổng Tiền Vay (VND)</th><th>Tổng Đã Trả Gốc (VND)</th><th>Tổng Dư Nợ (VND)</th>
                    <th>Hạn Mức (VND)</th><th>Quỹ Khả Dụng (VND)</th>
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
                          return acc;
                        },
                        {
                          totalIncome: 0,
                          totalExpense: 0,
                        },
                      );
                      const outstanding = t.totalIncome - t.totalExpense;
                      const fundLimit = fundInfo.fundLimitBank || 0;
                      const fundAvailable = fundInfo.fundAvailableBank || 0;
                      const outstandingClass =
                        outstanding >= 0
                          ? "text-danger fw-bold"
                          : "text-success fw-bold";
                      const fundAvailableClass =
                        fundAvailable >= 0 ? "text-success" : "text-danger";
                      return `<tr onclick="switchToCostCenter('${costCenterId}')" style="cursor:pointer;">
                      <td><strong>${data.name}</strong></td>
                      <td>${data.entries.length}</td>
                      <td>${t.totalIncome.toLocaleString("vi-VN")}</td>
                      <td>${t.totalExpense.toLocaleString("vi-VN")}</td>
                      <td class="${outstandingClass}">${outstanding.toLocaleString("vi-VN")}</td>
                      <td>${fundLimit.toLocaleString("vi-VN")}</td>
                      <td class="${fundAvailableClass}">${fundAvailable.toLocaleString("vi-VN")}</td>
                     </tr>`;
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
                        ? "text-danger"
                        : "text-success"
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
      "Trạm,Tên khoản vay,Ngày giải ngân,Số tiền vay,Đã trả gốc,Lãi suất %,Ngày trừ nợ,Tháng ân hạn,Ngày đáo hạn\n";
    costCentersWithEntries.forEach(([_, data]) => {
      (data.entries || []).forEach((entry) => {
        csvContent +=
          [
            `"${data.name}"`,
            `"${entry.name}"`,
            entry.date,
            entry.income || 0,
            entry.expense || 0,
            entry.interestRate || 0,
            entry.deductionDate || "",
            entry.monthsWithNoPrincipalRepayment || 0,
            entry.maturityDate || "",
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
