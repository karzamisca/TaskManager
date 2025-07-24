//views/financePages/financeGas/financeGas.js
let centers = [];
let currentCenter = null;
const months = [
  "Tháng Một",
  "Tháng Hai",
  "Tháng Ba",
  "Tháng Tư",
  "Tháng Năm",
  "Tháng Sáu",
  "Tháng Bảy",
  "Tháng Tám",
  "Tháng Chín",
  "Tháng Mười",
  "Tháng Mười Một",
  "Tháng Mười Hai",
];

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  loadCenters();
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("addCenterForm")
    .addEventListener("submit", handleAddCenter);
  document
    .getElementById("centerSelect")
    .addEventListener("change", handleCenterSelect);
  document
    .getElementById("deleteCenterBtn")
    .addEventListener("click", handleDeleteCenter);
  document
    .getElementById("addYearBtn")
    .addEventListener("click", handleAddYear);
}

async function loadCenters() {
  try {
    const response = await fetch("/financeGasControl");
    centers = await response.json();
    renderCenterSelect();
  } catch (error) {
    console.error("Error loading centers:", error);
  }
}

function renderCenterSelect() {
  const select = document.getElementById("centerSelect");
  select.innerHTML = '<option value="">Chọn một trạm...</option>';

  centers.forEach((center) => {
    const option = document.createElement("option");
    option.value = center._id;
    option.textContent = center.name;
    select.appendChild(option);
  });
}

async function handleAddCenter(e) {
  e.preventDefault();
  const centerName = document.getElementById("centerName").value.trim();

  if (!centerName) return;

  try {
    const response = await fetch("/financeGasControl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: centerName }),
    });

    if (response.ok) {
      document.getElementById("centerName").value = "";
      loadCenters();
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error adding center:", error);
    console.log("Failed to add center");
  }
}

function handleCenterSelect(e) {
  const centerId = e.target.value;
  if (!centerId) {
    currentCenter = null;
    document.getElementById("selectedCenterTitle").textContent =
      "Chọn một trạm";
    document.getElementById("financeContent").style.display = "none";
    return;
  }

  currentCenter = centers.find((c) => c._id === centerId);
  if (currentCenter) {
    document.getElementById("selectedCenterTitle").textContent =
      currentCenter.name;
    document.getElementById("financeContent").style.display = "block";
    renderFinanceTable();
  }
}

