// views\documentPages\documentSummaryPurchasing\documentSummaryPurchasing.js
// State management
const state = {
  currentUser: null,
  purchasingDocuments: [],
  showOnlyPendingApprovals: false,
  currentApprovers: [],
  currentAppendedProposals: [],
  availableProposals: [],
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 1,
  paginationEnabled: true,
  selectedDocuments: new Set(),
  currentEditDoc: null,
  nameFilter: "",
  currentGroupFilter: [],
  currentCostCenterFilter: [],
  currentTotalCostFilter: "",
  currentDateFilter: "",
  customTotalCostRange: { min: null, max: null },
  customDateRange: { from: null, to: null },
  costCenters: [],
  groups: [],
};

// Stock movement state
const stockMovementState = {
  currentDocument: null,
  selectedProducts: new Set(),
  productDetails: [],
};

// Helper function to validate and parse dd/mm/yyyy dates
const validateAndParseDate = (dateStr) => {
  if (!dateStr) return { isValid: false, date: null, message: "" };

  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);

  if (!match) {
    return {
      isValid: false,
      date: null,
      message:
        "Định dạng ngày không hợp lệ. Vui lòng nhập theo định dạng dd/mm/yyyy",
    };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      date: null,
      message: "Tháng phải từ 01 đến 12",
    };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      date: null,
      message: `Tháng ${month} chỉ có từ 01 đến ${daysInMonth} ngày`,
    };
  }

  const currentYear = new Date().getFullYear();
  if (year < 2000 || year > currentYear + 10) {
    return {
      isValid: false,
      date: null,
      message: `Năm phải từ 2000 đến ${currentYear + 10}`,
    };
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return {
      isValid: false,
      date: null,
      message: "Ngày không hợp lệ",
    };
  }

  return { isValid: true, date, message: "" };
};

const parseSubmissionDate = (dateString) => {
  if (!dateString) return null;

  const parts = dateString.split(" ");
  if (parts.length < 2) return null;

  const datePart = parts[0];
  const timePart = parts[1] || "00:00:00";

  const dateParts = datePart.split("-");
  if (dateParts.length !== 3) return null;

  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);

  const timeParts = timePart.split(":");
  const hour = timeParts.length > 0 ? parseInt(timeParts[0], 10) : 0;
  const minute = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;
  const second = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;

  return new Date(year, month, day, hour, minute, second);
};

const getDateRange = (filterType, customRange = null) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  if (filterType === "custom" && customRange) {
    if (customRange.from) {
      const fromParts = customRange.from.split("/");
      if (fromParts.length === 3) {
        start.setDate(parseInt(fromParts[0], 10));
        start.setMonth(parseInt(fromParts[1], 10) - 1);
        start.setFullYear(parseInt(fromParts[2], 10));
        start.setHours(0, 0, 0, 0);
      }
    } else {
      start.setTime(new Date(0).getTime());
    }

    if (customRange.to) {
      const toParts = customRange.to.split("/");
      if (toParts.length === 3) {
        end.setDate(parseInt(toParts[0], 10));
        end.setMonth(parseInt(toParts[1], 10) - 1);
        end.setFullYear(parseInt(toParts[2], 10));
        end.setHours(23, 59, 59, 999);
      }
    } else {
      end.setTime(new Date().getTime());
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  switch (filterType) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisWeek":
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisMonth":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "lastMonth":
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last3Months":
      start.setMonth(now.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "thisYear":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return { start: null, end: null };
  }

  return { start, end };
};

const isDateInRange = (dateString, filterType, customRange = null) => {
  if (!dateString || !filterType) return true;

  const { start, end } = getDateRange(filterType, customRange);
  if (!start || !end) return true;

  const date = parseSubmissionDate(dateString);
  if (!date) return true;

  return date >= start && date <= end;
};

const isInTotalCostRange = (amount, range, customRange = null) => {
  if (!amount && amount !== 0) return true;

  if (range === "custom" && customRange) {
    const { min, max } = customRange;
    if (min !== null && amount < min) return false;
    if (max !== null && amount > max) return false;
    return true;
  }

  if (!range) return true;

  if (range === "0-500000") {
    return amount < 500000;
  } else if (range === "500000-2000000") {
    return amount >= 500000 && amount < 2000000;
  } else if (range === "2000000-5000000") {
    return amount >= 2000000 && amount < 5000000;
  } else if (range === "5000000-10000000") {
    return amount >= 5000000 && amount < 10000000;
  } else if (range === "10000000-") {
    return amount >= 10000000;
  }

  return true;
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("/")) {
    return dateStr;
  }
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return formatDateToDDMMYYYY(date);
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }
  return dateStr;
};

const setupCustomFilterHandlers = () => {
  const totalCostFilter = document.getElementById("totalCostFilter");
  const totalCostCustomContainer = document.getElementById(
    "totalCostCustomContainer",
  );
  const applyTotalCostCustom = document.getElementById("applyTotalCostCustom");
  const clearTotalCostCustom = document.getElementById("clearTotalCostCustom");
  const totalCostMin = document.getElementById("totalCostMin");
  const totalCostMax = document.getElementById("totalCostMax");

  totalCostFilter.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      totalCostCustomContainer.style.display = "block";
      totalCostMin.value = "";
      totalCostMax.value = "";
    } else {
      totalCostCustomContainer.style.display = "none";
      state.customTotalCostRange = { min: null, max: null };
      state.currentTotalCostFilter = e.target.value;
      state.currentPage = 1;
      fetchPurchasingDocuments();
    }
  });

  applyTotalCostCustom.addEventListener("click", () => {
    const min = totalCostMin.value ? parseFloat(totalCostMin.value) : null;
    const max = totalCostMax.value ? parseFloat(totalCostMax.value) : null;

    if (min === null && max === null) {
      showMessage(
        "Vui lòng nhập ít nhất một giá trị cho khoảng tùy chỉnh",
        true,
      );
      return;
    }

    if (min !== null && max !== null && min > max) {
      showMessage('Giá trị "Từ" không được lớn hơn giá trị "Đến"', true);
      return;
    }

    if (min !== null && min < 0) {
      showMessage("Giá trị không được âm", true);
      return;
    }

    if (max !== null && max < 0) {
      showMessage("Giá trị không được âm", true);
      return;
    }

    state.customTotalCostRange = { min, max };
    state.currentTotalCostFilter = "custom";
    state.currentPage = 1;
    fetchPurchasingDocuments();

    let rangeText = "Tùy chỉnh: ";
    if (min !== null && max !== null) {
      rangeText += `${min.toLocaleString("en-EN", { maximumFractionDigits: 5 })} - ${max.toLocaleString("en-EN", { maximumFractionDigits: 5 })}`;
    } else if (min !== null) {
      rangeText += `Trên ${min.toLocaleString("en-EN", { maximumFractionDigits: 5 })}`;
    } else if (max !== null) {
      rangeText += `Dưới ${max.toLocaleString("en-EN", { maximumFractionDigits: 5 })}`;
    }

    const customOption = totalCostFilter.querySelector(
      'option[value="custom"]',
    );
    customOption.textContent = rangeText;
    customOption.title = rangeText;

    showMessage("Đã áp dụng khoảng tùy chỉnh");
  });

  clearTotalCostCustom.addEventListener("click", () => {
    totalCostMin.value = "";
    totalCostMax.value = "";
    state.customTotalCostRange = { min: null, max: null };
    state.currentTotalCostFilter = "";
    totalCostFilter.value = "";
    totalCostCustomContainer.style.display = "none";

    const customOption = totalCostFilter.querySelector(
      'option[value="custom"]',
    );
    customOption.textContent = "Nhập khoảng tùy chỉnh...";
    customOption.title = "";

    state.currentPage = 1;
    fetchPurchasingDocuments();
  });

  const dateFilter = document.getElementById("dateFilter");
  const dateCustomContainer = document.getElementById("dateCustomContainer");
  const applyDateCustom = document.getElementById("applyDateCustom");
  const clearDateCustom = document.getElementById("clearDateCustom");
  const dateFrom = document.getElementById("dateFrom");
  const dateTo = document.getElementById("dateTo");

  dateFilter.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      dateCustomContainer.style.display = "block";
      dateFrom.value = "";
      dateTo.value = "";
      dateFrom.classList.remove("invalid");
      dateTo.classList.remove("invalid");
    } else {
      dateCustomContainer.style.display = "none";
      state.customDateRange = { from: null, to: null };
      state.currentDateFilter = e.target.value;
      state.currentPage = 1;
      fetchPurchasingDocuments();
    }
  });

  applyDateCustom.addEventListener("click", () => {
    const from = dateFrom.value.trim();
    const to = dateTo.value.trim();

    if (!from && !to) {
      showMessage("Vui lòng nhập ít nhất một ngày cho khoảng tùy chỉnh", true);
      return;
    }

    let fromDate = null;
    let toDate = null;

    if (from) {
      const fromResult = validateAndParseDate(from);
      if (!fromResult.isValid) {
        showMessage(`Ngày "Từ": ${fromResult.message}`, true);
        dateFrom.focus();
        return;
      }
      fromDate = fromResult.date;
    }

    if (to) {
      const toResult = validateAndParseDate(to);
      if (!toResult.isValid) {
        showMessage(`Ngày "Đến": ${toResult.message}`, true);
        dateTo.focus();
        return;
      }
      toDate = toResult.date;
    }

    if (fromDate && toDate && fromDate > toDate) {
      showMessage('Ngày "Từ" không được sau ngày "Đến"', true);
      dateFrom.focus();
      return;
    }

    state.customDateRange = {
      from: fromDate ? formatDateToDDMMYYYY(fromDate) : null,
      to: toDate ? formatDateToDDMMYYYY(toDate) : null,
    };
    state.currentDateFilter = "custom";
    state.currentPage = 1;
    fetchPurchasingDocuments();

    let dateText = "Tùy chỉnh: ";
    if (from && to) {
      dateText += `${from} - ${to}`;
    } else if (from) {
      dateText += `Từ ${from}`;
    } else if (to) {
      dateText += `Đến ${to}`;
    }

    const customOption = dateFilter.querySelector('option[value="custom"]');
    customOption.textContent = dateText;
    customOption.title = dateText;

    showMessage("Đã áp dụng khoảng ngày tùy chỉnh");
  });

  clearDateCustom.addEventListener("click", () => {
    dateFrom.value = "";
    dateTo.value = "";
    dateFrom.classList.remove("invalid");
    dateTo.classList.remove("invalid");
    state.customDateRange = { from: null, to: null };
    state.currentDateFilter = "";
    dateFilter.value = "";
    dateCustomContainer.style.display = "none";

    const customOption = dateFilter.querySelector('option[value="custom"]');
    customOption.textContent = "Chọn khoảng ngày tùy chỉnh...";
    customOption.title = "";

    state.currentPage = 1;
    fetchPurchasingDocuments();
  });

  dateFrom.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      applyDateCustom.click();
    }
  });

  dateTo.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      applyDateCustom.click();
    }
  });
};

