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

function showOptimisticState(element) {
  element.classList.add("optimistic");
  const spinner = document.createElement("span");
  spinner.className = "optimistic-spinner";
  element.parentNode.appendChild(spinner);
  return spinner;
}

function clearOptimisticState(element, spinner, success = true) {
  if (spinner) spinner.remove();
  element.classList.remove("optimistic");
  element.classList.add(success ? "success" : "error");
  setTimeout(() => {
    element.classList.remove("success", "error");
  }, 1000);
}

// Utility functions for number formatting
function formatNumberWithCommas(num, isOutput = false) {
  const numericValue = Number(num) || 0;
  // For outputs (calculated fields), round up. For inputs, keep decimal precision
  const finalValue = isOutput ? Math.ceil(numericValue) : numericValue;
  return finalValue.toLocaleString("en-US", {
    minimumFractionDigits: isOutput ? 0 : undefined,
    maximumFractionDigits: isOutput ? 0 : undefined,
  });
}

function parseNumberFromInput(value) {
  // Remove commas and parse as float, maintaining decimal precision
  return parseFloat(value.replace(/,/g, "")) || 0;
}

function formatInputValue(input, value) {
  const numericValue = parseNumberFromInput(value);
  // For input fields, preserve decimals
  const formattedValue = numericValue.toLocaleString("en-US");
  input.value = formattedValue;
  return numericValue;
}

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

  // Disable the button during operation
  const addYearBtn = document.getElementById("addYearBtn");
  const originalText = addYearBtn.innerHTML;
  addYearBtn.innerHTML =
    '<span class="optimistic-spinner"></span> Đang thêm...';
  addYearBtn.disabled = true;

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
      addNewYearTab(newYear);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
      // Show error state
      addYearBtn.innerHTML = "Lỗi! Thử lại";
      setTimeout(() => {
        addYearBtn.innerHTML = originalText;
        addYearBtn.disabled = false;
      }, 2000);
      return;
    }
  } catch (error) {
    console.error("Error adding year:", error);
    console.log("Failed to add year");
    addYearBtn.innerHTML = "Lỗi! Thử lại";
    setTimeout(() => {
      addYearBtn.innerHTML = originalText;
      addYearBtn.disabled = false;
    }, 2000);
    return;
  }

  // Restore button state
  addYearBtn.innerHTML = originalText;
  addYearBtn.disabled = false;
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
      // Render month total row at the top
      const totals = calculateMonthTotals(monthData.entries);
      html += renderMonthTotalRow(monthName, monthData.entries.length, totals);

      // Render individual entries
      monthData.entries.forEach((entry, entryIndex) => {
        html += renderEntryRow(entry, entryIndex, monthName, yearData.year);
      });

      // Add entry button row
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
  return `
    <tr data-month="${monthName}" data-year="${year}" data-entry="${entryIndex}">
      <td>${entryIndex === 0 ? monthName : ""}</td>
      <td>${entryIndex + 1}</td>

      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.purchaseContract?.amount || 0
      )}" data-field="purchaseContract.amount"></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.purchaseContract?.unitCost || 0
      )}" data-field="purchaseContract.unitCost"></td>
      <td class="calculated-field">${formatNumberWithCommas(
        entry.purchaseContract?.totalCost || 0,
        true
      )}</td>

      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.saleContract?.amount || 0
      )}" data-field="saleContract.amount"></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.saleContract?.unitCost || 0
      )}" data-field="saleContract.unitCost"></td>
      <td class="calculated-field">${formatNumberWithCommas(
        entry.saleContract?.totalCost || 0,
        true
      )}</td>

      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.salary || 0
      )}" data-field="salary"></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.transportCost || 0
      )}" data-field="transportCost"></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.currencyExchangeRate || 1
      )}" data-field="currencyExchangeRate"></td>

      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.commissionRatePurchase || 0
      )}" data-field="commissionRatePurchase"></td>
      <td class="calculated-field">${formatNumberWithCommas(
        entry.commissionBonus?.purchase || 0,
        true
      )}</td>

      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.commissionRateSale || 0
      )}" data-field="commissionRateSale"></td>
      <td class="calculated-field">${formatNumberWithCommas(
        entry.commissionBonus?.sale || 0,
        true
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

// MODIFIED: Function to render month total row (now goes at the top)
function renderMonthTotalRow(monthName, entryCount, totals) {
  return `
    <tr class="total-row" data-month="${monthName}" style="background-color: #f8f9fa; font-weight: bold;">
      <td><strong>Tổng ${monthName}</strong></td>
      <td><strong>${entryCount}</strong></td>
      <td><strong>${formatNumberWithCommas(
        totals.purchaseAmount,
        true
      )}</strong></td>
      <td>-</td>
      <td><strong>${formatNumberWithCommas(
        totals.purchaseTotal,
        true
      )}</strong></td>
      <td><strong>${formatNumberWithCommas(
        totals.saleAmount,
        true
      )}</strong></td>
      <td>-</td>
      <td><strong>${formatNumberWithCommas(
        totals.saleTotal,
        true
      )}</strong></td>
      <td><strong>${formatNumberWithCommas(totals.salary, true)}</strong></td>
      <td><strong>${formatNumberWithCommas(
        totals.transport,
        true
      )}</strong></td>
      <td>-</td>
      <td>-</td>
      <td><strong>${formatNumberWithCommas(
        totals.commissionPurchase,
        true
      )}</strong></td>
      <td>-</td>
      <td><strong>${formatNumberWithCommas(
        totals.commissionSale,
        true
      )}</strong></td>
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

  // Enhanced input handling for number inputs with thousand separators
  container.querySelectorAll(".number-input").forEach((input) => {
    // Format input on focus (select all for easy editing)
    input.addEventListener("focus", function (e) {
      // Remove commas for easier editing
      const numericValue = parseNumberFromInput(e.target.value);
      e.target.value = numericValue.toString();
      e.target.select(); // Select all text for easy replacement
    });

    // Real-time input formatting and calculation
    input.addEventListener("input", function (e) {
      // Allow only numbers, commas, and decimal points during typing
      let value = e.target.value.replace(/[^\d.,]/g, "");

      // Prevent multiple decimal points
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      }

      e.target.value = value;
      handleInputChange(e);
    });

    // Format with commas on blur
    input.addEventListener("blur", function (e) {
      const numericValue = formatInputValue(e.target, e.target.value);
      handleInputBlur(e);
    });

    // Handle keyboard events
    input.addEventListener("keydown", function (e) {
      // Allow: backspace, delete, tab, escape, enter
      if (
        [46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)
      ) {
        return;
      }
      // Ensure that it is a number and stop the keypress
      if (
        (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
        (e.keyCode < 96 || e.keyCode > 105) &&
        e.keyCode !== 190 && // Regular decimal point (.)
        e.keyCode !== 110 && // Numpad decimal point (.)  <-- ADD THIS LINE
        e.keyCode !== 188 // Comma (,)
      ) {
        e.preventDefault();
      }
    });
  });
}

