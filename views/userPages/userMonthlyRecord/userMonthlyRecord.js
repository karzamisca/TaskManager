// views\userPages\userMonthlyRecord\userMonthlyRecord.js

// ====================================================================
// CONSTANTS AND CONFIGURATION
// ====================================================================
const CONFIG = {
  ITEMS_PER_PAGE: 10,
  MAX_VISIBLE_PAGES: 5,
  API_ENDPOINT: "/userMonthlyRecordGet",
  DEBOUNCE_DELAY: 300,
  MONTH_NAMES: [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ],
};

// ====================================================================
// STATE MANAGEMENT
// ====================================================================
const state = {
  allRecords: [],
  filteredRecords: [],
  currentPage: 1,
  isLoading: false,
  filters: {
    year: "",
    month: "",
    costCenter: "",
    bank: "",
    realName: "",
    reverseFilters: {
      year: false,
      month: false,
      costCenter: false,
      bank: false,
      realName: false,
    },
  },
  summary: null,
};

// ====================================================================
// DOM ELEMENT REFERENCES
// ====================================================================
const elements = {
  yearFilter: () => document.getElementById("yearFilter"),
  monthFilter: () => document.getElementById("monthFilter"),
  costCenterFilter: () => document.getElementById("costCenterFilter"),
  bankFilter: () => document.getElementById("bankFilter"),
  realNameFilter: () => document.getElementById("realNameFilter"),
  applyFiltersBtn: () => document.getElementById("applyFilters"),
  resetFiltersBtn: () => document.getElementById("resetFilters"),
  recordsBody: () => document.getElementById("recordsBody"),
  loadingDiv: () => document.getElementById("loading"),
  paginationDiv: () => document.getElementById("pagination"),
  modal: () => document.getElementById("recordModal"),
  modalContent: () => document.getElementById("modalContent"),
  closeModal: () => document.querySelector(".close"),
  exportPDFBtn: () => document.getElementById("exportPDF"),
  exportExcelBtn: () => document.getElementById("exportExcel"),
  summarySection: () => document.getElementById("summarySection"),
  summaryGrid: () => document.getElementById("summaryGrid"),
};

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Formats a date to Vietnamese locale
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString("vi-VN");
  } catch (error) {
    console.warn("Invalid date format:", date);
    return "N/A";
  }
};

/**
 * Gets month name by month number
 * @param {number} monthNumber - Month number (1-12)
 * @returns {string} Month name in Vietnamese
 */
const getMonthName = (monthNumber) => {
  const index = monthNumber - 1;
  return CONFIG.MONTH_NAMES[index] || `Tháng ${monthNumber}`;
};

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

/**
 * Safe property access with fallback
 * @param {Object} obj - Object to access
 * @param {string} path - Property path (e.g., 'costCenter.name')
 * @param {*} fallback - Fallback value
 * @returns {*} Property value or fallback
 */
const safeGet = (obj, path, fallback = "N/A") => {
  return path
    .split(".")
    .reduce(
      (current, key) =>
        current && current[key] !== undefined ? current[key] : fallback,
      obj
    );
};

/**
 * Safely converts value to locale string for numbers
 * @param {*} value - Value to convert
 * @returns {string} Formatted number or "0" if invalid
 */
const safeToLocaleString = (value) => {
  if (value === null || value === undefined || value === "" || isNaN(value)) {
    return "0";
  }
  const num = Number(value);
  return isNaN(num) ? "0" : num.toLocaleString();
};

/**
 * Shows error message to user
 * @param {string} message - Error message to display
 */
const showError = (message) => {
  const loadingDiv = elements.loadingDiv();
  if (loadingDiv) {
    loadingDiv.style.display = "block";
    loadingDiv.innerHTML = `<div style="color: #d32f2f; padding: 10px;">${message}</div>`;
  }
};

/**
 * Hides loading indicator
 */
const hideLoading = () => {
  const loadingDiv = elements.loadingDiv();
  if (loadingDiv) {
    loadingDiv.style.display = "none";
  }
};

// ====================================================================
// API FUNCTIONS
// ====================================================================

/**
 * Fetches monthly records from the server
 * @returns {Promise<Array>} Array of monthly records
 */
const fetchMonthlyRecords = async () => {
  try {
    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid data format received from server");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw new Error(`Không thể kết nối đến server: ${error.message}`);
  }
};

