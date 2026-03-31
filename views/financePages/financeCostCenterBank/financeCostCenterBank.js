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

let allCostCenters = [];
let allEntries = {};
let allEntriesFlat = [];
let allFundInfo = {};

let filterState = { dateFrom: "", dateTo: "", searchName: "" };
let alternativeViewActive = false;
let isAddingInAllView = false;
let addingCostCenterId = null;
let allViewMultipleEntryCounter = 0;
let isAddingMultipleInAllView = false;

let allFilterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
  costCenterFilter: "all",
};
let filteredAllEntries = [];
let currentAllSortField = "date";
let currentAllSortDirection = "desc";

document.addEventListener("DOMContentLoaded", loadCostCenters);

function getTodayFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
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
  if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0))
    monthLength[1] = 29;
  return day > 0 && day <= monthLength[month - 1];
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

async function previewLoanSchedule(loanData) {
  try {
    const response = await fetch(`${API_BASE}/preview-loan-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
            <th>Kỳ</th><th>Ngày trả</th><th>Tiền lãi (VND)</th><th>Tiền gốc (VND)</th><th>Tổng trả (VND)</th><th>Dư nợ còn lại (VND)</th><th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>`;
  for (const p of data.schedule) {
    const graceNote = p.isGracePeriod ? "Ân hạn" : "";
    scheduleHtml += `
      <tr>
        <td>${p.period}</td>
        <td>${p.deductionDate}</td>
        <td class="${p.interestExpense > 0 ? "text-danger" : ""}">${p.interestExpense.toLocaleString("vi-VN")}</td>
        <td class="${p.principalRepayment > 0 ? "text-success" : ""}">${p.principalRepayment.toLocaleString("vi-VN")}</td>
        <td><strong>${p.totalPayment.toLocaleString("vi-VN")}</strong></td>
        <td>${p.outstandingBalance.toLocaleString("vi-VN")}</td>
        <td>${graceNote}</td>
      </tr>`;
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
    </div>`;
  modalContent.innerHTML = scheduleHtml;
  new bootstrap.Modal(document.getElementById("loanPreviewModal")).show();
}

async function regenerateLoanEntries() {
  if (!currentCostCenterId) {
    alert("Vui lòng chọn trạm trước");
    return;
  }
  if (confirm("Bạn có chắc chắn muốn tạo lại tất cả các khoản lãi vay?")) {
    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/regenerate-loans`,
        { method: "POST" },
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
    populateCostCenterFilter();
    renderAllCostCentersView();
  }
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
  }
}

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
        } catch (e) {}
        allEntries[costCenter._id] = {
          name: costCenter.name,
          entries: costCenterEntries,
        };
        allFundInfo[costCenter._id] = fundInfo;
      } catch (error) {
        allEntries[costCenter._id] = { name: costCenter.name, entries: [] };
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
    console.error("Lỗi:", error);
  }
}

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

function calculateGlobalSummary() {
  let globalTotalIncome = 0,
    globalTotalExpense = 0,
    globalTotalFundLimit = 0,
    globalTotalFundAvailable = 0;
  Object.values(allFundInfo).forEach((fundInfo) => {
    globalTotalIncome += fundInfo.totalIncome || 0;
    globalTotalExpense += fundInfo.totalExpense || 0;
    globalTotalFundLimit += fundInfo.fundLimitBank || 0;
    globalTotalFundAvailable += fundInfo.fundAvailableBank || 0;
  });
  document.getElementById("globalTotalIncome").textContent =
    globalTotalIncome.toLocaleString("vi-VN");
  document.getElementById("globalTotalExpense").textContent =
    globalTotalExpense.toLocaleString("vi-VN");
  document.getElementById("globalTotalProfit").textContent = (
    globalTotalIncome - globalTotalExpense
  ).toLocaleString("vi-VN");
  document.getElementById("globalTotalFundLimit").textContent =
    globalTotalFundLimit.toLocaleString("vi-VN");
  document.getElementById("globalTotalFundAvailable").textContent =
    globalTotalFundAvailable.toLocaleString("vi-VN");
}

