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
let draggedTab = null;
let draggedTabIndex = -1;

async function showAllCentersTotals() {
  try {
    // Show loading state
    const btn = document.getElementById("showAllTotalsBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="optimistic-spinner"></span> Đang tải...';
    btn.disabled = true;

    // Fetch all centers data
    const response = await fetch("/financeGasControl");
    const allCenters = await response.json();

    // Create modal container
    const modal = document.createElement("div");
    modal.className = "consolidated-totals-modal";
    modal.innerHTML = `
      <div class="consolidated-totals-overlay">
        <div class="consolidated-totals-container">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h4>Tổng hợp tất cả trạm</h4>
            <button id="exportExcelBtn" class="btn btn-sm btn-success me-2">
              <i class="bi bi-file-earmark-excel"></i> Xuất Excel
            </button>            
            <button type="button" class="btn-close" aria-label="Close"></button>
          </div>
          <div class="table-container" style="max-height: 70vh;">
            <table class="table table-excel consolidated-totals-table">
              <thead>
                <tr>
                  <th>Trạm</th>
                  <th>Tháng</th>
                  <th>Số lượng mua</th>
                  <th>Tổng mua</th>
                  <th>Số lượng bán</th>
                  <th>Tổng bán</th>
                  <th>Vận chuyển</th>
                  <th>Hoa hồng mua</th>
                  <th>Hoa hồng bán</th>
                </tr>
              </thead>
              <tbody id="consolidatedTotalsBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Populate the table
    const tbody = modal.querySelector("#consolidatedTotalsBody");
    let grandTotals = {
      purchaseAmount: 0,
      purchaseTotal: 0,
      saleAmount: 0,
      saleTotal: 0,
      transport: 0,
      commissionPurchase: 0,
      commissionSale: 0,
    };

    allCenters.forEach((center) => {
      center.years.forEach((yearData) => {
        yearData.months.forEach((monthData) => {
          if (monthData.entries.length > 0) {
            const monthTotals = calculateMonthTotals(monthData.entries);

            // Add to grand totals
            Object.keys(grandTotals).forEach((key) => {
              grandTotals[key] += monthTotals[key];
            });

            // Add row for this month
            tbody.innerHTML += `
              <tr>
                <td>${center.name}</td>
                <td>${monthData.name} ${yearData.year}</td>
                <td>${formatNumberWithCommas(
                  monthTotals.purchaseAmount,
                  true
                )}</td>
                <td>${formatNumberWithCommas(
                  monthTotals.purchaseTotal,
                  true
                )}</td>
                <td>${formatNumberWithCommas(monthTotals.saleAmount, true)}</td>
                <td>${formatNumberWithCommas(monthTotals.saleTotal, true)}</td>
                <td>${formatNumberWithCommas(monthTotals.transport, true)}</td>
                <td>${formatNumberWithCommas(
                  monthTotals.commissionPurchase,
                  true
                )}</td>
                <td>${formatNumberWithCommas(
                  monthTotals.commissionSale,
                  true
                )}</td>
              </tr>
            `;
          }
        });
      });
    });

    // Add grand totals row
    tbody.innerHTML += `
      <tr class="consolidated-total-row">
        <td colspan="2"><strong>TỔNG CỘNG</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.purchaseAmount,
          true
        )}</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.purchaseTotal,
          true
        )}</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.saleAmount,
          true
        )}</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.saleTotal,
          true
        )}</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.transport,
          true
        )}</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.commissionPurchase,
          true
        )}</strong></td>
        <td><strong>${formatNumberWithCommas(
          grandTotals.commissionSale,
          true
        )}</strong></td>
      </tr>
    `;

    // Add close button functionality
    modal.querySelector(".btn-close").addEventListener("click", () => {
      modal.remove();
      btn.innerHTML = originalText;
      btn.disabled = false;
    });

    // Add export button functionality
    modal.querySelector("#exportExcelBtn").addEventListener("click", () => {
      // Trigger file download
      window.location.href = "/financeGasControlSummaryExportToExcel";
    });

    // Add to document
    document.body.appendChild(modal);
  } catch (error) {
    console.error("Error loading consolidated totals:", error);
    alert("Lỗi khi tải dữ liệu tổng hợp");
    document.getElementById("showAllTotalsBtn").innerHTML = originalText;
    document.getElementById("showAllTotalsBtn").disabled = false;
  }
}

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
    .getElementById("showAllTotalsBtn")
    .addEventListener("click", showAllCentersTotals);
  document
    .getElementById("centerSelect")
    .addEventListener("change", handleCenterSelect);
  document
    .getElementById("addYearBtn")
    .addEventListener("click", handleAddYear);
  document
    .getElementById("editYearBtn")
    .addEventListener("click", handleEditYear);
  document
    .getElementById("categorySelect")
    .addEventListener("change", handleCategoryChange);
}

async function handleCategoryChange(e) {
  if (!currentCenter) return;

  const newCategory = e.target.value;
  if (newCategory === currentCenter.category) return;

  try {
    const response = await fetch(`/financeGasControl/${currentCenter._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory }),
    });

    if (response.ok) {
      const updatedCenter = await response.json();
      updateCurrentCenter(updatedCenter);
      document.getElementById(
        "centerCategory"
      ).textContent = `Loại: ${newCategory}`;
      updateFieldLockState(); // Update field lock state and column visibility
    } else {
      // Revert dropdown if update fails
      e.target.value = currentCenter.category;
      alert("Lỗi khi cập nhật loại hình");
    }
  } catch (error) {
    console.error("Error updating category:", error);
    e.target.value = currentCenter.category;
    alert("Lỗi khi cập nhật loại hình");
  }
}

