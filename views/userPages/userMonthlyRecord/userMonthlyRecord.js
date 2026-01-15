// views\userPages\userMonthlyRecord\userMonthlyRecord.js
// ====================================================================
// USER MONTHLY RECORD - IMPROVED WITH USER GROUPING AND NO PAGINATION
// ====================================================================

// ====================================================================
// CONSTANTS AND CONFIGURATION
// ====================================================================
const CONFIG = {
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
 */
const getMonthName = (monthNumber) => {
  const index = monthNumber - 1;
  return CONFIG.MONTH_NAMES[index] || `Tháng ${monthNumber}`;
};

/**
 * Debounce function to limit API calls
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
 */
const safeGet = (obj, path, fallback = "N/A") => {
  if (!obj) return fallback;
  return path
    .split(".")
    .reduce(
      (current, key) =>
        current && current[key] !== undefined && current[key] !== null
          ? current[key]
          : fallback,
      obj
    );
};

/**
 * Safely converts value to locale string for numbers
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
 * Groups records by user and sorts them
 */
const groupRecordsByUser = (records) => {
  // Separate records with undefined/null realName
  const recordsWithName = records.filter(
    (record) => record.realName && record.realName.trim() !== ""
  );

  const recordsWithoutName = records.filter(
    (record) => !record.realName || record.realName.trim() === ""
  );

  // Sort records with name alphabetically, then by year/month
  const sortedRecordsWithName = [...recordsWithName].sort((a, b) => {
    const nameA = a.realName?.toLowerCase() || "";
    const nameB = b.realName?.toLowerCase() || "";
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    if (a.recordYear < b.recordYear) return -1;
    if (a.recordYear > b.recordYear) return 1;

    return a.recordMonth - b.recordMonth;
  });

  // Sort records without name by year/month
  const sortedRecordsWithoutName = [...recordsWithoutName].sort((a, b) => {
    if (a.recordYear < b.recordYear) return -1;
    if (a.recordYear > b.recordYear) return 1;
    return a.recordMonth - b.recordMonth;
  });

  return [...sortedRecordsWithName, ...sortedRecordsWithoutName];
};

/**
 * Creates display items for rendering (headers, records, summaries)
 */
const createDisplayItems = (records) => {
  const groupedRecords = groupRecordsByUser(records);
  const displayItems = [];
  let currentUser = null;
  let currentUserRecords = [];
  let globalRecordIndex = 0;
  let groupIndex = 0;

  // Helper to add user group
  const addUserGroup = (user, userRecords, isFirst = false) => {
    if (!isFirst && userRecords.length > 0) {
      const userSummary = calculateUserSummary(userRecords);
      if (userSummary) {
        displayItems.push({
          type: "summary",
          data: userSummary,
          userRealName: user,
        });
      }
    }

    if (user && user.trim() !== "") {
      displayItems.push({
        type: "header",
        data: userRecords[0],
        userRealName: user,
        groupIndex: groupIndex,
      });
      groupIndex++;
    }
  };

  // Process all records
  groupedRecords.forEach((record) => {
    const userName = record.realName || "Không có tên";

    if (currentUser !== userName) {
      if (currentUser !== null) {
        addUserGroup(currentUser, currentUserRecords, currentUser === null);
      }
      currentUser = userName;
      currentUserRecords = [record];
    } else {
      currentUserRecords.push(record);
    }

    globalRecordIndex++;
    displayItems.push({
      type: "record",
      data: record,
      globalIndex: globalRecordIndex,
    });
  });

  // Add summary for last user
  if (currentUser !== null && currentUserRecords.length > 0) {
    const userSummary = calculateUserSummary(currentUserRecords);
    if (userSummary) {
      displayItems.push({
        type: "summary",
        data: userSummary,
        userRealName: currentUser,
      });
    }
  }

  return displayItems;
};

/**
 * Calculates summary for a user group
 */
const calculateUserSummary = (userRecords) => {
  if (!userRecords || userRecords.length === 0) {
    return null;
  }

  const summary = {
    userRealName: userRecords[0].realName || "Không có tên",
    recordCount: userRecords.length,
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
    averageCurrentSalary: 0,
    averageTax: 0,
  };

  userRecords.forEach((record) => {
    summary.totalBaseSalary += Number(record.baseSalary) || 0;
    summary.totalHourlyWage += Number(record.hourlyWage) || 0;
    summary.totalResponsibility += Number(record.responsibility) || 0;
    summary.totalTravelExpense += Number(record.travelExpense) || 0;
    summary.totalCommissionBonus += Number(record.commissionBonus) || 0;
    summary.totalOtherBonus += Number(record.otherBonus) || 0;
    summary.totalWeekdayOvertimeHours +=
      Number(record.weekdayOvertimeHour) || 0;
    summary.totalWeekendOvertimeHours +=
      Number(record.weekendOvertimeHour) || 0;
    summary.totalHolidayOvertimeHours +=
      Number(record.holidayOvertimeHour) || 0;
    summary.totalOvertimePay += Number(record.overtimePay) || 0;
    summary.totalTaxableIncome += Number(record.taxableIncome) || 0;
    summary.totalGrossSalary += Number(record.grossSalary) || 0;
    summary.totalTax += Number(record.tax) || 0;
    summary.totalCurrentSalary += Number(record.currentSalary) || 0;
  });

  if (summary.recordCount > 0) {
    summary.averageCurrentSalary = Math.round(
      summary.totalCurrentSalary / summary.recordCount
    );
    summary.averageTax = Math.round(summary.totalTax / summary.recordCount);
  }

  return summary;
};

/**
 * Extracts unique years from records and sorts them
 */
const extractUniqueYears = (records) => {
  const years = records
    .map((record) => record.recordYear)
    .filter((year) => year != null && !isNaN(year));

  return [...new Set(years)].sort((a, b) => b - a);
};

/**
 * Extracts unique cost centers from records and sorts them
 */
const extractUniqueCostCenters = (records) => {
  const costCenters = records
    .map((record) => safeGet(record, "costCenter.name", ""))
    .filter((name) => name && name.trim() !== "");

  const uniqueCostCenters = [...new Set(costCenters)].sort();

  const hasNoCostCenter = records.some(
    (record) => !safeGet(record, "costCenter.name")
  );
  if (hasNoCostCenter) {
    uniqueCostCenters.push("Không có trạm");
  }

  return uniqueCostCenters;
};

/**
 * Filters records based on current filter criteria
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

  if (totals.minCurrentSalary === Infinity) totals.minCurrentSalary = 0;
  if (totals.maxCurrentSalary === -Infinity) totals.maxCurrentSalary = 0;

  return totals;
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

  if (state.summary && state.summary.totalRecords > 0) {
    url += `&includeSummary=true`;
  }

  const loadingDiv = elements.loadingDiv();
  loadingDiv.style.display = "block";
  loadingDiv.innerHTML = "Đang tạo báo cáo PDF, vui lòng chờ...";

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

  const loadingDiv = elements.loadingDiv();
  loadingDiv.style.display = "block";
  loadingDiv.innerHTML = "Đang tạo báo cáo Excel, vui lòng chờ...";

  let url = `/exportSalaryExcel?year=${year}`;

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

  if (state.summary && state.summary.totalRecords > 0) {
    url += `&includeSummary=true`;
  }

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
 * Creates a user group header row
 */
const createUserGroupHeader = (user, groupIndex) => {
  const row = document.createElement("tr");
  row.className = "user-group";
  row.setAttribute("role", "row");
  const employeeInfo = `${user.realName || "Không có tên"}${
    user.costCenter?.name ? ` - ${user.costCenter.name}` : ""
  }`;

  row.innerHTML = `
    <td colspan="19" role="gridcell">
      <strong>Nhóm ${groupIndex + 1}:</strong> ${employeeInfo}
      <span style="float: right; font-weight: normal; font-size: 0.9em; color: var(--text-secondary);">
        ${user.email || ""}
      </span>
    </td>
  `;

  return row;
};

/**
 * Creates a user summary row WITHOUT RECORD COUNT COLUMN
 */
const createUserSummaryRow = (summary) => {
  const row = document.createElement("tr");
  row.className = "user-summary-row";
  row.setAttribute("role", "row");

  const cells = [
    { text: "", colSpan: 1, align: "center" },
    { text: `<strong>Tổng hợp cho:</strong>`, colSpan: 2, align: "left" },
    {
      text: summary.totalBaseSalary.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalHourlyWage.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalResponsibility.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalTravelExpense.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalCommissionBonus.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalOtherBonus.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalWeekdayOvertimeHours.toFixed(1),
      colSpan: 1,
      align: "center",
    },
    {
      text: summary.totalWeekendOvertimeHours.toFixed(1),
      colSpan: 1,
      align: "center",
    },
    {
      text: summary.totalHolidayOvertimeHours.toFixed(1),
      colSpan: 1,
      align: "center",
    },
    {
      text: summary.totalOvertimePay.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalTaxableIncome.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    {
      text: summary.totalGrossSalary.toLocaleString(),
      colSpan: 1,
      align: "right",
    },
    { text: summary.totalTax.toLocaleString(), colSpan: 1, align: "right" },
    {
      text: `<strong>${summary.totalCurrentSalary.toLocaleString()}</strong>`,
      colSpan: 1,
      align: "right",
    },
    {
      text: `TB: ${summary.averageCurrentSalary.toLocaleString()} | Thuế TB: ${summary.averageTax.toLocaleString()}`,
      colSpan: 2,
      align: "left",
    },
  ];

  let html = "";
  let cellIndex = 0;

  for (let i = 0; i < 19; i++) {
    if (cellIndex < cells.length) {
      const cell = cells[cellIndex];

      if (cell.colSpan > 1) {
        html += `<td colspan="${cell.colSpan}" role="gridcell" style="text-align: ${cell.align}">${cell.text}</td>`;
        i += cell.colSpan - 1;
      } else {
        html += `<td role="gridcell" style="text-align: ${cell.align}">${cell.text}</td>`;
      }

      cellIndex++;
    } else {
      html += `<td role="gridcell"></td>`;
    }
  }

  row.innerHTML = html;

  return row;
};

/**
 * Creates a table row for a record
 */
const createRecordRow = (record, index) => {
  const row = document.createElement("tr");
  row.setAttribute("role", "row");
  const monthName = getMonthName(record.recordMonth);

  row.innerHTML = `
    <td role="gridcell">${index + 1}</td>
    <td role="gridcell">${safeGet(record, "realName", "Không có tên")}</td>
    <td role="gridcell">${monthName} ${record.recordYear || "N/A"}</td>
    <td role="gridcell">${safeToLocaleString(record.baseSalary)}</td>
    <td role="gridcell">${safeToLocaleString(record.hourlyWage)}</td>
    <td role="gridcell">${safeToLocaleString(record.responsibility)}</td>
    <td role="gridcell">${safeToLocaleString(record.travelExpense)}</td>
    <td role="gridcell">${safeToLocaleString(record.commissionBonus)}</td>
    <td role="gridcell">${safeToLocaleString(record.otherBonus)}</td>
    <td role="gridcell">${record.weekdayOvertimeHour || 0}</td>
    <td role="gridcell">${record.weekendOvertimeHour || 0}</td>
    <td role="gridcell">${record.holidayOvertimeHour || 0}</td>
    <td role="gridcell">${safeToLocaleString(record.overtimePay)}</td>
    <td role="gridcell">${safeToLocaleString(record.taxableIncome)}</td>
    <td role="gridcell">${safeToLocaleString(record.grossSalary)}</td>
    <td role="gridcell">${safeToLocaleString(record.tax)}</td>
    <td role="gridcell">${safeToLocaleString(record.currentSalary)}</td>
    <td role="gridcell">${safeGet(
      record,
      "costCenter.name",
      "Không có trạm"
    )}</td>
    <td role="gridcell">
      <button class="view-details" data-id="${record._id}" 
              title="Xem chi tiết bản ghi" role="button">
        Xem chi tiết
      </button>
    </td>
  `;

  return row;
};

/**
 * Renders the records table with ALL records at once
 */
const renderTableWithGrouping = (items) => {
  const recordsBody = elements.recordsBody();
  if (!recordsBody) return;

  recordsBody.innerHTML = "";

  if (items.length === 0) {
    recordsBody.innerHTML = `
      <tr role="row">
        <td colspan="19" role="gridcell" style="text-align: center; padding: 20px; color: #666;">
          Không tìm thấy bản ghi nào phù hợp với tiêu chí tìm kiếm.
        </td>
      </tr>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  let userGroupCount = 0;
  let currentUser = null;

  items.forEach((item) => {
    switch (item.type) {
      case "header":
        if (
          item.userRealName !== currentUser &&
          item.userRealName !== "Không có tên"
        ) {
          fragment.appendChild(
            createUserGroupHeader(item.data, userGroupCount)
          );
          currentUser = item.userRealName;
          userGroupCount++;
        }
        break;

      case "record":
        fragment.appendChild(createRecordRow(item.data, item.globalIndex - 1));
        break;

      case "summary":
        fragment.appendChild(createUserSummaryRow(item.data));
        currentUser = null;
        break;
    }
  });

  recordsBody.appendChild(fragment);
  attachDetailButtonListeners();
};

/**
 * Populates year filter dropdown
 */
const populateYearFilter = (years) => {
  const yearFilter = elements.yearFilter();
  if (!yearFilter) return;

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
 */
const populateCostCenterFilter = (costCenters) => {
  const costCenterFilter = elements.costCenterFilter();
  if (!costCenterFilter) return;

  costCenterFilter.innerHTML = '<option value="">Tất cả trạm</option>';

  costCenters.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    costCenterFilter.appendChild(option);
  });
};

/**
 * Renders the summary section
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
 * Shows record count
 */
const showRecordCount = (count) => {
  let recordCountDisplay = document.getElementById("recordCountDisplay");

  if (!recordCountDisplay) {
    recordCountDisplay = document.createElement("div");
    recordCountDisplay.id = "recordCountDisplay";
    recordCountDisplay.style.cssText = `
      margin: 10px 0;
      padding: 8px 12px;
      background-color: var(--primary-light);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-align: center;
      border: 1px solid var(--border-light);
    `;

    const tableContainer = document.querySelector(".table-container");
    if (tableContainer && tableContainer.parentNode) {
      tableContainer.parentNode.insertBefore(
        recordCountDisplay,
        tableContainer.nextSibling
      );
    }
  }

  recordCountDisplay.textContent = `Đang hiển thị ${count.toLocaleString()} bản ghi`;
};

/**
 * Creates modal content for record details
 */
const createModalContent = (record) => {
  const monthName = getMonthName(record.recordMonth);

  return `
    <h2>${safeGet(record, "realName", "Không có tên")} - ${monthName} ${
    record.recordYear
  }</h2>
    <p><strong>Ngày ghi nhận:</strong> ${formatDate(record.recordDate)}</p>
    <p><strong>Email:</strong> ${safeGet(record, "email", "Không có")}</p>
    <p><strong>Trạm:</strong> ${safeGet(
      record,
      "costCenter.name",
      "Không có trạm"
    )}</p>
    <p><strong>Người phụ trách:</strong> ${safeGet(
      record,
      "assignedManager.realName",
      "Không có"
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
 */
const toggleReverseFilter = (filterType) => {
  state.filters.reverseFilters[filterType] =
    !state.filters.reverseFilters[filterType];

  const button = document.getElementById(`${filterType}Reverse`);
  if (button) {
    button.classList.toggle("active", state.filters.reverseFilters[filterType]);
  }

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
  updateDisplay();
};

/**
 * Shows record details in modal
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

// ====================================================================
// SETUP FUNCTIONS
// ====================================================================

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

/**
 * Updates the display with current data and filters
 */
const updateDisplay = () => {
  // Filter records
  state.filteredRecords = filterRecords(state.allRecords, state.filters);

  // Calculate overall summary
  state.summary = calculateSummary(state.filteredRecords);

  // Create display items
  const displayItems = createDisplayItems(state.filteredRecords);

  // Render table with all items
  renderTableWithGrouping(displayItems);
  renderSummary(state.summary);
  showRecordCount(state.filteredRecords.length);
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

    console.log(
      "User Monthly Record application initialized successfully without pagination"
    );
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