async function loadCostCenterData() {
  currentCostCenterId = document.getElementById("costCenterSelect").value;
  if (!currentCostCenterId) {
    document
      .querySelectorAll(
        "#costCenterInfo, #addFormContainer, #summarySection, #bulkActions, #filtersSection",
      )
      .forEach((el) => el.classList.add("hidden"));
    return;
  }
  const selectedOption =
    document.getElementById("costCenterSelect").selectedOptions[0];
  document.getElementById("costCenterName").textContent =
    selectedOption.textContent;
  await loadFundInfo();
  document
    .querySelectorAll(
      "#costCenterInfo, #addFormContainer, #bulkActions, #filtersSection",
    )
    .forEach((el) => el.classList.remove("hidden"));
  await loadEntries();
  allEntries[currentCostCenterId] = {
    name: selectedOption.textContent,
    entries: entries,
  };
  await updateGlobalSummary();
}

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
    currentFundLimitBank = 0;
  }
}

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
  document.getElementById("multipleEntryForm").classList.add("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
  showAddButton();
  clearMultipleEntries();
}

function clearMultipleEntries() {
  const container = document.getElementById("multipleEntriesContainer");
  if (container) container.innerHTML = "";
  multipleEntryCounter = 0;
}

function sortEntries(field, direction) {
  if (field !== "date") return;
  filteredEntries.sort((a, b) => {
    const aValue = parseDate(a[field]),
      bValue = parseDate(b[field]);
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return aValue < bValue
      ? direction === "asc"
        ? -1
        : 1
      : aValue > bValue
        ? direction === "asc"
          ? 1
          : -1
        : 0;
  });
}

function sortTable(field) {
  if (field !== "date") return;
  if (currentSortField === field)
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  else {
    currentSortField = field;
    currentSortDirection = "asc";
  }
  sortEntries(currentSortField, currentSortDirection);
  renderEntries();
}

function calculateSummary() {
  let totalIncome = 0,
    totalExpense = 0;
  filteredEntries.forEach((entry) => {
    totalIncome += entry.income || 0;
    totalExpense += entry.expense || 0;
  });
  const fundAvailableBank = currentFundLimitBank - totalExpense + totalIncome;
  document.getElementById("totalIncome").textContent =
    totalIncome.toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent =
    totalExpense.toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent = (
    totalIncome - totalExpense
  ).toLocaleString("vi-VN");
  document.getElementById("fundLimitBankSummary").textContent =
    currentFundLimitBank.toLocaleString("vi-VN");
  document.getElementById("fundAvailableBank").textContent =
    fundAvailableBank.toLocaleString("vi-VN");
  document.getElementById("summarySection").classList.remove("hidden");
}