const initializeCostCenterMultiSelect = () => {
  const button = document.getElementById("costCenterMultiSelectButton");
  const dropdown = document.getElementById("costCenterMultiSelectDropdown");

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
    button.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
    button.classList.remove("open");
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
};

const initializeGroupMultiSelect = () => {
  const button = document.getElementById("groupMultiSelectButton");
  const dropdown = document.getElementById("groupMultiSelectDropdown");

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
    button.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
    button.classList.remove("open");
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
};

const populateCostCenterMultiSelect = async () => {
  try {
    const response = await fetch("/documentCostCenters");
    const costCenters = await response.json();
    state.costCenters = costCenters;

    const dropdown = document.getElementById("costCenterMultiSelectDropdown");
    dropdown.innerHTML = "";

    const selectAllOption = document.createElement("div");
    selectAllOption.className = "multi-select-option";
    selectAllOption.innerHTML = `
      <input type="checkbox" id="selectAllCostCenters">
      <label for="selectAllCostCenters">Chọn tất cả</label>
    `;
    dropdown.appendChild(selectAllOption);

    costCenters.forEach((center) => {
      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.innerHTML = `
        <input type="checkbox" id="costCenter_${center.name}" value="${center.name}">
        <label for="costCenter_${center.name}">${center.name}</label>
      `;
      dropdown.appendChild(option);
    });

    const selectAllCheckbox = document.getElementById("selectAllCostCenters");
    selectAllCheckbox.addEventListener("change", (e) => {
      const checkboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]:not(#selectAllCostCenters)',
      );
      checkboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked;
      });
      updateCostCenterFilter();
    });

    const checkboxes = dropdown.querySelectorAll(
      'input[type="checkbox"]:not(#selectAllCostCenters)',
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
        const someChecked = Array.from(checkboxes).some((cb) => cb.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
        updateCostCenterFilter();
      });
    });

    const clearButton = document.createElement("button");
    clearButton.className = "multi-select-clear";
    clearButton.innerHTML = '<i class="fas fa-times"></i> Xóa tất cả';
    clearButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      selectAllCheckbox.indeterminate = false;
      updateCostCenterFilter();
    });

    const buttonContainer = document.getElementById(
      "costCenterMultiSelectButton",
    );
    buttonContainer.appendChild(clearButton);
  } catch (error) {
    console.error("Error fetching cost centers for multi-select:", error);
  }
};

const populateGroupMultiSelect = async () => {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    state.groups = groups;

    const dropdown = document.getElementById("groupMultiSelectDropdown");
    dropdown.innerHTML = "";

    const selectAllOption = document.createElement("div");
    selectAllOption.className = "multi-select-option";
    selectAllOption.innerHTML = `
      <input type="checkbox" id="selectAllGroups">
      <label for="selectAllGroups">Chọn tất cả</label>
    `;
    dropdown.appendChild(selectAllOption);

    groups.forEach((group) => {
      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.innerHTML = `
        <input type="checkbox" id="group_${group.name}" value="${group.name}">
        <label for="group_${group.name}">${group.name}</label>
      `;
      dropdown.appendChild(option);
    });

    const selectAllCheckbox = document.getElementById("selectAllGroups");
    selectAllCheckbox.addEventListener("change", (e) => {
      const checkboxes = dropdown.querySelectorAll(
        'input[type="checkbox"]:not(#selectAllGroups)',
      );
      checkboxes.forEach((checkbox) => {
        checkbox.checked = e.target.checked;
      });
      updateGroupFilter();
    });

    const checkboxes = dropdown.querySelectorAll(
      'input[type="checkbox"]:not(#selectAllGroups)',
    );
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
        const someChecked = Array.from(checkboxes).some((cb) => cb.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
        updateGroupFilter();
      });
    });

    const clearButton = document.createElement("button");
    clearButton.className = "multi-select-clear";
    clearButton.innerHTML = '<i class="fas fa-times"></i> Xóa tất cả';
    clearButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      selectAllCheckbox.indeterminate = false;
      updateGroupFilter();
    });

    const buttonContainer = document.getElementById("groupMultiSelectButton");
    buttonContainer.appendChild(clearButton);
  } catch (error) {
    console.error("Error fetching groups for multi-select:", error);
  }
};

const updateCostCenterFilter = () => {
  const checkboxes = document.querySelectorAll(
    '#costCenterMultiSelectDropdown input[type="checkbox"]:not(#selectAllCostCenters)',
  );
  const selectedCostCenters = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  state.currentCostCenterFilter = selectedCostCenters;

  const textElement = document.getElementById("costCenterMultiSelectText");
  const countElement = document.querySelector(".multi-select-selected-count");

  if (selectedCostCenters.length === 0) {
    textElement.textContent = "Tất cả";
    if (countElement) countElement.remove();
  } else if (selectedCostCenters.length === 1) {
    textElement.textContent = selectedCostCenters[0];
    if (countElement) countElement.remove();
  } else {
    textElement.textContent = `${selectedCostCenters.length} trạm đã chọn`;
    if (!countElement) {
      const countSpan = document.createElement("span");
      countSpan.className = "multi-select-selected-count";
      countSpan.textContent = `(${selectedCostCenters.length})`;
      textElement.parentNode.appendChild(countSpan);
    } else {
      countElement.textContent = `(${selectedCostCenters.length})`;
    }
  }

  state.currentPage = 1;
  fetchPurchasingDocuments();
};

const updateGroupFilter = () => {
  const checkboxes = document.querySelectorAll(
    '#groupMultiSelectDropdown input[type="checkbox"]:not(#selectAllGroups)',
  );
  const selectedGroups = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  state.currentGroupFilter = selectedGroups;

  const textElement = document.getElementById("groupMultiSelectText");
  const buttonContainer = document.getElementById("groupMultiSelectButton");
  const countElement = buttonContainer.querySelector(
    ".multi-select-selected-count",
  );

  if (selectedGroups.length === 0) {
    textElement.textContent = "Tất cả";
    if (countElement) countElement.remove();
  } else if (selectedGroups.length === 1) {
    textElement.textContent = selectedGroups[0];
    if (countElement) countElement.remove();
  } else {
    textElement.textContent = `${selectedGroups.length} nhóm đã chọn`;
    if (!countElement) {
      const countSpan = document.createElement("span");
      countSpan.className = "multi-select-selected-count";
      countSpan.textContent = `(${selectedGroups.length})`;
      textElement.parentNode.appendChild(countSpan);
    } else {
      countElement.textContent = `(${selectedGroups.length})`;
    }
  }

  state.currentPage = 1;
  fetchPurchasingDocuments();
};

const showMessage = (message, isError = false) => {
  const messageContainer = document.getElementById("messageContainer");

  if (messageContainer.timeoutId) {
    clearTimeout(messageContainer.timeoutId);
  }

  messageContainer.className = `message ${isError ? "error" : "success"}`;
  messageContainer.textContent = message;
  messageContainer.style.display = "block";

  void messageContainer.offsetWidth;
  messageContainer.classList.remove("hidden");

  messageContainer.timeoutId = setTimeout(() => {
    messageContainer.classList.add("hidden");
    setTimeout(() => {
      messageContainer.style.display = "none";
    }, 300);
  }, 5000);
};

const showLoading = (show) => {
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.style.display = show ? "flex" : "none";
};

const renderStatus = (status) => {
  switch (status) {
    case "Approved":
      return `<span class="status approved"><i class="fas fa-check-circle"></i> Đã phê duyệt</span>`;
    case "Suspended":
      return `<span class="status suspended"><i class="fas fa-ban"></i> Từ chối</span>`;
    default:
      return `<span class="status pending"><i class="fas fa-clock"></i> Chưa phê duyệt</span>`;
  }
};

