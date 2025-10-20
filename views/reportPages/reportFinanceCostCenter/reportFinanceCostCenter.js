// views/reportPages/reportFinanceCostCenter/reportFinanceCostCenter.js
// Available log types and actions
const logTypes = {
  gas: {
    name: "Gas Operations",
    actions: [
      "GET_FINANCE_GAS_PAGE",
      "GET_ALL_CENTERS_GAS",
      "EXPORT_GAS_SUMMARY_EXCEL",
      "CREATE_CENTER_GAS",
      "ADD_MONTH_ENTRY_GAS",
      "DELETE_CENTER_GAS",
      "ADD_YEAR_GAS",
      "UPDATE_YEAR_GAS",
      "REORDER_YEARS_GAS",
      "DELETE_MONTH_ENTRY_GAS",
      "UPDATE_MONTH_ENTRY_GAS",
      "UPDATE_CENTER_GAS",
    ],
  },
  bank: {
    name: "Bank Entries",
    actions: [
      "GET_BANK_ENTRIES",
      "ADD_BANK_ENTRY",
      "UPDATE_BANK_ENTRY",
      "DELETE_BANK_ENTRY",
      "GET_COST_CENTERS",
    ],
  },
  construction: {
    name: "Construction",
    actions: [
      "GET_CONSTRUCTION_ENTRIES",
      "ADD_CONSTRUCTION_ENTRY",
      "UPDATE_CONSTRUCTION_ENTRY",
      "DELETE_CONSTRUCTION_ENTRY",
      "GET_COST_CENTERS_CONSTRUCTION",
    ],
  },
};

let currentState = {
  filters: {
    logType: "all",
    user: "",
    action: "all",
    dateFrom: "",
    dateTo: "",
  },
};

document.addEventListener("DOMContentLoaded", function () {
  populateActionFilter();
  setupEventListeners();
  loadLogs();
});

function populateActionFilter() {
  const actionFilter = document.getElementById("actionFilter");
  actionFilter.innerHTML = '<option value="all">Tất cả</option>';

  const selectedType = document.getElementById("logType").value;

  if (selectedType !== "all") {
    logTypes[selectedType].actions.forEach((action) => {
      const option = document.createElement("option");
      option.value = action;
      option.textContent = action;
      actionFilter.appendChild(option);
    });
  }
}

function setupEventListeners() {
  document.getElementById("logType").addEventListener("change", function () {
    populateActionFilter();
  });

  document
    .getElementById("applyFilters")
    .addEventListener("click", applyFilters);
}

function applyFilters() {
  currentState.filters = {
    logType: document.getElementById("logType").value,
    user: document.getElementById("userFilter").value,
    action: document.getElementById("actionFilter").value,
    dateFrom: document.getElementById("dateFrom").value,
    dateTo: document.getElementById("dateTo").value,
  };

  loadLogs();
}

async function loadLogs() {
  const logsList = document.getElementById("logsList");
  logsList.innerHTML = '<div class="loading">Đang tải nhật ký...</div>';

  try {
    const params = new URLSearchParams({
      type: currentState.filters.logType,
      user: currentState.filters.user,
      action: currentState.filters.action,
      dateFrom: currentState.filters.dateFrom,
      dateTo: currentState.filters.dateTo,
    });

    const response = await fetch(`/reportFinanceCostCenterControl?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    renderLogs(data.logs);
  } catch (error) {
    console.error("Error loading logs:", error);
    logsList.innerHTML =
      '<div class="no-logs">Lỗi khi tải nhật ký: ' + error.message + "</div>";
  }
}

function renderLogs(logs) {
  const logsList = document.getElementById("logsList");

  if (!logs || logs.length === 0) {
    logsList.innerHTML =
      '<div class="no-logs">Không có nhật ký nào được tìm thấy</div>';
    return;
  }

  logsList.innerHTML = "";

  logs.forEach((log) => {
    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";

    const logHeader = document.createElement("div");
    logHeader.className = "log-header";

    const logTitle = document.createElement("h3");
    logTitle.textContent = `${log.username} - ${log.action}`;

    const logTimestamp = document.createElement("span");
    logTimestamp.textContent = new Date(log.timestamp).toLocaleString("vi-VN");

    logHeader.appendChild(logTitle);
    logHeader.appendChild(logTimestamp);

    const logDetails = document.createElement("div");
    logDetails.className = "log-details";

    const details = [
      { label: "Vai trò", value: log.userRole },
      { label: "Phòng ban", value: log.userDepartment || "Không có" },
      { label: "Bộ điều khiển", value: log.controller },
      {
        label: "Mã phản hồi",
        value: log.responseStatus,
        className:
          log.responseStatus >= 400 ? "status-error" : "status-success",
      },
      { label: "Thông điệp", value: log.responseMessage || "Không có" },
      { label: "Địa chỉ IP", value: log.ipAddress || "Không có" },
    ];

    if (log.year) details.push({ label: "Năm", value: log.year });
    if (log.monthName) details.push({ label: "Tháng", value: log.monthName });
    if (log.entryIndex)
      details.push({ label: "Chỉ mục", value: log.entryIndex });
    if (log.costCenterId)
      details.push({
        label: "Mã trung tâm chi phí",
        value: log.costCenterId,
      });
    if (log.bankEntryId)
      details.push({
        label: "Mã bản ghi ngân hàng",
        value: log.bankEntryId,
      });
    if (log.entryId) details.push({ label: "Mã bản ghi", value: log.entryId });

    if (log.exportInfo) {
      details.push({ label: "Tên file", value: log.exportInfo.fileName });
      details.push({
        label: "Số bản ghi",
        value: log.exportInfo.recordCount,
      });

      if (log.exportInfo.totalAmounts) {
        const amounts = Object.entries(log.exportInfo.totalAmounts)
          .map(([key, value]) => `${key}: ${value.toLocaleString("vi-VN")}`)
          .join(", ");
        details.push({ label: "Tổng số tiền", value: amounts });
      }
    }

    details.forEach((detail) => {
      const detailItem = document.createElement("div");
      detailItem.className = "detail-item";

      const detailLabel = document.createElement("div");
      detailLabel.className = "detail-label";
      detailLabel.textContent = detail.label;

      const detailValue = document.createElement("div");
      detailValue.className = detail.className || "detail-value";
      detailValue.textContent = detail.value;

      detailItem.appendChild(detailLabel);
      detailItem.appendChild(detailValue);
      logDetails.appendChild(detailItem);
    });

    logEntry.appendChild(logHeader);
    logEntry.appendChild(logDetails);
    logsList.appendChild(logEntry);
  });
}