// ====================================================================
// DATA PROCESSING FUNCTIONS
// ====================================================================

/**
 * Extracts unique years from records and sorts them
 * @param {Array} records - Array of records
 * @returns {Array} Sorted array of unique years
 */
const extractUniqueYears = (records) => {
  const years = records
    .map((record) => record.recordYear)
    .filter((year) => year != null && !isNaN(year));

  return [...new Set(years)].sort((a, b) => b - a);
};

/**
 * Extracts unique cost centers from records and sorts them
 * @param {Array} records - Array of records
 * @returns {Array} Sorted array of unique cost center names
 */
const extractUniqueCostCenters = (records) => {
  const costCenters = records
    .filter((record) => record.costCenter?.name)
    .map((record) => record.costCenter.name);

  return [...new Set(costCenters)].sort();
};

/**
 * Filters records based on current filter criteria
 * @param {Array} records - Array of records to filter
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered records
 */
const filterRecords = (records, filters) => {
  return records.filter((record) => {
    // Year filter with reverse option
    const yearMatch = filters.year
      ? filters.reverseFilters.year
        ? record.recordYear != filters.year
        : record.recordYear == filters.year
      : true;

    // Month filter with reverse option
    const monthMatch = filters.month
      ? filters.reverseFilters.month
        ? record.recordMonth != filters.month
        : record.recordMonth == filters.month
      : true;

    // Cost Center filter with reverse option
    const costCenterMatch = filters.costCenter
      ? filters.reverseFilters.costCenter
        ? safeGet(record, "costCenter.name", "") !== filters.costCenter
        : safeGet(record, "costCenter.name", "") === filters.costCenter
      : true;

    // Bank filter with reverse option
    const bankMatch = filters.bank
      ? filters.reverseFilters.bank
        ? !(
            record.beneficiaryBank &&
            record.beneficiaryBank
              .toLowerCase()
              .includes(filters.bank.toLowerCase())
          )
        : record.beneficiaryBank &&
          record.beneficiaryBank
            .toLowerCase()
            .includes(filters.bank.toLowerCase())
      : true;

    // RealName filter with reverse option
    const realNameMatch = filters.realName
      ? filters.reverseFilters.realName
        ? !(
            record.realName &&
            record.realName
              .toLowerCase()
              .includes(filters.realName.toLowerCase())
          )
        : record.realName &&
          record.realName.toLowerCase().includes(filters.realName.toLowerCase())
      : true;

    return (
      yearMatch && monthMatch && costCenterMatch && bankMatch && realNameMatch
    );
  });
};

/**
 * Calculates summary statistics for records
 * @param {Array} records - Records to summarize
 * @returns {Object} Summary statistics
 */
