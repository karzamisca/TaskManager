//views/financePages/financeGas/financeGas.js
let centers = [];
let currentCenter = null;
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  loadCenters();
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("addCenterForm")
    .addEventListener("submit", handleAddCenter);
  document
    .getElementById("centerSelect")
    .addEventListener("change", handleCenterSelect);
  document
    .getElementById("deleteCenterBtn")
    .addEventListener("click", handleDeleteCenter);
  document
    .getElementById("addYearBtn")
    .addEventListener("click", handleAddYear);
  document
    .getElementById("saveAllBtn")
    .addEventListener("click", handleSaveAll);
  document.getElementById("exportBtn").addEventListener("click", handleExport);
}

async function loadCenters() {
  try {
    const response = await fetch("/financeGasControl");
    centers = await response.json();
    renderCenterSelect();
  } catch (error) {
    console.error("Error loading centers:", error);
  }
}

function renderCenterSelect() {
  const select = document.getElementById("centerSelect");
  select.innerHTML = '<option value="">Select a center...</option>';

  centers.forEach((center) => {
    const option = document.createElement("option");
    option.value = center._id;
    option.textContent = center.name;
    select.appendChild(option);
  });
}

async function handleAddCenter(e) {
  e.preventDefault();
  const centerName = document.getElementById("centerName").value.trim();

  if (!centerName) return;

  try {
    const response = await fetch("/financeGasControl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: centerName }),
    });

    if (response.ok) {
      document.getElementById("centerName").value = "";
      loadCenters();
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error adding center:", error);
    alert("Failed to add center");
  }
}

function handleCenterSelect(e) {
  const centerId = e.target.value;
  if (!centerId) {
    currentCenter = null;
    document.getElementById("selectedCenterTitle").textContent =
      "Select a Center";
    document.getElementById("financeContent").style.display = "none";
    return;
  }

  currentCenter = centers.find((c) => c._id === centerId);
  if (currentCenter) {
    document.getElementById("selectedCenterTitle").textContent =
      currentCenter.name;
    document.getElementById("financeContent").style.display = "block";
    renderFinanceTable();
  }
}

