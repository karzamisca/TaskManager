//views/financePages/financeBank/financeBank.js
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
let draggedTab = null;
let draggedTabIndex = -1;

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
  document
    .getElementById("editYearBtn")
    .addEventListener("click", handleEditYear);
}

async function loadCenters() {
  try {
    const response = await fetch("/financeBankControl");
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
    const response = await fetch("/financeBankControl", {
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
    const response = await fetch(`/financeBankControl/${currentCenter._id}`, {
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
      `/financeBankControl/${currentCenter._id}/years`,
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

async function handleEditYear() {
  if (!currentCenter) return;

  const activeTab = document.querySelector(".nav-tabs .nav-link.active");
  if (!activeTab) return;

  const year = activeTab.textContent.trim();
  const yearData = currentCenter.years.find((y) => y.year === parseInt(year));
  if (!yearData) return;

  // Create and show the edit modal
  const modalHtml = `
    <div class="year-edit-overlay">
      <div class="year-edit-modal">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5>Sửa năm</h5>
          <button type="button" class="btn-close" aria-label="Close"></button>
        </div>
        <form id="editYearForm">
          <div class="mb-3">
            <label for="editYearInput" class="form-label">Năm hiện tại</label>
            <input type="number" class="form-control" id="editYearInput" value="${year}" min="2000" max="2100">
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm" id="cancelEditYear">Hủy</button>
            <button type="submit" class="btn btn-primary btn-sm">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.createElement("div");
  modal.innerHTML = modalHtml;
  document.body.appendChild(modal);

  // Setup event listeners for the modal
  modal
    .querySelector(".btn-close")
    .addEventListener("click", () => modal.remove());
  modal
    .querySelector("#cancelEditYear")
    .addEventListener("click", () => modal.remove());

  modal.querySelector("#editYearForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newYear = parseInt(modal.querySelector("#editYearInput").value);

    if (isNaN(newYear) || newYear < 2000 || newYear > 2100) {
      alert("Vui lòng nhập năm hợp lệ (2000-2100)");
      return;
    }

    if (newYear === yearData.year) {
      modal.remove();
      return;
    }

    // Check if year already exists
    if (currentCenter.years.some((y) => y.year === newYear)) {
      alert(`Năm ${newYear} đã tồn tại`);
      return;
    }

    try {
      const response = await fetch(
        `/financeBankControl/${currentCenter._id}/years/${yearData.year}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newYear }),
        }
      );

      if (response.ok) {
        const updatedCenter = await response.json();
        updateCurrentCenter(updatedCenter);
        modal.remove();
        renderFinanceTable(); // Refresh the entire table to show the new year
      } else {
        const error = await response.json();
        console.log(`Error: ${error.message}`);
        alert(`Lỗi khi cập nhật năm: ${error.message}`);
      }
    } catch (error) {
      console.error("Error updating year:", error);
      alert("Lỗi khi cập nhật năm");
    }
  });
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
      <li class="nav-item" role="presentation" draggable="true" data-index="${index}">
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

  // Setup drag and drop events for tabs
  setupTabDragAndDrop();

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

function setupTabDragAndDrop() {
  const tabsContainer = document.getElementById("yearTabs");
  const tabs = Array.from(tabsContainer.querySelectorAll(".nav-item"));

  tabs.forEach((tab) => {
    tab.addEventListener("dragstart", handleTabDragStart);
    tab.addEventListener("dragover", handleTabDragOver);
    tab.addEventListener("dragleave", handleTabDragLeave);
    tab.addEventListener("drop", handleTabDrop);
    tab.addEventListener("dragend", handleTabDragEnd);
  });
}

function handleTabDragStart(e) {
  draggedTab = this;
  draggedTabIndex = parseInt(this.getAttribute("data-index"));
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/html", this.innerHTML);

  // Add visual feedback
  this.classList.add("dragging");
  setTimeout(() => {
    this.style.opacity = "0.4";
  }, 0);
}

function handleTabDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  // Highlight the drop target
  this.classList.add("drag-over");
}

function handleTabDragLeave() {
  this.classList.remove("drag-over");
}

async function handleTabDrop(e) {
  e.preventDefault();
  this.classList.remove("drag-over");

  if (draggedTab !== this) {
    const dropIndex = parseInt(this.getAttribute("data-index"));
    const tabsContainer = document.getElementById("yearTabs");

    // Reorder the DOM elements
    if (draggedTabIndex < dropIndex) {
      tabsContainer.insertBefore(draggedTab, this.nextSibling);
    } else {
      tabsContainer.insertBefore(draggedTab, this);
    }

    // Update the data model and save to server
    await reorderYears(draggedTabIndex, dropIndex);

    // Update data-index attributes
    const tabs = Array.from(tabsContainer.querySelectorAll(".nav-item"));
    tabs.forEach((tab, index) => {
      tab.setAttribute("data-index", index);
    });
  }
}

