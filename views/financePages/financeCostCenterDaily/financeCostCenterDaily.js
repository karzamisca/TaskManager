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

// Biến cho tổng kết toàn hệ thống
let allCostCenters = [];
let allEntries = {}; // Lưu entries của từng cost center: { costCenterId: { name: string, entries: array } }

// Alternative view variables
let alternativeViewActive = false;
let alternativeViewMode = "spreadsheet"; // 'spreadsheet' or 'column'

// Filter state
let filterState = {
  dateFrom: "",
  dateTo: "",
  searchName: "",
  searchNote: "",
  predictionFilter: "all",
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

    // Tính toán và hiển thị tổng kết toàn hệ thống
    calculateGlobalSummary();

    // If alternative view is active, render it
    if (alternativeViewActive) {
      renderAlternativeView();
    }
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu toàn hệ thống:", error);
  }
}

// Tính tổng kết toàn hệ thống
function calculateGlobalSummary() {
  let globalTotalIncome = 0;
  let globalTotalExpense = 0;
  let globalTotalIncomePrediction = 0;
  let globalTotalExpensePrediction = 0;

  // Duyệt qua tất cả cost centers
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

  // Cập nhật UI
  document.getElementById("globalTotalIncome").textContent =
    globalTotalIncome.toLocaleString("vi-VN");
  document.getElementById("globalTotalExpense").textContent =
    globalTotalExpense.toLocaleString("vi-VN");
  document.getElementById("globalTotalProfit").textContent =
    globalTotalProfit.toLocaleString("vi-VN");
}

// Cập nhật dữ liệu toàn hệ thống khi có thay đổi
async function updateGlobalSummary() {
  // Làm mới dữ liệu của cost center hiện tại
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

  // Tính toán lại tổng kết
  calculateGlobalSummary();

  // If alternative view is active, render it
  if (alternativeViewActive) {
    renderAlternativeView();
  }
}

// Toggle between single and alternative view
function toggleView() {
  const toggle = document.getElementById("viewToggle");
  alternativeViewActive = toggle.checked;

  // Update labels
  document
    .getElementById("singleViewLabel")
    .classList.toggle("active", !alternativeViewActive);
  document
    .getElementById("alternativeViewLabel")
    .classList.toggle("active", alternativeViewActive);

  // Show/hide views
  document.getElementById("singleCostCenterView").style.display =
    alternativeViewActive ? "none" : "block";
  document
    .getElementById("alternativeView")
    .classList.toggle("active", alternativeViewActive);

  if (alternativeViewActive) {
    renderAlternativeView();
  }
}