async function handleDeleteCenter() {
  if (
    !currentCenter ||
    !confirm("Are you sure you want to delete this center and all its data?")
  ) {
    return;
  }

  try {
    const response = await fetch(`/financeGasControl/${currentCenter._id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      loadCenters();
      currentCenter = null;
      document.getElementById("selectedCenterTitle").textContent =
        "Select a Center";
      document.getElementById("financeContent").style.display = "none";
      document.getElementById("centerSelect").value = "";
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting center:", error);
    alert("Failed to delete center");
  }
}

async function handleAddYear() {
  if (!currentCenter) return;

  const currentYear = new Date().getFullYear();
  const existingYears = currentCenter.years.map((y) => y.year);
  let newYear = currentYear;

  while (existingYears.includes(newYear)) {
    newYear++;
  }

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year: newYear }),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      currentCenter = updatedCenter;
      // Update centers array
      const centerIndex = centers.findIndex((c) => c._id === currentCenter._id);
      if (centerIndex !== -1) {
        centers[centerIndex] = updatedCenter;
      }
      renderFinanceTable();
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error adding year:", error);
    alert("Failed to add year");
  }
}

function renderFinanceTable() {
  if (!currentCenter) return;

  // Render year tabs
  let tabsHtml = "";
  let contentHtml = "";

  currentCenter.years.forEach((yearData, index) => {
    tabsHtml += `
                    <li class="nav-item" role="presentation">
                        <button class="nav-link ${index === 0 ? "active" : ""}" 
                                id="year-${yearData.year}-tab" 
                                data-bs-toggle="tab" 
                                data-bs-target="#year-${yearData.year}" 
                                type="button" 
                                role="tab">
                            ${yearData.year}
                        </button>
                    </li>
                `;

    contentHtml += `
                    <div class="tab-pane fade ${
                      index === 0 ? "show active" : ""
                    }" 
                         id="year-${yearData.year}" 
                         role="tabpanel">
                        ${renderYearTable(yearData)}
                    </div>
                `;
  });

  document.getElementById("yearTabs").innerHTML = tabsHtml;
  document.getElementById("yearTabsContent").innerHTML = contentHtml;

  // Setup table event listeners
  setupTableEventListeners();
}

function renderYearTable(yearData) {
  // Create table structure
  let html = `
                <div class="table-container">
                    <table class="table table-excel table-bordered table-hover">
                        <thead>
                            <tr>
                                <th style="min-width: 120px;">Month</th>
                                <th style="min-width: 80px;">Entry #</th>
                                <th style="min-width: 90px;">Purchase Amount</th>
                                <th style="min-width: 90px;">Purchase Unit Cost</th>
                                <th style="min-width: 90px;">Purchase Total</th>
                                <th style="min-width: 90px;">Sale Amount</th>
                                <th style="min-width: 90px;">Sale Unit Cost</th>
                                <th style="min-width: 90px;">Sale Total</th>
                                <th style="min-width: 80px;">Salary</th>
                                <th style="min-width: 90px;">Transport Cost</th>
                                <th style="min-width: 90px;">Exchange Rate</th>
                                <th style="min-width: 90px;">Purchase Comm. Rate</th>
                                <th style="min-width: 90px;">Purchase Comm. Bonus</th>
                                <th style="min-width: 90px;">Sale Comm. Rate</th>
                                <th style="min-width: 90px;">Sale Comm. Bonus</th>
                                <th style="min-width: 80px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

  months.forEach((monthName) => {
    const monthData = yearData.months.find((m) => m.name === monthName) || {
      entries: [],
    };

    if (monthData.entries.length === 0) {
      // Empty row for month
      html += `
                        <tr data-month="${monthName}" data-year="${yearData.year}">
                            <td>${monthName}</td>
                            <td>-</td>
                            <td colspan="13" class="text-muted text-center">No entries</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                                        data-month="${monthName}" data-year="${yearData.year}">
                                    + Add
                                </button>
                            </td>
                        </tr>
                    `;
    } else {
      // Render entries
      monthData.entries.forEach((entry, entryIndex) => {
        html += `
                            <tr data-month="${monthName}" data-year="${
          yearData.year
        }" data-entry="${entryIndex}">
                                <td>${entryIndex === 0 ? monthName : ""}</td>
                                <td>${entryIndex + 1}</td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.purchaseContract?.amount || 0
                                }" 
                                           data-field="purchaseContract.amount" step="0.01"></td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.purchaseContract?.unitCost || 0
                                }" 
                                           data-field="purchaseContract.unitCost" step="0.01"></td>
                                <td class="calculated-field">${(
                                  entry.purchaseContract?.totalCost || 0
                                ).toFixed(2)}</td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.saleContract?.amount || 0
                                }" 
                                           data-field="saleContract.amount" step="0.01"></td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.saleContract?.unitCost || 0
                                }" 
                                           data-field="saleContract.unitCost" step="0.01"></td>
                                <td class="calculated-field">${(
                                  entry.saleContract?.totalCost || 0
                                ).toFixed(2)}</td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.salary || 0
                                }" 
                                           data-field="salary" step="0.01"></td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.transportCost || 0
                                }" 
                                           data-field="transportCost" step="0.01"></td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.currencyExchangeRate || 1
                                }" 
                                           data-field="currencyExchangeRate" step="0.0001"></td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.commissionRatePurchase || 0
                                }" 
                                           data-field="commissionRatePurchase" step="0.0001"></td>
                                <td class="calculated-field">${(
                                  entry.commissionBonus?.purchase || 0
                                ).toFixed(2)}</td>
                                <td><input type="number" class="input-cell" value="${
                                  entry.commissionRateSale || 0
                                }" 
                                           data-field="commissionRateSale" step="0.0001"></td>
                                <td class="calculated-field">${(
                                  entry.commissionBonus?.sale || 0
                                ).toFixed(2)}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-danger btn-action delete-entry-btn" 
                                            data-month="${monthName}" data-year="${
          yearData.year
        }" data-entry="${entryIndex}">
                                        ×
                                    </button>
                                </td>
                            </tr>
                        `;
      });

      // Add "Add Entry" row for month
      html += `
                        <tr data-month="${monthName}" data-year="${yearData.year}">
                            <td></td>
                            <td colspan="14" class="text-center">
                                <button class="btn btn-sm btn-outline-primary btn-action add-entry-btn" 
                                        data-month="${monthName}" data-year="${yearData.year}">
                                    + Add Entry
                                </button>
                            </td>
                            <td></td>
                        </tr>
                    `;

      // Calculate and show month totals
      const totals = calculateMonthTotals(monthData.entries);
      html += `
                        <tr class="total-row" data-month="${monthName}">
                            <td><strong>${monthName} Total</strong></td>
                            <td><strong>${
                              monthData.entries.length
                            }</strong></td>
                            <td><strong>${totals.purchaseAmount.toFixed(
                              2
                            )}</strong></td>
                            <td>-</td>
                            <td><strong>${totals.purchaseTotal.toFixed(
                              2
                            )}</strong></td>
                            <td><strong>${totals.saleAmount.toFixed(
                              2
                            )}</strong></td>
                            <td>-</td>
                            <td><strong>${totals.saleTotal.toFixed(
                              2
                            )}</strong></td>
                            <td><strong>${totals.salary.toFixed(
                              2
                            )}</strong></td>
                            <td><strong>${totals.transport.toFixed(
                              2
                            )}</strong></td>
                            <td>-</td>
                            <td>-</td>
                            <td><strong>${totals.commissionPurchase.toFixed(
                              2
                            )}</strong></td>
                            <td>-</td>
                            <td><strong>${totals.commissionSale.toFixed(
                              2
                            )}</strong></td>
                            <td></td>
                        </tr>
                    `;
    }
  });

  html += `
                        </tbody>
                    </table>
                </div>
            `;

  return html;
}

function calculateMonthTotals(entries) {
  const totals = {
    purchaseAmount: 0,
    purchaseTotal: 0,
    saleAmount: 0,
    saleTotal: 0,
    salary: 0,
    transport: 0,
    commissionPurchase: 0,
    commissionSale: 0,
  };

  entries.forEach((entry) => {
    totals.purchaseAmount += entry.purchaseContract?.amount || 0;
    totals.purchaseTotal += entry.purchaseContract?.totalCost || 0;
    totals.saleAmount += entry.saleContract?.amount || 0;
    totals.saleTotal += entry.saleContract?.totalCost || 0;
    totals.salary += entry.salary || 0;
    totals.transport += entry.transportCost || 0;
    totals.commissionPurchase += entry.commissionBonus?.purchase || 0;
    totals.commissionSale += entry.commissionBonus?.sale || 0;
  });

  return totals;
}

function setupTableEventListeners() {
  // Add entry buttons
  document.querySelectorAll(".add-entry-btn").forEach((btn) => {
    btn.addEventListener("click", handleAddEntry);
  });

  // Delete entry buttons
  document.querySelectorAll(".delete-entry-btn").forEach((btn) => {
    btn.addEventListener("click", handleDeleteEntry);
  });

  // Input field changes
  document.querySelectorAll(".input-cell").forEach((input) => {
    input.addEventListener("input", handleInputChange);
    input.addEventListener("blur", handleInputBlur);
  });
}

async function handleAddEntry(e) {
  const monthName = e.target.getAttribute("data-month");
  const year = e.target.getAttribute("data-year");

  if (!currentCenter) return;

  const entryData = {
    purchaseContract: { amount: 0, unitCost: 0, totalCost: 0 },
    saleContract: { amount: 0, unitCost: 0, totalCost: 0 },
    salary: 0,
    transportCost: 0,
    currencyExchangeRate: 1,
    commissionRatePurchase: 0,
    commissionRateSale: 0,
    commissionBonus: { purchase: 0, sale: 0 },
  };

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryData),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      currentCenter = updatedCenter;
      // Update centers array
      const centerIndex = centers.findIndex((c) => c._id === currentCenter._id);
      if (centerIndex !== -1) {
        centers[centerIndex] = updatedCenter;
      }
      renderFinanceTable();
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error adding entry:", error);
    alert("Failed to add entry");
  }
}