const renderProducts = (products) => {
  if (!products || products.length === 0) return "-";

  return `
    <div class="products-table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th class="text-right">Đơn giá</th>
            <th class="text-right">Số lượng</th>
            <th class="text-right">VAT (%)</th>
            <th class="text-right">Thành tiền</th>
            <th class="text-right">Sau VAT</th>
            <th>Trạm</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (product) => `
            <tr>
              <td><strong>${product.productName}</strong></td>
              <td class="text-right">${product.costPerUnit.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</td>
              <td class="text-right">${product.amount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</td>
              <td class="text-right">${product.vat.toLocaleString("en-EN", { maximumFractionDigits: 5 }) || ""}</td>
              <td class="text-right">${product.totalCost.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</td>
              <td class="text-right">${
                product.totalCostAfterVat.toLocaleString("en-EN", {
                  maximumFractionDigits: 5,
                }) || ""
              }</td>
              <td>${product.costCenter || ""}</td>
              <td>${product.note || ""}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const renderFiles = (fileArray) => {
  if (!fileArray || fileArray.length === 0) return "-";

  return `
    <div class="file-array-container">
      ${fileArray
        .map(
          (file) => `
        <div class="file-item">
          <i class="fas fa-paperclip file-icon"></i>
          <a href="${file.link}" class="file-link" target="_blank">${file.name}</a>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
};

const renderProposals = (proposals) => {
  if (!proposals || proposals.length === 0) return "-";

  return `
    <div class="proposals-container">
      ${proposals
        .map(
          (proposal) => `
          <div>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
          <div class="proposal-item">
            <div><strong>Công việc:</strong> ${proposal.task}</div>
            <div><strong>Trạm:</strong> ${proposal.costCenter}</div>
            <div><strong>Nhóm:</strong> ${proposal.groupName}</div>
            <div><strong>Dự án:</strong> ${proposal.projectName || "Không có"}</div>
            <div><strong>Mô tả:</strong> ${proposal.detailsDescription}</div>
            <div><strong>Ngày nộp:</strong> ${proposal.submissionDate}</div>
            <div><strong>Người nộp:</strong> ${proposal.submittedBy?.username || "Không rõ"}</div>
            <div><strong>Trạng thái:</strong> ${proposal.status}</div>
            ${proposal.declaration ? `<div><strong>Kê khai:</strong> ${proposal.declaration}</div>` : ""}
            ${proposal.suspendReason ? `<div><strong>Lý do tạm dừng:</strong> ${proposal.suspendReason}</div>` : ""}
            ${proposal.fileMetadata && proposal.fileMetadata.length > 0 ? `<div><strong>Tệp đính kèm:</strong> ${renderFiles(proposal.fileMetadata)}</div>` : ""}            
            <div><strong>Đã phê duyệt bởi:</strong></div>
            <ul>
              ${proposal.approvedBy
                .map(
                  (approval) => `
                <li>
                  ${approval.username} - ${approval.approvalDate}
                </li>
              `,
                )
                .join("")}
            </ul>                        
        `,
        )
        .join("")}
    </div>
  `;
};

// TRANSFER HISTORY FUNCTIONS
const showTransferHistory = async (docId) => {
  try {
    const response = await fetch(`/getTransferStatus/${docId}`);
    const data = await response.json();

    if (data.success) {
      let historyHtml = `
        <div class="transfer-history-container">
          <div class="transfer-history-header">
            <i class="fas fa-chart-line"></i> Tình trạng nhập kho
          </div>
      `;

      data.transferStatus.forEach((status) => {
        const percentage =
          (status.transferredAmount / status.totalAmount) * 100;
        const isComplete = status.isComplete;

        historyHtml += `
          <div class="transfer-status-item ${isComplete ? "complete" : "incomplete"}">
            <div class="transfer-product-name">
              <strong><i class="fas fa-box"></i> ${status.productName}</strong>
              ${isComplete ? '<span class="complete-badge"><i class="fas fa-check-circle"></i> Hoàn thành</span>' : '<span class="incomplete-badge"><i class="fas fa-clock"></i> Chưa hoàn thành</span>'}
            </div>
            <div class="transfer-details">
              <div class="transfer-detail-row">
                <span><i class="fas fa-chart-simple"></i> Tiến độ:</span>
                <div class="progress-bar-container">
                  <div class="progress-bar" style="width: ${percentage}%"></div>
                  <span class="progress-text">${percentage.toFixed(1)}%</span>
                </div>
              </div>
              <div class="transfer-detail-row">
                <span><i class="fas fa-cubes"></i> Tổng số lượng:</span>
                <strong>${status.totalAmount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</strong>
              </div>
              <div class="transfer-detail-row">
                <span><i class="fas fa-arrow-down"></i> Đã nhập kho:</span>
                <strong class="text-success">${status.transferredAmount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</strong>
              </div>
              <div class="transfer-detail-row">
                <span><i class="fas fa-hourglass-half"></i> Còn lại:</span>
                <strong class="text-warning">${status.remainingAmount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</strong>
              </div>
            </div>
          </div>
        `;
      });

      if (data.allCompleted) {
        historyHtml += `
          <div class="transfer-complete-message">
            <i class="fas fa-trophy"></i> Tất cả sản phẩm đã được nhập kho đầy đủ!
          </div>
        `;
      }

      historyHtml += "</div>";

      const modalHTML = `
        <div id="transferHistoryModal" class="modal" style="display: block;">
          <div class="modal-content" style="max-width: 600px;">
            <span class="modal-close" onclick="closeTransferHistoryModal()">&times;</span>
            <h2 class="modal-title">
              <i class="fas fa-history"></i> 
              Lịch sử nhập kho
            </h2>
            <div class="modal-body">
              ${historyHtml}
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHTML);
    } else {
      showMessage("Error fetching transfer history", true);
    }
  } catch (error) {
    console.error("Error fetching transfer history:", error);
    showMessage("Error fetching transfer history", true);
  }
};

const closeTransferHistoryModal = () => {
  const modal = document.getElementById("transferHistoryModal");
  if (modal) {
    modal.remove();
  }
};

// STOCK MOVEMENT FUNCTIONS
const showMoveToStockModal = async (docId) => {
  try {
    const response = await fetch(`/getPurchasingDocument/${docId}`);
    const doc = await response.json();

    // First check transfer status to show remaining quantities
    const transferStatusResponse = await fetch(`/getTransferStatus/${docId}`);
    const transferData = await transferStatusResponse.json();

    stockMovementState.currentDocument = doc;
    stockMovementState.selectedProducts.clear();

    const modalHTML = `
            <div id="moveToStockModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 900px;">
                    <span class="modal-close" onclick="closeMoveToStockModal()">&times;</span>
                    <h2 class="modal-title">
                        <i class="fas fa-boxes"></i> 
                        Nhập kho - ${doc.name || doc.tag}
                    </h2>
                    <div class="modal-body">
                        <div class="info-banner">
                            <i class="fas fa-info-circle"></i> 
                            <strong>Hướng dẫn:</strong> Chọn sản phẩm và nhập số lượng thực tế nhập kho (có thể nhập một phần)
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <i class="fas fa-check-square"></i> 
                                Chọn sản phẩm để nhập kho:
                            </label>
                            <div id="productsToStockList" class="products-list">
                                ${renderProductsForStockSelection(doc.products, transferData.transferStatus)}
                            </div>
                        </div>
                        
                        <div class="form-actions" style="margin-top: 20px;">
                            <button onclick="confirmMoveToStock()" class="btn btn-primary">
                                <i class="fas fa-arrow-right"></i> Nhập kho
                            </button>
                            <button onclick="closeMoveToStockModal()" class="btn btn-secondary">
                                <i class="fas fa-times"></i> Hủy
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    const existingModal = document.getElementById("moveToStockModal");
    if (existingModal) {
      existingModal.remove();
    }

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    document.querySelectorAll(".product-stock-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const productItem = e.target.closest(".stock-product-item");
        const quantityInputDiv = productItem.querySelector(
          ".product-quantity-input",
        );
        const productName = e.target.getAttribute("data-product-name");

        if (e.target.checked) {
          quantityInputDiv.style.display = "block";
          stockMovementState.selectedProducts.add(productName);
        } else {
          quantityInputDiv.style.display = "none";
          stockMovementState.selectedProducts.delete(productName);
        }
      });
    });

    const selectAllCheckbox = document.getElementById("selectAllStockProducts");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", (e) => {
        const checkboxes = document.querySelectorAll(".product-stock-checkbox");
        checkboxes.forEach((checkbox) => {
          checkbox.checked = e.target.checked;
          const productItem = checkbox.closest(".stock-product-item");
          const quantityInputDiv = productItem.querySelector(
            ".product-quantity-input",
          );
          const productName = checkbox.getAttribute("data-product-name");

          if (e.target.checked) {
            quantityInputDiv.style.display = "block";
            stockMovementState.selectedProducts.add(productName);
          } else {
            quantityInputDiv.style.display = "none";
            stockMovementState.selectedProducts.delete(productName);
          }
        });
      });
    }

    document.querySelectorAll(".quantity-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const max = parseInt(e.target.getAttribute("max"));
        let value = parseInt(e.target.value);

        if (isNaN(value) || value < 1) {
          e.target.value = 1;
        } else if (value > max) {
          e.target.value = max;
          showMessage(
            `Số lượng nhập kho không thể vượt quá ${max.toLocaleString("en-EN", { maximumFractionDigits: 5 })}`,
            true,
          );
        }
      });
    });
  } catch (error) {
    console.error("Error showing move to stock modal:", error);
    showMessage("Error loading products for stock movement", true);
  }
};

const renderProductsForStockSelection = (products, transferStatus = null) => {
  if (!products || products.length === 0) {
    return '<p class="text-muted">Không có sản phẩm nào trong phiếu này</p>';
  }

  return `
        <div class="stock-products-container">
            <div class="stock-header">
                <label class="select-all-stock">
                    <input type="checkbox" id="selectAllStockProducts">
                    <span><strong>Chọn tất cả</strong></span>
                </label>
            </div>
            ${products
              .map((product, index) => {
                // Get transferred amount if available
                let transferredAmount = 0;
                let remainingAmount = product.amount;
                if (transferStatus) {
                  const status = transferStatus.find(
                    (s) => s.productName === product.productName,
                  );
                  if (status) {
                    transferredAmount = status.transferredAmount;
                    remainingAmount = status.remainingAmount;
                  }
                }

                const isFullyTransferred = remainingAmount === 0;

                return `
                <div class="stock-product-item ${isFullyTransferred ? "fully-transferred" : ""}" data-product-index="${index}">
                    <div class="product-stock-header">
                        <label class="product-stock-label">
                            <input type="checkbox" 
                                   class="product-stock-checkbox" 
                                   data-product-name="${product.productName.replace(/"/g, "&quot;")}"
                                   data-product-index="${index}"
                                   ${isFullyTransferred ? "disabled" : ""}>
                            <div class="product-stock-info">
                                <strong>${product.productName}</strong>
                                <div class="product-stock-details">
                                    <span><i class="fas fa-cubes"></i> Tổng số lượng: ${product.amount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</span>
                                    ${transferredAmount > 0 ? `<span><i class="fas fa-check-circle"></i> Đã nhập: ${transferredAmount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</span>` : ""}
                                    ${remainingAmount > 0 && remainingAmount < product.amount ? `<span><i class="fas fa-hourglass-half"></i> Còn lại: ${remainingAmount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}</span>` : ""}
                                    <span><i class="fas fa-map-marker-alt"></i> Trạm: ${product.costCenter || "Chưa có"}</span>
                                    <span><i class="fas fa-dollar-sign"></i> Đơn giá: ${product.costPerUnit.toLocaleString("en-EN", { maximumFractionDigits: 5 })} đ</span>
                                    <span><i class="fas fa-percent"></i> VAT: ${product.vat || 0}%</span>
                                </div>
                                ${isFullyTransferred ? '<div class="fully-transferred-badge"><i class="fas fa-check-circle"></i> Đã nhập đủ</div>' : ""}
                            </div>
                        </label>
                    </div>
                    ${
                      !isFullyTransferred
                        ? `
                    <div class="product-quantity-input" style="display: none; margin-top: 10px; margin-left: 30px;">
                        <label style="display: flex; align-items: center; gap: 10px;">
                            <span><i class="fas fa-box"></i> Số lượng nhập kho:</span>
                            <input type="number" 
                                   class="quantity-input" 
                                   data-product-name="${product.productName.replace(/"/g, "&quot;")}"
                                   min="1" 
                                   max="${remainingAmount}" 
                                   step="1"
                                   value="${remainingAmount}"
                                   style="width: 150px; padding: 5px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                            <span class="remaining-quantity">(Tối đa: ${remainingAmount.toLocaleString("en-EN", { maximumFractionDigits: 5 })})</span>
                        </label>
                    </div>
                    `
                        : ""
                    }
                </div>
            `;
              })
              .join("")}
        </div>
    `;
};