async function handleAddEntry(e) {
  const monthName = e.target.getAttribute("data-month");
  const year = e.target.getAttribute("data-year");

  if (!currentCenter) return;

  // Show loading state on the button
  const originalText = e.target.innerHTML;
  e.target.innerHTML = '<span class="optimistic-spinner"></span> Đang thêm...';
  e.target.disabled = true;

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
      await refreshMonthSection(monthName, year);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
      // Show error state
      e.target.innerHTML = "Lỗi! Thử lại";
      setTimeout(() => {
        e.target.innerHTML = originalText;
        e.target.disabled = false;
      }, 2000);
      return;
    }
  } catch (error) {
    console.error("Error adding entry:", error);
    console.log("Failed to add entry");
    e.target.innerHTML = "Lỗi! Thử lại";
    setTimeout(() => {
      e.target.innerHTML = originalText;
      e.target.disabled = false;
    }, 2000);
    return;
  }

  // Restore button state after successful addition
  e.target.innerHTML = originalText;
  e.target.disabled = false;
}

async function handleDeleteEntry(e) {
  const monthName = e.target.getAttribute("data-month");
  const year = e.target.getAttribute("data-year");
  const entryIndex = e.target.getAttribute("data-entry");

  if (!currentCenter || !confirm("Bạn có muốn xóa mục này?")) {
    return;
  }

  // Optimistically remove the row
  const row = e.target.closest("tr");
  row.style.opacity = "0.5";
  row.style.transition = "opacity 0.3s ease";

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);

      // Animate removal
      row.style.height = `${row.offsetHeight}px`;
      row.style.margin = "0";
      row.style.padding = "0";
      row.style.overflow = "hidden";
      row.style.transition = "all 0.3s ease";

      setTimeout(() => {
        row.style.height = "0";
        setTimeout(() => {
          // Only refresh the specific month section
          refreshMonthSection(monthName, year);
        }, 300);
      }, 50);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
      // Revert the visual state if deletion failed
      row.style.opacity = "1";
    }
  } catch (error) {
    console.error("Error deleting entry:", error);
    console.log("Failed to delete entry");
    row.style.opacity = "1";
  }
}

