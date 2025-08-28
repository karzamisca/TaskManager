// views/financePages/financeSummary/financeSummary.js
$(document).ready(function () {
  // Ensure Chart.js is loaded
  if (typeof Chart === "undefined") {
    console.error("Chart.js not loaded");
    alert("Lỗi: Chart.js không tải được. Vui lòng kiểm tra kết nối internet.");
    return;
  }

  // Chart.js default configuration
  Chart.defaults.font.family = "'Segoe UI', 'Roboto', sans-serif";
  Chart.defaults.color = "#495057";

  // Constants
  const STARTING_BUDGET_2025 = 2866850896;

  // Chart variables
  let mainChart = null;
  let comparisonChart = null;
  let netRevenueChart = null;
  let trendChart = null;
  let currentChartData = [];

  // Month mapping for proper sorting
  const monthOrder = {
    "Tháng Một": 1,
    "Tháng Hai": 2,
    "Tháng Ba": 3,
    "Tháng Tư": 4,
    "Tháng Năm": 5,
    "Tháng Sáu": 6,
    "Tháng Bảy": 7,
    "Tháng Tám": 8,
    "Tháng Chín": 9,
    "Tháng Mười": 10,
    "Tháng Mười Một": 11,
    "Tháng Mười Hai": 12,
  };

  // Metrics configuration
  const metrics = [
    {
      key: "totalSale",
      label: "Tổng Bán Hàng",
      isPositive: true,
      color: "#28a745",
    },
    {
      key: "totalPurchase",
      label: "Tổng Mua Hàng",
      isPositive: false,
      color: "#dc3545",
    },
    {
      key: "totalTransport",
      label: "Chi Phí Vận Chuyển",
      isPositive: false,
      color: "#ffc107",
    },
    {
      key: "totalCommissionPurchase",
      label: "Hoa Hồng Mua Hàng",
      isPositive: false,
      color: "#fd7e14",
    },
    {
      key: "totalCommissionSale",
      label: "Hoa Hồng Bán Hàng",
      isPositive: false,
      color: "#e83e8c",
    },
    {
      key: "totalSalary",
      label: "Tổng Lương",
      isPositive: false,
      color: "#6f42c1",
    },
    {
      key: "totalPayments",
      label: "Tổng Thanh Toán",
      isPositive: false,
      color: "#6c757d",
    },
    {
      key: "netRevenue",
      label: "Doanh Thu Ròng",
      isPositive: true,
      color: "#007bff",
    },
  ];

  let currentTable = null;
  let allCostCenters = [];
  let selectedCostCenters = new Set();
  let currentCategory = "all";

  // Initialize Select2 for cost center selection
  $("#costCenterSelect").select2({
    theme: "bootstrap-5",
    placeholder: "Chọn trạm...",
    allowClear: true,
    closeOnSelect: false,
    width: "100%",
    templateResult: formatCostCenter,
    templateSelection: formatCostCenterSelection,
  });

  // Format cost center with category for dropdown
  function formatCostCenter(costCenter) {
    if (!costCenter.id) return costCenter.text;
    const $container = $("<span></span>");
    $container.text(costCenter.text);
    if (costCenter.element && $(costCenter.element).data("category")) {
      const category = $(costCenter.element).data("category");
      $container.append(
        $('<span class="cost-center-category"></span>').text(` (${category})`)
      );
    }
    return $container;
  }

  // Format selected cost centers
  function formatCostCenterSelection(costCenter) {
    if (!costCenter.id) return costCenter.text;
    if (costCenter.id === "all") {
      return $("<span></span>").text("Tất Cả Trạm");
    }
    const $container = $("<span></span>");
    $container.text(costCenter.text);
    if (costCenter.element && $(costCenter.element).data("category")) {
      const category = $(costCenter.element).data("category");
      $container.append(
        $('<span class="cost-center-category"></span>').text(` (${category})`)
      );
    }
    return $container;
  }

  // Populate year dropdown
  const currentYear = new Date().getFullYear();
  const yearSelect = $("#yearSelect");
  for (let year = currentYear; year >= currentYear - 5; year--) {
    yearSelect.append(`<option value="${year}">${year}</option>`);
  }
  yearSelect.val(currentYear);

  // View toggle functionality
  $('input[name="viewOptions"]').on("change", function () {
    if ($(this).attr("id") === "tableView") {
      $("#tableViewContainer").show();
      $("#chartViewContainer").hide();
    } else {
      $("#tableViewContainer").hide();
      $("#chartViewContainer").show();
      updateCharts();
    }
  });

  // Chart control handlers
  $("#chartType, #chartMetric, #chartGroupBy").on("change", function () {
    updateCharts();
  });

  // Category filter handler
  $("#categoryFilter").on("change", function () {
    currentCategory = $(this).val();
    filterCostCentersByCategory();
  });

  // Filter cost centers by category
  function filterCostCentersByCategory() {
    const costCenterSelect = $("#costCenterSelect");
    const currentSelections = costCenterSelect.val() || [];

    costCenterSelect.empty();
    costCenterSelect.append('<option value="all">Tất Cả Trạm</option>');

    allCostCenters.forEach((costCenter) => {
      if (
        currentCategory === "all" ||
        costCenter.category === currentCategory
      ) {
        const option = $(
          `<option value="${costCenter.name}">${costCenter.name}</option>`
        );
        // Add category info as data attribute
        option.data("category", costCenter.category);
        costCenterSelect.append(option);
      }
    });

    // Restore previous selections if they still exist
    const validSelections = currentSelections.filter(
      (value) => costCenterSelect.find(`option[value="${value}"]`).length > 0
    );
    if (validSelections.length > 0) {
      costCenterSelect.val(validSelections).trigger("change");
    } else if (
      currentSelections.includes("all") ||
      validSelections.length === 0
    ) {
      costCenterSelect.val(["all"]).trigger("change");
    }

    // Update Select2 to refresh the display
    costCenterSelect.trigger("change.select2");
  }

  // Fetch cost centers and populate dropdown
  $.ajax({
    url: "/financeSummaryCostCenters",
    method: "GET",
    success: function (data) {
      allCostCenters = data;
      filterCostCentersByCategory();
    },
    error: function () {
      console.error("Không thể tải danh sách trạm");
      alert("Lỗi khi tải danh sách trạm");
    },
  });

  // Handle "Tất Cả Trạm" selection logic
  $("#costCenterSelect").on("change", function () {
    const selectedValues = $(this).val();
    if (selectedValues && selectedValues.includes("all")) {
      // If "all" is selected, clear other selections
      if (selectedValues.length > 1) {
        $(this).val(["all"]).trigger("change");
      }
    }
    updateSelectedCentersInfo();
  });

  // Clear selection button
  $("#clearSelection").on("click", function () {
    $("#costCenterSelect").val(["all"]).trigger("change");
    $("#categoryFilter").val("all").trigger("change");
  });

  // Update selected centers info
  function updateSelectedCentersInfo() {
    const selectedValues = $("#costCenterSelect").val();
    const infoElement = $("#selectedCentersInfo");

    if (
      !selectedValues ||
      selectedValues.length === 0 ||
      selectedValues.includes("all")
    ) {
      const category = $("#categoryFilter").val();
      const categoryText = category === "all" ? "Tất cả loại" : category;
      infoElement.text(`Hiển thị: Tất cả trạm (${categoryText})`);
    } else {
      infoElement.text(
        `Hiển thị: ${
          selectedValues.length
        } trạm được chọn (${selectedValues.join(", ")})`
      );
    }
  }

  // Chart creation functions (keeping original chart functions)
  function createMainChart(data, chartType, metric, groupBy) {
    if (typeof Chart === "undefined") {
      console.error("Chart.js not available when creating main chart");
      return;
    }

    const ctx = document.getElementById("mainChart").getContext("2d");
    if (mainChart) {
      mainChart.destroy();
    }

    const metricInfo = metrics.find((m) => m.key === metric);
    let chartData, labels;

    if (groupBy === "month") {
      const monthData = {};
      data.forEach((item) => {
        const monthKey = `${item.month}`;
        if (!monthData[monthKey]) {
          monthData[monthKey] = 0;
        }
        monthData[monthKey] += item[metric] || 0;
      });

      labels = Object.keys(monthData).sort((a, b) => {
        const [monthA, yearA] = a.split(" ");
        const [monthB, yearB] = b.split(" ");
        const yearDiff = parseInt(yearA) - parseInt(yearB);
        if (yearDiff !== 0) return yearDiff;
        return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
      });
      chartData = labels.map((label) => monthData[label]);
    } else {
      const centerData = {};
      data.forEach((item) => {
        if (!centerData[item.costCenter]) {
          centerData[item.costCenter] = 0;
        }
        centerData[item.costCenter] += item[metric] || 0;
      });
      labels = Object.keys(centerData).sort();
      chartData = labels.map((label) => centerData[label]);
    }

    let backgroundColors;
    if (chartType === "area") {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, metricInfo.color + "80");
      gradient.addColorStop(1, metricInfo.color + "20");
      backgroundColors = gradient;
    } else if (chartType === "pie") {
      backgroundColors = generateColors(labels.length);
    } else {
      backgroundColors = metricInfo.color;
    }

    const config = {
      type: chartType === "area" ? "line" : chartType,
      data: {
        labels: labels,
        datasets: [
          {
            label: metricInfo.label,
            data: chartData,
            backgroundColor: backgroundColors,
            borderColor: metricInfo.color,
            borderWidth: 2,
            fill: chartType === "area",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: chartType === "pie",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y || context.parsed;
                return `${context.dataset.label}: ${value.toLocaleString(
                  "vi-VN"
                )} VNĐ`;
              },
            },
          },
        },
        scales:
          chartType !== "pie"
            ? {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function (value) {
                      return value.toLocaleString("vi-VN");
                    },
                  },
                },
              }
            : {},
        onResize: function (chart, size) {
          chart.canvas.style.maxHeight = "350px";
        },
      },
    };

    mainChart = new Chart(ctx, config);
    $("#mainChartTitle").text(
      `${metricInfo.label} theo ${groupBy === "month" ? "Tháng" : "Trạm"}`
    );
  }

  function generateColors(count) {
    const colors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#FF6384",
      "#C9CBCF",
      "#4BC0C0",
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
    ];
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  function createNetRevenueChart(data) {
    if (typeof Chart === "undefined") {
      console.error("Chart.js not available when creating net revenue chart");
      return;
    }
    const ctx = document.getElementById("netRevenueChart").getContext("2d");
    if (netRevenueChart) {
      netRevenueChart.destroy();
    }

    // Group data by month for net revenue only
    const monthlyData = {};
    data.forEach((item) => {
      const monthKey = `${item.month}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += item.netRevenue || 0;
    });

    const labels = Object.keys(monthlyData).sort((a, b) => {
      const [monthA, yearA] = a.split(" ");
      const [monthB, yearB] = b.split(" ");
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });
    const chartData = labels.map((label) => monthlyData[label]);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, "#007bff80");
    gradient.addColorStop(1, "#007bff20");

    netRevenueChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Doanh Thu Ròng",
            data: chartData,
            backgroundColor: gradient,
            borderColor: "#007bff",
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#007bff",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                return `Doanh thu ròng: ${value.toLocaleString("vi-VN")} VNĐ`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value.toLocaleString("vi-VN");
              },
            },
          },
        },
        onResize: function (chart, size) {
          chart.canvas.style.maxHeight = "250px";
        },
      },
    });
  }

  function createComparisonChart(data) {
    if (typeof Chart === "undefined") {
      console.error("Chart.js not available when creating comparison chart");
      return;
    }
    const ctx = document.getElementById("comparisonChart").getContext("2d");
    if (comparisonChart) {
      comparisonChart.destroy();
    }

    const totals = {
      totalSale: 0,
      totalPurchase: 0,
      totalTransport: 0,
      totalCommissionPurchase: 0,
      totalCommissionSale: 0,
      totalSalary: 0,
      totalPayments: 0,
    };

    data.forEach((item) => {
      totals.totalSale += item.totalSale || 0;
      totals.totalPurchase += item.totalPurchase || 0;
      totals.totalTransport += item.totalTransport || 0;
      totals.totalCommissionPurchase += item.totalCommissionPurchase || 0;
      totals.totalCommissionSale += item.totalCommissionSale || 0;
      totals.totalSalary += item.totalSalary || 0;
      totals.totalPayments += item.totalPayments || 0;
    });

    const labels = ["Thu nhập", "Chi phí"];
    const chartData = [
      totals.totalSale,
      totals.totalPurchase +
        totals.totalTransport +
        totals.totalCommissionPurchase +
        totals.totalCommissionSale +
        totals.totalSalary +
        totals.totalPayments,
    ];

    comparisonChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "VNĐ",
            data: chartData,
            backgroundColor: ["#28a745", "#dc3545"],
            borderColor: ["#28a745", "#dc3545"],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `${context.label}: ${context.parsed.y.toLocaleString(
                  "vi-VN"
                )} VNĐ`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value.toLocaleString("vi-VN");
              },
            },
          },
        },
        onResize: function (chart, size) {
          chart.canvas.style.maxHeight = "250px";
        },
      },
    });
  }

  function createTrendChart(data) {
    if (typeof Chart === "undefined") {
      console.error("Chart.js not available when creating trend chart");
      return;
    }
    const ctx = document.getElementById("trendChart").getContext("2d");
    if (trendChart) {
      trendChart.destroy();
    }

    // Group data by month for all metrics
    const monthlyData = {};
    data.forEach((item) => {
      const monthKey = `${item.month}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          totalSale: 0,
          totalPurchase: 0,
          netRevenue: 0,
          totalTransport: 0,
        };
      }
      monthlyData[monthKey].totalSale += item.totalSale || 0;
      monthlyData[monthKey].totalPurchase += item.totalPurchase || 0;
      monthlyData[monthKey].netRevenue += item.netRevenue || 0;
      monthlyData[monthKey].totalTransport += item.totalTransport || 0;
    });

    const labels = Object.keys(monthlyData).sort((a, b) => {
      const [monthA, yearA] = a.split(" ");
      const [monthB, yearB] = b.split(" ");
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });

    const datasets = [
      {
        label: "Doanh Thu Ròng",
        data: labels.map((label) => monthlyData[label].netRevenue),
        borderColor: "#007bff",
        backgroundColor: "#007bff20",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Tổng Bán Hàng",
        data: labels.map((label) => monthlyData[label].totalSale),
        borderColor: "#28a745",
        backgroundColor: "#28a74520",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Tổng Mua Hàng",
        data: labels.map((label) => monthlyData[label].totalPurchase),
        borderColor: "#dc3545",
        backgroundColor: "#dc354520",
        fill: false,
        tension: 0.4,
      },
    ];

    trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: function (context) {
                return `${
                  context.dataset.label
                }: ${context.parsed.y.toLocaleString("vi-VN")} VNĐ`;
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: "Tháng",
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: "VNĐ",
            },
            ticks: {
              callback: function (value) {
                return value.toLocaleString("vi-VN");
              },
            },
          },
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false,
        },
        onResize: function (chart, size) {
          chart.canvas.style.maxHeight = "350px";
        },
      },
    });
  }

  function createPieChart(data) {
    // This function can be added if you have a pie chart element in your HTML
    // For now, it's a placeholder to match the updateCharts() call
  }

  function updateCharts() {
    if (!currentChartData.length || typeof Chart === "undefined") {
      if (typeof Chart === "undefined") {
        console.error("Chart.js not available when updating charts");
      }
      return;
    }

    const chartType = $("#chartType").val();
    const metric = $("#chartMetric").val();
    const groupBy = $("#chartGroupBy").val();

    createMainChart(currentChartData, chartType, metric, groupBy);
    createPieChart(currentChartData);
    createComparisonChart(currentChartData);
    createTrendChart(currentChartData);
  }

  // NEW: Function to create vertical stacked table with cost center dropdowns
  function createVerticalStackedTable(data) {
    // Destroy existing DataTable if it exists
    if (currentTable) {
      currentTable.destroy();
      currentTable = null;
    }

    // Group data by cost center and month
    const pivotData = {};
    const costCenters = new Set();
    const months = new Set();

    data.forEach((item) => {
      const centerMonthKey = `${item.costCenter}_${item.actualMonth}_${item.actualYear}`;
      costCenters.add(item.costCenter);
      months.add(`${item.actualMonth} ${item.actualYear}`);

      if (!pivotData[centerMonthKey]) {
        pivotData[centerMonthKey] = {
          costCenter: item.costCenter,
          month: `${item.actualMonth} ${item.actualYear}`,
          monthOrder: monthOrder[item.actualMonth] || 0,
          year: item.actualYear,
          totalSale: 0,
          totalPurchase: 0,
          totalTransport: 0,
          totalCommissionPurchase: 0,
          totalCommissionSale: 0,
          totalSalary: 0,
          totalPayments: 0,
          netRevenue: 0,
        };
      }

      const entry = pivotData[centerMonthKey];
      entry.totalSale += item.totalSale;
      entry.totalPurchase += item.totalPurchase;
      entry.totalTransport += item.totalTransport;
      entry.totalCommissionPurchase += item.totalCommissionPurchase;
      entry.totalCommissionSale += item.totalCommissionSale;
      entry.totalSalary += item.grossSalary;
      entry.totalPayments += item.totalPayments;
      entry.netRevenue =
        entry.totalSale -
        entry.totalPurchase -
        entry.totalTransport -
        entry.totalCommissionPurchase -
        entry.totalCommissionSale -
        entry.totalSalary -
        entry.totalPayments;
    });

    // Sort cost centers and months
    const sortedCostCenters = Array.from(costCenters).sort();
    const sortedMonths = Array.from(months).sort((a, b) => {
      const [monthA, yearA] = a.split(" ");
      const [monthB, yearB] = b.split(" ");
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });

    // Create table header
    const tableHead = $("#tableHead");
    tableHead.empty();

    const headerRow = $("<tr></tr>");
    headerRow.append(
      '<th style="min-width: 200px; width: 200px;">Trạm / Chỉ số</th>'
    );
    sortedMonths.forEach((month) => {
      headerRow.append(
        `<th class="month-subheader" style="min-width: 120px;">${month}</th>`
      );
    });
    tableHead.append(headerRow);

    // Create table body
    const tableBody = $("#tableBody");
    tableBody.empty();

    sortedCostCenters.forEach((costCenter) => {
      // Cost center header row (clickable)
      const costCenterRow = $(
        `<tr class="cost-center-row" data-cost-center="${costCenter}"></tr>`
      );
      costCenterRow.append(
        `<td style="min-width: 200px; width: 200px;">
          <span class="cost-center-toggle">▶</span>
          <strong>${costCenter}</strong>
        </td>`
      );

      // Add summary cells for the cost center
      sortedMonths.forEach((month) => {
        const entry = Object.values(pivotData).find(
          (item) => item.costCenter === costCenter && item.month === month
        );
        const netRevenue = entry ? entry.netRevenue : 0;
        let cellClass = "";
        if (netRevenue > 0) cellClass = "positive";
        else if (netRevenue < 0) cellClass = "negative";

        const formattedValue =
          netRevenue === 0 ? "-" : netRevenue.toLocaleString("vi-VN");
        costCenterRow.append(
          `<td class="${cellClass}" style="min-width: 120px; text-align: right; font-weight: bold;">${formattedValue}</td>`
        );
      });

      tableBody.append(costCenterRow);

      // Add metric detail rows (initially hidden)
      metrics.forEach((metric) => {
        const metricRow = $(
          `<tr class="monthly-data-row" data-parent="${costCenter}"></tr>`
        );
        metricRow.append(
          `<td style="min-width: 200px; width: 200px;">${metric.label}</td>`
        );

        sortedMonths.forEach((month) => {
          const entry = Object.values(pivotData).find(
            (item) => item.costCenter === costCenter && item.month === month
          );
          let value = 0;
          if (entry) {
            value = entry[metric.key];
          }

          let cellClass = "";
          if (metric.isPositive && value > 0) cellClass = "positive";
          else if (!metric.isPositive && value > 0) cellClass = "negative";
          else if (value < 0) cellClass = "negative";

          const formattedValue =
            value === 0 ? "-" : value.toLocaleString("vi-VN");
          metricRow.append(
            `<td class="${cellClass}" style="min-width: 120px; text-align: right;">${formattedValue}</td>`
          );
        });

        tableBody.append(metricRow);
      });
    });

    // Add click handlers for cost center rows
    $(".cost-center-row").on("click", function () {
      const costCenter = $(this).data("cost-center");
      const toggle = $(this).find(".cost-center-toggle");
      const isExpanded = $(this).hasClass("expanded");

      if (isExpanded) {
        // Collapse
        $(this).removeClass("expanded");
        toggle.removeClass("expanded");
        $(`.monthly-data-row[data-parent="${costCenter}"]`).removeClass("show");
      } else {
        // Expand
        $(this).addClass("expanded");
        toggle.addClass("expanded");
        $(`.monthly-data-row[data-parent="${costCenter}"]`).addClass("show");
      }
    });

    // Wait for DOM to be ready before initializing DataTable
    setTimeout(() => {
      // Initialize DataTable with specific configuration
      currentTable = $("#revenueTable").DataTable({
        responsive: false,
        scrollX: true,
        scrollY: "500px",
        paging: false,
        searching: false,
        ordering: false,
        info: false,
        autoWidth: false,
        dom: "Bt",
        buttons: [
          {
            extend: "excelHtml5",
            text: "Xuất Excel",
            className: "btn btn-success",
            title: "Báo cáo doanh thu",
            filename: function () {
              const year = $("#yearSelect").val();
              const selectedCostCenters = $("#costCenterSelect").val();
              let fileName = `Bao_cao_doanh_thu_${year}`;
              if (
                selectedCostCenters &&
                selectedCostCenters.length > 0 &&
                !selectedCostCenters.includes("all")
              ) {
                fileName += `_${selectedCostCenters.join("_")}`;
              }
              return fileName;
            },
            exportOptions: {
              format: {
                body: function (data, row, column, node) {
                  return data.replace(/\./g, "").replace(/,/g, "");
                },
              },
            },
          },
        ],
        language: {
          decimal: "",
          emptyTable: "Không có dữ liệu trong bảng",
          processing: "Đang xử lý...",
          zeroRecords: "Không tìm thấy kết quả phù hợp",
        },
      });

      // Add the buttons to the DOM
      currentTable.buttons().container().appendTo($(".card-body .mb-3"));

      // Force column adjustment after initialization
      setTimeout(() => {
        if (currentTable) {
          currentTable.columns.adjust();
        }
      }, 100);
    }, 50);

    return Object.values(pivotData);
  }

  // Function to update budget summary
  function updateBudgetSummary(data, year) {
    const budgetContainer = $("#budgetSummaryContainer");
    const budgetDetails = $("#budgetDetails");

    if (year != 2025) {
      budgetContainer.hide();
      return;
    }

    let totalNetRevenue = 0;
    let totalSales = 0;
    let totalPurchases = 0;
    let totalTransport = 0;
    let totalCommissionPurchase = 0;
    let totalCommissionSale = 0;
    let totalSalary = 0;
    let totalPayments = 0;

    // Calculate totals
    data.forEach((item) => {
      totalSales += item.totalSale;
      totalPurchases += item.totalPurchase;
      totalTransport += item.totalTransport;
      totalCommissionPurchase += item.totalCommissionPurchase;
      totalCommissionSale += item.totalCommissionSale;
      totalSalary += item.totalSalary;
      totalPayments += item.totalPayments;
      totalNetRevenue += item.netRevenue;
    });

    const currentBudget = STARTING_BUDGET_2025 + totalNetRevenue;

    // Format numbers
    const format = (num) => num.toLocaleString("vi-VN");

    // Build HTML
    const html = `
      <div class="budget-item">
        <span>Ngân sách ban đầu:</span>
        <span>${format(STARTING_BUDGET_2025)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng doanh thu bán hàng:</span>
        <span class="positive">${format(totalSales)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng chi phí mua hàng:</span>
        <span class="negative">-${format(totalPurchases)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng chi phí vận chuyển:</span>
        <span class="negative">-${format(totalTransport)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng hoa hồng mua hàng:</span>
        <span class="negative">-${format(totalCommissionPurchase)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng hoa hồng bán hàng:</span>
        <span class="negative">-${format(totalCommissionSale)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng chi phí lương:</span>
        <span class="negative">-${format(totalSalary)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng thanh toán khác:</span>
        <span class="negative">-${format(totalPayments)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng doanh thu ròng (2025):</span>
        <span class="${totalNetRevenue >= 0 ? "positive" : "negative"}">
          ${totalNetRevenue >= 0 ? "+" : ""}${format(totalNetRevenue)} VNĐ
        </span>
      </div>
      <div class="budget-item budget-total">
        <span>Ngân sách hiện tại:</span>
        <span class="${
          currentBudget >= STARTING_BUDGET_2025 ? "positive" : "negative"
        }">
          ${format(currentBudget)} VNĐ
        </span>
      </div>
    `;

    budgetDetails.html(html);
    budgetContainer.show();
  }

  // Group Management Functions
  function initializeCostCenterGrid() {
    const grid = $("#costCenterGrid");
    grid.empty();

    if (allCostCenters.length === 0) {
      grid.html('<div class="text-center text-muted">Không có trạm nào</div>');
      return;
    }

    // Group cost centers by category
    const categorizedCenters = {};
    allCostCenters.forEach((costCenter) => {
      if (!categorizedCenters[costCenter.category]) {
        categorizedCenters[costCenter.category] = [];
      }
      categorizedCenters[costCenter.category].push(costCenter);
    });

    // Add category sections
    Object.keys(categorizedCenters).forEach((category) => {
      const categoryHeader = $(`
        <div class="category-header mt-3 mb-2">
          <strong>${category}</strong>
          <hr class="my-1">
        </div>
      `);
      grid.append(categoryHeader);

      categorizedCenters[category].forEach((costCenter) => {
        const item = $(`
          <div class="cost-center-item" data-value="${
            costCenter.name
          }" data-category="${costCenter.category}">
            <input type="checkbox" id="cc_${costCenter.name.replace(
              /\s/g,
              "_"
            )}" />
            <label for="cc_${costCenter.name.replace(
              /\s/g,
              "_"
            )}" style="margin-bottom: 0; cursor: pointer; flex: 1;">
              ${costCenter.name}
            </label>
          </div>
        `);
        grid.append(item);
      });
    });

    // Handle cost center item click
    $(".cost-center-item").on("click", function (e) {
      if (e.target.type !== "checkbox") {
        const checkbox = $(this).find('input[type="checkbox"]');
        checkbox.prop("checked", !checkbox.prop("checked"));
      }
      const costCenterName = $(this).data("value");
      const isChecked = $(this).find('input[type="checkbox"]').prop("checked");

      if (isChecked) {
        selectedCostCenters.add(costCenterName);
        $(this).addClass("selected");
      } else {
        selectedCostCenters.delete(costCenterName);
        $(this).removeClass("selected");
      }
      updateSelectedCount();
    });

    // Handle checkbox change
    $('.cost-center-item input[type="checkbox"]').on("change", function () {
      const costCenterName = $(this).closest(".cost-center-item").data("value");
      const isChecked = $(this).prop("checked");

      if (isChecked) {
        selectedCostCenters.add(costCenterName);
        $(this).closest(".cost-center-item").addClass("selected");
      } else {
        selectedCostCenters.delete(costCenterName);
        $(this).closest(".cost-center-item").removeClass("selected");
      }
      updateSelectedCount();
    });
  }

  function updateSelectedCount() {
    const count = selectedCostCenters.size;
    $("#selectedCount").text(`${count} trạm được chọn`);
    // Enable/disable save button
    $("#saveGroup").prop(
      "disabled",
      count === 0 || !$("#groupName").val().trim()
    );
  }

  // Selection action buttons
  $("#selectAll").on("click", function () {
    $(".cost-center-item").each(function () {
      const costCenterName = $(this).data("value");
      selectedCostCenters.add(costCenterName);
      $(this).addClass("selected");
      $(this).find('input[type="checkbox"]').prop("checked", true);
    });
    updateSelectedCount();
  });

  $("#clearAll").on("click", function () {
    $(".cost-center-item").each(function () {
      const costCenterName = $(this).data("value");
      selectedCostCenters.delete(costCenterName);
      $(this).removeClass("selected");
      $(this).find('input[type="checkbox"]').prop("checked", false);
    });
    updateSelectedCount();
  });

  $("#invertSelection").on("click", function () {
    $(".cost-center-item").each(function () {
      const costCenterName = $(this).data("value");
      const checkbox = $(this).find('input[type="checkbox"]');
      const isCurrentlyChecked = checkbox.prop("checked");

      if (isCurrentlyChecked) {
        selectedCostCenters.delete(costCenterName);
        $(this).removeClass("selected");
        checkbox.prop("checked", false);
      } else {
        selectedCostCenters.add(costCenterName);
        $(this).addClass("selected");
        checkbox.prop("checked", true);
      }
    });
    updateSelectedCount();
  });

  // Monitor group name input
  $("#groupName").on("input", function () {
    const hasName = $(this).val().trim();
    const hasSelection = selectedCostCenters.size > 0;
    $("#saveGroup").prop("disabled", !hasName || !hasSelection);
  });

  function saveCostCenterGroup() {
    const name = $("#groupName").val().trim();
    const costCenters = Array.from(selectedCostCenters);

    if (!name) {
      alert("Vui lòng nhập tên nhóm");
      return;
    }

    if (costCenters.length === 0) {
      alert("Vui lòng chọn ít nhất một trạm");
      return;
    }

    $.ajax({
      url: "/financeSummaryCostCenterGroups",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        name,
        costCenters,
      }),
      success: function () {
        // Reset form
        $("#groupName").val("");
        selectedCostCenters.clear();
        $(".cost-center-item").removeClass("selected");
        $('.cost-center-item input[type="checkbox"]').prop("checked", false);
        updateSelectedCount();

        // Reload groups list
        loadCostCenterGroups();

        // Show success message
        alert("Nhóm đã được tạo thành công!");
      },
      error: function (xhr) {
        const errorMsg = xhr.responseJSON?.message || "Lỗi khi lưu nhóm";
        alert(errorMsg);
      },
    });
  }

  $("#saveGroup").on("click", saveCostCenterGroup);

  function loadCostCenterGroups() {
    $("#groupList").html(
      '<div class="list-group-item text-muted text-center">Đang tải nhóm...</div>'
    );

    $.ajax({
      url: "/financeSummaryCostCenterGroups",
      method: "GET",
      success: function (groups) {
        const groupList = $("#groupList");
        groupList.empty();

        if (groups.length === 0) {
          groupList.html(
            '<div class="list-group-item text-muted text-center">Bạn chưa có nhóm nào</div>'
          );
          return;
        }

        groups.forEach((group) => {
          const groupItem = $(`
            <div class="list-group-item group-item d-flex justify-content-between align-items-center">
              <div style="flex: 1; cursor: pointer;">
                <strong>${group.name}</strong>
                <div class="text-muted small">${
                  group.costCenters.length
                } trạm</div>
                <div class="text-muted small" style="font-size: 0.75em;">${group.costCenters.join(
                  ", "
                )}</div>
              </div>
              <div>
                <button class="btn btn-sm btn-outline-danger delete-group" data-id="${
                  group._id
                }" title="Xóa nhóm">
                  ✕
                </button>
              </div>
            </div>
          `);

          groupItem.on("click", ".delete-group", function (e) {
            e.stopPropagation();
            const groupId = $(this).data("id");
            deleteCostCenterGroup(groupId);
          });

          groupItem
            .find('div[style*="cursor: pointer"]')
            .on("click", function () {
              applyGroupFilter(group.costCenters);
            });

          groupList.append(groupItem);
        });
      },
      error: function () {
        $("#groupList").html(
          '<div class="list-group-item text-danger text-center">Lỗi khi tải nhóm</div>'
        );
      },
    });
  }

  function applyGroupFilter(costCenters) {
    $("#costCenterSelect").val(costCenters).trigger("change");
    $("#groupModal").modal("hide");
    $("#filterForm").trigger("submit");
  }

  function deleteCostCenterGroup(groupId) {
    if (!confirm("Bạn có chắc chắn muốn xóa nhóm này không?")) return;

    $.ajax({
      url: `/financeSummaryCostCenterGroups/${groupId}`,
      method: "DELETE",
      success: function () {
        loadCostCenterGroups();
        alert("Nhóm đã được xóa thành công!");
      },
      error: function () {
        alert("Lỗi khi xóa nhóm");
      },
    });
  }

  // Initialize the group management modal when shown
  $("#groupModal").on("shown.bs.modal", function () {
    // Initialize the cost center grid
    initializeCostCenterGrid();
    // Load existing groups
    loadCostCenterGroups();
    // Reset form state
    selectedCostCenters.clear();
    $("#groupName").val("");
    updateSelectedCount();
  });

  // Reset modal state when hidden
  $("#groupModal").on("hidden.bs.modal", function () {
    selectedCostCenters.clear();
    $("#groupName").val("");
    $("#costCenterGrid").empty();
  });

  // Form submission handler - UPDATED to use new vertical stacked table function
  $("#filterForm").on("submit", function (e) {
    e.preventDefault();
    const year = $("#yearSelect").val();
    const selectedCostCenters = $("#costCenterSelect").val();
    const category = $("#categoryFilter").val();

    // Build the query parameters for multiple cost centers
    let queryParams = `year=${year}`;
    if (
      selectedCostCenters &&
      selectedCostCenters.length > 0 &&
      !selectedCostCenters.includes("all")
    ) {
      queryParams += `&costCenters=${selectedCostCenters.join(",")}`;
    }

    // Add category to query if filtering by category
    if (category !== "all") {
      queryParams += `&category=${category}`;
    }

    $.ajax({
      url: `/financeSummaryRevenueByCostCenter?${queryParams}`,
      method: "GET",
      success: function (data) {
        if (data.length === 0) {
          alert("Không tìm thấy dữ liệu cho năm đã chọn");
          $("#tableBody").html(
            '<tr><td colspan="100%" class="text-center text-muted">Không có dữ liệu</td></tr>'
          );
          $("#budgetSummaryContainer").hide();
          currentChartData = [];
          return;
        }

        // Use the new vertical stacked table function
        const pivotData = createVerticalStackedTable(data);
        currentChartData = pivotData;

        updateSelectedCentersInfo();
        updateBudgetSummary(pivotData, year);

        // Update charts if chart view is active
        if ($("#chartView").is(":checked")) {
          updateCharts();
        }
      },
      error: function (xhr, status, error) {
        alert("Lỗi khi tải dữ liệu: " + error);
      },
    });
  });

  // Initial load
  $("#filterForm").trigger("submit");
});