const calculateSummary = (records) => {
  if (!records || records.length === 0) {
    return {
      totalRecords: 0,
      totalBaseSalary: 0,
      totalHourlyWage: 0,
      totalResponsibility: 0,
      totalTravelExpense: 0,
      totalCommissionBonus: 0,
      totalOtherBonus: 0,
      totalWeekdayOvertimeHours: 0,
      totalWeekendOvertimeHours: 0,
      totalHolidayOvertimeHours: 0,
      totalOvertimePay: 0,
      totalTaxableIncome: 0,
      totalGrossSalary: 0,
      totalTax: 0,
      totalCurrentSalary: 0,
      averageBaseSalary: 0,
      averageCurrentSalary: 0,
      averageTax: 0,
      minCurrentSalary: 0,
      maxCurrentSalary: 0,
    };
  }

  const totals = {
    totalRecords: records.length,
    totalBaseSalary: 0,
    totalHourlyWage: 0,
    totalResponsibility: 0,
    totalTravelExpense: 0,
    totalCommissionBonus: 0,
    totalOtherBonus: 0,
    totalWeekdayOvertimeHours: 0,
    totalWeekendOvertimeHours: 0,
    totalHolidayOvertimeHours: 0,
    totalOvertimePay: 0,
    totalTaxableIncome: 0,
    totalGrossSalary: 0,
    totalTax: 0,
    totalCurrentSalary: 0,
    minCurrentSalary: Infinity,
    maxCurrentSalary: -Infinity,
  };

  records.forEach((record) => {
    totals.totalBaseSalary += Number(record.baseSalary) || 0;
    totals.totalHourlyWage += Number(record.hourlyWage) || 0;
    totals.totalResponsibility += Number(record.responsibility) || 0;
    totals.totalTravelExpense += Number(record.travelExpense) || 0;
    totals.totalCommissionBonus += Number(record.commissionBonus) || 0;
    totals.totalOtherBonus += Number(record.otherBonus) || 0;
    totals.totalWeekdayOvertimeHours += Number(record.weekdayOvertimeHour) || 0;
    totals.totalWeekendOvertimeHours += Number(record.weekendOvertimeHour) || 0;
    totals.totalHolidayOvertimeHours += Number(record.holidayOvertimeHour) || 0;
    totals.totalOvertimePay += Number(record.overtimePay) || 0;
    totals.totalTaxableIncome += Number(record.taxableIncome) || 0;
    totals.totalGrossSalary += Number(record.grossSalary) || 0;
    totals.totalTax += Number(record.tax) || 0;

    const currentSalary = Number(record.currentSalary) || 0;
    totals.totalCurrentSalary += currentSalary;

    if (currentSalary < totals.minCurrentSalary) {
      totals.minCurrentSalary = currentSalary;
    }
    if (currentSalary > totals.maxCurrentSalary) {
      totals.maxCurrentSalary = currentSalary;
    }
  });

  // Calculate averages
  totals.averageBaseSalary =
    totals.totalRecords > 0
      ? Math.round(totals.totalBaseSalary / totals.totalRecords)
      : 0;
  totals.averageCurrentSalary =
    totals.totalRecords > 0
      ? Math.round(totals.totalCurrentSalary / totals.totalRecords)
      : 0;
  totals.averageTax =
    totals.totalRecords > 0
      ? Math.round(totals.totalTax / totals.totalRecords)
      : 0;

  // Reset min/max if no valid values
  if (totals.minCurrentSalary === Infinity) totals.minCurrentSalary = 0;
  if (totals.maxCurrentSalary === -Infinity) totals.maxCurrentSalary = 0;

  return totals;
};

/**
 * Paginates records array
 * @param {Array} records - Records to paginate
 * @param {number} page - Current page number
 * @param {number} itemsPerPage - Items per page
 * @returns {Object} Paginated data with records and pagination info
 */
const paginateRecords = (records, page, itemsPerPage) => {
  const totalItems = records.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedRecords = records.slice(startIndex, endIndex);

  return {
    records: paginatedRecords,
    totalPages,
    totalItems,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

// ====================================================================
// EXPORT FUNCTIONS
// ====================================================================

/**
 * Exports data to PDF
 */
const exportToPDF = () => {
  const { year, month, costCenter, bank, realName } = state.filters;
  const { reverseFilters } = state.filters;

  if (!year) {
    alert("Vui lòng chọn năm để xuất báo cáo chi lương");
    return;
  }

  let url = `/exportSalaryPDF?year=${year}`;

  // Add month if selected
  if (month) {
    url += `&month=${month}`;
  }

  if (costCenter) {
    url += `&costCenter=${costCenter}`;
    if (reverseFilters.costCenter) {
      url += `&costCenterReverse=true`;
    }
  }

  if (bank) {
    url += `&beneficiaryBank=${encodeURIComponent(bank)}`;
    if (reverseFilters.bank) {
      url += `&beneficiaryBankReverse=true`;
    }
  }

  if (realName) {
    url += `&realName=${encodeURIComponent(realName)}`;
    if (reverseFilters.realName) {
      url += `&realNameReverse=true`;
    }
  }

  // Add summary data to URL
  if (state.summary && state.summary.totalRecords > 0) {
    url += `&includeSummary=true`;
  }

  // Show loading message in Vietnamese
  const loadingDiv = elements.loadingDiv();
  loadingDiv.style.display = "block";
  loadingDiv.innerHTML = "Đang tạo báo cáo PDF, vui lòng chờ...";

  // Create a temporary iframe for download
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;

  iframe.onload = function () {
    loadingDiv.style.display = "none";
    document.body.removeChild(iframe);
  };

  document.body.appendChild(iframe);
};

/**
 * Exports data to Excel
 */
const exportToExcel = async () => {
  const { year, month, costCenter, bank, realName } = state.filters;
  const { reverseFilters } = state.filters;

  if (!year) {
    alert("Vui lòng chọn năm để xuất báo cáo chi lương");
    return;
  }

  // Show loading message in Vietnamese
  const loadingDiv = elements.loadingDiv();
  loadingDiv.style.display = "block";
  loadingDiv.innerHTML = "Đang tạo báo cáo Excel, vui lòng chờ...";

  let url = `/exportSalaryExcel?year=${year}`;

  // Add month if selected
  if (month) {
    url += `&month=${month}`;
  }

  if (costCenter) {
    url += `&costCenter=${costCenter}`;
    if (reverseFilters.costCenter) {
      url += `&costCenterReverse=true`;
    }
  }

  if (bank) {
    url += `&beneficiaryBank=${encodeURIComponent(bank)}`;
    if (reverseFilters.bank) {
      url += `&beneficiaryBankReverse=true`;
    }
  }

  if (realName) {
    url += `&realName=${encodeURIComponent(realName)}`;
    if (reverseFilters.realName) {
      url += `&realNameReverse=true`;
    }
  }

  // Add summary data to URL
  if (state.summary && state.summary.totalRecords > 0) {
    url += `&includeSummary=true`;
  }

  // Create a temporary iframe for download
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;

  iframe.onload = function () {
    loadingDiv.style.display = "none";
    document.body.removeChild(iframe);
  };

  document.body.appendChild(iframe);
};

// ====================================================================
// UI RENDERING FUNCTIONS
// ====================================================================

/**
 * Populates year filter dropdown
 * @param {Array} years - Array of unique years
 */
const populateYearFilter = (years) => {
  const yearFilter = elements.yearFilter();
  if (!yearFilter) return;

  // Clear existing options except the first one
  yearFilter.innerHTML = '<option value="">Tất cả năm</option>';

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });
};