const confirmMoveToStock = async () => {
  if (stockMovementState.selectedProducts.size === 0) {
    showMessage("Vui lòng chọn ít nhất một sản phẩm để nhập kho", true);
    return;
  }

  const selectedProductsArrayFinal = [];

  // Debug: Log selected products
  console.log(
    "Selected products:",
    Array.from(stockMovementState.selectedProducts),
  );

  for (const productName of stockMovementState.selectedProducts) {
    const product = stockMovementState.currentDocument.products.find(
      (p) => p.productName === productName,
    );

    if (product) {
      // Find the quantity input for this product - use more reliable method
      let quantityToMove = product.amount; // Default to full amount

      // Find all quantity inputs and find the one for this product
      const allQuantityInputs = document.querySelectorAll(".quantity-input");
      console.log(`Found ${allQuantityInputs.length} quantity inputs`);

      for (let input of allQuantityInputs) {
        const inputProductName = input.getAttribute("data-product-name");
        console.log(
          `Checking input for: ${inputProductName}, looking for: ${productName}`,
        );

        if (inputProductName === productName) {
          const inputValue = parseInt(input.value);
          console.log(
            `Found matching input for ${productName}, value: ${inputValue}`,
          );

          if (!isNaN(inputValue) && inputValue > 0) {
            quantityToMove = inputValue;
          }
          break;
        }
      }

      // Ensure we don't exceed available amount
      if (quantityToMove > product.amount) {
        quantityToMove = product.amount;
      }

      console.log(
        `Product: ${productName}, Full amount: ${product.amount}, Moving: ${quantityToMove}`,
      );

      selectedProductsArrayFinal.push({
        productName: product.productName,
        amount: quantityToMove,
        costPerUnit: product.costPerUnit,
        costCenter:
          product.costCenter || stockMovementState.currentDocument.costCenter,
        vat: product.vat || 0,
      });
    } else {
      console.error(`Product not found: ${productName}`);
    }
  }

  if (selectedProductsArrayFinal.length === 0) {
    showMessage("Không tìm thấy sản phẩm nào được chọn", true);
    return;
  }

  // Check if any product has partial transfer (amount < original)
  const hasPartialTransfer = selectedProductsArrayFinal.some((p) => {
    const originalProduct = stockMovementState.currentDocument.products.find(
      (op) => op.productName === p.productName,
    );
    return p.amount < originalProduct.amount;
  });

  // Build confirmation message
  let confirmMessage = `Xác nhận nhập kho\n\n`;
  confirmMessage += `Bạn có chắc chắn muốn nhập kho ${selectedProductsArrayFinal.length} sản phẩm?\n\n`;
  confirmMessage += selectedProductsArrayFinal
    .map((p) => {
      const originalProduct = stockMovementState.currentDocument.products.find(
        (op) => op.productName === p.productName,
      );
      const isPartial = p.amount < originalProduct.amount;
      const partialText = isPartial
        ? ` (⚠️ NHẬP MỘT PHẦN: ${p.amount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}/${originalProduct.amount.toLocaleString("en-EN", { maximumFractionDigits: 5 })})`
        : "";
      return `• ${p.productName}: ${p.amount.toLocaleString("en-EN", { maximumFractionDigits: 5 })}${partialText}`;
    })
    .join("\n");

  if (hasPartialTransfer) {
    confirmMessage += "\n\n⚠️ LƯU Ý: Một số sản phẩm sẽ được nhập một phần!";
  }

  if (!confirm(confirmMessage)) {
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(
      `/moveProductsToItemStock/${stockMovementState.currentDocument._id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedProducts: selectedProductsArrayFinal,
        }),
      },
    );

    const result = await response.json();

    if (result.success) {
      let message = result.message;
      if (result.results && result.results.length > 0) {
        message += "\n\n✅ Chi tiết thành công:\n";
        result.results.forEach((r) => {
          message += `• ${r.productName}: ${r.oldStock.toLocaleString("en-EN", { maximumFractionDigits: 5 })} → ${r.newStock.toLocaleString("en-EN", { maximumFractionDigits: 5 })} (Nhập: ${r.amountMoved.toLocaleString("en-EN", { maximumFractionDigits: 5 })})\n`;
          if (r.remainingToMove > 0) {
            message += `  ⏳ Còn lại: ${r.remainingToMove.toLocaleString("en-EN", { maximumFractionDigits: 5 })}\n`;
          }
        });
      }
      if (result.errors && result.errors.length > 0) {
        message +=
          "\n\n⚠️ Lỗi:\n" + result.errors.map((e) => `• ${e}`).join("\n");
      }

      if (!result.allTransferred) {
        message +=
          "\n\n💡 Gợi ý: Một số sản phẩm còn tồn lại. Bạn có thể nhập kho phần còn lại sau.";
      }

      showMessage(message, false);
      closeMoveToStockModal();
      fetchPurchasingDocuments();
    } else {
      showMessage(result.message || "Lỗi khi nhập kho", true);
    }
  } catch (error) {
    console.error("Error moving products to stock:", error);
    showMessage("Lỗi khi nhập kho: " + error.message, true);
  } finally {
    showLoading(false);
  }
};

const closeMoveToStockModal = () => {
  const modal = document.getElementById("moveToStockModal");
  if (modal) {
    modal.style.display = "none";
    setTimeout(() => modal.remove(), 300);
  }
  stockMovementState.selectedProducts.clear();
};

// Data fetching
const fetchCurrentUser = async () => {
  try {
    const response = await fetch("/getCurrentUser");
    state.currentUser = await response.json();
  } catch (error) {
    console.error("Error fetching current user:", error);
  }
};

const fetchPurchasingDocuments = async () => {
  showLoading(true);

  try {
    const response = await fetch("/getPurchasingDocumentForSeparatedView");
    const data = await response.json();
    state.purchasingDocuments = data.purchasingDocuments;

    const filteredDocuments = filterDocumentsForCurrentUser(
      state.purchasingDocuments,
    );
    state.totalPages = Math.ceil(filteredDocuments.length / state.itemsPerPage);

    if (state.currentPage > state.totalPages) {
      state.currentPage = state.totalPages;
    }
    if (state.currentPage < 1) {
      state.currentPage = 1;
    }

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const pageDocuments = state.paginationEnabled
      ? filteredDocuments.slice(startIndex, endIndex)
      : filteredDocuments;

    renderDocumentsTable(pageDocuments);
    updateSummary(filteredDocuments);

    if (state.paginationEnabled) {
      renderPagination();
    } else {
      removePagination();
    }
  } catch (err) {
    console.error("Error fetching purchasing documents:", err);
    showMessage("Error fetching purchasing documents", true);
  } finally {
    showLoading(false);
  }
};

const filterDocumentsForCurrentUser = (documents) => {
  let filteredDocs = [...documents];

  if (state.showOnlyPendingApprovals && state.currentUser) {
    filteredDocs = filteredDocs.filter((doc) => {
      const isRequiredApprover = doc.approvers.some(
        (approver) => approver.username === state.currentUser.username,
      );
      const hasNotApprovedYet = !doc.approvedBy.some(
        (approved) => approved.username === state.currentUser.username,
      );
      return isRequiredApprover && hasNotApprovedYet;
    });
  }

  if (state.nameFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      doc.name?.toLowerCase().includes(state.nameFilter),
    );
  }

  if (state.currentCostCenterFilter.length > 0) {
    filteredDocs = filteredDocs.filter((doc) =>
      state.currentCostCenterFilter.includes(doc.costCenter),
    );
  }

  if (state.currentGroupFilter.length > 0) {
    filteredDocs = filteredDocs.filter((doc) =>
      state.currentGroupFilter.includes(doc.groupName),
    );
  }

  if (state.currentTotalCostFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      isInTotalCostRange(
        doc.grandTotalCost,
        state.currentTotalCostFilter,
        state.customTotalCostRange,
      ),
    );
  }

  if (state.currentDateFilter) {
    filteredDocs = filteredDocs.filter((doc) =>
      isDateInRange(
        doc.submissionDate,
        state.currentDateFilter,
        state.customDateRange,
      ),
    );
  }

  return filteredDocs;
};

const renderDocumentsTable = (documents) => {
  const tableBody = document
    .getElementById("purchasingDocumentsTable")
    .querySelector("tbody");
  tableBody.innerHTML = "";

  documents.forEach((doc) => {
    const approvalStatus = doc.approvers
      .map((approver) => {
        const hasApproved = doc.approvedBy.find(
          (a) => a.username === approver.username,
        );
        return `
          <div class="approver-item">
            <span class="status-icon ${hasApproved ? "status-approved" : "status-pending"}"></span>
            <div>
              <div>${approver.username} (${approver.subRole})</div>
              ${hasApproved ? `<div class="approval-date">Đã phê duyệt vào: ${hasApproved.approvalDate}</div>` : '<div class="approval-date">Chưa phê duyệt</div>'}
            </div>
          </div>
        `;
      })
      .join("");

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="doc-checkbox" data-doc-id="${doc._id}" ${state.selectedDocuments.has(doc._id) ? "checked" : ""}></td>
      <td>${doc.name ? doc.name : ""}</td>
      <td>${doc.costCenter ? doc.costCenter : ""}</td>
      <td>${doc.groupName ? doc.groupName : ""}</td>               
      <td>
        ${renderProducts(doc.products)} 
        ${doc.declaration ? `<div class="declaration"><strong>Kê khai:</strong> ${doc.declaration}</div>` : ""}
        ${doc.suspendReason ? `<div class="suspend-reason"><strong>Lý do từ chối:</strong> ${doc.suspendReason}</div>` : ""}
      </td>
      <td>${renderFiles(doc.fileMetadata)}</td>
      <td>${doc.grandTotalCost?.toLocaleString("en-EN", { maximumFractionDigits: 5 }) || "-"}</td>
      <td>${renderProposals(doc.appendedProposals)}</td>
      <td>${renderStatus(doc.status)}</td>
      <td class="approval-status">${approvalStatus}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-primary btn-sm" onclick="showFullView('${doc._id}')">
            <i class="fas fa-eye"></i> Xem
          </button>
          <form action="/exportDocumentToDocx/${doc._id}" method="GET" style="display:inline;">
            <button class="btn btn-primary btn-sm">
              <i class="fas fa-file-word"></i> Xuất DOCX
            </button>
          </form>
          ${
            doc.approvedBy.length === 0
              ? `
            <button class="btn btn-primary btn-sm" onclick="editDocument('${doc._id}')">
              <i class="fas fa-edit"></i> Sửa
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteDocument('${doc._id}')">
              <i class="fas fa-trash"></i> Xóa
            </button>
          `
              : ""
          }
          ${
            doc.status === "Pending"
              ? `
            <button class="btn btn-primary btn-sm" onclick="approveDocument('${doc._id}')">
              <i class="fas fa-check"></i> Phê duyệt
            </button>
          `
              : ""
          }
          ${
            doc.status === "Approved"
              ? `
            <button class="btn btn-primary btn-sm" onclick="editDeclaration('${doc._id}')">
              <i class="fas fa-edit"></i> Kê khai
            </button>
            <button class="btn btn-success btn-sm" onclick="showMoveToStockModal('${doc._id}')">
              <i class="fas fa-boxes"></i> Nhập kho
            </button>
            <button class="btn btn-info btn-sm" onclick="showTransferHistory('${doc._id}')">
              <i class="fas fa-history"></i> Lịch sử nhập
            </button>
          `
              : ""
          }
          ${
            doc.status === "Suspended"
              ? `
            <button class="btn btn-primary btn-sm" onclick="openDocument('${doc._id}')">
              <i class="fas fa-lock-open"></i> Mở
            </button>
          `
              : `
            <button class="btn btn-danger btn-sm" onclick="suspendDocument('${doc._id}')">
              <i class="fas fa-ban"></i> Từ chối
            </button>
          `
          }
          <button class="btn btn-secondary btn-sm" onclick="showDocumentsContainingPurchasing('${doc._id}')">
            <i class="fas fa-link"></i> Liên quan
          </button>
        </div>
       </td>
    `;
    tableBody.appendChild(row);
  });

  updateSelectAllCheckbox();
};