function updateColumnVisibility() {
  if (!currentCenter) return;

  const category = currentCenter.category;
  const isRental = category === "Thuê trạm" || category === "Thuê bồn";
  const isTeam = category === "Đội";

  let columnsToHide = [];

  if (isRental) {
    columnsToHide = [
      2, // Số lượng mua
      3, // Đơn giá mua
      4, // Tổng mua
      8, // Vận chuyển
      9, // Hoa hồng mua
    ];
  } else if (isTeam) {
    columnsToHide = [
      2, // Số lượng mua
      3, // Đơn giá mua
      4, // Tổng mua
      5, // Số lượng bán
      6, // Đơn giá bán
      7, // Tổng bán
      8, // Vận chuyển
      9, // Hoa hồng mua
      10, // Hoa hồng bán
      // 🚫 DO NOT hide col 11 (actions)
    ];
  }

  const tables = document.querySelectorAll(".table-excel");

  tables.forEach((table) => {
    const headerRows = table.querySelectorAll("thead tr");
    headerRows.forEach((row) => {
      const cells = row.querySelectorAll("th");
      columnsToHide.forEach((colIndex) => {
        // never hide the action column (last one)
        if (colIndex < cells.length - 1 && cells[colIndex]) {
          cells[colIndex].style.display = "none";
        }
      });
    });

    const bodyRows = table.querySelectorAll("tbody tr");
    bodyRows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      columnsToHide.forEach((colIndex) => {
        // never hide the action column (last one)
        if (colIndex < cells.length - 1 && cells[colIndex]) {
          cells[colIndex].style.display = "none";
        }
      });
    });
  });
}

