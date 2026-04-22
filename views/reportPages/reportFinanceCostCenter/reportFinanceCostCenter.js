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
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 30,
  },
};

document.addEventListener("DOMContentLoaded", function () {
  populateActionFilter();
  setupEventListeners();
  loadLogs(1); // Load first page
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
    .addEventListener("click", function () {
      currentState.pagination.currentPage = 1; // Reset to first page on filter
      applyFilters();
    });
}

function applyFilters() {
  currentState.filters = {
    logType: document.getElementById("logType").value,
    user: document.getElementById("userFilter").value,
    action: document.getElementById("actionFilter").value,
    dateFrom: document.getElementById("dateFrom").value,
    dateTo: document.getElementById("dateTo").value,
  };

  loadLogs(1);
}

async function loadLogs(page) {
  const logsList = document.getElementById("logsList");
  logsList.innerHTML = '<div class="loading">Đang tải nhật ký...</div>';

  try {
    const params = new URLSearchParams({
      type: currentState.filters.logType,
      user: currentState.filters.user,
      action: currentState.filters.action,
      dateFrom: currentState.filters.dateFrom,
      dateTo: currentState.filters.dateTo,
      page: page,
      limit: currentState.pagination.limit,
    });

    const response = await fetch(`/reportFinanceCostCenterControl?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update pagination state
    currentState.pagination = {
      ...currentState.pagination,
      ...data.pagination,
    };

    renderLogs(data.logs);
    renderPagination();
  } catch (error) {
    console.error("Error loading logs:", error);
    logsList.innerHTML =
      '<div class="no-logs">Lỗi khi tải nhật ký: ' + error.message + "</div>";
  }
}

function renderPagination() {
  const logsContainer = document.querySelector(".logs-container");

  // Remove existing pagination if any
  const existingPagination = document.querySelector(".pagination-container");
  if (existingPagination) {
    existingPagination.remove();
  }

  const { currentPage, totalPages, totalCount, limit } =
    currentState.pagination;

  if (totalPages <= 1) return;

  const paginationContainer = document.createElement("div");
  paginationContainer.className = "pagination-container";
  paginationContainer.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 30px;
    gap: 10px;
    flex-wrap: wrap;
  `;

  // Info text
  const infoText = document.createElement("div");
  infoText.className = "pagination-info";
  infoText.style.cssText = `
    margin-right: 20px;
    color: #6c757d;
    font-size: 14px;
  `;

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCount);
  infoText.textContent = `Hiển thị ${startItem}-${endItem} trên tổng số ${totalCount} bản ghi`;

  // Pagination controls
  const paginationControls = document.createElement("div");
  paginationControls.style.cssText = `
    display: flex;
    gap: 5px;
  `;

  // Previous button
  const prevButton = createPaginationButton("«", currentPage > 1, () =>
    loadLogs(currentPage - 1),
  );
  paginationControls.appendChild(prevButton);

  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationControls.appendChild(
      createPaginationButton("1", true, () => loadLogs(1)),
    );
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.style.cssText = `
        padding: 8px 12px;
        color: #6c757d;
      `;
      paginationControls.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageButton = createPaginationButton(
      i.toString(),
      true,
      () => loadLogs(i),
      i === currentPage,
    );
    paginationControls.appendChild(pageButton);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.style.cssText = `
        padding: 8px 12px;
        color: #6c757d;
      `;
      paginationControls.appendChild(ellipsis);
    }
    paginationControls.appendChild(
      createPaginationButton(totalPages.toString(), true, () =>
        loadLogs(totalPages),
      ),
    );
  }

  // Next button
  const nextButton = createPaginationButton("»", currentPage < totalPages, () =>
    loadLogs(currentPage + 1),
  );
  paginationControls.appendChild(nextButton);

  paginationContainer.appendChild(infoText);
  paginationContainer.appendChild(paginationControls);
  logsContainer.appendChild(paginationContainer);
}

function createPaginationButton(text, enabled, onClick, isActive = false) {
  const button = document.createElement("button");
  button.textContent = text;
  button.disabled = !enabled;
  button.style.cssText = `
    padding: 8px 14px;
    border: 1px solid ${isActive ? "#007bff" : "#dee2e6"};
    background: ${isActive ? "#007bff" : "white"};
    color: ${isActive ? "white" : "#007bff"};
    cursor: ${enabled ? "pointer" : "not-allowed"};
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s;
    min-width: 40px;
    opacity: ${enabled ? "1" : "0.5"};
  `;

  if (enabled) {
    button.addEventListener("mouseenter", () => {
      if (!isActive) {
        button.style.background = "#e9ecef";
      }
    });

    button.addEventListener("mouseleave", () => {
      if (!isActive) {
        button.style.background = "white";
      }
    });

    button.addEventListener("click", onClick);
  }

  return button;
}