const updateSummary = (filteredDocuments) => {
  const approvedDocs = filteredDocuments.filter(
    (doc) => doc.status === "Approved",
  );
  const unapprovedDocs = filteredDocuments.filter(
    (doc) => doc.status === "Pending",
  );

  const approvedSum = approvedDocs.reduce(
    (sum, doc) => sum + (doc.grandTotalCost || 0),
    0,
  );
  const unapprovedSum = unapprovedDocs.reduce(
    (sum, doc) => sum + (doc.grandTotalCost || 0),
    0,
  );

  document.getElementById("approvedSum").textContent =
    approvedSum.toLocaleString("en-EN", { maximumFractionDigits: 5 });
  document.getElementById("unapprovedSum").textContent =
    unapprovedSum.toLocaleString("en-EN", { maximumFractionDigits: 5 });
  document.getElementById("approvedDocument").textContent =
    approvedDocs.length.toLocaleString("en-EN", { maximumFractionDigits: 5 });
  document.getElementById("unapprovedDocument").textContent =
    unapprovedDocs.length.toLocaleString("en-EN", {
      maximumFractionDigits: 20,
    });
};

const renderPagination = () => {
  let paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer) {
    const table = document.querySelector("table");
    paginationContainer = document.createElement("div");
    paginationContainer.id = "paginationContainer";
    paginationContainer.className = "pagination-container";
    table.parentNode.insertBefore(paginationContainer, table.nextSibling);
  }

  if (state.totalPages > 1) {
    paginationContainer.innerHTML = `
      <div class="pagination">
        <button onclick="changePage(1)" ${state.currentPage === 1 ? "disabled" : ""}>
          <i class="fas fa-angle-double-left"></i> Trang đầu
        </button>
        <button onclick="changePage(${state.currentPage - 1})" ${state.currentPage === 1 ? "disabled" : ""}>
          <i class="fas fa-angle-left"></i> Trang trước
        </button>
        <span class="page-info">Trang ${state.currentPage} / ${state.totalPages}</span>
        <div class="go-to-page">
          <span>Đến trang:</span>
          <input type="number" class="page-input" id="pageInput" min="1" max="${state.totalPages}" value="${state.currentPage}">
          <button onclick="goToPage()">Đi</button>
        </div>
        <button onclick="changePage(${state.currentPage + 1})" ${state.currentPage === state.totalPages ? "disabled" : ""}>
          Trang tiếp <i class="fas fa-angle-right"></i>
        </button>
        <button onclick="changePage(${state.totalPages})" ${state.currentPage === state.totalPages ? "disabled" : ""}>
          Trang cuối <i class="fas fa-angle-double-right"></i>
        </button>
      </div>
    `;
  } else {
    paginationContainer.innerHTML = "";
  }
};

const removePagination = () => {
  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) {
    paginationContainer.innerHTML = "";
  }
};

const goToPage = () => {
  const pageInput = document.getElementById("pageInput");
  if (!pageInput) return;

  const pageNumber = parseInt(pageInput.value);
  if (
    !isNaN(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= state.totalPages &&
    pageNumber !== state.currentPage
  ) {
    changePage(pageNumber);
  } else {
    pageInput.value = state.currentPage;
  }
};

const changePage = (newPage) => {
  if (
    newPage >= 1 &&
    newPage <= state.totalPages &&
    newPage !== state.currentPage
  ) {
    state.currentPage = newPage;
    fetchPurchasingDocuments();
    document.querySelector("table").scrollIntoView({ behavior: "smooth" });
  }
};

// Document actions
const approveDocument = async (documentId) => {
  try {
    const response = await fetch(`/approveDocument/${documentId}`, {
      method: "POST",
    });
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error approving document:", err);
    showMessage("Error approving document", true);
  }
};

const deleteDocument = async (documentId) => {
  if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này?")) return;
  try {
    const response = await fetch(`/deleteDocument/${documentId}`, {
      method: "POST",
    });
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error deleting document:", err);
    showMessage("Error deleting document", true);
  }
};

const suspendDocument = (docId) => {
  document.getElementById("suspendModal").style.display = "block";
  document.getElementById("suspendForm").dataset.docId = docId;
};

const closeSuspendModal = () => {
  document.getElementById("suspendModal").style.display = "none";
  document.getElementById("suspendForm").reset();
};

const handleSuspendSubmit = async (event) => {
  event.preventDefault();
  const docId = event.target.dataset.docId;
  const suspendReason = document.getElementById("suspendReason").value;
  try {
    const response = await fetch(`/suspendPurchasingDocument/${docId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspendReason }),
    });
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      closeSuspendModal();
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error suspending document:", err);
    showMessage("Lỗi khi tạm dừng tài liệu.", true);
  }
};

const openDocument = async (docId) => {
  try {
    const response = await fetch(`/openPurchasingDocument/${docId}`, {
      method: "POST",
    });
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error reopening document:", err);
    showMessage("Lỗi khi mở lại tài liệu.", true);
  }
};

const editDeclaration = (docId) => {
  const existingModal = document.getElementById("declarationModal");
  if (existingModal) existingModal.remove();

  const doc = state.purchasingDocuments.find((d) => d._id === docId);
  if (!doc) return;

  const modalHTML = `
    <div id="declarationModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeDeclarationModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Kê Khai - ${doc.tag || doc.name}</h2>
        <div class="modal-body">
          <div class="form-group">
            <textarea id="declarationInput" class="form-textarea">${doc.declaration || ""}</textarea>
          </div>
          <div class="form-actions">
            <button onclick="saveDeclaration('${docId}')" class="btn btn-primary"><i class="fas fa-save"></i> Lưu kê khai</button>
            <button onclick="closeDeclarationModal()" class="btn btn-secondary"><i class="fas fa-times"></i> Hủy</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);
  document.getElementById("declarationModal").style.display = "block";
  document.getElementById("declarationInput").focus();
};

const closeDeclarationModal = () => {
  const modal = document.getElementById("declarationModal");
  if (modal) {
    modal.style.display = "none";
    setTimeout(() => modal.remove(), 300);
  }
};

const saveDeclaration = async (docId) => {
  const declaration = document.getElementById("declarationInput").value;
  try {
    const response = await fetch(
      `/updatePurchasingDocumentDeclaration/${docId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declaration }),
      },
    );
    const message = await response.text();
    if (response.ok) {
      showMessage(message);
      closeDeclarationModal();
      fetchPurchasingDocuments();
    } else {
      showMessage(message, true);
    }
  } catch (err) {
    console.error("Error updating declaration:", err);
    showMessage("Error updating declaration", true);
  }
};

const showFullView = (docId) => {
  try {
    const doc = state.purchasingDocuments.find((d) => d._id === docId);
    if (!doc) throw new Error("Document not found");

    const fullViewContent = document.getElementById("fullViewContent");
    const submissionDate = doc.submissionDate || "Không có";

    fullViewContent.innerHTML = `
      <div class="full-view-section">
        <h3><i class="fas fa-info-circle"></i> Thông tin cơ bản</h3>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Tên:</span><span class="detail-value">${doc.name}</span></div>
          <div class="detail-item"><span class="detail-label">Trạm:</span><span class="detail-value">${doc.costCenter}</span></div>
          <div class="detail-item"><span class="detail-label">Nhóm:</span><span class="detail-value">${doc.groupName || "Không có"}</span></div>
          <div class="detail-item"><span class="detail-label">Người nộp:</span><span class="detail-value">${doc.submittedBy?.username || "Không rõ"}</span></div>
          <div class="detail-item"><span class="detail-label">Ngày nộp:</span><span class="detail-value">${submissionDate}</span></div>
          <div class="detail-item"><span class="detail-label">Kê khai:</span><span class="detail-value">${doc.declaration || "Không có"}</span></div>
        </div>
      </div>
      <div class="full-view-section"><h3><i class="fas fa-boxes"></i> Sản phẩm</h3>${renderProducts(doc.products)}</div>
      <div class="full-view-section"><h3><i class="fas fa-paperclip"></i> Tệp tin kèm theo</h3>${renderFiles(doc.fileMetadata)}</div>
      <div class="full-view-section"><h3><i class="fas fa-file-alt"></i> Phiếu đề xuất kèm theo</h3>${renderProposals(doc.appendedProposals)}</div>
      <div class="full-view-section">
        <h3><i class="fas fa-tasks"></i> Trạng thái</h3>
        <div class="detail-grid"><div class="detail-item"><span class="detail-label">Tình trạng:</span><span class="detail-value">${renderStatus(doc.status)}</span></div></div>
        <div class="approval-section"><h4><i class="fas fa-user-check"></i> Trạng thái phê duyệt:</h4><div class="approval-status">${doc.approvers
          .map((approver) => {
            const hasApproved = doc.approvedBy.find(
              (a) => a.username === approver.username,
            );
            return `<div class="approver-item"><span class="status-icon ${hasApproved ? "status-approved" : "status-pending"}"></span><div><div>${approver.username} (${approver.subRole})</div>${hasApproved ? `<div class="approval-date"><i class="fas fa-calendar-check"></i> Đã phê duyệt vào: ${hasApproved.approvalDate}</div>` : '<div class="approval-date"><i class="fas fa-clock"></i> Chưa phê duyệt</div>'}</div></div>`;
          })
          .join("")}</div></div>
      </div>
    `;
    document.getElementById("fullViewModal").style.display = "block";
  } catch (err) {
    console.error("Error showing full view:", err);
    showMessage("Error loading full document details", true);
  }
};

const closeFullViewModal = () => {
  document.getElementById("fullViewModal").style.display = "none";
};

// Edit Document Functions
const addEditModal = () => {
  const modalHTML = `
    <div id="editModal" class="modal">
      <div class="modal-content">
        <span class="modal-close" onclick="closeEditModal()">&times;</span>
        <h2 class="modal-title"><i class="fas fa-edit"></i> Chỉnh sửa phiếu mua hàng</h2>
        <div class="modal-body">
          <form id="editForm" onsubmit="handleEditSubmit(event)" class="modal-form" enctype="multipart/form-data">
            <input type="hidden" id="editDocId">
            
            <div class="form-group">
              <label for="editName" class="form-label">Tên:</label>
              <input type="text" id="editName" required class="form-input">
            </div>
            
            <div class="form-group">
              <label for="editCostCenter" class="form-label">Trạm:</label>
              <select id="editCostCenter" required class="form-select">
                <option value="">Chọn một trạm</option>
              </select>
            </div>

            <div class="form-group">
              <label for="editGroupName" class="form-label">Nhóm:</label>
              <select id="editGroupName" required class="form-select">
                <option value="">Chọn một nhóm</option>
              </select>
            </div>            

            <div class="form-group">
              <label class="form-label">Sản phẩm:</label>
              <div id="productsList" class="products-list"></div>
              <button type="button" class="btn btn-primary" onclick="addProductField()">
                <i class="fas fa-plus"></i> Thêm sản phẩm
              </button>
            </div>
            
            <div class="form-group">
              <label class="form-label">Tệp tin hiện tại:</label>
              <div id="currentFilesList" class="files-list"></div>
            </div>
            
            <div class="form-group">
              <label for="editFiles" class="form-label">Thêm tệp tin mới:</label>
              <input type="file" id="editFiles" class="form-input" multiple>
              <small class="form-text">Có thể chọn nhiều tệp tin</small>
            </div>
            
            <div class="form-group">
              <label class="form-label">Phiếu đề xuất đã gắn kèm:</label>
              <div id="currentAppendedProposalsList" class="proposals-list"></div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Thêm phiếu đề xuất:</label>
              <select id="newProposalsDropdown" class="form-select">
                <option value="">Chọn phiếu đề xuất</option>
              </select>
              <button type="button" class="btn btn-primary" onclick="addNewProposal()" style="margin-top: var(--space-sm);">
                <i class="fas fa-plus"></i> Thêm phiếu đề xuất
              </button>
            </div>
            
            <div class="form-group">
              <label class="form-label">Người phê duyệt hiện tại:</label>
              <div id="currentApproversList" class="approvers-list"></div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Thêm người phê duyệt:</label>
              <select id="newApproversDropdown" class="form-select">
                <option value="">Chọn người phê duyệt</option>
              </select>
              <input type="text" id="newApproverSubRole" placeholder="Vai trò" class="form-input" style="margin-top: var(--space-sm);">
              <button type="button" class="btn btn-primary" onclick="addNewApprover()" style="margin-top: var(--space-sm);">
                <i class="fas fa-plus"></i> Thêm
              </button>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> Lưu thay đổi
              </button>
              <button type="button" class="btn btn-secondary" onclick="closeEditModal()">
                <i class="fas fa-times"></i> Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);
};

const fetchProducts = async () => {
  try {
    const response = await fetch("/documentProduct");
    const products = await response.json();
    return products;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách sản phẩm:", error);
    return [];
  }
};

const addProductField = async (product = null) => {
  const productsList = document.getElementById("productsList");
  const productDiv = document.createElement("div");
  productDiv.className = "product-item";

  const fieldsContainer = document.createElement("div");
  fieldsContainer.className = "product-fields";
  productDiv.appendChild(fieldsContainer);

  const productDropdown = document.createElement("select");
  const uniqueId = `product-select-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  productDropdown.id = uniqueId;
  productDropdown.className = "form-select product-select";
  productDropdown.removeAttribute("required");

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Chọn sản phẩm";
  productDropdown.appendChild(defaultOption);

  let fallbackToInput = false;
  let selectedProductName = product?.productName;

  try {
    const products = await fetchProducts();
    products.forEach((prod) => {
      const option = document.createElement("option");
      option.value = prod.name;
      option.textContent = `${prod.name} (${prod.code})`;
      productDropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading products:", error);
    fallbackToInput = true;
  }

  const costInput = document.createElement("input");
  costInput.type = "number";
  costInput.placeholder = "Đơn giá";
  costInput.value = product?.costPerUnit || "";
  costInput.required = true;
  costInput.step = "any";
  costInput.className = "form-input";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.placeholder = "Số lượng";
  amountInput.value = product?.amount || "";
  amountInput.required = true;
  amountInput.step = "any";
  amountInput.className = "form-input";

  const vatInput = document.createElement("input");
  vatInput.type = "number";
  vatInput.placeholder = "VAT(%)";
  vatInput.value = product?.vat !== undefined ? product.vat : "";
  vatInput.required = true;
  vatInput.step = "any";
  vatInput.className = "form-input";

  const costCenterSelect = document.createElement("select");
  costCenterSelect.className = "product-cost-center form-select";

  const defaultCenterOption = document.createElement("option");
  defaultCenterOption.value = "";
  defaultCenterOption.textContent = "Chọn trạm";
  costCenterSelect.appendChild(defaultCenterOption);

  if (state.costCenters) {
    state.costCenters.forEach((center) => {
      const option = document.createElement("option");
      option.value = center.name;
      option.textContent = center.name;
      if (product?.costCenter === center.name) {
        option.selected = true;
      }
      costCenterSelect.appendChild(option);
    });
  }

  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.placeholder = "Ghi chú";
  noteInput.value = product?.note || "";
  noteInput.className = "form-input";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "btn btn-danger btn-sm";
  removeButton.innerHTML = '<i class="fas fa-trash"></i> Xóa';
  removeButton.onclick = function () {
    const productSelect =
      this.parentElement.parentElement.querySelector(".product-select");
    if (productSelect && productSelect._choices) {
      productSelect._choices.destroy();
    }
    this.parentElement.parentElement.remove();
  };

  if (fallbackToInput) {
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Tên sản phẩm";
    nameInput.value = product?.productName || "";
    nameInput.required = true;
    nameInput.className = "form-input";
    fieldsContainer.appendChild(nameInput);
  } else {
    if (selectedProductName) {
      productDropdown.value = selectedProductName;
    }
    fieldsContainer.appendChild(productDropdown);
  }

  fieldsContainer.appendChild(costInput);
  fieldsContainer.appendChild(amountInput);
  fieldsContainer.appendChild(vatInput);
  fieldsContainer.appendChild(costCenterSelect);
  fieldsContainer.appendChild(noteInput);
  fieldsContainer.appendChild(removeButton);

  productsList.appendChild(productDiv);

  if (!fallbackToInput) {
    setTimeout(() => {
      const choices = new Choices(`#${uniqueId}`, {
        searchEnabled: true,
        searchPlaceholderValue: "Tìm kiếm sản phẩm...",
        noResultsText: "Không tìm thấy sản phẩm",
        itemSelectText: "Nhấn để chọn",
        shouldSort: false,
        searchResultLimit: 50,
        removeItemButton: false,
        placeholder: true,
        placeholderValue: "Chọn sản phẩm",
      });
      productDropdown._choices = choices;
      if (selectedProductName) {
        choices.setChoiceByValue(selectedProductName);
      }
    }, 0);
  }
};