// Update function to lock/unlock fields based on category
function updateFieldLockState() {
  if (!currentCenter) return;

  const category = currentCenter.category;
  const isRental = category === "Thuê trạm" || category === "Thuê bồn";
  const isTeam = category === "Đội";

  // Lock purchase-related fields for rental and team categories
  const purchaseInputsToLock = document.querySelectorAll(`
    [data-field="purchaseContract.amount"],
    [data-field="purchaseContract.unitCost"],
    [data-field="commissionBonus.purchase"]
  `);

  // Lock transport cost for rental and team categories
  const transportInputsToLock = document.querySelectorAll(`
    [data-field="transportCost"]
  `);

  // Lock sale fields for team category only
  const saleInputsToLock = document.querySelectorAll(`
    [data-field="saleContract.amount"],
    [data-field="saleContract.unitCost"],
    [data-field="commissionBonus.sale"]
  `);

  // Lock purchase fields and transport cost for rental and team
  purchaseInputsToLock.forEach((input) => {
    const shouldLock = isRental || isTeam;
    input.disabled = shouldLock;
    input.title = shouldLock ? "Không khả dụng cho loại hình này" : "";
    input.style.cursor = shouldLock ? "not-allowed" : "";
    input.style.backgroundColor = shouldLock ? "#f8f9fa" : "";
  });

  transportInputsToLock.forEach((input) => {
    const shouldLock = isRental || isTeam;
    input.disabled = shouldLock;
    input.title = shouldLock ? "Không khả dụng cho loại hình này" : "";
    input.style.cursor = shouldLock ? "not-allowed" : "";
    input.style.backgroundColor = shouldLock ? "#f8f9fa" : "";
  });

  // Lock sale fields only for team category
  saleInputsToLock.forEach((input) => {
    input.disabled = isTeam;
    input.title = isTeam ? "Không khả dụng cho loại hình này" : "";
    input.style.cursor = isTeam ? "not-allowed" : "";
    input.style.backgroundColor = isTeam ? "#f8f9fa" : "";
  });

  // Only disable the "Thêm mục" button for team categories (NOT for rental)
  const addButtons = document.querySelectorAll(".add-entry-btn");
  addButtons.forEach((button) => {
    button.disabled = isTeam; // Only team category disables add buttons
    button.title = isTeam ? "Không khả dụng cho loại hình này" : "";
    button.style.cursor = isTeam ? "not-allowed" : "";
  });

  // Only disable delete buttons for team categories (NOT for rental)
  const deleteButtons = document.querySelectorAll(".delete-entry-btn");
  deleteButtons.forEach((button) => {
    button.disabled = isTeam; // Only team category disables delete buttons
    button.title = isTeam ? "Không khả dụng cho loại hình này" : "";
    button.style.cursor = isTeam ? "not-allowed" : "";
  });

  // Update column visibility
  updateColumnVisibility();
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

function handleCenterSelect(e) {
  const centerId = e.target.value;
  if (!centerId) {
    currentCenter = null;
    document.getElementById("selectedCenterTitle").textContent =
      "Chọn một trạm";
    document.getElementById("financeContent").style.display = "none";
    document.getElementById("categorySection").style.display = "none";
    document.getElementById("centerCategory").textContent = "";
    return;
  }

  currentCenter = centers.find((c) => c._id === centerId);
  if (currentCenter) {
    document.getElementById("selectedCenterTitle").textContent =
      currentCenter.name;
    document.getElementById("financeContent").style.display = "block";
    document.getElementById("categorySection").style.display = "block";

    // Set category dropdown and display
    document.getElementById("categorySelect").value =
      currentCenter.category || "Mua bán khí";
    document.getElementById(
      "centerCategory"
    ).textContent = `Loại: ${currentCenter.category}`;

    renderFinanceTable();
    updateFieldLockState(); // Lock fields and hide columns based on category
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

// Function to add a new year tab without full re-render
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

  // Update column visibility for the new tab
  setTimeout(() => {
    updateColumnVisibility();
  }, 100);
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
        `/financeGasControl/${currentCenter._id}/years/${yearData.year}`,
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

  // Update column visibility after rendering
  setTimeout(() => {
    updateColumnVisibility();
  }, 100);
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
      `/financeGasControl/${currentCenter._id}/reorderYears`,
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
            <th style="min-width: 90px;">Vận chuyển</th>
            <th style="min-width: 90px;">Hoa hồng mua</th>
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
          <td colspan="10" class="text-muted text-center">Không có mục</td>
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
          <td colspan="11" class="text-center">
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

// Function to render a single entry row
function renderEntryRow(entry, entryIndex, monthName, year) {
  const category = currentCenter?.category || "Mua bán khí";
  const isRental = category === "Thuê trạm" || category === "Thuê bồn";
  const isTeam = category === "Đội";

  return `
    <tr data-month="${monthName}" data-year="${year}" data-entry="${entryIndex}">
      <td>${entryIndex === 0 ? monthName : ""}</td>
      <td>${entryIndex + 1}</td>

      <!-- Purchase fields - locked for rental and team -->
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.purchaseContract?.amount || 0
      )}" data-field="purchaseContract.amount" ${
    isRental || isTeam ? "disabled" : ""
  }></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.purchaseContract?.unitCost || 0
      )}" data-field="purchaseContract.unitCost" ${
    isRental || isTeam ? "disabled" : ""
  }></td>
      <td class="calculated-field">${formatNumberWithCommas(
        entry.purchaseContract?.totalCost || 0,
        true
      )}</td>

      <!-- Sale fields - locked only for team -->
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.saleContract?.amount || 0
      )}" data-field="saleContract.amount" ${isTeam ? "disabled" : ""}></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.saleContract?.unitCost || 0
      )}" data-field="saleContract.unitCost" ${isTeam ? "disabled" : ""}></td>
      <td class="calculated-field">${formatNumberWithCommas(
        entry.saleContract?.totalCost || 0,
        true
      )}</td>

      <!-- Transport cost - locked for rental and team -->
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.transportCost || 0
      )}" data-field="transportCost" ${
    isRental || isTeam ? "disabled" : ""
  }></td>
      
      <!-- Commission bonus inputs - direct user input -->
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.commissionBonus?.purchase || 0
      )}" data-field="commissionBonus.purchase" ${
    isRental || isTeam ? "disabled" : ""
  }></td>
      <td><input type="text" class="input-cell number-input" value="${formatNumberWithCommas(
        entry.commissionBonus?.sale || 0
      )}" data-field="commissionBonus.sale" ${isTeam ? "disabled" : ""}></td>

      <td>
        <button class="btn btn-sm btn-outline-danger btn-action delete-entry-btn" 
                data-month="${monthName}" data-year="${year}" data-entry="${entryIndex}"
                ${isTeam ? "disabled" : ""}>
            ×
        </button>
      </td>
    </tr>
  `;
}

// Function to render month total row (now goes at the top)
function renderMonthTotalRow(monthName, entryCount, totals) {
  return `
    <tr class="total-row" data-month="${monthName}" data-month-total="true" style="background-color: #f8f9fa; font-weight: bold;">
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
      <td><strong>${formatNumberWithCommas(
        totals.transport,
        true
      )}</strong></td>
      <td><strong>${formatNumberWithCommas(
        totals.commissionPurchase,
        true
      )}</strong></td>
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
    transport: 0,
    commissionPurchase: 0,
    commissionSale: 0,
  };

  entries.forEach((entry) => {
    totals.purchaseAmount += entry.purchaseContract?.amount || 0;
    totals.purchaseTotal += entry.purchaseContract?.totalCost || 0;
    totals.saleAmount += entry.saleContract?.amount || 0;
    totals.saleTotal += entry.saleContract?.totalCost || 0;
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
        e.keyCode !== 110 && // Numpad decimal point (.)
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
    transportCost: 0,
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

// Function to refresh only a specific month section
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
        <td colspan="10" class="text-muted text-center">Không có mục</td>
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
        <td colspan="11" class="text-center">
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

  // Update column visibility
  setTimeout(() => {
    updateColumnVisibility();
  }, 50);
}

// NEW: Update current center data
function updateCurrentCenter(updatedCenter) {
  currentCenter = updatedCenter;
  const centerIndex = centers.findIndex((c) => c._id === currentCenter._id);
  if (centerIndex !== -1) {
    centers[centerIndex] = updatedCenter;
  }
  updateFieldLockState(); // Update field lock state when center changes
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

  const purchaseTotal = purchaseAmount * purchaseUnitCost;
  const saleTotal = saleAmount * saleUnitCost;

  const calculatedFields = row.querySelectorAll(".calculated-field");
  calculatedFields[0].textContent = formatNumberWithCommas(purchaseTotal, true);
  calculatedFields[1].textContent = formatNumberWithCommas(saleTotal, true);
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

// Update month totals in place without full refresh
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
    `tr.total-row[data-month="${monthName}"][data-month-total="true"]`
  );

  if (totalRow) {
    // Get all td elements in the total row
    const cells = totalRow.querySelectorAll("td");

    // Update the cells with new totals (based on the structure from renderMonthTotalRow)
    if (cells.length >= 12) {
      // cells[0] = "Tổng ${monthName}" (skip)
      cells[1].innerHTML = `<strong>${monthData.entries.length}</strong>`;
      cells[2].innerHTML = `<strong>${formatNumberWithCommas(
        totals.purchaseAmount,
        true
      )}</strong>`;
      // cells[3] = "-" (skip)
      cells[4].innerHTML = `<strong>${formatNumberWithCommas(
        totals.purchaseTotal,
        true
      )}</strong>`;
      cells[5].innerHTML = `<strong>${formatNumberWithCommas(
        totals.saleAmount,
        true
      )}</strong>`;
      // cells[6] = "-" (skip)
      cells[7].innerHTML = `<strong>${formatNumberWithCommas(
        totals.saleTotal,
        true
      )}</strong>`;
      cells[8].innerHTML = `<strong>${formatNumberWithCommas(
        totals.transport,
        true
      )}</strong>`;
      cells[9].innerHTML = `<strong>${formatNumberWithCommas(
        totals.commissionPurchase,
        true
      )}</strong>`;
      cells[10].innerHTML = `<strong>${formatNumberWithCommas(
        totals.commissionSale,
        true
      )}</strong>`;
      // cells[11] = "" (skip - actions column)
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
  const transportCost = parseNumberFromInput(
    row.querySelector('[data-field="transportCost"]').value
  );

  // Get commission values directly from input
  const purchaseCommission = parseNumberFromInput(
    row.querySelector('[data-field="commissionBonus.purchase"]').value
  );
  const saleCommission = parseNumberFromInput(
    row.querySelector('[data-field="commissionBonus.sale"]').value
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
    transportCost: transportCost,
    commissionBonus: {
      purchase: purchaseCommission,
      sale: saleCommission,
    },
  };
}