// Switch between spreadsheet and column view modes
function switchViewMode(mode) {
  alternativeViewMode = mode;

  // Update buttons
  document.querySelectorAll(".view-mode-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  // Show/hide views
  document.getElementById("spreadsheetView").style.display =
    mode === "spreadsheet" ? "grid" : "none";
  document
    .getElementById("columnView")
    .classList.toggle("active", mode === "column");

  renderAlternativeView();
}

// Render alternative view
async function renderAlternativeView() {
  if (!alternativeViewActive) return;

  // Filter cost centers that have actual daily entries
  const costCentersWithEntries = Object.entries(allEntries).filter(
    ([costCenterId, data]) => {
      if (!data.entries || data.entries.length === 0) return false;

      // Check if there are any actual entries (income or expense > 0)
      return data.entries.some(
        (entry) =>
          (entry.income && entry.income > 0) ||
          (entry.expense && entry.expense > 0),
      );
    },
  );

  if (costCentersWithEntries.length === 0) {
    if (alternativeViewMode === "spreadsheet") {
      document.getElementById("spreadsheetView").innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">
          <h4>Không có dữ liệu thực tế hàng ngày</h4>
          <p>Chưa có trạm nào có dữ liệu thực tế hàng ngày.</p>
        </div>
      `;
    } else {
      document.getElementById("columnViewGrid").innerHTML = `
        <div style="text-align: center; padding: 40px; color: #888;">
          <h4>Không có dữ liệu thực tế hàng ngày</h4>
          <p>Chưa có trạm nào có dữ liệu thực tế hàng ngày.</p>
        </div>
      `;
    }
    return;
  }

  if (alternativeViewMode === "spreadsheet") {
    renderSpreadsheetView(costCentersWithEntries);
  } else {
    renderColumnView(costCentersWithEntries);
  }
}

// Render spreadsheet view - NO TRUNCATION
function renderSpreadsheetView(costCentersData) {
  const spreadsheetContainer = document.getElementById("spreadsheetView");
  spreadsheetContainer.innerHTML = "";

  costCentersData.forEach(([costCenterId, data]) => {
    const totals = calculateCostCenterTotals(data.entries);

    const card = document.createElement("div");
    card.className = "spreadsheet-card";
    card.innerHTML = `
      <div class="spreadsheet-header">
        ${data.name}
      </div>
      <div class="spreadsheet-summary">
        <div class="summary-cell">
          <span class="summary-label">Giao dịch:</span>
          <span class="summary-value">${data.entries.length}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">Tổng thu:</span>
          <span class="summary-value">${totals.totalIncome.toLocaleString("vi-VN")}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">Tổng chi:</span>
          <span class="summary-value">${totals.totalExpense.toLocaleString("vi-VN")}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">Lợi nhuận:</span>
          <span class="summary-value ${totals.profit >= 0 ? "positive" : "negative"}">
            ${totals.profit.toLocaleString("vi-VN")}
          </span>
        </div>
      </div>
      <div class="spreadsheet-table">
        ${
          data.entries.length > 0
            ? `<table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Tên</th>
                <th>Thu</th>
                <th>Chi</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${data.entries
                .slice(0, 8)
                .map(
                  (entry) => `
                <tr onclick="switchToCostCenter('${costCenterId}')" style="cursor: pointer;">
                  <td class="date-cell">${entry.date}</td>
                  <td>${entry.name}</td>
                  <td class="income-cell">${entry.income.toLocaleString(
                    "vi-VN",
                  )}</td>
                  <td class="expense-cell">${entry.expense.toLocaleString(
                    "vi-VN",
                  )}</td>
                  <td>${entry.note || ""}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>`
            : '<div class="no-entries">Không có dữ liệu</div>'
        }
      </div>
    `;

    spreadsheetContainer.appendChild(card);
  });
}

// Render column view - NO TRUNCATION
function renderColumnView(costCentersData) {
  const columnContainer = document.getElementById("columnViewGrid");
  columnContainer.innerHTML = "";

  costCentersData.forEach(([costCenterId, data]) => {
    const totals = calculateCostCenterTotals(data.entries);

    const column = document.createElement("div");
    column.className = "spreadsheet-column";
    column.innerHTML = `
      <div class="column-header">
        ${data.name}
      </div>
      <div class="column-summary">
        <div class="summary-cell">
          <span class="summary-label">Giao dịch:</span>
          <span class="summary-value">${data.entries.length}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">Tổng thu:</span>
          <span class="summary-value">${totals.totalIncome.toLocaleString(
            "vi-VN",
          )}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">Tổng chi:</span>
          <span class="summary-value">${totals.totalExpense.toLocaleString(
            "vi-VN",
          )}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">Lợi nhuận:</span>
          <span class="summary-value ${
            totals.profit >= 0 ? "positive" : "negative"
          }">
            ${totals.profit.toLocaleString("vi-VN")}
          </span>
        </div>
      </div>
      <div class="column-table">
        ${
          data.entries.length > 0
            ? `<table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Tên</th>
                <th>Thu</th>
                <th>Chi</th>
              </tr>
            </thead>
            <tbody>
              ${data.entries
                .map(
                  (entry) => `
                <tr onclick="switchToCostCenter('${costCenterId}')" style="cursor: pointer;">
                  <td class="date-cell">${entry.date}</td>
                  <td>${entry.name}</td>
                  <td class="income-cell">${entry.income.toLocaleString(
                    "vi-VN",
                  )}</td>
                  <td class="expense-cell">${entry.expense.toLocaleString(
                    "vi-VN",
                  )}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>`
            : '<div class="no-entries">Không có dữ liệu</div>'
        }
      </div>
    `;

    columnContainer.appendChild(column);
  });
}

// Helper function to calculate totals for a cost center
function calculateCostCenterTotals(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.totalIncome += entry.income || 0;
      acc.totalExpense += entry.expense || 0;
      acc.totalIncomePrediction += entry.incomePrediction || 0;
      acc.totalExpensePrediction += entry.expensePrediction || 0;
      if (entry.incomePrediction || entry.expensePrediction) {
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

  totals.profit = totals.totalIncome - totals.totalExpense;
  return totals;
}

// Refresh all data for alternative view
async function refreshAllData() {
  await loadAllCostCentersData();
  renderAlternativeView();
  alert("Đã làm mới dữ liệu toàn hệ thống!");
}

// Export data from alternative view
async function exportAlternativeView() {
  try {
    // Filter cost centers with actual data
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

    // Create and download CSV file
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

  // Cập nhật dữ liệu trong allEntries
  allEntries[currentCostCenterId] = {
    name: selectedOption.textContent,
    entries: entries,
  };

  // Tính toán lại tổng kết toàn hệ thống
  calculateGlobalSummary();
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

// Hide multiple entry form
function hideMultipleEntryForm() {
  document.getElementById("multipleEntryForm").classList.add("hidden");
  document.getElementById("bulkActions").classList.remove("hidden");
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

    // Handle undefined/null values
    if (aValue === undefined || aValue === null)
      aValue = direction === "asc" ? Infinity : -Infinity;
    if (bValue === undefined || bValue === null)
      bValue = direction === "asc" ? Infinity : -Infinity;

    if (aValue < bValue) return direction === "asc" ? -1 : 1;
    if (aValue > bValue) return direction === "asc" ? 1 : -1;
    return 0;
  });

  // Update sort indicators
  updateSortIndicators(field, direction);
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

// Tính toán tổng kết cho trạm hiện tại với dự báo
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

  // Cập nhật UI
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

  // Hiển thị thống kê dự báo
  const predictionStats = document.getElementById("predictionStats");
  if (entriesWithPrediction > 0) {
    predictionStats.classList.remove("hidden");
    document.getElementById("withPredictionCount").textContent =
      entriesWithPrediction;
  } else {
    predictionStats.classList.add("hidden");
  }

  // Hiển thị phần tổng kết
  document.getElementById("summarySection").classList.remove("hidden");
}

// Hiển thị các mục trong bảng với dự báo - NO TRUNCATION
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

  filteredEntries.forEach((entry) => {
    const row = document.createElement("tr");

    // Check if this row is being edited
    if (entry._id === editingEntryId) {
      row.className = "editing-row";
      row.innerHTML = `
        <td><input type="text" id="editName_${entry._id}" value="${entry.name}" required></td>
        <td><input type="text" id="editDate_${entry._id}" value="${entry.date}" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
        
        <!-- Actual Values -->
        <td><input type="number" id="editIncome_${entry._id}" value="${entry.income}" step="0.1" required></td>
        <td><input type="number" id="editExpense_${entry._id}" value="${entry.expense}" step="0.1" required></td>
        
        <!-- Prediction Values -->
        <td><input type="number" id="editIncomePrediction_${entry._id}" value="${entry.incomePrediction || 0}" step="0.1"></td>
        <td><input type="number" id="editExpensePrediction_${entry._id}" value="${entry.expensePrediction || 0}" step="0.1"></td>
        
        <!-- Note field as textarea -->
        <td><textarea id="editNote_${entry._id}" placeholder="Ghi chú">${entry.note || ""}</textarea></td>
        
        <td class="actions">
          <button class="save-btn" onclick="saveEdit('${entry._id}')">Lưu</button>
          <button class="cancel-btn" onclick="cancelEdit('${entry._id}')">Hủy</button>
        </td>
      `;
    } else {
      // Normal display row - NO TRUNCATION
      const note = entry.note || "";

      row.innerHTML = `
        <td>${entry.name}</td>
        <td>${entry.date}</td>
        
        <!-- Actual Values -->
        <td style="background-color: #e8f5e9;">${entry.income.toLocaleString("vi-VN")}</td>
        <td style="background-color: #e8f5e9;">${entry.expense.toLocaleString("vi-VN")}</td>
        
        <!-- Prediction Values -->
        <td style="background-color: #fff9e6;">
          ${(entry.incomePrediction || 0).toLocaleString("vi-VN")}
        </td>
        <td style="background-color: #fff9e6;">
          ${(entry.expensePrediction || 0).toLocaleString("vi-VN")}
        </td>
        
        <!-- Note field - FULL CONTENT -->
        <td>${note.replace(/\n/g, "<br>")}</td>
        
        <td class="actions">
          <button class="edit-btn" onclick="startEdit('${entry._id}')">Sửa</button>
          <button class="delete-btn" onclick="deleteEntry('${entry._id}')">Xóa</button>
        </td>
      `;
    }
    tbody.appendChild(row);
  });

  // If adding new row, show it at the top
  if (isAdding) {
    const addRow = createAddRow();
    tbody.insertBefore(addRow, tbody.firstChild);
  }
}

// Create the add row HTML
function createAddRow() {
  const row = document.createElement("tr");
  row.id = "addEntryRow";
  row.className = "editing-row";

  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2, "0")}/${(
    today.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${today.getFullYear()}`;

  row.innerHTML = `
    <td><input type="text" id="newName" placeholder="Tên giao dịch" required></td>
    <td><input type="text" id="newDate" value="${formattedDate}" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required></td>
    
    <!-- Actual Values -->
    <td><input type="number" id="newIncome" placeholder="Thu nhập" step="0.1" value="0" required></td>
    <td><input type="number" id="newExpense" placeholder="Chi phí" step="0.1" value="0" required></td>
    
    <!-- Prediction Values -->
    <td><input type="number" id="newIncomePrediction" placeholder="Dự báo thu" step="0.1" value="0"></td>
    <td><input type="number" id="newExpensePrediction" placeholder="Dự báo chi" step="0.1" value="0"></td>
    
    <!-- Note field as textarea -->
    <td><textarea id="newNote" placeholder="Ghi chú"></textarea></td>
    
    <td class="actions">
      <button class="save-btn" onclick="saveNewEntry()">Lưu</button>
      <button class="cancel-btn" onclick="cancelAdd()">Hủy</button>
    </td>
  `;

  return row;
}

// Hiển thị hàng thêm mới với prediction fields
function showAddRow() {
  if (isAdding || editingEntryId) {
    return;
  }

  isAdding = true;
  hideAddButton();
  renderEntries(); // This will now show the add row at the top
}

// Hủy thêm mới
function cancelAdd() {
  isAdding = false;
  showAddButton();

  // Re-render the table to remove the add row
  renderEntries();
}

// Lưu mục mới với prediction fields
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

// Lưu chỉnh sửa với prediction fields
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
  filterState.searchNote = document
    .getElementById("searchNote")
    .value.toLowerCase();
  filterState.predictionFilter =
    document.getElementById("predictionFilter").value;

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

    // Note search filter
    if (
      filterState.searchNote &&
      !(entry.note || "").toLowerCase().includes(filterState.searchNote)
    ) {
      return false;
    }

    // Prediction filter
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
  document.getElementById("searchNote").value = "";
  document.getElementById("predictionFilter").value = "all";

  // Reset filter state
  filterState = {
    dateFrom: "",
    dateTo: "",
    searchName: "",
    searchNote: "",
    predictionFilter: "all",
  };

  // Apply reset filters (show all entries)
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

function addEntryRow() {
  const container = document.getElementById("multipleEntriesContainer");
  const entryId = `entry_${multipleEntryCounter++}`;

  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2, "0")}/${(
    today.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${today.getFullYear()}`;

  const entryRow = document.createElement("div");
  entryRow.className = "entry-row";
  entryRow.id = entryId;
  entryRow.innerHTML = `
    <input type="text" id="${entryId}_name" placeholder="Tên giao dịch" required>
    <input type="text" id="${entryId}_date" value="${formattedDate}" placeholder="DD/MM/YYYY" pattern="\\d{2}/\\d{2}/\\d{4}" required>
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

  const entriesToSave = [];
  let hasError = false;

  // Validate all entries first
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

  // Show loading state
  const saveBtn = document.querySelector("#multipleEntryForm .save-btn");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Đang lưu...";
  saveBtn.disabled = true;

  try {
    let successCount = 0;
    let errorCount = 0;

    // Save entries one by one
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

    // Reset button
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;

    // Show result
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

// Export Data
async function exportData() {
  if (!currentCostCenterId || filteredEntries.length === 0) {
    alert("Không có dữ liệu để xuất");
    return;
  }

  try {
    // Create CSV content
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

    // Create and download CSV file
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

// Global Summary Functions
function showGlobalDetails() {
  // Filter cost centers that have actual daily entries
  const costCentersWithEntries = Object.entries(allEntries).filter(
    ([costCenterId, data]) => {
      if (!data.entries || data.entries.length === 0) return false;

      // Check if there are any actual entries (income or expense > 0)
      return data.entries.some(
        (entry) =>
          (entry.income && entry.income > 0) ||
          (entry.expense && entry.expense > 0),
      );
    },
  );

  // If no cost centers have actual entries, show message
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

// Hàm xuất toàn bộ dữ liệu
async function exportAllData() {
  try {
    // Filter cost centers with actual data
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

    // Create and download CSV file
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