/**
 * Populates cost center filter dropdown
 * @param {Array} costCenters - Array of unique cost center names
 */
const populateCostCenterFilter = (costCenters) => {
  const costCenterFilter = elements.costCenterFilter();
  if (!costCenterFilter) return;

  // Clear existing options except the first one
  costCenterFilter.innerHTML = '<option value="">Tất cả trạm</option>';

  costCenters.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    costCenterFilter.appendChild(option);
  });
};

/**
 * Creates a table row for a record
 * @param {Object} record - Monthly record data
 * @param {number} index - Row index (for STT)
 * @returns {HTMLElement} Table row element
 */
const createRecordRow = (record, index) => {
  const row = document.createElement("tr");
  const monthName = getMonthName(record.recordMonth);
  const startIndex =
    (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE + index + 1;

  row.innerHTML = `
    <td>${startIndex}</td>
    <td>${safeGet(record, "realName", "N/A")}</td>
    <td>${monthName} ${record.recordYear || "N/A"}</td>
    <td>${safeToLocaleString(record.baseSalary)}</td>
    <td>${safeToLocaleString(record.hourlyWage)}</td>
    <td>${safeToLocaleString(record.responsibility)}</td>
    <td>${safeToLocaleString(record.travelExpense)}</td>
    <td>${safeToLocaleString(record.commissionBonus)}</td>
    <td>${safeToLocaleString(record.otherBonus)}</td>
    <td>${record.weekdayOvertimeHour || 0}</td>
    <td>${record.weekendOvertimeHour || 0}</td>
    <td>${record.holidayOvertimeHour || 0}</td>
    <td>${safeToLocaleString(record.overtimePay)}</td>
    <td>${safeToLocaleString(record.taxableIncome)}</td>
    <td>${safeToLocaleString(record.grossSalary)}</td>
    <td>${safeToLocaleString(record.tax)}</td>
    <td>${safeToLocaleString(record.currentSalary)}</td>
    <td>${safeGet(record, "costCenter.name", "N/A")}</td>
    <td>
      <button class="view-details" data-id="${record._id}" 
              title="Xem chi tiết bản ghi">
        Xem chi tiết
      </button>
    </td>
  `;

  return row;
};

/**
 * Renders the records table
 * @param {Array} records - Records to display
 */
const renderTable = (records) => {
  const recordsBody = elements.recordsBody();
  if (!recordsBody) return;

  recordsBody.innerHTML = "";

  if (records.length === 0) {
    recordsBody.innerHTML = `
      <tr>
        <td colspan="19" style="text-align: center; padding: 20px; color: #666;">
          Không tìm thấy bản ghi nào phù hợp với tiêu chí tìm kiếm.
        </td>
      </tr>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  records.forEach((record, index) => {
    fragment.appendChild(createRecordRow(record, index));
  });

  recordsBody.appendChild(fragment);
  attachDetailButtonListeners();
};

/**
 * Renders the summary section
 * @param {Object} summaryData - Summary statistics to display
 */
const renderSummary = (summaryData) => {
  const summarySection = elements.summarySection();
  const summaryGrid = elements.summaryGrid();

  if (!summarySection || !summaryGrid) return;

  if (!summaryData || summaryData.totalRecords === 0) {
    summarySection.style.display = "none";
    return;
  }

  summarySection.style.display = "block";
  summaryGrid.innerHTML = "";

  const summaryItems = [
    {
      label: "Tổng số bản ghi",
      value: summaryData.totalRecords.toLocaleString(),
      className: "summary-value",
    },
    {
      label: "Tổng lương cơ bản",
      value: summaryData.totalBaseSalary.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng lương theo giờ",
      value: summaryData.totalHourlyWage.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng trách nhiệm",
      value: summaryData.totalResponsibility.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng công tác phí",
      value: summaryData.totalTravelExpense.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng hoa hồng",
      value: summaryData.totalCommissionBonus.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng thưởng khác",
      value: summaryData.totalOtherBonus.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng giờ TC tuần",
      value: summaryData.totalWeekdayOvertimeHours.toFixed(1) + " giờ",
      className: "summary-value",
    },
    {
      label: "Tổng giờ TC CN",
      value: summaryData.totalWeekendOvertimeHours.toFixed(1) + " giờ",
      className: "summary-value",
    },
    {
      label: "Tổng giờ TC lễ",
      value: summaryData.totalHolidayOvertimeHours.toFixed(1) + " giờ",
      className: "summary-value",
    },
    {
      label: "Tổng lương tăng ca",
      value: summaryData.totalOvertimePay.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng lương tính thuế",
      value: summaryData.totalTaxableIncome.toLocaleString() + " VND",
      className: "summary-value",
    },
    {
      label: "Tổng lương gộp",
      value: summaryData.totalGrossSalary.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Tổng thuế",
      value: summaryData.totalTax.toLocaleString() + " VND",
      className: "summary-value negative",
    },
    {
      label: "Tổng lương thực lĩnh",
      value: summaryData.totalCurrentSalary.toLocaleString() + " VND",
      className: "summary-value positive",
    },
    {
      label: "Lương TB thực lĩnh",
      value: summaryData.averageCurrentSalary.toLocaleString() + " VND",
      className: "summary-value",
    },
    {
      label: "Thuế TB",
      value: summaryData.averageTax.toLocaleString() + " VND",
      className: "summary-value",
    },
    {
      label: "Lương thực lĩnh thấp nhất",
      value: summaryData.minCurrentSalary.toLocaleString() + " VND",
      className: "summary-value",
    },
    {
      label: "Lương thực lĩnh cao nhất",
      value: summaryData.maxCurrentSalary.toLocaleString() + " VND",
      className: "summary-value",
    },
  ];

  const fragment = document.createDocumentFragment();

  summaryItems.forEach((item) => {
    const summaryItem = document.createElement("div");
    summaryItem.className = "summary-item";

    summaryItem.innerHTML = `
      <div class="summary-label">${item.label}</div>
      <div class="${item.className}">${item.value}</div>
    `;

    fragment.appendChild(summaryItem);
  });

  summaryGrid.appendChild(fragment);
};

/**
 * Creates a pagination button
 * @param {string} text - Button text
 * @param {number|null} page - Page number (null for disabled buttons)
 * @param {boolean} isActive - Whether button is active
 * @returns {HTMLElement} Button element
 */
const createPaginationButton = (text, page, isActive = false) => {
  const button = document.createElement("button");
  button.textContent = text;
  button.disabled = page === null;

  if (isActive) {
    button.style.fontWeight = "bold";
    button.style.backgroundColor = "#45a049";
  }

  if (page !== null) {
    button.addEventListener("click", () => changePage(page));
  }

  return button;
};

/**
 * Renders pagination controls
 * @param {Object} paginationInfo - Pagination information
 */
const renderPagination = (paginationInfo) => {
  const paginationDiv = elements.paginationDiv();
  if (!paginationDiv) return;

  paginationDiv.innerHTML = "";

  const { totalPages, currentPage, hasPreviousPage, hasNextPage } =
    paginationInfo;

  if (totalPages <= 1) return;

  const fragment = document.createDocumentFragment();

  // Previous button
  fragment.appendChild(
    createPaginationButton("Trước", hasPreviousPage ? currentPage - 1 : null)
  );

  // Page number buttons
  const { startPage, endPage } = calculatePageRange(currentPage, totalPages);

  // First page and ellipsis
  if (startPage > 1) {
    fragment.appendChild(createPaginationButton("1", 1));
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.style.padding = "5px 10px";
      fragment.appendChild(ellipsis);
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    fragment.appendChild(
      createPaginationButton(i.toString(), i, i === currentPage)
    );
  }

  // Last page and ellipsis
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.style.padding = "5px 10px";
      fragment.appendChild(ellipsis);
    }
    fragment.appendChild(
      createPaginationButton(totalPages.toString(), totalPages)
    );
  }

  // Next button
  fragment.appendChild(
    createPaginationButton("Sau", hasNextPage ? currentPage + 1 : null)
  );

  paginationDiv.appendChild(fragment);
};

/**
 * Calculates the range of page numbers to display
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @returns {Object} Start and end page numbers
 */
const calculatePageRange = (currentPage, totalPages) => {
  const maxVisible = CONFIG.MAX_VISIBLE_PAGES;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  return { startPage, endPage };
};

/**
 * Creates modal content for record details
 * @param {Object} record - Record to display
 * @returns {string} HTML content for modal
 */
const createModalContent = (record) => {
  const monthName = getMonthName(record.recordMonth);

  return `
    <h2>${safeGet(record, "realName")} - ${monthName} ${record.recordYear}</h2>
    <p><strong>Ngày ghi nhận:</strong> ${formatDate(record.recordDate)}</p>
    <p><strong>Email:</strong> ${safeGet(record, "email")}</p>
    <p><strong>Trạm:</strong> ${safeGet(record, "costCenter.name")}</p>
    <p><strong>Người phụ trách:</strong> ${safeGet(
      record,
      "assignedManager.realName"
    )}</p>
    
    <div class="modal-section">
      <p><strong>Số tài khoản ngân hàng:</strong> ${
        record.bankAccountNumber || "Chưa cập nhật"
      }</p>
      <p><strong>Số CMND/CCCD:</strong> ${
        record.citizenID || "Chưa cập nhật"
      }</p>
      <p><strong>Ngân hàng thụ hưởng:</strong> ${
        record.beneficiaryBank || "Chưa cập nhật"
      }</p>
      <p><strong>Lương cơ bản:</strong> ${safeToLocaleString(
        record.baseSalary
      )}</p>
      <p><strong>Lương theo giờ:</strong> ${safeToLocaleString(
        record.hourlyWage
      )}</p>
    </div>

    <div class="modal-section">
      <p><strong>Trách nhiệm:</strong> ${safeToLocaleString(
        record.responsibility
      )}</p>
      <p><strong>Công tác phí:</strong> ${safeToLocaleString(
        record.travelExpense
      )}</p>
      <p><strong>Hoa hồng:</strong> ${safeToLocaleString(
        record.commissionBonus
      )}</p>
      <p><strong>Thưởng khác:</strong> ${safeToLocaleString(
        record.otherBonus
      )}</p>
    </div>

    <div class="modal-section">
      <p><strong>Giờ tăng ca trong tuần:</strong> ${
        record.weekdayOvertimeHour || 0
      } giờ</p>
      <p><strong>Giờ tăng ca Chủ Nhật:</strong> ${
        record.weekendOvertimeHour || 0
      } giờ</p>
      <p><strong>Giờ tăng ca ngày lễ:</strong> ${
        record.holidayOvertimeHour || 0
      } giờ</p>
      <p><strong>Lương tăng ca:</strong> ${safeToLocaleString(
        record.overtimePay
      )}</p>
    </div>

    <div class="modal-section">
      <p><strong>Tổng lương:</strong> ${safeToLocaleString(
        record.grossSalary
      )}</p>
    </div>

    <div class="modal-section">
      <p><strong>Lương tính thuế:</strong> ${safeToLocaleString(
        record.taxableIncome
      )}</p>
      <p><strong>Thuế thu nhập:</strong> ${safeToLocaleString(record.tax)}</p>
      <p><strong>Số người phụ thuộc:</strong> ${record.dependantCount || 0}</p>
      <p><strong>Lương đóng bảo hiểm:</strong> ${safeToLocaleString(
        record.insurableSalary
      )}</p>
      <p><strong>Bảo hiểm bắt buộc:</strong> ${safeToLocaleString(
        record.mandatoryInsurance
      )}</p>
    </div>

    <div class="modal-section">  
      <p><strong>Lương thực lĩnh:</strong> ${safeToLocaleString(
        record.currentSalary
      )}</p>
    </div>
  `;
};

// ====================================================================
// EVENT HANDLERS
// ====================================================================

/**
 * Toggles reverse filter for a filter type
 * @param {string} filterType - Type of filter to toggle
 */
const toggleReverseFilter = (filterType) => {
  state.filters.reverseFilters[filterType] =
    !state.filters.reverseFilters[filterType];

  // Update button appearance
  const button = document.getElementById(`${filterType}Reverse`);
  if (button) {
    button.classList.toggle("active", state.filters.reverseFilters[filterType]);
  }

  state.currentPage = 1;
  updateDisplay();
};

/**
 * Handles filter application
 */
const handleApplyFilters = () => {
  const yearFilter = elements.yearFilter();
  const monthFilter = elements.monthFilter();
  const costCenterFilter = elements.costCenterFilter();
  const bankFilter = elements.bankFilter();
  const realNameFilter = elements.realNameFilter();

  state.filters = {
    ...state.filters,
    year: yearFilter?.value || "",
    month: monthFilter?.value || "",
    costCenter: costCenterFilter?.value || "",
    bank: bankFilter?.value || "",
    realName: realNameFilter?.value || "",
  };

  state.currentPage = 1;
  updateDisplay();
};

/**
 * Handles filter reset
 */
const handleResetFilters = () => {
  const yearFilter = elements.yearFilter();
  const monthFilter = elements.monthFilter();
  const costCenterFilter = elements.costCenterFilter();
  const bankFilter = elements.bankFilter();
  const realNameFilter = elements.realNameFilter();

  if (yearFilter) yearFilter.value = "";
  if (monthFilter) monthFilter.value = "";
  if (costCenterFilter) costCenterFilter.value = "";
  if (bankFilter) bankFilter.value = "";
  if (realNameFilter) realNameFilter.value = "";

  // Reset reverse filter buttons
  [
    "yearReverse",
    "monthReverse",
    "costCenterReverse",
    "bankReverse",
    "realNameReverse",
  ].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.classList.remove("active");
    }
  });

  state.filters = {
    year: "",
    month: "",
    costCenter: "",
    bank: "",
    realName: "",
    reverseFilters: {
      year: false,
      month: false,
      costCenter: false,
      bank: false,
      realName: false,
    },
  };
  state.currentPage = 1;
  updateDisplay();
};

/**
 * Handles page change
 * @param {number} page - New page number
 */
const changePage = (page) => {
  state.currentPage = page;
  updateDisplay();

  // Scroll to top of table
  const table = document.getElementById("recordsTable");
  if (table) {
    table.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

/**
 * Shows record details in modal
 * @param {string} recordId - ID of the record to show
 */
const showRecordDetails = (recordId) => {
  const record = state.allRecords.find((r) => r._id === recordId);
  if (!record) {
    console.warn("Record not found:", recordId);
    return;
  }

  const modal = elements.modal();
  const modalContent = elements.modalContent();

  if (!modal || !modalContent) return;

  modalContent.innerHTML = createModalContent(record);
  modal.style.display = "block";

  // Focus on modal for accessibility
  modal.setAttribute("tabindex", "-1");
  modal.focus();
};

/**
 * Hides the modal
 */
const hideModal = () => {
  const modal = elements.modal();
  if (modal) {
    modal.style.display = "none";
  }
};

/**
 * Attaches event listeners to detail buttons
 */
const attachDetailButtonListeners = () => {
  document.querySelectorAll(".view-details").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const recordId = button.dataset.id;
      if (recordId) {
        showRecordDetails(recordId);
      }
    });
  });
};

/**
 * Sets up all event listeners
 */
const setupEventListeners = () => {
  const applyFiltersBtn = elements.applyFiltersBtn();
  const resetFiltersBtn = elements.resetFiltersBtn();
  const closeModal = elements.closeModal();
  const modal = elements.modal();
  const exportPDFBtn = elements.exportPDFBtn();
  const exportExcelBtn = elements.exportExcelBtn();

  // Filter buttons
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", handleApplyFilters);
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", handleResetFilters);
  }

  // Modal controls
  if (closeModal) {
    closeModal.addEventListener("click", hideModal);
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        hideModal();
      }
    });
  }

  // Export buttons
  if (exportPDFBtn) {
    exportPDFBtn.addEventListener("click", exportToPDF);
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportToExcel);
  }

  // Keyboard accessibility
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideModal();
    }
  });

  // Auto-filter on dropdown change (debounced)
  const debouncedApplyFilters = debounce(
    handleApplyFilters,
    CONFIG.DEBOUNCE_DELAY
  );

  [elements.yearFilter(), elements.monthFilter(), elements.costCenterFilter()]
    .filter(Boolean)
    .forEach((element) => {
      element.addEventListener("change", debouncedApplyFilters);
    });

  const bankFilter = elements.bankFilter();
  if (bankFilter) {
    bankFilter.addEventListener("input", debouncedApplyFilters);
  }

  const realNameFilter = elements.realNameFilter();
  if (realNameFilter) {
    realNameFilter.addEventListener("input", debouncedApplyFilters);
  }

  // Reverse filter buttons
  document
    .getElementById("yearReverse")
    ?.addEventListener("click", () => toggleReverseFilter("year"));
  document
    .getElementById("monthReverse")
    ?.addEventListener("click", () => toggleReverseFilter("month"));
  document
    .getElementById("costCenterReverse")
    ?.addEventListener("click", () => toggleReverseFilter("costCenter"));
  document
    .getElementById("bankReverse")
    ?.addEventListener("click", () => toggleReverseFilter("bank"));
  document
    .getElementById("realNameReverse")
    ?.addEventListener("click", () => toggleReverseFilter("realName"));
};

// ====================================================================
// MAIN FUNCTIONS
// ====================================================================

/**
 * Updates the display with current data and filters
 */
const updateDisplay = () => {
  // Filter records
  state.filteredRecords = filterRecords(state.allRecords, state.filters);

  // Calculate summary
  state.summary = calculateSummary(state.filteredRecords);

  // Paginate results
  const paginationInfo = paginateRecords(
    state.filteredRecords,
    state.currentPage,
    CONFIG.ITEMS_PER_PAGE
  );

  // Render table, pagination, and summary
  renderTable(paginationInfo.records);
  renderPagination(paginationInfo);
  renderSummary(state.summary);
};

/**
 * Loads data from the server and initializes the application
 */
const loadData = async () => {
  if (state.isLoading) return;

  try {
    state.isLoading = true;
    elements.loadingDiv().style.display = "block";

    // Fetch data from server
    const records = await fetchMonthlyRecords();
    state.allRecords = records;

    // Populate filter dropdowns
    const uniqueYears = extractUniqueYears(records);
    const uniqueCostCenters = extractUniqueCostCenters(records);

    populateYearFilter(uniqueYears);
    populateCostCenterFilter(uniqueCostCenters);

    // Initial display
    updateDisplay();
    hideLoading();
  } catch (error) {
    console.error("Data loading error:", error);
    showError(error.message);
  } finally {
    state.isLoading = false;
  }
};

/**
 * Initializes the application
 */
const initializeApp = async () => {
  try {
    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadData();

    console.log("User Monthly Record application initialized successfully");
  } catch (error) {
    console.error("Application initialization failed:", error);
    showError("Không thể khởi tạo ứng dụng. Vui lòng tải lại trang.");
  }
};

// ====================================================================
// APPLICATION ENTRY POINT
// ====================================================================

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeApp);

// Export functions for testing (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatDate,
    getMonthName,
    safeGet,
    safeToLocaleString,
    filterRecords,
    calculateSummary,
    paginateRecords,
    extractUniqueYears,
    extractUniqueCostCenters,
  };
}