function updateFundSummary(fundData) {
  document.getElementById("fundLimitBankSummary").textContent = (
    fundData.fundLimitBank || 0
  ).toLocaleString("vi-VN");
  document.getElementById("fundAvailableBank").textContent = (
    fundData.fundAvailableBank || 0
  ).toLocaleString("vi-VN");
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

function renderEntries() {
  const tbody = document.getElementById("entriesBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  document.getElementById("currentEntriesCount").textContent =
    filteredEntries.length;
  document.getElementById("totalEntriesCount").textContent = entries.length;
  const today = getTodayFormatted();
  if (filteredEntries.length === 0 && !isAdding) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;">${entries.length === 0 ? "Chưa có dữ liệu. Hãy thêm khoản vay mới." : "Không có kết quả phù hợp."}</td></tr>`;
    return;
  }
  if (isAdding) tbody.appendChild(createAddRow());
  filteredEntries.forEach((entry) => {
    const row = document.createElement("tr");
    if (entry._id === editingEntryId) {
      row.className = "editing-row";
      row.innerHTML = `
        <td><input type="text" id="editName_${entry._id}" value="${escapeHtml(entry.name)}" required></td>
        <td><input type="text" id="editDate_${entry._id}" value="${entry.date}" required></td>
        <td><input type="number" id="editIncome_${entry._id}" value="${entry.income}" step="0.1" required></td>
        <td><input type="number" id="editExpense_${entry._id}" value="${entry.expense}" step="0.1" required></td>
        <td><input type="number" id="editInterestRate_${entry._id}" value="${entry.interestRate || 0}" step="0.01"></td>
        <td><input type="text" id="editDeductionDate_${entry._id}" value="${entry.deductionDate || ""}" placeholder="DD/MM/YYYY"></td>
        <td><input type="number" id="editMonthsWithNoPrincipalRepayment_${entry._id}" value="${entry.monthsWithNoPrincipalRepayment || 0}" step="1"></td>
        <td><input type="text" id="editMaturityDate_${entry._id}" value="${entry.maturityDate || ""}" placeholder="DD/MM/YYYY"></td>
        <td class="actions"><button class="save-btn" onclick="saveEdit('${entry._id}')">Lưu</button><button class="cancel-btn" onclick="cancelEdit('${entry._id}')">Hủy</button></td>
      `;
    } else {
      const isComplete =
        entry.isCompleteLoan &&
        entry.loanDisbursementDate &&
        entry.deductionDate &&
        entry.maturityDate;
      row.innerHTML = `
        <td>${escapeHtml(entry.name)}</td>
        <td class="${entry.date === today ? "current-date" : ""}">${entry.date}</td>
        <td>${(entry.income || 0).toLocaleString("vi-VN")}</td>
        <td>${(entry.expense || 0).toLocaleString("vi-VN")}</td>
        <td>${entry.interestRate ? entry.interestRate + "%" : "-"}</td>
        <td>${entry.deductionDate || "-"}</td>
        <td>${entry.monthsWithNoPrincipalRepayment || 0}</td>
        <td>${entry.maturityDate || "-"}</td>
        <td class="actions">
          <button class="edit-btn" onclick="startEdit('${entry._id}')">Sửa</button>
          <button class="delete-btn" onclick="deleteEntry('${entry._id}')">Xóa</button>
          ${isComplete ? `<button class="preview-btn" onclick="previewLoanFromEntry('${entry._id}')" style="background:#17a2b8;">Xem lịch</button>` : ""}
        </td>
      `;
    }
    tbody.appendChild(row);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(
    /[&<>]/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m] || m,
  );
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

function createAddRow() {
  const row = document.createElement("tr");
  row.id = "addEntryRow";
  row.className = "editing-row";
  const today = getTodayFormatted();
  row.innerHTML = `
    <td><input type="text" id="newName" placeholder="Tên khoản vay" required></td>
    <td><input type="text" id="newDate" value="${today}" required></td>
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
    alert("Vui lòng nhập tên");
    return;
  }
  if (isNaN(income) || income < 0) {
    alert("Vui lòng nhập số tiền vay hợp lệ");
    return;
  }
  if (!isValidDate(date)) {
    alert("Ngày giải ngân không hợp lệ");
    return;
  }
  if (isNaN(interestRate) || interestRate < 0) {
    alert("Vui lòng nhập lãi suất hợp lệ");
    return;
  }
  if (!deductionDate || !isValidDate(deductionDate)) {
    alert("Ngày trừ nợ không hợp lệ");
    return;
  }
  if (!maturityDate || !isValidDate(maturityDate)) {
    alert("Ngày đáo hạn không hợp lệ");
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`, {
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
      cancelAdd();
      await loadEntries();
      await updateGlobalSummary();
      alert("Thêm khoản vay thành công!");
    } else {
      const error = await response.json();
      alert("Lỗi: " + (error.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

function startEdit(entryId) {
  if (isAdding) cancelAdd();
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
  if (!isValidDate(date)) {
    alert("Ngày không hợp lệ");
    return;
  }
  try {
    const response = await fetch(
      `${API_BASE}/${currentCostCenterId}/entries/${entryId}`,
      {
        method: "PUT",
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
      },
    );
    if (response.ok) {
      editingEntryId = null;
      await loadEntries();
      await updateGlobalSummary();
      alert("Cập nhật thành công!");
    } else {
      const error = await response.json();
      alert("Lỗi: " + (error.message || "Unknown error"));
    }
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

async function deleteEntry(entryId) {
  if (!currentCostCenterId) return;
  if (confirm("Bạn có chắc chắn muốn xóa khoản vay này?")) {
    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries/${entryId}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        await loadEntries();
        await updateGlobalSummary();
        alert("Xóa thành công!");
      } else alert("Lỗi khi xóa");
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  }
}

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
    )
      return false;
    if (filterState.dateTo && !isDateOnOrBefore(entry.date, filterState.dateTo))
      return false;
    if (
      filterState.searchName &&
      !entry.name.toLowerCase().includes(filterState.searchName)
    )
      return false;
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
  filterState = { dateFrom: "", dateTo: "", searchName: "" };
  applyFilters();
}

function applyTodayOnlyFilter() {
  const today = getTodayFormatted();
  document.getElementById("dateFrom").value = today;
  document.getElementById("dateTo").value = today;
  applyFilters();
}

function showMultipleEntryForm() {
  if (isAdding || editingEntryId) {
    alert("Vui lòng hoàn thành thao tác hiện tại");
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
  const row = document.createElement("div");
  row.className = "entry-row";
  row.id = entryId;
  row.innerHTML = `
    <input type="text" id="${entryId}_name" placeholder="Tên khoản vay" required>
    <input type="text" id="${entryId}_date" value="${today}" required>
    <input type="number" id="${entryId}_income" placeholder="Số tiền vay" step="0.1" value="0" required>
    <input type="number" id="${entryId}_expense" placeholder="Đã trả gốc" step="0.1" value="0" required>
    <input type="number" id="${entryId}_interestRate" placeholder="Lãi suất %" step="0.01" value="0" required>
    <input type="text" id="${entryId}_deductionDate" placeholder="Ngày trừ nợ" required>
    <input type="number" id="${entryId}_monthsWithNoPrincipalRepayment" placeholder="Tháng ân hạn" step="1" value="0">
    <input type="text" id="${entryId}_maturityDate" placeholder="Ngày đáo hạn" required>
    <button type="button" class="remove-entry-btn" onclick="removeEntryRow('${entryId}')">×</button>
  `;
  container.appendChild(row);
}

function removeEntryRow(entryId) {
  const row = document.getElementById(entryId);
  if (row) row.remove();
  if (document.getElementById("multipleEntriesContainer").children.length === 0)
    addEntryRow();
}

async function saveMultipleEntries() {
  if (!currentCostCenterId) return;
  const rows = document.querySelectorAll(
    "#multipleEntriesContainer .entry-row",
  );
  if (rows.length === 0) {
    alert("Vui lòng thêm ít nhất một mục");
    return;
  }
  const entriesToSave = [];
  for (let row of rows) {
    const id = row.id;
    const name = document.getElementById(`${id}_name`).value.trim();
    const date = document.getElementById(`${id}_date`).value;
    const income = parseFloat(document.getElementById(`${id}_income`).value);
    const expense = parseFloat(document.getElementById(`${id}_expense`).value);
    const interestRate = parseFloat(
      document.getElementById(`${id}_interestRate`).value,
    );
    const deductionDate = document.getElementById(`${id}_deductionDate`).value;
    const monthsWithNoPrincipalRepayment =
      parseInt(
        document.getElementById(`${id}_monthsWithNoPrincipalRepayment`).value,
      ) || 0;
    const maturityDate = document.getElementById(`${id}_maturityDate`).value;
    if (!name || !date || !deductionDate || !maturityDate) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
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
  let success = 0,
    error = 0;
  for (const entry of entriesToSave) {
    try {
      const res = await fetch(`${API_BASE}/${currentCostCenterId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (res.ok) success++;
      else error++;
    } catch (e) {
      error++;
    }
  }
  alert(`Đã thêm ${success} khoản thành công, ${error} khoản thất bại`);
  if (success > 0) {
    hideMultipleEntryForm();
    await loadEntries();
    await updateGlobalSummary();
  }
}

function cancelMultipleEntries() {
  if (confirm("Hủy bỏ? Dữ liệu chưa lưu sẽ mất.")) hideMultipleEntryForm();
}

async function exportData() {
  if (!currentCostCenterId || filteredEntries.length === 0) {
    alert("Không có dữ liệu");
    return;
  }
  let csv =
    "Tên khoản vay,Ngày giải ngân,Số tiền vay,Đã trả gốc,Lãi suất %,Ngày trừ nợ,Tháng ân hạn,Ngày đáo hạn\n";
  filteredEntries.forEach((e) => {
    csv += `"${e.name}",${e.date},${e.income || 0},${e.expense || 0},${e.interestRate || 0},${e.deductionDate || ""},${e.monthsWithNoPrincipalRepayment || 0},${e.maturityDate || ""}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `bank_finance_${currentCostCenterId}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function showEditFundLimit() {
  if (!currentCostCenterId) {
    alert("Vui lòng chọn trạm");
    return;
  }
  const newVal = prompt("Nhập hạn mức mới (VND):", currentFundLimitBank);
  if (newVal !== null) {
    const val = parseFloat(newVal.replace(/[^\d.-]/g, ""));
    if (!isNaN(val) && val >= 0) saveFundLimit(val);
    else alert("Số không hợp lệ");
  }
}

async function saveFundLimit(newLimit) {
  try {
    const res = await fetch(`${API_BASE}/${currentCostCenterId}/fund-limit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundLimitBank: newLimit }),
    });
    if (res.ok) {
      currentFundLimitBank = newLimit;
      await loadFundInfo();
      await updateGlobalSummary();
      alert("Cập nhật hạn mức thành công!");
    } else alert("Lỗi cập nhật");
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

async function updateGlobalSummary() {
  if (currentCostCenterId) {
    try {
      const entriesRes = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries`,
      );
      const updatedEntries = await entriesRes.json();
      const fundRes = await fetch(
        `${API_BASE}/${currentCostCenterId}/fund-info`,
      );
      const updatedFund = await fundRes.json();
      allEntries[currentCostCenterId] = {
        name: document.getElementById("costCenterName").textContent,
        entries: updatedEntries,
      };
      allFundInfo[currentCostCenterId] = updatedFund;
    } catch (e) {}
  }
  flattenAllEntries();
  calculateGlobalSummary();
  if (alternativeViewActive) renderAllCostCentersView();
}

function renderAllCostCentersView() {
  if (!alternativeViewActive) return;
  const unique = new Set(filteredAllEntries.map((e) => e.costCenterId)).size;
  document.getElementById("totalCostCentersCount").textContent = unique;
  document.getElementById("totalTransactionsCount").textContent =
    filteredAllEntries.length;
  renderAllEntriesTable();
}

function renderAllEntriesTable() {
  const tbody = document.getElementById("allEntriesBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const today = getTodayFormatted();
  if (isAddingInAllView)
    tbody.appendChild(
      createAllViewAddRow(addingCostCenterId || allCostCenters[0]?._id),
    );
  if (filteredAllEntries.length === 0 && !isAddingInAllView) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;">Không có dữ liệu</td></tr>`;
    return;
  }
  filteredAllEntries.forEach((entry) => {
    const isComplete =
      entry.isCompleteLoan &&
      entry.loanDisbursementDate &&
      entry.deductionDate &&
      entry.maturityDate;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(entry.costCenterName)}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td class="${entry.date === today ? "current-date" : ""}">${entry.date}</td>
      <td>${(entry.income || 0).toLocaleString("vi-VN")}</td>
      <td>${(entry.expense || 0).toLocaleString("vi-VN")}</td>
      <td>${entry.interestRate ? entry.interestRate + "%" : "-"}</td>
      <td>${entry.deductionDate || "-"}</td>
      <td>${entry.monthsWithNoPrincipalRepayment || 0}</td>
      <td>${entry.maturityDate || "-"}</td>
      <td class="actions">
        <button class="edit-btn" onclick="switchToCostCenterAndEdit('${entry.costCenterId}', '${entry._id}')">Sửa</button>
        <button class="delete-btn" onclick="switchToCostCenterAndDelete('${entry.costCenterId}', '${entry._id}')">Xóa</button>
        ${isComplete ? `<button class="preview-btn" onclick="previewLoanFromAllView('${entry.costCenterId}', '${entry._id}')" style="background:#17a2b8;">Xem lịch</button>` : ""}
      </td>
    `;
    tbody.appendChild(row);
  });
  const addRow = document.createElement("tr");
  addRow.className = "add-row";
  addRow.innerHTML = `<td colspan="10"><button class="add-btn" onclick="showAllViewAddRow()">+ Thêm Khoản Vay Mới</button></td>`;
  tbody.appendChild(addRow);
}

async function previewLoanFromAllView(costCenterId, entryId) {
  try {
    const res = await fetch(`${API_BASE}/${costCenterId}/entries`);
    const entriesList = await res.json();
    const entry = entriesList.find((e) => e._id === entryId);
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
    alert("Lỗi: " + error.message);
  }
}

function createAllViewAddRow(costCenterId) {
  const row = document.createElement("tr");
  row.id = "allViewAddRow";
  row.className = "editing-row";
  const today = getTodayFormatted();
  row.innerHTML = `
    <td><select id="allViewNewCostCenter">${allCostCenters.map((cc) => `<option value="${cc._id}" ${cc._id === costCenterId ? "selected" : ""}>${cc.name}</option>`).join("")}</select></td>
    <td><input type="text" id="allViewNewName" placeholder="Tên khoản vay" required></td>
    <td><input type="text" id="allViewNewDate" value="${today}" required></td>
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
      : allCostCenters[0]?._id;
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
  const months =
    parseInt(
      document.getElementById("allViewNewMonthsWithNoPrincipalRepayment").value,
    ) || 0;
  const maturity = document.getElementById("allViewNewMaturityDate").value;
  if (!name || !date || !deductionDate || !maturity) {
    alert("Vui lòng điền đầy đủ thông tin");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/${costCenterId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        income,
        expense,
        date,
        interestRate,
        deductionDate,
        monthsWithNoPrincipalRepayment: months,
        maturityDate: maturity,
        loanDisbursementDate: date,
      }),
    });
    if (res.ok) {
      isAddingInAllView = false;
      await loadAllCostCentersData();
      applyAllFilters();
      alert("Thêm thành công!");
    } else alert("Lỗi khi thêm");
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

function showAllViewMultipleEntryForm() {
  if (isAddingInAllView || isAddingMultipleInAllView) {
    alert("Vui lòng hoàn thành thao tác hiện tại");
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
  document.getElementById("allViewMultipleEntriesContainer").innerHTML = "";
  allViewMultipleEntryCounter = 0;
}

function addAllViewEntryRow() {
  const container = document.getElementById("allViewMultipleEntriesContainer");
  const id = `allViewEntry_${allViewMultipleEntryCounter++}`;
  const today = getTodayFormatted();
  const row = document.createElement("div");
  row.className = "entry-row";
  row.id = id;
  row.innerHTML = `
    <select id="${id}_costCenter"><option value="">-- Chọn Trạm --</option>${allCostCenters.map((cc) => `<option value="${cc._id}">${cc.name}</option>`).join("")}</select>
    <input type="text" id="${id}_name" placeholder="Tên khoản vay" required>
    <input type="text" id="${id}_date" value="${today}" required>
    <input type="number" id="${id}_income" placeholder="Số tiền vay" step="0.1" value="0" required>
    <input type="number" id="${id}_expense" placeholder="Đã trả gốc" step="0.1" value="0" required>
    <input type="number" id="${id}_interestRate" placeholder="Lãi suất %" step="0.01" value="0" required>
    <input type="text" id="${id}_deductionDate" placeholder="Ngày trừ nợ" required>
    <input type="number" id="${id}_monthsWithNoPrincipalRepayment" placeholder="Tháng ân hạn" step="1" value="0">
    <input type="text" id="${id}_maturityDate" placeholder="Ngày đáo hạn" required>
    <button type="button" class="remove-entry-btn" onclick="removeAllViewEntryRow('${id}')">×</button>
  `;
  container.appendChild(row);
}

function removeAllViewEntryRow(id) {
  const row = document.getElementById(id);
  if (row) row.remove();
  if (
    document.getElementById("allViewMultipleEntriesContainer").children
      .length === 0
  )
    addAllViewEntryRow();
}

function cancelAllViewMultipleEntries() {
  if (confirm("Hủy bỏ?")) hideAllViewMultipleEntryForm();
}

function hideAllViewMultipleEntryForm() {
  document.getElementById("allViewMultipleEntryForm").classList.add("hidden");
  isAddingMultipleInAllView = false;
  clearAllViewMultipleEntries();
}

async function saveAllViewMultipleEntries() {
  const rows = document.querySelectorAll(
    "#allViewMultipleEntriesContainer .entry-row",
  );
  if (rows.length === 0) {
    alert("Vui lòng thêm ít nhất một mục");
    return;
  }
  const entriesToSave = [];
  for (let row of rows) {
    const id = row.id;
    const costCenterId = document.getElementById(`${id}_costCenter`).value;
    const name = document.getElementById(`${id}_name`).value.trim();
    const date = document.getElementById(`${id}_date`).value;
    const income = parseFloat(document.getElementById(`${id}_income`).value);
    const expense = parseFloat(document.getElementById(`${id}_expense`).value);
    const rate = parseFloat(
      document.getElementById(`${id}_interestRate`).value,
    );
    const dedDate = document.getElementById(`${id}_deductionDate`).value;
    const months =
      parseInt(
        document.getElementById(`${id}_monthsWithNoPrincipalRepayment`).value,
      ) || 0;
    const matDate = document.getElementById(`${id}_maturityDate`).value;
    if (!costCenterId || !name || !date || !dedDate || !matDate) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }
    entriesToSave.push({
      costCenterId,
      entry: {
        name,
        income,
        expense,
        date,
        interestRate: rate,
        deductionDate: dedDate,
        monthsWithNoPrincipalRepayment: months,
        maturityDate: matDate,
        loanDisbursementDate: date,
      },
    });
  }
  let success = 0,
    error = 0;
  for (const item of entriesToSave) {
    try {
      const res = await fetch(`${API_BASE}/${item.costCenterId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.entry),
      });
      if (res.ok) success++;
      else error++;
    } catch (e) {
      error++;
    }
  }
  alert(`Đã thêm ${success} khoản thành công, ${error} khoản thất bại`);
  if (success > 0) {
    hideAllViewMultipleEntryForm();
    await loadAllCostCentersData();
    applyAllFilters();
  }
}

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
    const aVal = parseDate(a[field]),
      bVal = parseDate(b[field]);
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    return aVal < bVal
      ? direction === "asc"
        ? -1
        : 1
      : aVal > bVal
        ? direction === "asc"
          ? 1
          : -1
        : 0;
  });
  if (alternativeViewActive) renderAllEntriesTable();
}

function sortAllTable(field) {
  if (field !== "date") return;
  if (currentAllSortField === field)
    currentAllSortDirection =
      currentAllSortDirection === "asc" ? "desc" : "asc";
  else {
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
  loadCostCenterData().then(() => setTimeout(() => startEdit(entryId), 500));
}

function switchToCostCenterAndDelete(costCenterId, entryId) {
  const toggle = document.getElementById("viewToggle");
  if (toggle.checked) {
    toggle.checked = false;
    toggleView();
  }
  document.getElementById("costCenterSelect").value = costCenterId;
  loadCostCenterData().then(() => setTimeout(() => deleteEntry(entryId), 500));
}

async function refreshAllData() {
  await loadAllCostCentersData();
  applyAllFilters();
  alert("Đã làm mới dữ liệu!");
}

async function exportAlternativeView() {
  if (filteredAllEntries.length === 0) {
    alert("Không có dữ liệu");
    return;
  }
  let csv =
    "Trạm,Tên khoản vay,Ngày giải ngân,Số tiền vay,Đã trả gốc,Lãi suất %,Ngày trừ nợ,Tháng ân hạn,Ngày đáo hạn\n";
  filteredAllEntries.forEach((e) => {
    csv += `"${e.costCenterName}","${e.name}",${e.date},${e.income || 0},${e.expense || 0},${e.interestRate || 0},${e.deductionDate || ""},${e.monthsWithNoPrincipalRepayment || 0},${e.maturityDate || ""}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `all_bank_finance_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function showGlobalDetails() {
  const active = Object.entries(allEntries).filter(
    ([_, d]) => d.entries?.length > 0,
  );
  if (active.length === 0) {
    alert("Không có dữ liệu");
    return;
  }
  const modalHtml = `
    <div class="modal fade" id="globalDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">📊 Tổng Kết Chi Tiết</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="table-dark"><tr><th>Trạm</th><th>Số Khoản</th><th>Tổng Vay</th><th>Tổng Trả Gốc</th><th>Tổng Dư Nợ</th><th>Hạn Mức</th><th>Quỹ Khả Dụng</th></tr></thead>
                <tbody>${active
                  .map(([id, d]) => {
                    const fund = allFundInfo[id] || {};
                    const totalVay = d.entries.reduce(
                      (s, e) => s + (e.income || 0),
                      0,
                    );
                    const totalTra = d.entries.reduce(
                      (s, e) => s + (e.expense || 0),
                      0,
                    );
                    const duNo = totalVay - totalTra;
                    return `<tr onclick="switchToCostCenter('${id}')" style="cursor:pointer"><td><strong>${d.name}</strong></td><td>${d.entries.length}</td><td>${totalVay.toLocaleString("vi-VN")}</td><td>${totalTra.toLocaleString("vi-VN")}</td><td class="${duNo >= 0 ? "text-danger" : "text-success"}">${duNo.toLocaleString("vi-VN")}</td><td>${(fund.fundLimitBank || 0).toLocaleString("vi-VN")}</td><td class="${(fund.fundAvailableBank || 0) >= 0 ? "text-success" : "text-danger"}">${(fund.fundAvailableBank || 0).toLocaleString("vi-VN")}</td></tr>`;
                  })
                  .join("")}</tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button><button class="btn btn-primary" onclick="refreshGlobalData()">🔄 Làm Mới</button><button class="btn btn-success" onclick="exportAllData()">📁 Xuất Toàn Bộ</button></div>
        </div>
      </div>
    </div>`;
  const existing = document.getElementById("globalDetailsModal");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", modalHtml);
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
  alert("Đã cập nhật!");
}

async function exportAllData() {
  const active = Object.entries(allEntries).filter(
    ([_, d]) => d.entries?.length > 0,
  );
  if (active.length === 0) {
    alert("Không có dữ liệu");
    return;
  }
  let csv =
    "Trạm,Tên khoản vay,Ngày giải ngân,Số tiền vay,Đã trả gốc,Lãi suất %,Ngày trừ nợ,Tháng ân hạn,Ngày đáo hạn\n";
  active.forEach(([_, d]) => {
    d.entries.forEach((e) => {
      csv += `"${d.name}","${e.name}",${e.date},${e.income || 0},${e.expense || 0},${e.interestRate || 0},${e.deductionDate || ""},${e.monthsWithNoPrincipalRepayment || 0},${e.maturityDate || ""}\n`;
    });
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `all_bank_finance_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