function renderLogs(logs) {
  const logsList = document.getElementById("logsList");

  if (!logs || logs.length === 0) {
    logsList.innerHTML =
      '<div class="no-logs">Không có nhật ký nào được tìm thấy</div>';
    return;
  }

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  logs.forEach((log) => {
    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";

    // Add type indicator
    const typeBadge = document.createElement("div");
    typeBadge.className = `log-type-badge log-type-${log.type}`;
    typeBadge.textContent = getTypeDisplayName(log.type);
    typeBadge.style.cssText = `
      display: inline-block;
      padding: 2px 8px;
      background: ${getTypeColor(log.type)};
      color: white;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 10px;
    `;

    const logHeader = document.createElement("div");
    logHeader.className = "log-header";

    const logTitle = document.createElement("h3");
    logTitle.textContent = `${log.username} - ${log.action}`;
    logTitle.appendChild(typeBadge);

    const logTimestamp = document.createElement("span");
    logTimestamp.textContent = new Date(log.timestamp).toLocaleString("vi-VN");

    logHeader.appendChild(logTitle);
    logHeader.appendChild(logTimestamp);

    const logDetails = document.createElement("div");
    logDetails.className = "log-details";

    // Create details array with all possible fields
    const details = [
      { label: "Loại", value: getTypeDisplayName(log.type) },
      { label: "Người dùng", value: log.username },
      { label: "Vai trò", value: log.userRole },
      { label: "Phòng ban", value: log.userDepartment || "Không có" },
      { label: "Hành động", value: log.action },
      { label: "Bộ điều khiển", value: log.controller },
      {
        label: "Mã phản hồi",
        value: log.responseStatus,
        className:
          log.responseStatus >= 400 ? "status-error" : "status-success",
      },
      {
        label: "Thông điệp phản hồi",
        value: log.responseMessage || "Không có",
      },
      { label: "Địa chỉ IP", value: log.ipAddress || "Không có" },
      {
        label: "Thời gian",
        value: new Date(log.timestamp).toLocaleString("vi-VN"),
      },
      { label: "User Agent", value: log.userAgent || "Không có" },
    ];

    // Add model-specific fields
    if (log.costCenterId) {
      details.push({ label: "Mã trung tâm chi phí", value: log.costCenterId });
    }

    // Gas log specific fields
    if (log.year) details.push({ label: "Năm", value: log.year });
    if (log.monthName) details.push({ label: "Tháng", value: log.monthName });
    if (log.entryIndex)
      details.push({ label: "Chỉ mục bản ghi", value: log.entryIndex });

    // Bank log specific fields
    if (log.bankEntryId) {
      details.push({ label: "Mã bản ghi ngân hàng", value: log.bankEntryId });
    }

    // Construction log specific fields
    if (log.entryId) details.push({ label: "Mã bản ghi", value: log.entryId });
    if (log.entryType)
      details.push({ label: "Loại bản ghi", value: log.entryType });

    // Export information (Gas logs)
    if (log.exportInfo) {
      details.push({
        label: "Tên file xuất",
        value: log.exportInfo.fileName || "Không có",
      });
      details.push({
        label: "Số lượng bản ghi",
        value: log.exportInfo.recordCount || 0,
      });

      if (log.exportInfo.totalAmounts) {
        const amounts = Object.entries(log.exportInfo.totalAmounts)
          .map(
            ([key, value]) =>
              `${key}: ${
                typeof value === "number"
                  ? value.toLocaleString("vi-VN")
                  : value
              }`,
          )
          .join(", ");
        details.push({ label: "Tổng số tiền", value: amounts });
      }
    }

    // Create detail items for basic fields
    details.forEach((detail) => {
      if (detail.value !== undefined && detail.value !== null) {
        const detailItem = document.createElement("div");
        detailItem.className = "detail-item";

        const detailLabel = document.createElement("div");
        detailLabel.className = "detail-label";
        detailLabel.textContent = detail.label;

        const detailValue = document.createElement("div");
        detailValue.className = detail.className || "detail-value";

        // Format the value display
        if (typeof detail.value === "object") {
          detailValue.textContent = JSON.stringify(detail.value);
        } else {
          detailValue.textContent = detail.value;
        }

        detailItem.appendChild(detailLabel);
        detailItem.appendChild(detailValue);
        logDetails.appendChild(detailItem);
      }
    });

    // REQUEST DATA SECTION - Show this prominently for ALL log types including gas
    if (log.requestData) {
      const requestDataSection = document.createElement("div");
      requestDataSection.className = "request-data-section";
      requestDataSection.style.cssText = `
        grid-column: 1 / -1;
        margin-top: 15px;
        padding: 15px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
      `;

      const requestDataHeader = document.createElement("div");
      requestDataHeader.className = "detail-label";
      requestDataHeader.textContent = "DỮ LIỆU YÊU CẦU";
      requestDataHeader.style.marginBottom = "10px";

      const requestDataContent = document.createElement("div");
      requestDataContent.className = "detail-value";

      try {
        let requestDataStr;

        if (typeof log.requestData === "string") {
          // Try to parse if it's a JSON string
          try {
            const parsed = JSON.parse(log.requestData);
            requestDataStr = JSON.stringify(parsed, null, 2);
          } catch {
            requestDataStr = log.requestData;
          }
        } else if (typeof log.requestData === "object") {
          // It's already an object
          requestDataStr = JSON.stringify(log.requestData, null, 2);
        } else {
          requestDataStr = String(log.requestData);
        }

        // Create preformatted text for better readability
        const pre = document.createElement("pre");
        pre.style.cssText = `
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          background: white;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          max-height: 300px;
          overflow-y: auto;
        `;
        pre.textContent = requestDataStr;

        requestDataContent.appendChild(pre);
      } catch (error) {
        requestDataContent.textContent = `Lỗi hiển thị dữ liệu: ${error.message}`;
        requestDataContent.style.color = "#dc3545";
      }

      requestDataSection.appendChild(requestDataHeader);
      requestDataSection.appendChild(requestDataContent);
      logDetails.appendChild(requestDataSection);
    }

    logEntry.appendChild(logHeader);
    logEntry.appendChild(logDetails);
    fragment.appendChild(logEntry);
  });

  logsList.innerHTML = "";
  logsList.appendChild(fragment);
}

function getTypeDisplayName(type) {
  const typeNames = {
    gas: "Mua bán khí",
    bank: "Ngân hàng",
    construction: "Xây dựng",
  };
  return typeNames[type] || type;
}

function getTypeColor(type) {
  const colors = {
    gas: "#28a745", // Green
    bank: "#007bff", // Blue
    construction: "#fd7e14", // Orange
  };
  return colors[type] || "#6c757d"; // Gray as fallback
}
