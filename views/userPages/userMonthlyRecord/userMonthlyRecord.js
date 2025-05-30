////views\userPages\userMonthlyRecord\userMonthlyRecord.js
// Global variables
let allRecords = [];
let filteredRecords = [];
const itemsPerPage = 10;
let currentPage = 1;

// DOM elements
const yearFilter = document.getElementById("yearFilter");
const monthFilter = document.getElementById("monthFilter");
const costCenterFilter = document.getElementById("costCenterFilter");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const recordsBody = document.getElementById("recordsBody");
const loadingDiv = document.getElementById("loading");
const paginationDiv = document.getElementById("pagination");
const modal = document.getElementById("recordModal");
const modalContent = document.getElementById("modalContent");
const closeModal = document.getElementsByClassName("close")[0];

// Initialize the application
document.addEventListener("DOMContentLoaded", async () => {
  // Load data
  await fetchData();

  // Set up event listeners
  applyFiltersBtn.addEventListener("click", applyFilters);
  resetFiltersBtn.addEventListener("click", resetFilters);
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Populate year filter
  populateYearFilter();

  // Initial display
  applyFilters();
});

// Fetch data from the server
async function fetchData() {
  try {
    loadingDiv.style.display = "block";
    const response = await fetch("/userMonthlyRecordGet");
    if (!response.ok) throw new Error("Không thể kết nối đến server");

    allRecords = await response.json();
    populateCostCenterFilter();
    loadingDiv.style.display = "none";
  } catch (error) {
    loadingDiv.textContent = "Lỗi khi tải dữ liệu: " + error.message;
    console.error("Error:", error);
  }
}

// Populate year filter with unique years from data
function populateYearFilter() {
  const years = [
    ...new Set(allRecords.map((record) => record.recordYear)),
  ].sort((a, b) => b - a);
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });
}

// Populate cost center filter with unique cost centers from data
function populateCostCenterFilter() {
  const costCenters = [
    ...new Set(
      allRecords
        .filter((record) => record.costCenter)
        .map((record) => record.costCenter.name)
    ),
  ].sort();

  costCenters.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    costCenterFilter.appendChild(option);
  });
}

// Apply filters to the data
function applyFilters() {
  const selectedYear = yearFilter.value;
  const selectedMonth = monthFilter.value;
  const selectedCostCenter = costCenterFilter.value;

  filteredRecords = allRecords.filter((record) => {
    return (
      (!selectedYear || record.recordYear == selectedYear) &&
      (!selectedMonth || record.recordMonth == selectedMonth) &&
      (!selectedCostCenter ||
        (record.costCenter && record.costCenter.name === selectedCostCenter))
    );
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

// Reset all filters
function resetFilters() {
  yearFilter.value = "";
  monthFilter.value = "";
  costCenterFilter.value = "";
  applyFilters();
}

// Render the table with paginated data
function renderTable() {
  recordsBody.innerHTML = "";

  if (filteredRecords.length === 0) {
    recordsBody.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">Không tìm thấy bản ghi nào phù hợp.</td></tr>';
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredRecords.length);
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  paginatedRecords.forEach((record) => {
    const row = document.createElement("tr");

    // Format month name
    const monthNames = [
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
    ];
    const monthName = monthNames[record.recordMonth - 1];

    row.innerHTML = `
                    <td>${record.username}</td>
                    <td>${monthName} ${record.recordYear}</td>
                    <td>${formatVND(record.baseSalary || 0)}</td>
                    <td>${formatVND(record.grossSalary || 0)}</td>
                    <td>${formatVND(record.tax || 0)}</td>
                    <td>${record.costCenter?.name || "N/A"}</td>
                    <td><button class="view-details" data-id="${
                      record._id
                    }">Xem chi tiết</button></td>
                `;

    recordsBody.appendChild(row);
  });

  // Add event listeners to detail buttons
  document.querySelectorAll(".view-details").forEach((button) => {
    button.addEventListener("click", () =>
      showRecordDetails(button.dataset.id)
    );
  });
}

// Format number as VND currency
function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Render pagination controls
function renderPagination() {
  paginationDiv.innerHTML = "";

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  if (totalPages <= 1) return;

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.textContent = "Trước";
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      renderPagination();
    }
  });
  paginationDiv.appendChild(prevButton);

  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.addEventListener("click", () => {
      currentPage = 1;
      renderTable();
      renderPagination();
    });
    paginationDiv.appendChild(firstButton);

    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      paginationDiv.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement("button");
    pageButton.textContent = i;
    if (i === currentPage) {
      pageButton.style.fontWeight = "bold";
      pageButton.style.backgroundColor = "#45a049";
    }
    pageButton.addEventListener("click", () => {
      currentPage = i;
      renderTable();
      renderPagination();
    });
    paginationDiv.appendChild(pageButton);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      paginationDiv.appendChild(ellipsis);
    }

    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.addEventListener("click", () => {
      currentPage = totalPages;
      renderTable();
      renderPagination();
    });
    paginationDiv.appendChild(lastButton);
  }

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = "Sau";
  nextButton.disabled = currentPage === totalPages;
  nextButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
      renderPagination();
    }
  });
  paginationDiv.appendChild(nextButton);
}