async function handleDeleteCenter() {
  if (
    !currentCenter ||
    !confirm("Bạn muốn xóa trạm này vào tất cả dữ liệu của nó?")
  ) {
    return;
  }

  try {
    const response = await fetch(`/financeGasControl/${currentCenter._id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      loadCenters();
      currentCenter = null;
      document.getElementById("selectedCenterTitle").textContent =
        "Chọn một trạm";
      document.getElementById("financeContent").style.display = "none";
      document.getElementById("centerSelect").value = "";
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting center:", error);
    console.log("Failed to delete center");
  }
}

async function handleAddYear() {
  if (!currentCenter) return;

  const currentYear = new Date().getFullYear();
  const existingYears = currentCenter.years.map((y) => y.year);
  let newYear = currentYear;

  while (existingYears.includes(newYear)) {
    newYear++;
  }

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: newYear }),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);
      // Only add new year tab instead of re-rendering everything
      addNewYearTab(newYear);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error adding year:", error);
    console.log("Failed to add year");
  }
}

// NEW: Function to add a new year tab without full re-render
function addNewYearTab(year) {
  const yearData = currentCenter.years.find((y) => y.year === year);
  if (!yearData) return;

  // Add new tab
  const tabsContainer = document.getElementById("yearTabs");
  const newTab = document.createElement("li");
  newTab.className = "nav-item";
  newTab.setAttribute("role", "presentation");
  newTab.innerHTML = `
    <button class="nav-link" 
            id="year-${year}-tab" 
            data-bs-toggle="tab" 
            data-bs-target="#year-${year}" 
            type="button" 
            role="tab">
        ${year}
    </button>
  `;
  tabsContainer.appendChild(newTab);

  // Add new tab content
  const contentContainer = document.getElementById("yearTabsContent");
  const newContent = document.createElement("div");
  newContent.className = "tab-pane fade";
  newContent.id = `year-${year}`;
  newContent.setAttribute("role", "tabpanel");
  newContent.innerHTML = renderYearTable(yearData);
  contentContainer.appendChild(newContent);

  // Activate the new tab
  const newTabButton = newTab.querySelector("button");
  const tab = new bootstrap.Tab(newTabButton);
  tab.show();

  // Setup event listeners for the new content
  setupTableEventListenersForContainer(newContent);
}

function renderFinanceTable() {
  if (!currentCenter) return;

  // Store current scroll position and active tab
  const activeTab = document.querySelector(".nav-tabs .nav-link.active");
  const activeYear = activeTab ? activeTab.textContent.trim() : null;
  const scrollPosition =
    document.querySelector(".table-container")?.scrollTop || 0;

  // Render year tabs
  let tabsHtml = "";
  let contentHtml = "";

  currentCenter.years.forEach((yearData, index) => {
    const isActive = activeYear
      ? yearData.year.toString() === activeYear
      : index === 0;

    tabsHtml += `
      <li class="nav-item" role="presentation">
        <button class="nav-link ${isActive ? "active" : ""}" 
                id="year-${yearData.year}-tab" 
                data-bs-toggle="tab" 
                data-bs-target="#year-${yearData.year}" 
                type="button" 
                role="tab">
            ${yearData.year}
        </button>
      </li>
    `;

    contentHtml += `
      <div class="tab-pane fade ${isActive ? "show active" : ""}" 
           id="year-${yearData.year}" 
           role="tabpanel">
          ${renderYearTable(yearData)}
      </div>
    `;
  });

  document.getElementById("yearTabs").innerHTML = tabsHtml;
  document.getElementById("yearTabsContent").innerHTML = contentHtml;

  // Restore scroll position
  setTimeout(() => {
    const tableContainer = document.querySelector(".table-container");
    if (tableContainer) {
      tableContainer.scrollTop = scrollPosition;
    }
  }, 50);

  // Setup table event listeners
  setupTableEventListeners();
}

function renderYearTable(yearData) {
  let html = `
    <div class="table-container">
      <table class="table table-excel table-bordered table-hover">
        <thead>
          <tr>
            <th style="min-width: 120px;">Tháng</th>
            <th style="min-width: 80px;">Mục</th>
            <th style="min-width: 90px;">Số lượng mua</th>
            <th style="min-width: 90px;">Đơn giá mua</th>
            <th style="min-width: 90px;">Tổng mua</th>
            <th style="min-width: 90px;">Số lượng bán</th>
            <th style="min-width: 90px;">Đơn giá bán</th>
            <th style="min-width: 90px;">Tổng bán</th>
            <th style="min-width: 80px;">Lương</th>
            <th style="min-width: 90px;">Vận chuyển</th>
            <th style="min-width: 90px;">Tỷ giá tiền</th>
            <th style="min-width: 90px;">Tỷ suất hoa hồng mua</th>
            <th style="min-width: 90px;">Hoa hồng mua</th>
            <th style="min-width: 90px;">Tỷ suất hoa hồng bán</th>
            <th style="min-width: 90px;">Hoa hồng bán</th>
            <th style="min-width: 80px;">Hành động</th>
          </tr>
        </thead>
        <tbody>
  `;

  months.forEach((monthName) => {
    const monthData = yearData.months.find((m) => m.name === monthName) || {
      entries: [],
    };

    if (monthData.entries.length === 0) {
      html += `
        <tr data-month="${monthName}" data-year="${yearData.year}">
          <td>${monthName}</td>
          <td>-</td>
          <td colspan="13" class="text-muted text-center">Không có mục</td>
          <td>
            <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                    data-month="${monthName}" data-year="${yearData.year}">
                + Thêm
            </button>
          </td>
        </tr>
      `;
    } else {
      monthData.entries.forEach((entry, entryIndex) => {
        html += renderEntryRow(entry, entryIndex, monthName, yearData.year);
      });

      html += `
        <tr data-month="${monthName}" data-year="${yearData.year}">
          <td></td>
          <td colspan="14" class="text-center">
            <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                    data-month="${monthName}" data-year="${yearData.year}">
                + Thêm mục
            </button>
          </td>
          <td></td>
        </tr>
      `;

      const totals = calculateMonthTotals(monthData.entries);
      html += renderMonthTotalRow(monthName, monthData.entries.length, totals);
    }
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  return html;
}

// NEW: Function to render a single entry row
function renderEntryRow(entry, entryIndex, monthName, year) {
  const formatNumber = (num) => {
    const rounded = Math.ceil(num * 100) / 100; // Round up to 2 decimal places
    return rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return `
    <tr data-month="${monthName}" data-year="${year}" data-entry="${entryIndex}">
      <td>${entryIndex === 0 ? monthName : ""}</td>
      <td>${entryIndex + 1}</td>

      <td><input type="number" class="input-cell" value="${
        entry.purchaseContract?.amount || 0
      }" data-field="purchaseContract.amount" step="0.01"></td>
      <td><input type="number" class="input-cell" value="${
        entry.purchaseContract?.unitCost || 0
      }" data-field="purchaseContract.unitCost" step="0.01"></td>
      <td class="calculated-field">${formatNumber(
        entry.purchaseContract?.totalCost || 0
      )}</td>

      <td><input type="number" class="input-cell" value="${
        entry.saleContract?.amount || 0
      }" data-field="saleContract.amount" step="0.01"></td>
      <td><input type="number" class="input-cell" value="${
        entry.saleContract?.unitCost || 0
      }" data-field="saleContract.unitCost" step="0.01"></td>
      <td class="calculated-field">${formatNumber(
        entry.saleContract?.totalCost || 0
      )}</td>

      <td><input type="number" class="input-cell" value="${
        entry.salary || 0
      }" data-field="salary" step="0.01"></td>
      <td><input type="number" class="input-cell" value="${
        entry.transportCost || 0
      }" data-field="transportCost" step="0.01"></td>
      <td><input type="number" class="input-cell" value="${
        entry.currencyExchangeRate || 1
      }" data-field="currencyExchangeRate" step="0.0001"></td>

      <td><input type="number" class="input-cell" value="${
        entry.commissionRatePurchase || 0
      }" data-field="commissionRatePurchase" step="0.0001"></td>
      <td class="calculated-field">${formatNumber(
        entry.commissionBonus?.purchase || 0
      )}</td>

      <td><input type="number" class="input-cell" value="${
        entry.commissionRateSale || 0
      }" data-field="commissionRateSale" step="0.0001"></td>
      <td class="calculated-field">${formatNumber(
        entry.commissionBonus?.sale || 0
      )}</td>

      <td>
        <button class="btn btn-sm btn-outline-danger btn-action delete-entry-btn" 
                data-month="${monthName}" data-year="${year}" data-entry="${entryIndex}">
            ×
        </button>
      </td>
    </tr>
  `;
}

// NEW: Function to render month total row
function renderMonthTotalRow(monthName, entryCount, totals) {
  const formatNumber = (num) => {
    const rounded = Math.ceil(num * 100) / 100; // Round up to 2 decimal places
    return rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return `
    <tr class="total-row" data-month="${monthName}">
      <td><strong>Tổng ${monthName}</strong></td>
      <td><strong>${entryCount}</strong></td>
      <td><strong>${formatNumber(totals.purchaseAmount)}</strong></td>
      <td>-</td>
      <td><strong>${formatNumber(totals.purchaseTotal)}</strong></td>
      <td><strong>${formatNumber(totals.saleAmount)}</strong></td>
      <td>-</td>
      <td><strong>${formatNumber(totals.saleTotal)}</strong></td>
      <td><strong>${formatNumber(totals.salary)}</strong></td>
      <td><strong>${formatNumber(totals.transport)}</strong></td>
      <td>-</td>
      <td>-</td>
      <td><strong>${formatNumber(totals.commissionPurchase)}</strong></td>
      <td>-</td>
      <td><strong>${formatNumber(totals.commissionSale)}</strong></td>
      <td></td>
    </tr>
  `;
}

function calculateMonthTotals(entries) {
  const totals = {
    purchaseAmount: 0,
    purchaseTotal: 0,
    saleAmount: 0,
    saleTotal: 0,
    salary: 0,
    transport: 0,
    commissionPurchase: 0,
    commissionSale: 0,
  };

  entries.forEach((entry) => {
    totals.purchaseAmount += entry.purchaseContract?.amount || 0;
    totals.purchaseTotal += entry.purchaseContract?.totalCost || 0;
    totals.saleAmount += entry.saleContract?.amount || 0;
    totals.saleTotal += entry.saleContract?.totalCost || 0;
    totals.salary += entry.salary || 0;
    totals.transport += entry.transportCost || 0;
    totals.commissionPurchase += entry.commissionBonus?.purchase || 0;
    totals.commissionSale += entry.commissionBonus?.sale || 0;
  });

  return totals;
}

function setupTableEventListeners() {
  setupTableEventListenersForContainer(document);
}

// NEW: Setup event listeners for a specific container
function setupTableEventListenersForContainer(container) {
  container.querySelectorAll(".add-entry-btn").forEach((btn) => {
    btn.addEventListener("click", handleAddEntry);
  });

  container.querySelectorAll(".delete-entry-btn").forEach((btn) => {
    btn.addEventListener("click", handleDeleteEntry);
  });

  container.querySelectorAll(".input-cell").forEach((input) => {
    input.addEventListener("input", handleInputChange);
    input.addEventListener("blur", handleInputBlur);
  });
}

async function handleAddEntry(e) {
  const monthName = e.target.getAttribute("data-month");
  const year = e.target.getAttribute("data-year");

  if (!currentCenter) return;

  // Store current scroll position and focused element
  const scrollPosition = document.querySelector(".table-container").scrollTop;
  const focusedElement = document.activeElement;

  const entryData = {
    purchaseContract: { amount: 0, unitCost: 0, totalCost: 0 },
    saleContract: { amount: 0, unitCost: 0, totalCost: 0 },
    salary: 0,
    transportCost: 0,
    currencyExchangeRate: 1,
    commissionRatePurchase: 0,
    commissionRateSale: 0,
    commissionBonus: { purchase: 0, sale: 0 },
  };

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryData),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);

      // Only refresh the specific month section
      await refreshMonthSection(monthName, year);

      // Restore scroll position
      setTimeout(() => {
        const tableContainer = document.querySelector(".table-container");
        if (tableContainer) {
          tableContainer.scrollTop = scrollPosition;
        }
      }, 50);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error adding entry:", error);
    console.log("Failed to add entry");
  }
}

async function handleDeleteEntry(e) {
  const monthName = e.target.getAttribute("data-month");
  const year = e.target.getAttribute("data-year");
  const entryIndex = e.target.getAttribute("data-entry");

  if (!currentCenter || !confirm("Bạn có muốn xóa mục này?")) {
    return;
  }

  // Store current scroll position
  const scrollPosition = document.querySelector(".table-container").scrollTop;

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);

      // Only refresh the specific month section
      await refreshMonthSection(monthName, year);

      // Restore scroll position
      setTimeout(() => {
        const tableContainer = document.querySelector(".table-container");
        if (tableContainer) {
          tableContainer.scrollTop = scrollPosition;
        }
      }, 50);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting entry:", error);
    console.log("Failed to delete entry");
  }
}

// NEW: Function to refresh only a specific month section
async function refreshMonthSection(monthName, year) {
  const yearData = currentCenter.years.find((y) => y.year === parseInt(year));
  if (!yearData) return;

  const monthData = yearData.months.find((m) => m.name === monthName) || {
    entries: [],
  };
  const activeTabContent = document.querySelector(".tab-pane.active tbody");

  if (!activeTabContent) return;

  // Find all rows for this month
  const monthRows = activeTabContent.querySelectorAll(
    `tr[data-month="${monthName}"]`
  );

  // Remove existing month rows
  monthRows.forEach((row) => row.remove());

  // Generate new month content
  let newRowsHtml = "";

  if (monthData.entries.length === 0) {
    newRowsHtml = `
      <tr data-month="${monthName}" data-year="${year}">
        <td>${monthName}</td>
        <td>-</td>
        <td colspan="13" class="text-muted text-center">Không có mục</td>
        <td>
          <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                  data-month="${monthName}" data-year="${year}">
              + Thêm
          </button>
        </td>
      </tr>
    `;
  } else {
    monthData.entries.forEach((entry, entryIndex) => {
      newRowsHtml += renderEntryRow(entry, entryIndex, monthName, year);
    });

    newRowsHtml += `
      <tr data-month="${monthName}" data-year="${year}">
        <td></td>
        <td colspan="14" class="text-center">
          <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                  data-month="${monthName}" data-year="${year}">
              + Thêm mục
          </button>
        </td>
        <td></td>
      </tr>
    `;

    const totals = calculateMonthTotals(monthData.entries);
    newRowsHtml += renderMonthTotalRow(
      monthName,
      monthData.entries.length,
      totals
    );
  }

  // Find the insertion point (before the next month or at the end)
  const nextMonthIndex = months.indexOf(monthName) + 1;
  let insertionPoint = null;

  if (nextMonthIndex < months.length) {
    for (let i = nextMonthIndex; i < months.length; i++) {
      const nextMonthRow = activeTabContent.querySelector(
        `tr[data-month="${months[i]}"]`
      );
      if (nextMonthRow) {
        insertionPoint = nextMonthRow;
        break;
      }
    }
  }

  // Create a temporary container to parse the HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = `<table><tbody>${newRowsHtml}</tbody></table>`;
  const newRows = tempDiv.querySelectorAll("tr");

  // Insert the new rows
  newRows.forEach((row) => {
    if (insertionPoint) {
      activeTabContent.insertBefore(row, insertionPoint);
    } else {
      activeTabContent.appendChild(row);
    }
  });

  // Setup event listeners for the new rows
  setupTableEventListenersForContainer(activeTabContent);
}

// NEW: Update current center data
function updateCurrentCenter(updatedCenter) {
  currentCenter = updatedCenter;
  const centerIndex = centers.findIndex((c) => c._id === currentCenter._id);
  if (centerIndex !== -1) {
    centers[centerIndex] = updatedCenter;
  }
}

function handleInputChange(e) {
  const row = e.target.closest("tr");
  updateRowCalculations(row);
}

function updateRowCalculations(row) {
  const purchaseAmount =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.amount"]').value
    ) || 0;
  const purchaseUnitCost =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.unitCost"]').value
    ) || 0;
  const saleAmount =
    parseFloat(row.querySelector('[data-field="saleContract.amount"]').value) ||
    0;
  const saleUnitCost =
    parseFloat(
      row.querySelector('[data-field="saleContract.unitCost"]').value
    ) || 0;
  const exchangeRate =
    parseFloat(
      row.querySelector('[data-field="currencyExchangeRate"]').value
    ) || 1;
  const purchaseCommRate =
    parseFloat(
      row.querySelector('[data-field="commissionRatePurchase"]').value
    ) || 0;
  const saleCommRate =
    parseFloat(row.querySelector('[data-field="commissionRateSale"]').value) ||
    0;

  const purchaseTotal = purchaseAmount * purchaseUnitCost;
  const saleTotal = saleAmount * saleUnitCost;
  const purchaseCommission = purchaseAmount * purchaseCommRate * exchangeRate;
  const saleCommission = saleAmount * saleCommRate * exchangeRate;

  const formatNumber = (num) => {
    const rounded = Math.ceil(num * 100) / 100; // Round up to 2 decimal places
    return rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const calculatedFields = row.querySelectorAll(".calculated-field");
  calculatedFields[0].textContent = formatNumber(purchaseTotal);
  calculatedFields[1].textContent = formatNumber(saleTotal);
  calculatedFields[2].textContent = formatNumber(purchaseCommission);
  calculatedFields[3].textContent = formatNumber(saleCommission);
}

async function handleInputBlur(e) {
  const row = e.target.closest("tr");
  const monthName = row.getAttribute("data-month");
  const year = row.getAttribute("data-year");
  const entryIndex = row.getAttribute("data-entry");

  if (!currentCenter || entryIndex === null) return;

  const entryData = collectRowData(row);

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryData),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);

      // Update only the month totals row instead of full refresh
      // Add a small delay to ensure the data is properly updated
      setTimeout(() => {
        updateMonthTotalsInPlace(monthName, year);
      }, 10);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error updating entry:", error);
    console.log("Failed to update entry");
  }
}

// NEW: Update month totals in place without full refresh
function updateMonthTotalsInPlace(monthName, year) {
  const yearData = currentCenter.years.find((y) => y.year === parseInt(year));
  if (!yearData) return;

  const monthData = yearData.months.find((m) => m.name === monthName);
  if (!monthData || monthData.entries.length === 0) {
    // If no entries exist, there's no total row to update
    return;
  }

  const totals = calculateMonthTotals(monthData.entries);
  const totalRow = document.querySelector(
    `tr.total-row[data-month="${monthName}"]`
  );

  if (totalRow) {
    const formatNumber = (num) => {
      const rounded = Math.ceil(num * 100) / 100; // Round up to 2 decimal places
      return rounded.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const cells = totalRow.querySelectorAll("td strong");
    // Verify we have enough cells before accessing them
    if (cells.length >= 15) {
      cells[1].textContent = monthData.entries.length;
      cells[2].textContent = formatNumber(totals.purchaseAmount);
      cells[4].textContent = formatNumber(totals.purchaseTotal);
      cells[5].textContent = formatNumber(totals.saleAmount);
      cells[7].textContent = formatNumber(totals.saleTotal);
      cells[8].textContent = formatNumber(totals.salary);
      cells[9].textContent = formatNumber(totals.transport);
      cells[12].textContent = formatNumber(totals.commissionPurchase);
      cells[14].textContent = formatNumber(totals.commissionSale);
    }
  }
}

function collectRowData(row) {
  const purchaseAmount =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.amount"]').value
    ) || 0;
  const purchaseUnitCost =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.unitCost"]').value
    ) || 0;
  const saleAmount =
    parseFloat(row.querySelector('[data-field="saleContract.amount"]').value) ||
    0;
  const saleUnitCost =
    parseFloat(
      row.querySelector('[data-field="saleContract.unitCost"]').value
    ) || 0;
  const salary =
    parseFloat(row.querySelector('[data-field="salary"]').value) || 0;
  const transportCost =
    parseFloat(row.querySelector('[data-field="transportCost"]').value) || 0;
  const exchangeRate =
    parseFloat(
      row.querySelector('[data-field="currencyExchangeRate"]').value
    ) || 1;
  const purchaseCommRate =
    parseFloat(
      row.querySelector('[data-field="commissionRatePurchase"]').value
    ) || 0;
  const saleCommRate =
    parseFloat(row.querySelector('[data-field="commissionRateSale"]').value) ||
    0;

  return {
    purchaseContract: {
      amount: purchaseAmount,
      unitCost: purchaseUnitCost,
      totalCost: purchaseAmount * purchaseUnitCost,
    },
    saleContract: {
      amount: saleAmount,
      unitCost: saleUnitCost,
      totalCost: saleAmount * saleUnitCost,
    },
    salary: salary,
    transportCost: transportCost,
    currencyExchangeRate: exchangeRate,
    commissionRatePurchase: purchaseCommRate,
    commissionRateSale: saleCommRate,
    commissionBonus: {
      purchase: purchaseAmount * purchaseCommRate * exchangeRate,
      sale: saleAmount * saleCommRate * exchangeRate,
    },
  };
}