async function handleDeleteEntry(e) {
  const monthName = e.target.getAttribute("data-month");
  const year = e.target.getAttribute("data-year");
  const entryIndex = e.target.getAttribute("data-entry");

  if (
    !currentCenter ||
    !confirm("Are you sure you want to delete this entry?")
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
      {
        method: "DELETE",
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      currentCenter = updatedCenter;
      // Update centers array
      const centerIndex = centers.findIndex((c) => c._id === currentCenter._id);
      if (centerIndex !== -1) {
        centers[centerIndex] = updatedCenter;
      }
      renderFinanceTable();
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting entry:", error);
    alert("Failed to delete entry");
  }
}

function handleInputChange(e) {
  const row = e.target.closest("tr");
  const monthName = row.getAttribute("data-month");
  const year = row.getAttribute("data-year");
  const entryIndex = row.getAttribute("data-entry");

  if (entryIndex === null) return;

  // Update calculations in real-time
  updateRowCalculations(row);
}

function updateRowCalculations(row) {
  // Get input values
  const purchaseAmount =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.amount"]').value
    ) || 0;
  const purchaseUnitCost =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.unitCost"]').value
    ) || 0;
  const saleAmount =
    parseFloat(row.querySelector('[data-field="saleContract.amount"]').value) ||
    0;
  const saleUnitCost =
    parseFloat(
      row.querySelector('[data-field="saleContract.unitCost"]').value
    ) || 0;
  const exchangeRate =
    parseFloat(
      row.querySelector('[data-field="currencyExchangeRate"]').value
    ) || 1;
  const purchaseCommRate =
    parseFloat(
      row.querySelector('[data-field="commissionRatePurchase"]').value
    ) || 0;
  const saleCommRate =
    parseFloat(row.querySelector('[data-field="commissionRateSale"]').value) ||
    0;

  // Calculate totals
  const purchaseTotal = purchaseAmount * purchaseUnitCost;
  const saleTotal = saleAmount * saleUnitCost;
  const purchaseCommission = purchaseAmount * purchaseCommRate * exchangeRate;
  const saleCommission = saleAmount * saleCommRate * exchangeRate;

  // Update calculated fields
  const calculatedFields = row.querySelectorAll(".calculated-field");
  calculatedFields[0].textContent = purchaseTotal.toFixed(2); // Purchase Total
  calculatedFields[1].textContent = saleTotal.toFixed(2); // Sale Total
  calculatedFields[2].textContent = purchaseCommission.toFixed(2); // Purchase Commission
  calculatedFields[3].textContent = saleCommission.toFixed(2); // Sale Commission
}