function handleTabDragEnd() {
  this.classList.remove("dragging");
  this.style.opacity = "1";

  // Remove drag-over class from all tabs
  const tabs = document.querySelectorAll(".nav-item");
  tabs.forEach((tab) => tab.classList.remove("drag-over"));
}

async function reorderYears(fromIndex, toIndex) {
  if (!currentCenter || fromIndex === toIndex) return;

  try {
    // Create a new array with the reordered years
    const reorderedYears = [...currentCenter.years];
    const [movedYear] = reorderedYears.splice(fromIndex, 1);
    reorderedYears.splice(toIndex, 0, movedYear);

    // Update the current center data
    const updatedCenter = {
      ...currentCenter,
      years: reorderedYears,
    };

    // Send the update to the server
    const response = await fetch(
      `/financeBankControl/${currentCenter._id}/reorderYears`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromIndex, toIndex }),
      }
    );

    if (response.ok) {
      updateCurrentCenter(updatedCenter);
    } else {
      const error = await response.json();
      console.log(`Error reordering years: ${error.message}`);
      // If the server update fails, revert the UI
      renderFinanceTable();
    }
  } catch (error) {
    console.error("Error reordering years:", error);
    console.log("Failed to reorder years");
    // If there's an error, revert the UI
    renderFinanceTable();
  }
}

function updateYearTotalsInPlace(year) {
  const yearData = currentCenter.years.find((y) => y.year === parseInt(year));
  if (!yearData) return;

  const yearTotals = {
    inflows: 0,
    outflows: 0,
    balance: 0, // This will be the accumulated balance for the year
  };

  // Calculate totals for each month
  months.forEach((monthName) => {
    const monthData = yearData.months.find((m) => m.name === monthName);
    if (monthData && monthData.entries.length > 0) {
      const monthTotals = calculateMonthTotals(monthData.entries);
      yearTotals.inflows += monthTotals.inflows;
      yearTotals.outflows += monthTotals.outflows;
      yearTotals.balance += monthTotals.balance; // Accumulate monthly balances
    }
  });

  // Update the year total row
  const yearTotalRow = document.querySelector(`tr.year-total-row`);
  if (yearTotalRow) {
    const cells = yearTotalRow.querySelectorAll("td strong");
    cells[0].textContent = formatNumberWithCommas(yearTotals.inflows, true);
    cells[1].textContent = formatNumberWithCommas(yearTotals.outflows, true);
    cells[2].textContent = formatNumberWithCommas(yearTotals.balance, true);
  }
}

