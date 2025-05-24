////views/reportPages/reportSummary/reportSummary.js
class ReportSummary {
  constructor() {
    this.reports = [];
    this.filteredReports = [];
    this.isLoading = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadReports();
  }

  bindEvents() {
    const searchButton = document.getElementById("searchButton");
    const clearButton = document.getElementById("clearButton");
    const exportCsv = document.getElementById("exportCsv");
    const printReports = document.getElementById("printReports");

    searchButton.addEventListener("click", () => this.handleSearch());
    clearButton.addEventListener("click", () => this.clearFilters());
    exportCsv.addEventListener("click", () => this.exportToCsv());
    printReports.addEventListener("click", () => this.printReports());

    // Enter key search
    ["reportType", "costCenterSearch", "dateSearch"].forEach((id) => {
      document.getElementById(id).addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleSearch();
      });
    });
  }

  async handleSearch() {
    if (this.isLoading) return;

    this.setLoading(true);
    const filters = this.getFilters();

    try {
      await this.fetchReports(filters);
    } catch (error) {
      this.showError("Error loading reports. Please try again.");
    } finally {
      this.setLoading(false);
    }
  }

  getFilters() {
    return {
      reportType: document.getElementById("reportType").value,
      costCenter: document.getElementById("costCenterSearch").value,
      date: document.getElementById("dateSearch").value,
    };
  }

  clearFilters() {
    document.getElementById("reportType").value = "";
    document.getElementById("costCenterSearch").value = "";
    document.getElementById("dateSearch").value = "";
    this.loadReports();
  }

  async loadReports() {
    this.setLoading(true);
    try {
      await this.fetchReports({});
    } catch (error) {
      this.showError("Error loading reports. Please try again.");
    } finally {
      this.setLoading(false);
    }
  }

  async fetchReports(filters = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });

    const apiUrl = `/reportGet?${queryParams.toString()}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      this.reports = data || [];
      this.filteredReports = [...this.reports];
      this.displayReports();
      this.hideError();
    } catch (error) {
      console.error("Error fetching reports:", error);
      throw error;
    }
  }

  displayReports() {
    const reportList = document.getElementById("reportList");
    const noReports = document.getElementById("noReports");
    const resultsContainer = document.getElementById("resultsContainer");
    const resultsCount = document.getElementById("resultsCount");

    if (!this.filteredReports || this.filteredReports.length === 0) {
      reportList.innerHTML = "";
      noReports.style.display = "block";
      resultsContainer.style.display = "none";
      return;
    }

    noReports.style.display = "none";
    resultsContainer.style.display = "flex";
    resultsCount.textContent = `Tìm thấy ${this.filteredReports.length} báo cáo / Found ${this.filteredReports.length} reports`;

    reportList.innerHTML = this.filteredReports
      .map((report) => this.createReportCard(report))
      .join("");

    // Add animation to cards
    const cards = reportList.querySelectorAll(".report-card");
    cards.forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      setTimeout(() => {
        card.style.transition = "all 0.3s ease";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, index * 100);
    });
  }

  createReportCard(report) {
    const reportDate = new Date(report.submissionDate);
    const formattedDate = reportDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const reportTypeDisplay =
      report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1);

    return `
                    <div class="report-card">
                        <div class="report-header">
                            <div class="report-title">
                                ${reportTypeDisplay} Report
                                <span class="report-type-badge">${
                                  report.reportType
                                }</span>
                            </div>
                            <div class="report-meta">
                                <div class="meta-item">
                                    <div class="meta-label">Ngày nộp / Submission Date</div>
                                    <div class="meta-value">${formattedDate}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">Thời gian kiểm tra / Inspection Time</div>
                                    <div class="meta-value">${
                                      report.inspectionTime || "N/A"
                                    }</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">Người kiểm tra / Inspector</div>
                                    <div class="meta-value">${
                                      report.inspector?.username || "Unknown"
                                    }</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">Trạm / Center</div>
                                    <div class="meta-value">${
                                      report.costCenter?.name || "Unassigned"
                                    }</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="table-container">
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th>Nhiệm vụ / Task</th>
                                        <th>Tình trạng / Status</th>
                                        <th>Ghi chú / Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${
                                      report.items
                                        ?.map(
                                          (item) => `
                                        <tr>
                                            <td>${item.task || "N/A"}</td>
                                            <td>
                                                <span class="status-badge status-${
                                                  item.status
                                                }">
                                                    ${
                                                      item.status
                                                        ? "Có / Yes"
                                                        : "Không / No"
                                                    }
                                                </span>
                                            </td>
                                            <td>${item.notes || "-"}</td>
                                        </tr>
                                    `
                                        )
                                        .join("") ||
                                      '<tr><td colspan="3">No items found</td></tr>'
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
  }

  setLoading(loading) {
    this.isLoading = loading;
    const loadingMessage = document.getElementById("loadingMessage");
    const searchButton = document.getElementById("searchButton");
    const searchSpinner = document.getElementById("searchSpinner");
    const searchText = document.getElementById("searchText");

    if (loading) {
      loadingMessage.style.display = "flex";
      searchButton.disabled = true;
      searchSpinner.style.display = "block";
      searchText.textContent = "Đang tìm... / Searching...";
    } else {
      loadingMessage.style.display = "none";
      searchButton.disabled = false;
      searchSpinner.style.display = "none";
      searchText.textContent = "🔍 Tìm kiếm / Search";
    }
  }

  showError(message) {
    const errorMessage = document.getElementById("errorMessage");
    const errorText = document.getElementById("errorText");
    errorText.textContent = message;
    errorMessage.style.display = "flex";

    // Auto hide after 5 seconds
    setTimeout(() => this.hideError(), 5000);
  }

  hideError() {
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.style.display = "none";
  }

  exportToCsv() {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.showError("No reports to export");
      return;
    }

    try {
      const csvContent = this.generateCsvContent();
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `report-summary-${new Date().toISOString().split("T")[0]}.csv`
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      this.showError("Error exporting CSV");
    }
  }

  generateCsvContent() {
    const headers = [
      "Report Type",
      "Submission Date",
      "Inspection Time",
      "Inspector",
      "Cost Center",
      "Task",
      "Status",
      "Notes",
    ];

    let csvContent = headers.join(",") + "\n";

    this.filteredReports.forEach((report) => {
      const baseInfo = [
        `"${report.reportType || ""}"`,
        `"${report.submissionDate || ""}"`,
        `"${report.inspectionTime || ""}"`,
        `"${report.inspector?.username || ""}"`,
        `"${report.costCenter?.name || ""}"`,
      ];

      if (report.items && report.items.length > 0) {
        report.items.forEach((item) => {
          const row = [
            ...baseInfo,
            `"${item.task || ""}"`,
            `"${item.status ? "Yes" : "No"}"`,
            `"${item.notes || ""}"`,
          ];
          csvContent += row.join(",") + "\n";
        });
      } else {
        const row = [...baseInfo, '""', '""', '""'];
        csvContent += row.join(",") + "\n";
      }
    });

    return csvContent;
  }

  printReports() {
    if (!this.filteredReports || this.filteredReports.length === 0) {
      this.showError("No reports to print");
      return;
    }

    const printWindow = window.open("", "_blank");
    const printContent = this.generatePrintContent();

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  generatePrintContent() {
    const reportCards = this.filteredReports
      .map((report) => this.createReportCard(report))
      .join("");

    return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Report Summary - ${new Date().toLocaleDateString()}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
                            .report-card { margin-bottom: 30px; border: 1px solid #ccc; page-break-inside: avoid; }
                            .report-header { padding: 15px; background: #f5f5f5; border-bottom: 1px solid #ddd; }
                            .report-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                            .report-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                            .meta-item { margin-bottom: 8px; }
                            .meta-label { font-size: 12px; color: #666; font-weight: bold; }
                            .meta-value { font-size: 14px; }
                            table { width: 100%; border-collapse: collapse; margin: 15px; }
                            th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
                            th { background: #f0f0f0; font-weight: bold; }
                            .status-badge { padding: 2px 6px; border-radius: 3px; font-size: 12px; }
                            .status-true { background: #d4edda; color: #155724; }
                            .status-false { background: #f8d7da; color: #721c24; }
                        </style>
                    </head>
                    <body>
                        <h1>Report Summary - Generated on ${new Date().toLocaleDateString()}</h1>
                        <div class="report-list">${reportCards}</div>
                    </body>
                    </html>
                `;
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ReportSummary();
});

// Add some utility functions for enhanced UX

// Debounce function for search input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Enhanced search with auto-complete (if needed in future)
function setupAutoComplete() {
  // This could be implemented to provide suggestions for cost centers
  // based on previously entered values or API data
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + K to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    document.getElementById("costCenterSearch").focus();
  }

  // Escape to clear search
  if (e.key === "Escape") {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" || activeElement.tagName === "SELECT")
    ) {
      activeElement.blur();
    }
  }
});

// Add smooth scrolling for better UX
function smoothScrollTo(element) {
  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

// Performance optimization: Intersection Observer for lazy loading
function setupIntersectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "50px",
    }
  );

  // Observe report cards for animations
  document.querySelectorAll(".report-card").forEach((card) => {
    observer.observe(card);
  });
}

// Enhanced error handling with retry mechanism
class NetworkManager {
  static async fetchWithRetry(url, options = {}, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.delay(1000 * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Local storage for user preferences (if needed)
class PreferencesManager {
  static save(key, value) {
    try {
      // Note: localStorage is not available in Claude artifacts
      // This would work in a real environment
      console.log(`Would save ${key}:`, value);
    } catch (error) {
      console.warn("Cannot save preferences:", error);
    }
  }

  static load(key, defaultValue) {
    try {
      // Note: localStorage is not available in Claude artifacts
      // This would work in a real environment
      console.log(`Would load ${key}, using default:`, defaultValue);
      return defaultValue;
    } catch (error) {
      console.warn("Cannot load preferences:", error);
      return defaultValue;
    }
  }
}
