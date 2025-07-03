// views\userPages\userMonthlyRecord\userMonthlyRecord.js
// ====================================================================
// USER MONTHLY RECORD - IMPROVED VERSION
// ====================================================================

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
    reverseFilters: {
      year: false,
      month: false,
      costCenter: false,
      bank: false,
    },
  },
};

// ====================================================================
// DOM ELEMENT REFERENCES
// ====================================================================
const elements = {
  yearFilter: () => document.getElementById("yearFilter"),
  monthFilter: () => document.getElementById("monthFilter"),
  costCenterFilter: () => document.getElementById("costCenterFilter"),
  applyFiltersBtn: () => document.getElementById("applyFilters"),
  resetFiltersBtn: () => document.getElementById("resetFilters"),
  recordsBody: () => document.getElementById("recordsBody"),
  loadingDiv: () => document.getElementById("loading"),
  paginationDiv: () => document.getElementById("pagination"),
  modal: () => document.getElementById("recordModal"),
  modalContent: () => document.getElementById("modalContent"),
  closeModal: () => document.querySelector(".close"),
};

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Formats a number as Vietnamese currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */

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

    return yearMatch && monthMatch && costCenterMatch && bankMatch;
  });
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
// UI RENDERING FUNCTIONS
// ====================================================================

const exportToPDF = () => {
  const { year, month, costCenter, bank } = state.filters;
  const { reverseFilters } = state.filters;

  if (!year || !month) {
    alert("Vui lòng chọn cả năm và tháng để xuất báo cáo chi lương");
    return;
  }

  let url = `/exportSalaryPDF?month=${month}&year=${year}`;

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

const exportToExcel = async () => {
  const { year, month, costCenter, bank } = state.filters;
  const { reverseFilters } = state.filters;

  if (!year || !month) {
    alert("Vui lòng chọn cả năm và tháng để xuất báo cáo chi lương");
    return;
  }

  // Show loading message in Vietnamese
  const loadingDiv = elements.loadingDiv();
  loadingDiv.style.display = "block";
  loadingDiv.innerHTML = "Đang tạo báo cáo Excel, vui lòng chờ...";

  let url = `/exportSalaryExcel?month=${month}&year=${year}`;

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
 * @returns {HTMLElement} Table row element
 */
const createRecordRow = (record) => {
  const row = document.createElement("tr");
  const monthName = getMonthName(record.recordMonth);

  row.innerHTML = `
    <td>${safeGet(record, "realName", "N/A")}</td>
    <td>${monthName} ${record.recordYear || "N/A"}</td>
    <td>${record.baseSalary.toLocaleString()}</td>
    <td>${record.hourlyWage.toLocaleString()}</td>
    <td>${record.overtimePay.toLocaleString()}</td>
    <td>${record.currentSalary.toLocaleString()}</td>
    <td>${record.tax.toLocaleString()}</td>
    <td>${safeGet(record, "costCenter.name")}</td>
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
        <td colspan="8" style="text-align: center; padding: 20px; color: #666;">
          Không tìm thấy bản ghi nào phù hợp với tiêu chí tìm kiếm.
        </td>
      </tr>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  records.forEach((record) => {
    fragment.appendChild(createRecordRow(record));
  });

  recordsBody.appendChild(fragment);
  attachDetailButtonListeners();
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
      <p><strong>Lương cơ bản:</strong> ${record.baseSalary.toLocaleString()}</p>
      <p><strong>Lương theo giờ:</strong> ${record.hourlyWage.toLocaleString()}</p>
    </div>

    <div class="modal-section">
      <p><strong>Trách nhiệm:</strong> ${record.responsibility.toLocaleString()}</p>
      <p><strong>Công tác phí:</strong> ${record.travelExpense.toLocaleString()}</p>
      <p><strong>Hoa hồng:</strong> ${record.commissionBonus.toLocaleString()}</p>
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
      <p><strong>Lương tăng ca:</strong> ${record.overtimePay.toLocaleString()}</p>
    </div>

    <div class="modal-section">
      <p><strong>Tổng lương:</strong> ${record.grossSalary.toLocaleString()}</p>
    </div>

    <div class="modal-section">
      <p><strong>Lương tính thuế:</strong> ${record.taxableIncome.toLocaleString()}</p>
      <p><strong>Thuế thu nhập:</strong> ${record.tax.toLocaleString()}</p>
      <p><strong>Số người phụ thuộc:</strong> ${record.dependantCount || 0}</p>
      <p><strong>Lương đóng bảo hiểm:</strong> ${record.insurableSalary.toLocaleString()}</p>
      <p><strong>Bảo hiểm bắt buộc:</strong> ${record.mandatoryInsurance.toLocaleString()}</p>
    </div>

    <div class="modal-section">  
      <p><strong>Lương thực lĩnh:</strong> ${record.currentSalary.toLocaleString()}</p>
    </div>
  `;
};

// ====================================================================
// EVENT HANDLERS
// ====================================================================

/**
 * Handles filter application
 */
const handleApplyFilters = () => {
  const yearFilter = elements.yearFilter();
  const monthFilter = elements.monthFilter();
  const costCenterFilter = elements.costCenterFilter();
  const bankFilter = document.getElementById("bankFilter");

  state.filters = {
    ...state.filters,
    year: yearFilter?.value || "",
    month: monthFilter?.value || "",
    costCenter: costCenterFilter?.value || "",
    bank: bankFilter?.value || "",
  };

  state.currentPage = 1;
  updateDisplay();
};

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
 * Handles filter reset
 */
const handleResetFilters = () => {
  const yearFilter = elements.yearFilter();
  const monthFilter = elements.monthFilter();
  const costCenterFilter = elements.costCenterFilter();
  const bankFilter = document.getElementById("bankFilter");

  if (yearFilter) yearFilter.value = "";
  if (monthFilter) monthFilter.value = "";
  if (costCenterFilter) costCenterFilter.value = "";
  if (bankFilter) bankFilter.value = "";

  state.filters = { year: "", month: "", costCenter: "", bank: "" };
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

  const bankFilter = document.getElementById("bankFilter");
  if (bankFilter) {
    bankFilter.addEventListener("input", debouncedApplyFilters);
  }

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

  const exportBtn = document.getElementById("exportPDF");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportToPDF);
  }

  const exportExcelBtn = document.getElementById("exportExcel");
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportToExcel);
  }
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

  // Paginate results
  const paginationInfo = paginateRecords(
    state.filteredRecords,
    state.currentPage,
    CONFIG.ITEMS_PER_PAGE
  );

  // Render table and pagination
  renderTable(paginationInfo.records);
  renderPagination(paginationInfo);
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
    filterRecords,
    paginateRecords,
    extractUniqueYears,
    extractUniqueCostCenters,
  };
}