function renderYearTable(yearData) {
  // Calculate year totals
  const yearTotals = {
    inflows: 0,
    outflows: 0,
    balance: 0,
  };

  // Calculate month totals and accumulate year totals
  const monthTotalsData = {};
  months.forEach((monthName) => {
    const monthData = yearData.months.find((m) => m.name === monthName);
    if (monthData && monthData.entries.length > 0) {
      const totals = calculateMonthTotals(monthData.entries);
      monthTotalsData[monthName] = totals;
      yearTotals.inflows += totals.inflows;
      yearTotals.outflows += totals.outflows;
      yearTotals.balance = totals.balance; // Last month's balance is the current balance
    }
  });

  let html = `
    <div class="table-container">
      <table class="table table-excel table-bordered table-hover">
        <thead>
          <tr>
            <th style="min-width: 120px;">Tháng</th>
            <th style="min-width: 80px;">Mục</th>
            <th style="min-width: 90px;">Thu</th>
            <th style="min-width: 90px;">Chi</th>
            <th style="min-width: 90px;">Số dư</th>
            <th style="min-width: 90px;">Nội dung thủ quỹ</th>
            <th style="min-width: 90px;">Nội dung ngân hàng</th>
            <th style="min-width: 90px;">Ghi chú</th>
            <th style="min-width: 80px;">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <!-- Year Total Row (added at the top) -->
          <tr class="year-total-row">
            <td><strong>Tổng cả năm ${yearData.year}</strong></td>
            <td></td>
            <td><strong>${formatNumberWithCommas(
              yearTotals.inflows,
              true
            )}</strong></td>
            <td><strong>${formatNumberWithCommas(
              yearTotals.outflows,
              true
            )}</strong></td>
            <td><strong>${formatNumberWithCommas(
              yearTotals.balance,
              true
            )}</strong></td>
            <td colspan="4"></td>
          </tr>
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
          <td colspan="6" class="text-muted text-center">Không có mục</td>
          <td>
            <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                    data-month="${monthName}" data-year="${yearData.year}">
                + Thêm
            </button>
          </td>
        </tr>
      `;
    } else {
      // Render month total row
      const totals =
        monthTotalsData[monthName] || calculateMonthTotals(monthData.entries);
      html += renderMonthTotalRow(monthName, monthData.entries.length, totals);

      // Render individual entries
      monthData.entries.forEach((entry, entryIndex) => {
        html += renderEntryRow(entry, entryIndex, monthName, yearData.year);
      });

      // Add entry button row
      html += `
        <tr data-month="${monthName}" data-year="${yearData.year}">
          <td></td>
          <td colspan="7" class="text-center">
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

//Function to render a single entry row
function renderEntryRow(entry, entryIndex, monthName, year) {
  return `
    <tr data-month="${monthName}" data-year="${year}" data-entry="${entryIndex}">
      <td>${entryIndex === 0 ? monthName : ""}</td>
      <td>${entryIndex + 1}</td>
      
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.inflows || 0
      )}" data-field="inflows"></td>
      
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.outflows || 0
      )}" data-field="outflows"></td>
      
      <td class="calculated-field">${formatNumberWithCommas(
        entry.balance || 0
      )}</td>
      
      <td><textarea class="form-control input-cell" data-field="treasurerNote">${
        entry.treasurerNote || ""
      }</textarea></td>
      
      <td><textarea class="form-control input-cell" data-field="bankNote">${
        entry.bankNote || ""
      }</textarea></td>
      
      <td><textarea class="form-control input-cell" data-field="generalNote">${
        entry.generalNote || ""
      }</textarea></td>
      
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
    <tr class="total-row" data-month="${monthName}">
      <td><strong>Tổng ${monthName}</strong></td>
      <td><strong>${entryCount}</strong></td>
      <td><strong>${formatNumberWithCommas(totals.inflows, true)}</strong></td>
      <td><strong>${formatNumberWithCommas(totals.outflows, true)}</strong></td>
      <td><strong>${formatNumberWithCommas(totals.balance, true)}</strong></td>
      <td colspan="3"></td>
      <td></td>
    </tr>
  `;
}

function calculateMonthTotals(entries) {
  const totals = {
    inflows: 0,
    outflows: 0,
    balance: 0, // This will be the accumulated balance
  };

  entries.forEach((entry) => {
    totals.inflows += entry.inflows || 0;
    totals.outflows += entry.outflows || 0;
    totals.balance += (entry.inflows || 0) - (entry.outflows || 0); // Accumulate balance
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

  container.querySelectorAll("textarea.input-cell").forEach((textarea) => {
    textarea.addEventListener("change", handleTextareaChange);
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

async function handleTextareaChange(e) {
  const textarea = e.target;
  const row = textarea.closest("tr");
  const monthName = row.getAttribute("data-month");
  const year = row.getAttribute("data-year");
  const entryIndex = row.getAttribute("data-entry");

  if (!currentCenter || entryIndex === null) return;

  const spinner = showOptimisticState(textarea);
  const entryData = collectRowData(row);

  try {
    const response = await fetch(
      `/financeBankControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryData),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);
      clearOptimisticState(textarea, spinner, true);
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
      clearOptimisticState(textarea, spinner, false);
    }
  } catch (error) {
    console.error("Error updating entry:", error);
    console.log("Failed to update entry");
    clearOptimisticState(textarea, spinner, false);
  }
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
    inflows: 0,
    outflows: 0,
    balance: 0,
    treasurerNote: "",
    bankNote: "",
    generalNote: "",
  };

  try {
    const response = await fetch(
      `/financeBankControl/${currentCenter._id}/years/${year}/months/${monthName}/entries`,
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
      `/financeBankControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
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
  const inflows = parseNumberFromInput(
    row.querySelector('[data-field="inflows"]').value
  );
  const outflows = parseNumberFromInput(
    row.querySelector('[data-field="outflows"]').value
  );

  // Calculate this entry's balance only (inflows - outflows)
  const balanceCell = row.querySelector(".calculated-field");
  if (balanceCell) {
    balanceCell.textContent = formatNumberWithCommas(inflows - outflows, true);
  }

  // After updating this row, update the month totals
  const monthName = row.getAttribute("data-month");
  const year = row.getAttribute("data-year");
  updateMonthTotalsInPlace(monthName, year);
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

  // Optimistically update the totals first
  updateMonthTotalsInPlace(monthName, year);

  try {
    const response = await fetch(
      `/financeBankControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
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
    } else {
      const error = await response.json();
      console.log(`Error: ${error.message}`);
      clearOptimisticState(input, spinner, false);
      // Re-render to get correct server state
      refreshMonthSection(monthName, year);
    }
  } catch (error) {
    console.error("Error updating entry:", error);
    console.log("Failed to update entry");
    clearOptimisticState(input, spinner, false);
    // Re-render to get correct server state
    refreshMonthSection(monthName, year);
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
  return {
    inflows: parseNumberFromInput(
      row.querySelector('[data-field="inflows"]').value
    ),
    outflows: parseNumberFromInput(
      row.querySelector('[data-field="outflows"]').value
    ),
    treasurerNote: row.querySelector('[data-field="treasurerNote"]').value,
    bankNote: row.querySelector('[data-field="bankNote"]').value,
    generalNote: row.querySelector('[data-field="generalNote"]').value,
  };
}