const populateCostCenterDropdownForEditing = async () => {
  try {
    const response = await fetch("/costCenters");
    const costCenters = await response.json();
    const dropdown = document.getElementById("editCostCenter");
    dropdown.innerHTML = '<option value="">Chọn một trạm</option>';
    costCenters.forEach((center) => {
      const option = document.createElement("option");
      option.value = center.name;
      option.textContent = center.name;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching cost centers:", error);
  }
};

const populateGroupDropdownForEditing = async () => {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    const dropdown = document.getElementById("editGroupName");
    dropdown.innerHTML = '<option value="">Chọn một nhóm</option>';
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.name;
      option.textContent = group.name;
      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
  }
};

const fetchApprovers = async () => {
  try {
    const response = await fetch("/approvers");
    return await response.json();
  } catch (error) {
    console.error("Error fetching approvers:", error);
    return [];
  }
};

const renderCurrentApprovers = () => {
  const currentApproversList = document.getElementById("currentApproversList");
  currentApproversList.innerHTML = state.currentApprovers
    .map(
      (approver) => `
    <div class="approver-item">
      <span>${approver.username}</span>
      <input type="text" value="${approver.subRole}" onchange="updateApproverSubRole('${approver._id}', this.value)" class="form-input" style="width: 120px;">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeApprover('${approver._id}')">
        <i class="fas fa-trash"></i> Xóa
      </button>
    </div>
  `,
    )
    .join("");
};

const updateApproverSubRole = (approverId, newSubRole) => {
  const approver = state.currentApprovers.find(
    (a) => a.approver === approverId,
  );
  if (approver) {
    approver.subRole = newSubRole;
  }
};

const removeApprover = (approverId) => {
  state.currentApprovers = state.currentApprovers.filter(
    (a) => a._id !== approverId,
  );
  renderCurrentApprovers();
  populateNewApproversDropdown();
};

const populateNewApproversDropdown = async () => {
  const allApprovers = await fetchApprovers();
  const availableApprovers = allApprovers.filter(
    (approver) =>
      !state.currentApprovers.some((a) => a.approver === approver._id),
  );
  const dropdown = document.getElementById("newApproversDropdown");
  dropdown.innerHTML = `<option value="">Chọn người phê duyệt</option>${availableApprovers.map((approver) => `<option value="${approver._id}">${approver.username}</option>`).join("")}`;
};

const addNewApprover = () => {
  const newApproverId = document.getElementById("newApproversDropdown").value;
  const newSubRole = document.getElementById("newApproverSubRole").value;
  if (!newApproverId || !newSubRole) {
    showMessage("Vui lòng chọn người phê duyệt và nhập vai trò phụ.", true);
    return;
  }
  const newApprover = {
    approver: newApproverId,
    username: document
      .getElementById("newApproversDropdown")
      .selectedOptions[0].text.split(" (")[0],
    subRole: newSubRole,
  };
  state.currentApprovers.push(newApprover);
  renderCurrentApprovers();
  populateNewApproversDropdown();
  document.getElementById("newApproversDropdown").value = "";
  document.getElementById("newApproverSubRole").value = "";
};

const renderCurrentFiles = (files, docId) => {
  const currentFilesList = document.getElementById("currentFilesList");
  if (!files || files.length === 0) {
    currentFilesList.innerHTML =
      '<p class="text-muted">Không có tệp tin nào</p>';
    return;
  }
  currentFilesList.innerHTML = files
    .map(
      (file) => `
    <div class="file-item" data-file-id="${file._id || file.driveFileId}">
      <i class="fas fa-paperclip file-icon"></i>
      <a href="${file.link}" class="file-link" target="_blank">${file.name}</a>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeCurrentFile('${file._id || file.driveFileId}', '${docId}')">
        <i class="fas fa-trash"></i> Xóa
      </button>
    </div>
  `,
    )
    .join("");
};

const removeCurrentFile = async (fileId, docId) => {
  if (!confirm("Bạn có chắc chắn muốn xóa tệp tin này?")) return;
  try {
    const response = await fetch(
      `/deletePurchasingDocumentFile/${docId}/${fileId}`,
      { method: "POST" },
    );
    const result = await response.json();
    if (result.success) {
      const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
      if (fileItem) fileItem.remove();
      showMessage("Tệp tin đã được xóa thành công.");
      if (result.remainingFiles === 0) {
        document.getElementById("currentFilesList").innerHTML =
          '<p class="text-muted">Không có tệp tin nào</p>';
      }
    } else {
      showMessage("Lỗi khi xóa tệp tin: " + result.message, true);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    showMessage("Lỗi khi xóa tệp tin", true);
  }
};

const fetchAvailableProposals = async () => {
  try {
    const response = await fetch("/approvedProposalsForPurchasing");
    const allProposals = await response.json();
    const currentProposalIds = state.currentAppendedProposals.map(
      (p) => p.proposalId,
    );
    state.availableProposals = allProposals.filter(
      (proposal) => !currentProposalIds.includes(proposal._id),
    );
    populateProposalsDropdown();
  } catch (error) {
    console.error("Error fetching available proposals:", error);
    showMessage("Error loading available proposals", true);
  }
};

const populateProposalsDropdown = () => {
  const dropdown = document.getElementById("newProposalsDropdown");
  dropdown.innerHTML = '<option value="">Chọn phiếu đề xuất</option>';
  state.availableProposals.forEach((proposal) => {
    const option = document.createElement("option");
    option.value = proposal._id;
    option.textContent = `${proposal.task} - ${proposal.costCenter} - ${proposal.submissionDate}`;
    dropdown.appendChild(option);
  });
};

const renderCurrentAppendedProposals = () => {
  const currentProposalsList = document.getElementById(
    "currentAppendedProposalsList",
  );
  if (state.currentAppendedProposals.length === 0) {
    currentProposalsList.innerHTML =
      '<p class="text-muted">Không có phiếu đề xuất nào</p>';
    return;
  }
  currentProposalsList.innerHTML = state.currentAppendedProposals
    .map(
      (proposal) => `
    <div class="proposal-item" data-proposal-id="${proposal.proposalId}">
      <div class="proposal-info">
        <strong>${proposal.task}</strong>
        <div class="proposal-details">
          <span>Trạm: ${proposal.costCenter}</span>
          <span>Nhóm: ${proposal.groupName}</span>
          <span>Ngày: ${proposal.submissionDate}</span>
        </div>
      </div>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeAppendedProposal('${proposal.proposalId}')">
        <i class="fas fa-trash"></i> Xóa
      </button>
    </div>
  `,
    )
    .join("");
};

const removeAppendedProposal = (proposalId) => {
  state.currentAppendedProposals = state.currentAppendedProposals.filter(
    (p) => p.proposalId !== proposalId,
  );
  renderCurrentAppendedProposals();
  fetchAvailableProposals();
};

const addNewProposal = () => {
  const selectedProposalId = document.getElementById(
    "newProposalsDropdown",
  ).value;
  if (!selectedProposalId) {
    showMessage("Vui lòng chọn một phiếu đề xuất.", true);
    return;
  }
  const selectedProposal = state.availableProposals.find(
    (p) => p._id === selectedProposalId,
  );
  if (selectedProposal) {
    const newAppendedProposal = {
      task: selectedProposal.task,
      costCenter: selectedProposal.costCenter,
      groupName: selectedProposal.groupName,
      dateOfError: selectedProposal.dateOfError,
      detailsDescription: selectedProposal.detailsDescription,
      direction: selectedProposal.direction,
      fileMetadata: selectedProposal.fileMetadata || [],
      proposalId: selectedProposal._id,
      submissionDate: selectedProposal.submissionDate,
      submittedBy: selectedProposal.submittedBy,
      approvers: selectedProposal.approvers,
      approvedBy: selectedProposal.approvedBy,
      status: selectedProposal.status,
      declaration: selectedProposal.declaration,
      suspendReason: selectedProposal.suspendReason,
      projectName: selectedProposal.projectName,
    };
    state.currentAppendedProposals.push(newAppendedProposal);
    renderCurrentAppendedProposals();
    fetchAvailableProposals();
    document.getElementById("newProposalsDropdown").value = "";
  }
};

const editDocument = async (docId) => {
  try {
    const costCenterResponse = await fetch("/costCenters");
    state.costCenters = await costCenterResponse.json();

    const response = await fetch(`/getPurchasingDocument/${docId}`);
    const doc = await response.json();

    document.getElementById("editDocId").value = docId;
    document.getElementById("editName").value = doc.name;

    await populateCostCenterDropdownForEditing();
    document.getElementById("editCostCenter").value = doc.costCenter;

    await populateGroupDropdownForEditing();
    document.getElementById("editGroupName").value = doc.groupName;

    const productsList = document.getElementById("productsList");
    productsList.innerHTML = "";
    doc.products.forEach((product) => addProductField(product));

    renderCurrentFiles(doc.fileMetadata, docId);
    state.currentAppendedProposals = doc.appendedProposals || [];
    renderCurrentAppendedProposals();
    await fetchAvailableProposals();
    state.currentApprovers = doc.approvers;
    renderCurrentApprovers();
    await populateNewApproversDropdown();

    document.getElementById("editModal").style.display = "block";
  } catch (err) {
    console.error("Error fetching document details:", err);
    showMessage("Error loading document details", true);
  }
};

const closeEditModal = () => {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("editForm").reset();
  document.getElementById("productsList").innerHTML = "";
  state.currentAppendedProposals = [];
  state.currentApprovers = [];
};

const validateProductFields = () => {
  const productItems = document.querySelectorAll(".product-item");
  if (productItems.length === 0) {
    showMessage("Vui lòng thêm ít nhất một sản phẩm", true);
    return false;
  }
  for (let item of productItems) {
    const productSelect = item.querySelector(".product-select");
    if (productSelect) {
      const choicesInstance = productSelect._choices;
      const productName = choicesInstance
        ? choicesInstance.getValue(true)
        : productSelect.value;
      if (!productName || productName === "") {
        showMessage("Vui lòng chọn tên sản phẩm cho tất cả các mục", true);
        if (choicesInstance) {
          choicesInstance.showDropdown();
        } else {
          productSelect.focus();
        }
        return false;
      }
    } else {
      const nameInput = item.querySelector('input[type="text"]:first-of-type');
      if (nameInput && !nameInput.value) {
        showMessage("Vui lòng nhập tên sản phẩm cho tất cả các mục", true);
        nameInput.focus();
        return false;
      }
    }
    const requiredInputs = item.querySelectorAll("input[required]");
    for (let input of requiredInputs) {
      if (!input.value || input.value === "") {
        showMessage(
          `Vui lòng điền đầy đủ thông tin sản phẩm (${input.placeholder})`,
          true,
        );
        input.focus();
        return false;
      }
    }
  }
  return true;
};

const handleEditSubmit = async (event) => {
  event.preventDefault();
  if (!validateProductFields()) return;

  const docId = document.getElementById("editDocId").value;
  const formData = new FormData();

  formData.append("name", document.getElementById("editName").value);
  formData.append(
    "costCenter",
    document.getElementById("editCostCenter").value,
  );
  formData.append("groupName", document.getElementById("editGroupName").value);

  const products = [];
  const productItems = document.querySelectorAll(".product-item");

  productItems.forEach((item) => {
    const productSelect = item.querySelector(".product-select");
    const costCenterSelect = item.querySelector(".product-cost-center");
    const inputs = item.querySelectorAll(
      'input[type="number"], input[type="text"]',
    );

    let productName = "";
    if (productSelect && productSelect.tagName === "SELECT") {
      const choicesInstance = productSelect._choices;
      productName = choicesInstance
        ? choicesInstance.getValue(true)
        : productSelect.value;
    } else {
      const nameInput = item.querySelector('input[type="text"]:first-of-type');
      if (nameInput) productName = nameInput.value;
    }

    if (!productName) return;

    const hasSelect = productSelect && productSelect.tagName === "SELECT";
    let costPerUnit, amount, vat, note;

    if (hasSelect) {
      costPerUnit = parseFloat(inputs[0]?.value) || 0;
      amount = parseFloat(inputs[1]?.value) || 0;
      vat = parseFloat(inputs[2]?.value) || 0;
      note = inputs[3]?.value || "";
    } else {
      costPerUnit = parseFloat(inputs[1]?.value) || 0;
      amount = parseFloat(inputs[2]?.value) || 0;
      vat = parseFloat(inputs[3]?.value) || 0;
      note = inputs[4]?.value || "";
    }

    products.push({
      productName: productName,
      costPerUnit: costPerUnit,
      amount: amount,
      vat: vat,
      totalCost: costPerUnit * amount,
      totalCostAfterVat:
        costPerUnit * amount + costPerUnit * amount * (vat / 100),
      costCenter: costCenterSelect ? costCenterSelect.value : "",
      note: note,
    });
  });

  formData.append("products", JSON.stringify(products));
  const grandTotalCost = products.reduce(
    (sum, product) => sum + product.totalCostAfterVat,
    0,
  );
  formData.append("grandTotalCost", grandTotalCost);
  formData.append("approvers", JSON.stringify(state.currentApprovers));
  formData.append(
    "appendedProposals",
    JSON.stringify(state.currentAppendedProposals),
  );

  const fileInput = document.getElementById("editFiles");
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append("files", fileInput.files[i]);
    }
  }

  try {
    const response = await fetch(`/updatePurchasingDocument/${docId}`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (response.ok) {
      showMessage("Phiếu cập nhật thành công.");
      closeEditModal();
      fetchPurchasingDocuments();
    } else {
      showMessage(result.message || "Error updating document", true);
    }
  } catch (err) {
    console.error("Error updating document:", err);
    showMessage("Error updating document", true);
  }
};

// Documents containing purchasing
const showDocumentsContainingPurchasing = async (purchasingId) => {
  try {
    const response = await fetch(
      `/documentsContainingPurchasing/${purchasingId}`,
    );
    const data = await response.json();
    if (data.success) {
      const modalHTML = `<div id="containingDocsModal" class="modal" style="display: block;"><div class="modal-content"><span class="modal-close" onclick="closeContainingDocsModal()">&times;</span><h2 class="modal-title"><i class="fas fa-link"></i> Phiếu liên quan</h2><div class="modal-body"><div class="related-docs-section"><h3><i class="fas fa-money-bill-wave"></i> Thanh toán</h3>${data.paymentDocuments.length > 0 ? renderPaymentDocuments(data.paymentDocuments) : "<p>Không có phiếu thanh toán nào liên quan</p>"}</div><div class="related-docs-section"><h3><i class="fas fa-hand-holding-usd"></i> Tạm ứng</h3>${data.advancePaymentDocuments.length > 0 ? renderAdvancePaymentDocuments(data.advancePaymentDocuments) : "<p>Không có phiếu tạm ứng nào liên quan</p>"}</div><div class="related-docs-section"><h3><i class="fas fa-exchange-alt"></i> Thu hồi tạm ứng</h3>${data.advancePaymentReclaimDocuments.length > 0 ? renderAdvancePaymentReclaimDocuments(data.advancePaymentReclaimDocuments) : "<p>Không có phiếu thu hồi tạm ứng nào liên quan</p>"}</div></div></div></div>`;
      document.body.insertAdjacentHTML("beforeend", modalHTML);
    } else {
      showMessage("Error fetching related documents", true);
    }
  } catch (error) {
    console.error("Error fetching related documents:", error);
    showMessage("Error fetching related documents", true);
  }
};

const renderPaymentDocuments = (paymentDocs) => {
  if (!paymentDocs || paymentDocs.length === 0) return "-";
  return `<div class="documents-container">${paymentDocs.map((doc) => `<div class="document-card"><h4>${doc.title || "Payment Document"}</h4><div class="document-details"><div><strong>Tem:</strong> ${doc.tag}</div><div><strong>Tên:</strong> ${doc.name}</div><div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div><div><strong>Phương thức thanh toán:</strong> ${doc.paymentMethod}</div><div><strong>Tổng thanh toán:</strong> ${doc.totalPayment?.toLocaleString("en-EN", { maximumFractionDigits: 5 }) || "-"}</div><div><strong>Tạm ứng:</strong> ${doc.advancePayment?.toLocaleString("en-EN", { maximumFractionDigits: 5 }) || "-"}</div><div><strong>Hạn thanh toán:</strong> ${doc.paymentDeadline}</div><div><strong>Tệp tin:</strong> ${doc.fileMetadata?.link ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>` : "-"}</div><div><strong>Tình trạng:</strong> ${renderStatus(doc.status)}</div></div></div>`).join("")}</div>`;
};

const renderAdvancePaymentDocuments = (advancePaymentDocs) => {
  if (!advancePaymentDocs || advancePaymentDocs.length === 0) return "-";
  return `<div class="documents-container">${advancePaymentDocs.map((doc) => `<div class="document-card"><h4>Phiếu tạm ứng</h4><div class="document-details"><div><strong>Tem:</strong> ${doc.tag}</div><div><strong>Tên:</strong> ${doc.name}</div><div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div><div><strong>Phương thức thanh toán:</strong> ${doc.paymentMethod}</div><div><strong>Tạm ứng:</strong> ${doc.advancePayment?.toLocaleString("en-EN", { maximumFractionDigits: 5 }) || "-"}</div><div><strong>Hạn thanh toán:</strong> ${doc.paymentDeadline}</div><div><strong>Tệp tin:</strong> ${doc.fileMetadata?.link ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>` : "-"}</div><div><strong>Tình trạng:</strong> ${renderStatus(doc.status)}</div></div></div>`).join("")}</div>`;
};

const renderAdvancePaymentReclaimDocuments = (reclaimDocs) => {
  if (!reclaimDocs || reclaimDocs.length === 0) return "-";
  return `<div class="documents-container">${reclaimDocs.map((doc) => `<div class="document-card"><h4>Phiếu thu hồi tạm ứng</h4><div class="document-details"><div><strong>Tem:</strong> ${doc.tag}</div><div><strong>Tên:</strong> ${doc.name}</div><div><strong>Trạm:</strong> ${doc.costCenter || "-"}</div><div><strong>Phương thức thanh toán:</strong> ${doc.paymentMethod}</div><div><strong>Thu hồi tạm ứng:</strong> ${doc.advancePaymentReclaim?.toLocaleString("en-EN", { maximumFractionDigits: 5 }) || "-"}</div><div><strong>Hạn thanh toán:</strong> ${doc.paymentDeadline}</div><div><strong>Tệp tin:</strong> ${doc.fileMetadata?.link ? `<a href="${doc.fileMetadata.link}" class="file-link" target="_blank">${doc.fileMetadata.name}</a>` : "-"}</div><div><strong>Tình trạng:</strong> ${renderStatus(doc.status)}</div></div></div>`).join("")}</div>`;
};

const closeContainingDocsModal = () => {
  const modal = document.getElementById("containingDocsModal");
  if (modal) modal.remove();
};

// Export functions
const exportSelectedToExcel = () => {
  const selectedDocs = Array.from(state.selectedDocuments);
  if (selectedDocs.length === 0) {
    showMessage("Xin hãy chọn ít nhất một phiếu để xuất.", true);
    return;
  }
  try {
    const documentsToExport = state.purchasingDocuments.filter((doc) =>
      selectedDocs.includes(doc._id),
    );
    const wb = XLSX.utils.book_new();
    const detailedData = [];
    documentsToExport.forEach((doc, docIndex) => {
      detailedData.push({
        STT: docIndex + 1,
        "Tên phiếu": doc.name || "Không có",
        Trạm: doc.costCenter || "Không có",
        Nhóm: doc.groupName || "Không có",
        "Ngày nộp": doc.submissionDate || "Không có",
        "Tên sản phẩm": "",
        "Trạm sản phẩm": "",
        "Số lượng": "",
        "Giá trước VAT": "",
        "Tổng trước VAT": "",
        "VAT (%)": "",
        "Giá sau VAT": "",
        "Tổng sau VAT": doc.grandTotalCost || 0,
        "Ghi chú": "",
        "Tình trạng":
          doc.status === "Approved"
            ? "Đã phê duyệt"
            : doc.status === "Suspended"
              ? "Từ chối"
              : "Chưa phê duyệt",
        "Kê khai": doc.declaration || "Không có",
        "Lý do từ chối": doc.suspendReason || "Không có",
        "Tệp đính kèm": doc.fileMetadata ? doc.fileMetadata.name : "Không có",
        "Link tệp": doc.fileMetadata ? doc.fileMetadata.link : "",
        "Người nộp": doc.submittedBy?.username || "Không rõ",
        "Người phê duyệt":
          doc.approvedBy.map((a) => a.username).join(", ") || "Chưa có",
      });
      let documentTotalBeforeVAT = 0;
      if (doc.products?.length) {
        doc.products.forEach((product, productIndex) => {
          const costBeforeVAT = product.costPerUnit || 0;
          const vatPercentage = product.vat || 0;
          const costAfterVAT = costBeforeVAT * (1 + vatPercentage / 100);
          const amount = product.amount || 0;
          const totalBeforeVAT = costBeforeVAT * amount;
          const totalAfterVAT = costAfterVAT * amount;
          documentTotalBeforeVAT += totalBeforeVAT;
          detailedData.push({
            STT: `SP${productIndex + 1}`,
            "Tên phiếu": "",
            Trạm: "",
            Nhóm: "",
            "Ngày nộp": "",
            "Tên sản phẩm": product.productName || "",
            "Trạm sản phẩm": product.costCenter || "",
            "Số lượng": amount,
            "Giá trước VAT": costBeforeVAT,
            "Tổng trước VAT": totalBeforeVAT,
            "VAT (%)": vatPercentage,
            "Giá sau VAT": costAfterVAT,
            "Tổng sau VAT": totalAfterVAT,
            "Ghi chú": product.note || "",
            "Tình trạng": "",
            "Kê khai": "",
            "Lý do từ chối": "",
            "Tệp đính kèm": "",
            "Link tệp": "",
            "Người nộp": "",
            "Người phê duyệt": "",
          });
        });
        detailedData[detailedData.length - doc.products.length - 1][
          "Tổng trước VAT"
        ] = documentTotalBeforeVAT;
      }
      detailedData.push({});
    });
    const detailedWs = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, detailedWs, "Chi tiết đầy đủ");
    XLSX.writeFile(
      wb,
      `Bao_cao_phieu_mua_hang_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    showMessage(`Đã xuất ${selectedDocs.length} phiếu mua hàng.`);
  } catch (err) {
    console.error("Error exporting documents:", err);
    showMessage("Lỗi khi xuất dữ liệu: " + err.message, true);
  }
};

const updateDocumentSelection = (checkbox) => {
  const docId = checkbox.dataset.docId;
  if (checkbox.checked) state.selectedDocuments.add(docId);
  else state.selectedDocuments.delete(docId);
};

const toggleSelectAll = () => {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".doc-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
    updateDocumentSelection(checkbox);
  });
};

const updateSelectAllCheckbox = () => {
  const checkboxes = document.querySelectorAll(".doc-checkbox");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.disabled = true;
    return;
  }
  selectAllCheckbox.disabled = false;
  const allChecked = Array.from(checkboxes).every(
    (checkbox) => checkbox.checked,
  );
  selectAllCheckbox.checked = allChecked;
};

// Event listeners
const setupEventListeners = () => {
  document.getElementById("pendingToggle").addEventListener("change", (e) => {
    state.showOnlyPendingApprovals = e.target.checked;
    state.currentPage = 1;
    fetchPurchasingDocuments();
  });
  document.getElementById("paginationToggle").addEventListener("change", () => {
    state.paginationEnabled =
      document.getElementById("paginationToggle").checked;
    state.currentPage = 1;
    fetchPurchasingDocuments();
  });
  document.getElementById("nameFilter").addEventListener("input", (e) => {
    state.nameFilter = e.target.value.trim().toLowerCase();
    state.currentPage = 1;
    fetchPurchasingDocuments();
  });
  const totalCostFilter = document.getElementById("totalCostFilter");
  totalCostFilter.addEventListener("change", (e) => {
    if (e.target.value !== "custom") {
      state.currentTotalCostFilter = e.target.value;
      state.customTotalCostRange = { min: null, max: null };
      state.currentPage = 1;
      fetchPurchasingDocuments();
    }
  });
  const dateFilter = document.getElementById("dateFilter");
  dateFilter.addEventListener("change", (e) => {
    if (e.target.value !== "custom") {
      state.currentDateFilter = e.target.value;
      state.customDateRange = { from: null, to: null };
      state.currentPage = 1;
      fetchPurchasingDocuments();
    }
  });
  document.addEventListener("keypress", (e) => {
    if (e.target.id === "pageInput" && e.key === "Enter") goToPage();
  });
  document
    .getElementById("exportSelectedBtn")
    .addEventListener("click", () => exportSelectedToExcel());
  document
    .getElementById("selectAllCheckbox")
    .addEventListener("change", () => toggleSelectAll());
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("doc-checkbox")) {
      updateDocumentSelection(e.target);
      updateSelectAllCheckbox();
    }
  });
  document.getElementById("suspendForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleSuspendSubmit(e);
  });
  document
    .querySelector("#fullViewModal .modal-close")
    .addEventListener("click", () => closeFullViewModal());
  document
    .querySelector("#suspendModal .modal-close")
    .addEventListener("click", () => closeSuspendModal());
};

// Initialize the application
const initialize = async () => {
  await fetchCurrentUser();
  setupEventListeners();
  setupCustomFilterHandlers();
  await populateCostCenterMultiSelect();
  initializeCostCenterMultiSelect();
  await populateGroupMultiSelect();
  initializeGroupMultiSelect();
  await fetchPurchasingDocuments();
  addEditModal();
};

// Make all functions globally available
window.showFullView = showFullView;
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
window.approveDocument = approveDocument;
window.suspendDocument = suspendDocument;
window.openDocument = openDocument;
window.editDeclaration = editDeclaration;
window.showDocumentsContainingPurchasing = showDocumentsContainingPurchasing;
window.closeFullViewModal = closeFullViewModal;
window.closeSuspendModal = closeSuspendModal;
window.closeDeclarationModal = closeDeclarationModal;
window.closeContainingDocsModal = closeContainingDocsModal;
window.changePage = changePage;
window.goToPage = goToPage;
window.addProductField = addProductField;
window.removeAppendedProposal = removeAppendedProposal;
window.addNewProposal = addNewProposal;
window.updateApproverSubRole = updateApproverSubRole;
window.removeApprover = removeApprover;
window.addNewApprover = addNewApprover;
window.removeCurrentFile = removeCurrentFile;
window.closeEditModal = closeEditModal;
window.showMoveToStockModal = showMoveToStockModal;
window.confirmMoveToStock = confirmMoveToStock;
window.closeMoveToStockModal = closeMoveToStockModal;
window.showTransferHistory = showTransferHistory;
window.closeTransferHistoryModal = closeTransferHistoryModal;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initialize);
