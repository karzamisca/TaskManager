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
      hiddenForCategories: [],
    },
    {
      key: "totalPurchase",
      label: "Tổng Mua Hàng",
      isPositive: false,
      color: "#dc3545",
      hiddenForCategories: ["Thuê bồn", "Thuê trạm"],
    },
    {
      key: "totalTransport",
      label: "Chi Phí Vận Chuyển",
      isPositive: false,
      color: "#ffc107",
      hiddenForCategories: ["Thuê bồn", "Thuê trạm"],
    },
    {
      key: "totalCommissionPurchase",
      label: "Hoa Hồng Mua Hàng",
      isPositive: false,
      color: "#fd7e14",
      hiddenForCategories: ["Thuê bồn", "Thuê trạm"],
    },
    {
      key: "totalCommissionSale",
      label: "Hoa Hồng Bán Hàng",
      isPositive: false,
      color: "#e83e8c",
      hiddenForCategories: [],
    },
    {
      key: "totalSalary",
      label: "Tổng Lương",
      isPositive: false,
      color: "#6f42c1",
      hiddenForCategories: [],
    },
    {
      key: "totalPayments",
      label: "Tổng Thanh Toán",
      isPositive: false,
      color: "#6c757d",
      hiddenForCategories: [],
    },
    {
      key: "netRevenue",
      label: "Doanh Thu Ròng",
      isPositive: true,
      color: "#007bff",
      hiddenForCategories: [],
    },
  ];

  // Construction metrics
  const constructionMetrics = [
    {
      key: "constructionIncome",
      label: "Thu Xây Dựng",
      isPositive: true,
      color: "#20c997",
    },
    {
      key: "constructionExpense",
      label: "Chi Xây Dựng",
      isPositive: false,
      color: "#fd7e14",
    },
    {
      key: "constructionNet",
      label: "Lợi Nhuận Xây Dựng",
      isPositive: true,
      color: "#0dcaf0",
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

  // Function to get cost center category
  function getCostCenterCategory(costCenterName) {
    const costCenter = allCostCenters.find((cc) => cc.name === costCenterName);
    return costCenter ? costCenter.category : null;
  }

  // Function to check if metric should be hidden for a category
  function shouldHideMetricForCategory(metricKey, category) {
    const metric = metrics.find((m) => m.key === metricKey);
    return metric && metric.hiddenForCategories.includes(category);
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
        option.data("category", costCenter.category);
        costCenterSelect.append(option);
      }
    });

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

  // Chart creation functions
  function createMainChart(data, chartType, metric, groupBy) {
    if (typeof Chart === "undefined") {
      console.error("Chart.js not available when creating main chart");
      return;
    }

    const ctx = document.getElementById("mainChart").getContext("2d");
    if (mainChart) {
      mainChart.destroy();
    }

    const metricInfo = [...metrics, ...constructionMetrics].find(
      (m) => m.key === metric
    );
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
      chartData = labels.map((label) => Math.ceil(monthData[label]));
    } else {
      const centerData = {};
      data.forEach((item) => {
        if (!centerData[item.costCenter]) {
          centerData[item.costCenter] = 0;
        }
        centerData[item.costCenter] += item[metric] || 0;
      });
      labels = Object.keys(centerData).sort();
      chartData = labels.map((label) => Math.ceil(centerData[label]));
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
                return `${context.dataset.label}: ${Math.ceil(
                  value
                ).toLocaleString("vi-VN")} VNĐ`;
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
                      return Math.ceil(value).toLocaleString("vi-VN");
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
    const chartData = labels.map((label) => Math.ceil(monthlyData[label]));

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
                return `Doanh thu ròng: ${Math.ceil(value).toLocaleString(
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
                return Math.ceil(value).toLocaleString("vi-VN");
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
      constructionIncome: 0,
      constructionExpense: 0,
      constructionNet: 0,
    };

    data.forEach((item) => {
      totals.totalSale += item.totalSale || 0;
      totals.totalPurchase += item.totalPurchase || 0;
      totals.totalTransport += item.totalTransport || 0;
      totals.totalCommissionPurchase += item.totalCommissionPurchase || 0;
      totals.totalCommissionSale += item.totalCommissionSale || 0;
      totals.totalSalary += item.totalSalary || 0;
      totals.totalPayments += item.totalPayments || 0;
      totals.constructionIncome += item.constructionIncome || 0;
      totals.constructionExpense += item.constructionExpense || 0;
      totals.constructionNet += item.constructionNet || 0;
    });

    const labels = [
      "Thu nhập",
      "Chi phí",
      "Thu Xây dựng",
      "Chi Xây dựng",
      "Lợi nhuận Xây dựng",
    ];
    const chartData = [
      Math.ceil(totals.totalSale),
      Math.ceil(
        totals.totalPurchase +
          totals.totalTransport +
          totals.totalCommissionPurchase +
          totals.totalCommissionSale +
          totals.totalSalary +
          totals.totalPayments
      ),
      Math.ceil(totals.constructionIncome),
      Math.ceil(totals.constructionExpense),
      Math.ceil(totals.constructionNet),
    ];

    comparisonChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "VNĐ",
            data: chartData,
            backgroundColor: [
              "#28a745",
              "#dc3545",
              "#20c997",
              "#fd7e14",
              "#0dcaf0",
            ],
            borderColor: [
              "#28a745",
              "#dc3545",
              "#20c997",
              "#fd7e14",
              "#0dcaf0",
            ],
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
                return `${context.label}: ${Math.ceil(
                  context.parsed.y
                ).toLocaleString("vi-VN")} VNĐ`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return Math.ceil(value).toLocaleString("vi-VN");
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

    const monthlyData = {};
    data.forEach((item) => {
      const monthKey = `${item.month}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          totalSale: 0,
          totalPurchase: 0,
          netRevenue: 0,
          totalTransport: 0,
          constructionIncome: 0,
          constructionExpense: 0,
          constructionNet: 0,
        };
      }
      monthlyData[monthKey].totalSale += item.totalSale || 0;
      monthlyData[monthKey].totalPurchase += item.totalPurchase || 0;
      monthlyData[monthKey].netRevenue += item.netRevenue || 0;
      monthlyData[monthKey].totalTransport += item.totalTransport || 0;
      monthlyData[monthKey].constructionIncome += item.constructionIncome || 0;
      monthlyData[monthKey].constructionExpense +=
        item.constructionExpense || 0;
      monthlyData[monthKey].constructionNet += item.constructionNet || 0;
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
        data: labels.map((label) => Math.ceil(monthlyData[label].netRevenue)),
        borderColor: "#007bff",
        backgroundColor: "#007bff20",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Tổng Bán Hàng",
        data: labels.map((label) => Math.ceil(monthlyData[label].totalSale)),
        borderColor: "#28a745",
        backgroundColor: "#28a74520",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Tổng Mua Hàng",
        data: labels.map((label) =>
          Math.ceil(monthlyData[label].totalPurchase)
        ),
        borderColor: "#dc3545",
        backgroundColor: "#dc354520",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Thu Xây Dựng",
        data: labels.map((label) =>
          Math.ceil(monthlyData[label].constructionIncome)
        ),
        borderColor: "#20c997",
        backgroundColor: "#20c99720",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Chi Xây Dựng",
        data: labels.map((label) =>
          Math.ceil(monthlyData[label].constructionExpense)
        ),
        borderColor: "#fd7e14",
        backgroundColor: "#fd7e1420",
        fill: false,
        tension: 0.4,
      },
      {
        label: "Lợi Nhuận Xây Dựng",
        data: labels.map((label) =>
          Math.ceil(monthlyData[label].constructionNet)
        ),
        borderColor: "#0dcaf0",
        backgroundColor: "#0dcaf020",
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
                return `${context.dataset.label}: ${Math.ceil(
                  context.parsed.y
                ).toLocaleString("vi-VN")} VNĐ`;
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
                return Math.ceil(value).toLocaleString("vi-VN");
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
    // Placeholder function - can be implemented if needed
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

  // Function to create vertical stacked table with construction as separate category
  function createVerticalStackedTable(data) {
    if (currentTable) {
      currentTable.destroy();
      currentTable = null;
    }

    const pivotData = {};
    const categories = new Set();
    const costCenters = new Set();
    const months = new Set();

    data.forEach((item) => {
      const category =
        getCostCenterCategory(item.costCenter) || "Không phân loại";
      const centerMonthKey = `${category}_${item.costCenter}_${item.actualMonth}_${item.actualYear}`;

      categories.add(category);
      costCenters.add(item.costCenter);
      months.add(`${item.actualMonth} ${item.actualYear}`);

      if (!pivotData[centerMonthKey]) {
        pivotData[centerMonthKey] = {
          category: category,
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
          constructionIncome: 0,
          constructionExpense: 0,
          constructionNet: 0,
          netRevenue: 0,
        };
      }

      const entry = pivotData[centerMonthKey];

      // Backend already aggregates all data per cost center per month
      // So we should use direct assignment OR only add once per centerMonthKey
      // Since we're creating unique keys, this block only runs once per combination
      entry.totalSale += item.totalSale || 0;
      entry.totalPurchase += item.totalPurchase || 0;
      entry.totalTransport += item.totalTransport || 0;
      entry.totalCommissionPurchase += item.totalCommissionPurchase || 0;
      entry.totalCommissionSale += item.totalCommissionSale || 0;
      entry.totalSalary += item.totalSalary || 0; // Backend already summed all employees
      entry.totalPayments += item.totalPayments || 0;
      entry.constructionIncome += item.constructionIncome || 0;
      entry.constructionExpense += item.constructionExpense || 0;
      entry.constructionNet += item.constructionNet || 0;

      // Recalculate net revenue
      entry.netRevenue =
        entry.totalSale -
        entry.totalPurchase -
        entry.totalTransport -
        entry.totalCommissionPurchase -
        entry.totalCommissionSale -
        entry.totalSalary -
        entry.totalPayments;
    });

    // Round all numeric values in pivotData
    Object.keys(pivotData).forEach((key) => {
      const entry = pivotData[key];
      entry.totalSale = Math.ceil(entry.totalSale);
      entry.totalPurchase = Math.ceil(entry.totalPurchase);
      entry.totalTransport = Math.ceil(entry.totalTransport);
      entry.totalCommissionPurchase = Math.ceil(entry.totalCommissionPurchase);
      entry.totalCommissionSale = Math.ceil(entry.totalCommissionSale);
      entry.totalSalary = Math.ceil(entry.totalSalary);
      entry.totalPayments = Math.ceil(entry.totalPayments);
      entry.constructionIncome = Math.ceil(entry.constructionIncome);
      entry.constructionExpense = Math.ceil(entry.constructionExpense);
      entry.constructionNet = Math.ceil(entry.constructionNet);
      entry.netRevenue = Math.ceil(entry.netRevenue);
    });

    const sortedCategories = Array.from(categories).sort();
    const sortedCostCenters = Array.from(costCenters).sort();
    const sortedMonths = Array.from(months).sort((a, b) => {
      const [monthA, yearA] = a.split(" ");
      const [monthB, yearB] = b.split(" ");
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return (monthOrder[monthA] || 0) - (monthOrder[monthB] || 0);
    });

    const tableHead = $("#tableHead");
    tableHead.empty();

    const headerRow = $("<tr></tr>");
    headerRow.append('<th class="first-column">Loại / Chỉ số / Trạm</th>');
    sortedMonths.forEach((month) => {
      headerRow.append(
        `<th class="month-column" style="text-align: center;">${month}</th>`
      );
    });
    tableHead.append(headerRow);

    const tableBody = $("#tableBody");
    tableBody.empty();

    const costCentersByCategory = {};
    Object.values(pivotData).forEach((item) => {
      if (!costCentersByCategory[item.category]) {
        costCentersByCategory[item.category] = new Set();
      }
      costCentersByCategory[item.category].add(item.costCenter);
    });

    const constructionData = {};
    Object.values(pivotData).forEach((item) => {
      if (!constructionData[item.costCenter]) {
        constructionData[item.costCenter] = {};
      }
      constructionData[item.costCenter][item.month] = {
        constructionIncome: Math.ceil(item.constructionIncome),
        constructionExpense: Math.ceil(item.constructionExpense),
        constructionNet: Math.ceil(item.constructionNet),
      };
    });

    // Calculate total revenue across all categories (excluding construction) for each month
    const monthlyRevenueData = {};
    sortedMonths.forEach((month) => {
      monthlyRevenueData[month] = 0;
    });

    // First, process all categories and accumulate revenue data
    sortedCategories.forEach((category) => {
      if (category === "Xây Dựng") return;

      // Accumulate revenue data for the summary row
      sortedMonths.forEach((month) => {
        const categoryCostCenters = Array.from(
          costCentersByCategory[category] || []
        );

        categoryCostCenters.forEach((costCenter) => {
          const entry = Object.values(pivotData).find(
            (item) =>
              item.costCenter === costCenter &&
              item.month === month &&
              item.category === category
          );
          if (entry) {
            // Calculate revenue from all metrics
            monthlyRevenueData[month] +=
              (entry.totalSale || 0) -
              (entry.totalPurchase || 0) -
              (entry.totalTransport || 0) -
              (entry.totalCommissionPurchase || 0) -
              (entry.totalCommissionSale || 0) -
              (entry.totalSalary || 0) -
              (entry.totalPayments || 0);
          }
        });
      });
    });

    // Now create the table rows
    sortedCategories.forEach((category) => {
      if (category === "Xây Dựng") return;

      const categoryRow = $(
        `<tr class="category-row" data-category="${category}"></tr>`
      );
      categoryRow.append(
        `<td class="first-column">
          <span class="category-toggle">▶</span>
          <strong class="text-primary">${category}</strong>
        </td>`
      );

      sortedMonths.forEach(() => {
        categoryRow.append(
          `<td class="month-column" style="text-align: right; font-weight: bold;"></td>`
        );
      });

      tableBody.append(categoryRow);

      let filteredMetrics = [...metrics];

      if (category === "Thuê bồn") {
        filteredMetrics = filteredMetrics.filter(
          (metric) => metric.key !== "totalSalary"
        );
      } else if (category === "Đội") {
        filteredMetrics = filteredMetrics.filter((metric) =>
          ["totalSalary", "totalPayments", "netRevenue"].includes(metric.key)
        );
      }

      filteredMetrics.forEach((metric) => {
        if (shouldHideMetricForCategory(metric.key, category)) {
          return;
        }

        const metricRow = $(
          `<tr class="metric-row" data-category="${category}" data-metric="${metric.key}" style="display: none;"></tr>`
        );
        metricRow.append(
          `<td class="first-column" style="width: 250px; min-width: 250px; max-width: 250px; padding-left: 30px; white-space: nowrap;">
            <span class="metric-toggle">▶</span>
            <strong>${metric.label}</strong>
          </td>`
        );

        sortedMonths.forEach((month) => {
          let totalValue = 0;
          const categoryCostCenters = Array.from(
            costCentersByCategory[category] || []
          );

          categoryCostCenters.forEach((costCenter) => {
            const entry = Object.values(pivotData).find(
              (item) =>
                item.costCenter === costCenter &&
                item.month === month &&
                item.category === category
            );
            if (entry) {
              totalValue += entry[metric.key] || 0;
            }
          });

          totalValue = Math.ceil(totalValue);

          let cellClass = "";
          if (metric.isPositive && totalValue > 0) cellClass = "positive";
          else if (!metric.isPositive && totalValue > 0) cellClass = "negative";
          else if (totalValue < 0) cellClass = "negative";

          const formattedValue =
            totalValue === 0 ? "-" : totalValue.toLocaleString("vi-VN");
          metricRow.append(
            `<td class="month-column ${cellClass}" style="width: 150px; min-width: 150px; max-width: 150px; text-align: right; font-weight: bold; white-space: nowrap;">${formattedValue}</td>`
          );
        });

        tableBody.append(metricRow);

        const categoryCostCenters = Array.from(
          costCentersByCategory[category] || []
        ).sort();

        categoryCostCenters.forEach((costCenter) => {
          const costCenterRow = $(
            `<tr class="cost-center-row" data-category="${category}" data-metric="${metric.key}" data-cost-center="${costCenter}" style="display: none;"></tr>`
          );
          costCenterRow.append(
            `<td class="first-column" style="padding-left: 60px;">
              <strong>${costCenter}</strong>
            </td>`
          );

          sortedMonths.forEach((month) => {
            const entry = Object.values(pivotData).find(
              (item) =>
                item.costCenter === costCenter &&
                item.month === month &&
                item.category === category
            );
            let value = entry ? Math.ceil(entry[metric.key] || 0) : 0;

            let cellClass = "";
            if (metric.isPositive && value > 0) cellClass = "positive";
            else if (!metric.isPositive && value > 0) cellClass = "negative";
            else if (value < 0) cellClass = "negative";

            const formattedValue =
              value === 0 ? "-" : value.toLocaleString("vi-VN");
            costCenterRow.append(
              `<td class="month-column ${cellClass}" style="text-align: right;">${formattedValue}</td>`
            );
          });

          tableBody.append(costCenterRow);
        });
      });
    });

    // Add single Revenue Calculation Row for all categories (excluding construction)
    const revenueRow = $(`<tr class="revenue-row"></tr>`);
    revenueRow.append(
      `<td class="first-column" style="width: 250px; min-width: 250px; max-width: 250px; padding-left: 15px; white-space: nowrap;">
        <strong>Tổng Doanh Thu</strong>
      </td>`
    );

    sortedMonths.forEach((month) => {
      const totalRevenue = Math.ceil(monthlyRevenueData[month]);

      let cellClass = "";
      if (totalRevenue > 0) cellClass = "positive";
      else if (totalRevenue < 0) cellClass = "negative";

      const formattedValue =
        totalRevenue === 0 ? "-" : totalRevenue.toLocaleString("vi-VN");
      revenueRow.append(
        `<td class="month-column ${cellClass}" style="width: 150px; min-width: 150px; max-width: 150px; text-align: right; font-weight: bold; white-space: nowrap;">${formattedValue}</td>`
      );
    });

    tableBody.append(revenueRow);

    const constructionCategoryRow = $(
      `<tr class="category-row" data-category="Xây Dựng"></tr>`
    );
    constructionCategoryRow.append(
      `<td class="first-column">
          <span class="category-toggle">▶</span>
          <strong class="text-primary">Mua bán và Xây dựng</strong>
        </td>`
    );

    sortedMonths.forEach(() => {
      constructionCategoryRow.append(
        `<td class="month-column" style="text-align: right; font-weight: bold;"></td>`
      );
    });

    tableBody.append(constructionCategoryRow);

    constructionMetrics.forEach((metric) => {
      const metricRow = $(
        `<tr class="metric-row" data-category="Xây Dựng" data-metric="${metric.key}" style="display: none;"></tr>`
      );
      metricRow.append(
        `<td class="first-column" style="width: 250px; min-width: 250px; max-width: 250px; padding-left: 30px; white-space: nowrap;">
            <span class="metric-toggle">▶</span>
            <strong>${metric.label}</strong>
          </td>`
      );

      sortedMonths.forEach((month) => {
        let totalValue = 0;
        Object.keys(constructionData).forEach((costCenter) => {
          if (constructionData[costCenter][month]) {
            totalValue += constructionData[costCenter][month][metric.key] || 0;
          }
        });

        totalValue = Math.ceil(totalValue);

        let cellClass = "";
        if (metric.isPositive && totalValue > 0) cellClass = "positive";
        else if (!metric.isPositive && totalValue > 0) cellClass = "negative";
        else if (totalValue < 0) cellClass = "negative";

        const formattedValue =
          totalValue === 0 ? "-" : totalValue.toLocaleString("vi-VN");
        metricRow.append(
          `<td class="month-column ${cellClass}" style="width: 150px; min-width: 150px; max-width: 150px; text-align: right; font-weight: bold; white-space: nowrap;">${formattedValue}</td>`
        );
      });

      tableBody.append(metricRow);

      const constructionCostCenters = Object.keys(constructionData).sort();
      constructionCostCenters.forEach((costCenter) => {
        const costCenterRow = $(
          `<tr class="cost-center-row" data-category="Xây Dựng" data-metric="${metric.key}" data-cost-center="${costCenter}" style="display: none;"></tr>`
        );
        costCenterRow.append(
          `<td class="first-column" style="padding-left: 60px;">
              <strong>${costCenter}</strong>
            </td>`
        );

        sortedMonths.forEach((month) => {
          let value = 0;
          if (constructionData[costCenter][month]) {
            value = Math.ceil(
              constructionData[costCenter][month][metric.key] || 0
            );
          }

          let cellClass = "";
          if (metric.isPositive && value > 0) cellClass = "positive";
          else if (!metric.isPositive && value > 0) cellClass = "negative";
          else if (value < 0) cellClass = "negative";

          const formattedValue =
            value === 0 ? "-" : value.toLocaleString("vi-VN");
          costCenterRow.append(
            `<td class="month-column ${cellClass}" style="text-align: right;">${formattedValue}</td>`
          );
        });

        tableBody.append(costCenterRow);
      });
    });

    $(".category-row").on("click", function () {
      const category = $(this).data("category");
      const toggle = $(this).find(".category-toggle");
      const isExpanded = $(this).hasClass("expanded");

      if (isExpanded) {
        $(this).removeClass("expanded");
        toggle.removeClass("expanded");
        $(`.metric-row[data-category="${category}"]`).hide();
        $(`.cost-center-row[data-category="${category}"]`).hide();
      } else {
        $(this).addClass("expanded");
        toggle.addClass("expanded");
        $(`.metric-row[data-category="${category}"]`).show();
      }
    });

    $(".metric-row").on("click", function (e) {
      e.stopPropagation();

      const metric = $(this).data("metric");
      const category = $(this).data("category");
      const toggle = $(this).find(".metric-toggle");
      const isExpanded = $(this).hasClass("expanded");

      if (isExpanded) {
        $(this).removeClass("expanded");
        toggle.removeClass("expanded");
        $(
          `.cost-center-row[data-category="${category}"][data-metric="${metric}"]`
        ).hide();
      } else {
        $(this).addClass("expanded");
        toggle.addClass("expanded");
        $(
          `.cost-center-row[data-category="${category}"][data-metric="${metric}"]`
        ).show();
      }
    });

    setTimeout(() => {
      currentTable = $("#revenueTable").DataTable({
        responsive: false,
        scrollX: true,
        scrollY: "500px",
        paging: false,
        searching: false,
        ordering: false,
        info: false,
        autoWidth: true,
        fixedColumns: {
          leftColumns: 1,
        },
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
                  let cleanData = $(data).text() || data;

                  if (column === 0) {
                    cleanData = cleanData.replace(/^\s*▶?\s*/, "").trim();
                  } else {
                    cleanData = cleanData.replace(/\./g, "").replace(/,/g, "");
                  }

                  return cleanData;
                },
              },
              rows: function (idx, data, node) {
                return true;
              },
            },
            customize: function (xlsx) {
              var sheet = xlsx.xl.worksheets["sheet1.xml"];
              $("row:first c", sheet).attr("s", "2");
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

      currentTable.buttons().container().appendTo($(".card-body .mb-3"));

      setTimeout(() => {
        if (currentTable) {
          currentTable.columns.adjust();
          $("#revenueTable").css("table-layout", "auto");
        }
      }, 100);
    }, 50);

    return Object.values(pivotData);
  }
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
    let totalConstructionIncome = 0;
    let totalConstructionExpense = 0;
    let totalConstructionNet = 0;

    data.forEach((item) => {
      const costCenterCategory = getCostCenterCategory(item.costCenter);

      totalSales += item.totalSale;
      totalCommissionSale += item.totalCommissionSale;
      totalSalary += item.totalSalary;
      totalPayments += item.totalPayments;
      totalConstructionIncome += item.constructionIncome || 0;
      totalConstructionExpense += item.constructionExpense || 0;
      totalConstructionNet += item.constructionNet || 0;

      if (!shouldHideMetricForCategory("totalPurchase", costCenterCategory)) {
        totalPurchases += item.totalPurchase;
      }
      if (!shouldHideMetricForCategory("totalTransport", costCenterCategory)) {
        totalTransport += item.totalTransport;
      }
      if (
        !shouldHideMetricForCategory(
          "totalCommissionPurchase",
          costCenterCategory
        )
      ) {
        totalCommissionPurchase += item.totalCommissionPurchase;
      }

      totalNetRevenue += item.netRevenue;
    });

    totalSales = Math.ceil(totalSales);
    totalPurchases = Math.ceil(totalPurchases);
    totalTransport = Math.ceil(totalTransport);
    totalCommissionPurchase = Math.ceil(totalCommissionPurchase);
    totalCommissionSale = Math.ceil(totalCommissionSale);
    totalSalary = Math.ceil(totalSalary);
    totalPayments = Math.ceil(totalPayments);
    totalConstructionIncome = Math.ceil(totalConstructionIncome);
    totalConstructionExpense = Math.ceil(totalConstructionExpense);
    totalConstructionNet = Math.ceil(totalConstructionNet);
    totalNetRevenue = Math.ceil(totalNetRevenue);

    const currentBudget = STARTING_BUDGET_2025 + totalNetRevenue;

    const format = (num) => num.toLocaleString("vi-VN");

    let html = `
      <div class="budget-item">
        <span>Ngân sách ban đầu:</span>
        <span>${format(STARTING_BUDGET_2025)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Tổng doanh thu bán hàng:</span>
        <span class="positive">${format(totalSales)} VNĐ</span>
      </div>`;

    if (totalPurchases > 0) {
      html += `
      <div class="budget-item">
        <span>Tổng chi phí mua hàng:</span>
        <span class="negative">-${format(totalPurchases)} VNĐ</span>
      </div>`;
    }

    if (totalTransport > 0) {
      html += `
      <div class="budget-item">
        <span>Tổng chi phí vận chuyển:</span>
        <span class="negative">-${format(totalTransport)} VNĐ</span>
      </div>`;
    }

    if (totalCommissionPurchase > 0) {
      html += `
      <div class="budget-item">
        <span>Tổng hoa hồng mua hàng:</span>
        <span class="negative">-${format(totalCommissionPurchase)} VNĐ</span>
      </div>`;
    }

    html += `
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
        <span>Thu từ mua bán và xây dựng:</span>
        <span class="positive">+${format(totalConstructionIncome)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Chi từ mua bán và xây dựng:</span>
        <span class="negative">-${format(totalConstructionExpense)} VNĐ</span>
      </div>
      <div class="budget-item">
        <span>Lợi nhuận mua bán và xây dựng:</span>
        <span class="${totalConstructionNet >= 0 ? "positive" : "negative"}">
          ${totalConstructionNet >= 0 ? "+" : ""}${format(
      totalConstructionNet
    )} VNĐ
        </span>
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

  function initializeCostCenterGrid() {
    const grid = $("#costCenterGrid");
    grid.empty();

    if (allCostCenters.length === 0) {
      grid.html('<div class="text-center text-muted">Không có trạm nào</div>');
      return;
    }

    const categorizedCenters = {};
    allCostCenters.forEach((costCenter) => {
      if (!categorizedCenters[costCenter.category]) {
        categorizedCenters[costCenter.category] = [];
      }
      categorizedCenters[costCenter.category].push(costCenter);
    });

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
    $("#saveGroup").prop(
      "disabled",
      count === 0 || !$("#groupName").val().trim()
    );
  }

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
        $("#groupName").val("");
        selectedCostCenters.clear();
        $(".cost-center-item").removeClass("selected");
        $('.cost-center-item input[type="checkbox"]').prop("checked", false);
        updateSelectedCount();

        loadCostCenterGroups();

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

  $("#groupModal").on("shown.bs.modal", function () {
    initializeCostCenterGrid();
    loadCostCenterGroups();
    selectedCostCenters.clear();
    $("#groupName").val("");
    updateSelectedCount();
  });

  $("#groupModal").on("hidden.bs.modal", function () {
    selectedCostCenters.clear();
    $("#groupName").val("");
    $("#costCenterGrid").empty();
  });

  $("#filterForm").on("submit", function (e) {
    e.preventDefault();
    const year = $("#yearSelect").val();
    const selectedCostCenters = $("#costCenterSelect").val();
    const category = $("#categoryFilter").val();

    let queryParams = `year=${year}`;
    if (
      selectedCostCenters &&
      selectedCostCenters.length > 0 &&
      !selectedCostCenters.includes("all")
    ) {
      queryParams += `&costCenters=${selectedCostCenters.join(",")}`;
    }

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

        const pivotData = createVerticalStackedTable(data);
        currentChartData = pivotData;

        updateSelectedCentersInfo();
        updateBudgetSummary(pivotData, year);

        if ($("#chartView").is(":checked")) {
          updateCharts();
        }
      },
      error: function (xhr, status, error) {
        alert("Lỗi khi tải dữ liệu: " + error);
      },
    });
  });

  $("#filterForm").trigger("submit");
});