// MODIFIED: Function to refresh only a specific month section (updated for totals on top)
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
    // Month total row first
    const totals = calculateMonthTotals(monthData.entries);
    newRowsHtml += renderMonthTotalRow(
      monthName,
      monthData.entries.length,
      totals
    );

    // Then individual entries
    monthData.entries.forEach((entry, entryIndex) => {
      newRowsHtml += renderEntryRow(entry, entryIndex, monthName, year);
    });

    // Add entry button row
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
  const purchaseAmount = parseNumberFromInput(
    row.querySelector('[data-field="purchaseContract.amount"]').value
  );
  const purchaseUnitCost = parseNumberFromInput(
    row.querySelector('[data-field="purchaseContract.unitCost"]').value
  );
  const saleAmount = parseNumberFromInput(
    row.querySelector('[data-field="saleContract.amount"]').value
  );
  const saleUnitCost = parseNumberFromInput(
    row.querySelector('[data-field="saleContract.unitCost"]').value
  );
  const exchangeRate =
    parseNumberFromInput(
      row.querySelector('[data-field="currencyExchangeRate"]').value
    ) || 1;
  const purchaseCommRate = parseNumberFromInput(
    row.querySelector('[data-field="commissionRatePurchase"]').value
  );
  const saleCommRate = parseNumberFromInput(
    row.querySelector('[data-field="commissionRateSale"]').value
  );

  const purchaseTotal = purchaseAmount * purchaseUnitCost;
  const saleTotal = saleAmount * saleUnitCost;
  const purchaseCommission = purchaseAmount * purchaseCommRate * exchangeRate;
  const saleCommission = saleAmount * saleCommRate * exchangeRate;

  const calculatedFields = row.querySelectorAll(".calculated-field");
  calculatedFields[0].textContent = formatNumberWithCommas(purchaseTotal, true);
  calculatedFields[1].textContent = formatNumberWithCommas(saleTotal, true);
  calculatedFields[2].textContent = formatNumberWithCommas(
    purchaseCommission,
    true
  );
  calculatedFields[3].textContent = formatNumberWithCommas(
    saleCommission,
    true
  );
}

async function handleInputBlur(e) {
  const input = e.target;
  const row = input.closest("tr");
  const monthName = row.getAttribute("data-month");
  const year = row.getAttribute("data-year");
  const entryIndex = row.getAttribute("data-entry");

  if (!currentCenter || entryIndex === null) return;

  // Show optimistic UI state
  const spinner = showOptimisticState(input);

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
      clearOptimisticState(input, spinner, true);

      // Update only the month totals row instead of full refresh
      setTimeout(() => {
        updateMonthTotalsInPlace(monthName, year);
      }, 10);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
      clearOptimisticState(input, spinner, false);
      // Optionally revert the value if the update failed
      // input.value = previousValue;
    }
  } catch (error) {
    console.error("Error updating entry:", error);
    console.log("Failed to update entry");
    clearOptimisticState(input, spinner, false);
  }
}

// MODIFIED: Update month totals in place without full refresh (updated for totals on top)
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
    const cells = totalRow.querySelectorAll("td strong");
    // Verify we have enough cells before accessing them
    if (cells.length >= 15) {
      cells[1].textContent = monthData.entries.length;
      cells[2].textContent = formatNumberWithCommas(
        totals.purchaseAmount,
        true
      );
      cells[4].textContent = formatNumberWithCommas(totals.purchaseTotal, true);
      cells[5].textContent = formatNumberWithCommas(totals.saleAmount, true);
      cells[7].textContent = formatNumberWithCommas(totals.saleTotal, true);
      cells[8].textContent = formatNumberWithCommas(totals.salary, true);
      cells[9].textContent = formatNumberWithCommas(totals.transport, true);
      cells[12].textContent = formatNumberWithCommas(
        totals.commissionPurchase,
        true
      );
      cells[14].textContent = formatNumberWithCommas(
        totals.commissionSale,
        true
      );
    }
  }
}

function collectRowData(row) {
  const purchaseAmount = parseNumberFromInput(
    row.querySelector('[data-field="purchaseContract.amount"]').value
  );
  const purchaseUnitCost = parseNumberFromInput(
    row.querySelector('[data-field="purchaseContract.unitCost"]').value
  );
  const saleAmount = parseNumberFromInput(
    row.querySelector('[data-field="saleContract.amount"]').value
  );
  const saleUnitCost = parseNumberFromInput(
    row.querySelector('[data-field="saleContract.unitCost"]').value
  );
  const salary = parseNumberFromInput(
    row.querySelector('[data-field="salary"]').value
  );
  const transportCost = parseNumberFromInput(
    row.querySelector('[data-field="transportCost"]').value
  );
  const exchangeRate =
    parseNumberFromInput(
      row.querySelector('[data-field="currencyExchangeRate"]').value
    ) || 1;
  const purchaseCommRate = parseNumberFromInput(
    row.querySelector('[data-field="commissionRatePurchase"]').value
  );
  const saleCommRate = parseNumberFromInput(
    row.querySelector('[data-field="commissionRateSale"]').value
  );

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