// Show detailed view of a record in modal
function showRecordDetails(recordId) {
  const record = allRecords.find((r) => r._id === recordId);
  if (!record) return;

  // Format month name
  const monthNames = [
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
  ];
  const monthName = monthNames[record.recordMonth - 1];

  modalContent.innerHTML = `
                <h2>${record.username} - ${monthName} ${record.recordYear}</h2>
                <p><strong>Ngày ghi nhận:</strong> ${new Date(
                  record.recordDate
                ).toLocaleDateString("vi-VN")}</p>
                <p><strong>Email:</strong> ${record.email || "N/A"}</p>
                <p><strong>Trung tâm chi phí:</strong> ${
                  record.costCenter?.name || "N/A"
                }</p>
                <p><strong>Quản lý phụ trách:</strong> ${
                  record.assignedManager?.username || "N/A"
                }</p>
                
                <div class="modal-section">
                    <h3>Thông tin lương</h3>
                    <p><strong>Lương cơ bản:</strong> ${formatVND(
                      record.baseSalary || 0
                    )}</p>
                    <p><strong>Thưởng hoa hồng:</strong> ${formatVND(
                      record.commissionBonus || 0
                    )}</p>
                    <p><strong>Thưởng ngày lễ/ngày:</strong> ${formatVND(
                      record.holidayBonusPerDay || 0
                    )}</p>
                    <p><strong>Thưởng ca đêm/ngày:</strong> ${formatVND(
                      record.nightShiftBonusPerDay || 0
                    )}</p>
                    <p><strong>Lương đóng bảo hiểm:</strong> ${formatVND(
                      record.insurableSalary || 0
                    )}</p>
                    <p><strong>Bảo hiểm bắt buộc:</strong> ${formatVND(
                      record.mandatoryInsurance || 0
                    )}</p>
                    <p><strong>Số ngày lễ:</strong> ${
                      record.currentHolidayDays || 0
                    }</p>
                    <p><strong>Số ca đêm:</strong> ${
                      record.currentNightShiftDays || 0
                    }</p>
                    <p><strong>Lương hiện tại:</strong> ${formatVND(
                      record.currentSalary || 0
                    )}</p>
                    <p><strong>Tổng lương:</strong> ${formatVND(
                      record.grossSalary || 0
                    )}</p>
                </div>
                
                <div class="modal-section">
                    <h3>Thông tin thuế</h3>
                    <p><strong>Thuế thu nhập:</strong> ${formatVND(
                      record.tax || 0
                    )}</p>
                    <p><strong>Số người phụ thuộc:</strong> ${
                      record.dependantCount || 0
                    }</p>
                    <p><strong>Thu nhập chịu thuế:</strong> ${formatVND(
                      record.taxableIncome || 0
                    )}</p>
                </div>
                
                <div class="modal-section">
                    <h3>Thông tin khác</h3>
                    <p><strong>Chi phí đi lại:</strong> ${formatVND(
                      record.travelExpense || 0
                    )}</p>
                </div>
            `;

  modal.style.display = "block";
}
