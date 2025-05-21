////views/reportPages/reportSummary/reportSummary.js
document.addEventListener("DOMContentLoaded", function () {
  const reportContainer = document.getElementById("reportContainer");
  const reportList = document.getElementById("reportList");
  const loadingMessage = document.getElementById("loadingMessage");
  const errorMessage = document.getElementById("errorMessage");
  const searchButton = document.getElementById("searchButton");

  // Hide loading initially and show when needed
  loadingMessage.style.display = "none";

  // Search functionality
  searchButton.addEventListener("click", function () {
    const reportType = document.getElementById("reportType").value;
    const costCenterSearch = document.getElementById("costCenterSearch").value;
    const dateSearch = document.getElementById("dateSearch").value;

    // Show loading
    loadingMessage.style.display = "block";
    reportList.innerHTML = "";
    errorMessage.style.display = "none";

    // Create search query parameters
    const queryParams = new URLSearchParams();
    if (reportType) queryParams.append("reportType", reportType);
    if (costCenterSearch) queryParams.append("costCenter", costCenterSearch);
    if (dateSearch) queryParams.append("date", dateSearch);

    // Fetch reports with search criteria
    fetchReports(queryParams);
  });

  // Initial load of reports
  fetchReports();

  // Function to fetch reports
  function fetchReports(queryParams = new URLSearchParams()) {
    // API endpoint for reports
    const apiUrl = `/reportGet?${queryParams.toString()}`;

    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Hide loading
        loadingMessage.style.display = "none";

        // Display reports
        displayReports(data);
      })
      .catch((error) => {
        console.error("Error fetching reports:", error);
        loadingMessage.style.display = "none";
        errorMessage.textContent =
          "Error loading reports. Please try again later.";
        errorMessage.style.display = "block";
      });
  }

  // Function to display reports in the UI
  function displayReports(reports) {
    if (!reports || reports.length === 0) {
      reportList.innerHTML =
        '<div class="no-reports">No reports found matching your criteria</div>';
      return;
    }

    reportList.innerHTML = "";

    reports.forEach((report) => {
      const reportElement = document.createElement("div");
      reportElement.className = "report-item";

      // Format date for display
      const reportDate = new Date(report.submissionDate);
      const formattedDate = reportDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      reportElement.innerHTML = `
        <h2>${
          report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)
        } Report</h2>
        <div class="report-header">
            <div>
                <div class="info-label">Ngày nộp/Submission Date:</div>
                <div>${report.submissionDate}</div>
            </div>
            <div>
                <div class="info-label">Thời gian kiểm tra/Inspection Time:</div>
                <div>${report.inspectionTime}</div>
            </div>
            <div>
                <div class="info-label">Người kiểm tra/Inspector:</div>
                <div>${
                  report.inspector ? report.inspector.username : "Unknown"
                }</div>
            </div>
            <div>
                <div class="info-label">Trạm/Center:</div>
                <div>${
                  report.costCenter ? report.costCenter.name : "Unassigned"
                }</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Nhiệm vụ/Task</th>
                    <th>Tình trạng/Status</th>
                    <th>Ghi chú/Notes</th>
                </tr>
            </thead>
            <tbody>
                ${report.items
                  .map(
                    (item) => `
                    <tr>
                        <td>${item.task}</td>
                        <td class="status-${item.status}">${
                      item.status ? "Completed" : "Pending"
                    }</td>
                        <td>${item.notes || "-"}</td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
    `;

      reportList.appendChild(reportElement);
    });
  }
});