async function handleInputBlur(e) {
  const row = e.target.closest("tr");
  const monthName = row.getAttribute("data-month");
  const year = row.getAttribute("data-year");
  const entryIndex = row.getAttribute("data-entry");

  if (!currentCenter || entryIndex === null) return;

  // Collect all data from the row
  const entryData = collectRowData(row);

  try {
    const response = await fetch(
      `/financeGasControl/${currentCenter._id}/years/${year}/months/${monthName}/entries/${entryIndex}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryData),
      }
    );

    if (response.ok) {
      const updatedCenter = await response.json();
      currentCenter = updatedCenter;
      // Update centers array
      const centerIndex = centers.findIndex((c) => c._id === currentCenter._id);
      if (centerIndex !== -1) {
        centers[centerIndex] = updatedCenter;
      }
      // Update the totals row
      updateMonthTotals(monthName, year);
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  } catch (error) {
    console.error("Error updating entry:", error);
    alert("Failed to update entry");
  }
}

function collectRowData(row) {
  const purchaseAmount =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.amount"]').value
    ) || 0;
  const purchaseUnitCost =
    parseFloat(
      row.querySelector('[data-field="purchaseContract.unitCost"]').value
    ) || 0;
  const saleAmount =
    parseFloat(row.querySelector('[data-field="saleContract.amount"]').value) ||
    0;
  const saleUnitCost =
    parseFloat(
      row.querySelector('[data-field="saleContract.unitCost"]').value
    ) || 0;
  const salary =
    parseFloat(row.querySelector('[data-field="salary"]').value) || 0;
  const transportCost =
    parseFloat(row.querySelector('[data-field="transportCost"]').value) || 0;
  const exchangeRate =
    parseFloat(
      row.querySelector('[data-field="currencyExchangeRate"]').value
    ) || 1;
  const purchaseCommRate =
    parseFloat(
      row.querySelector('[data-field="commissionRatePurchase"]').value
    ) || 0;
  const saleCommRate =
    parseFloat(row.querySelector('[data-field="commissionRateSale"]').value) ||
    0;

  return {
    purchaseContract: {
      amount: purchaseAmount,
      unitCost: purchaseUnitCost,
      totalCost: purchaseAmount * purchaseUnitCost,
    },
    saleContract: {
      amount: saleAmount,
      unitCost: saleUnitCost,
      totalCost: saleAmount * saleUnitCost,
    },
    salary: salary,
    transportCost: transportCost,
    currencyExchangeRate: exchangeRate,
    commissionRatePurchase: purchaseCommRate,
    commissionRateSale: saleCommRate,
    commissionBonus: {
      purchase: purchaseAmount * purchaseCommRate * exchangeRate,
      sale: saleAmount * saleCommRate * exchangeRate,
    },
  };
}

function updateMonthTotals(monthName, year) {
  const yearData = currentCenter.years.find((y) => y.year === parseInt(year));
  if (!yearData) return;

  const monthData = yearData.months.find((m) => m.name === monthName);
  if (!monthData) return;

  const totals = calculateMonthTotals(monthData.entries);
  const totalRow = document.querySelector(
    `tr.total-row[data-month="${monthName}"]`
  );

  if (totalRow) {
    const cells = totalRow.querySelectorAll("td strong");
    if (cells.length >= 8) {
      cells[1].textContent = monthData.entries.length;
      cells[2].textContent = totals.purchaseAmount.toFixed(2);
      cells[3].textContent = totals.purchaseTotal.toFixed(2);
      cells[4].textContent = totals.saleAmount.toFixed(2);
      cells[5].textContent = totals.saleTotal.toFixed(2);
      cells[6].textContent = totals.salary.toFixed(2);
      cells[7].textContent = totals.transport.toFixed(2);
      cells[8].textContent = totals.commissionPurchase.toFixed(2);
      cells[9].textContent = totals.commissionSale.toFixed(2);
    }
  }
}

function handleSaveAll() {
  alert(
    "All changes are automatically saved when you finish editing each field."
  );
}

function handleExport() {
  if (!currentCenter) {
    alert("Please select a center first.");
    return;
  }

  // This would implement CSV/Excel export functionality
  alert(
    "Export functionality would be implemented here to generate Excel/CSV files."
  );
}
