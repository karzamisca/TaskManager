//views/financePages/financeGas/financeGas.js
document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const addCenterForm = document.getElementById("addCenterForm");
  const centersList = document.getElementById("centersList");
  const centerDetails = document.getElementById("centerDetails");
  const selectedCenterTitle = document.getElementById("selectedCenterTitle");
  const entryModal = new bootstrap.Modal(document.getElementById("entryModal"));
  const saveEntryBtn = document.getElementById("saveEntryBtn");

  // Form fields
  const currentCenterId = document.getElementById("currentCenterId");
  const currentMonthName = document.getElementById("currentMonthName");

  // Current state
  let currentCenter = null;
  let centers = [];

  // Initialize the app
  init();

  function init() {
    loadCenters();
    setupEventListeners();
  }

  function setupEventListeners() {
    // Add center form
    addCenterForm.addEventListener("submit", handleAddCenter);

    // Save entry button
    saveEntryBtn.addEventListener("click", handleSaveEntry);

    // Calculate totals when values change
    document
      .getElementById("purchaseAmount")
      .addEventListener("input", calculatePurchaseTotal);
    document
      .getElementById("purchaseUnitCost")
      .addEventListener("input", calculatePurchaseTotal);
    document
      .getElementById("saleAmount")
      .addEventListener("input", calculateSaleTotal);
    document
      .getElementById("saleUnitCost")
      .addEventListener("input", calculateSaleTotal);

    // Calculate commission bonuses
    document
      .getElementById("commissionRatePurchase")
      .addEventListener("input", calculateCommissionBonuses);
    document
      .getElementById("commissionRateSale")
      .addEventListener("input", calculateCommissionBonuses);
    document
      .getElementById("purchaseAmount")
      .addEventListener("input", calculateCommissionBonuses);
    document
      .getElementById("saleAmount")
      .addEventListener("input", calculateCommissionBonuses);
    document
      .getElementById("currencyExchangeRate")
      .addEventListener("input", calculateCommissionBonuses);
  }

  function calculatePurchaseTotal() {
    const amount =
      parseFloat(document.getElementById("purchaseAmount").value) || 0;
    const unitCost =
      parseFloat(document.getElementById("purchaseUnitCost").value) || 0;
    document.getElementById("purchaseTotalCost").value = (
      amount * unitCost
    ).toFixed(2);
    calculateCommissionBonuses();
  }

  function calculateSaleTotal() {
    const amount = parseFloat(document.getElementById("saleAmount").value) || 0;
    const unitCost =
      parseFloat(document.getElementById("saleUnitCost").value) || 0;
    document.getElementById("saleTotalCost").value = (
      amount * unitCost
    ).toFixed(2);
    calculateCommissionBonuses();
  }

  function calculateCommissionBonuses() {
    const exchangeRate =
      parseFloat(document.getElementById("currencyExchangeRate").value) || 1;

    // Purchase commission
    const purchaseAmount =
      parseFloat(document.getElementById("purchaseAmount").value) || 0;
    const purchaseRate =
      parseFloat(document.getElementById("commissionRatePurchase").value) || 0;
    document.getElementById("commissionBonusPurchase").value = (
      purchaseAmount *
      purchaseRate *
      exchangeRate
    ).toFixed(2);

    // Sale commission
    const saleAmount =
      parseFloat(document.getElementById("saleAmount").value) || 0;
    const saleRate =
      parseFloat(document.getElementById("commissionRateSale").value) || 0;
    document.getElementById("commissionBonusSale").value = (
      saleAmount *
      saleRate *
      exchangeRate
    ).toFixed(2);
  }

  async function loadCenters() {
    try {
      const response = await fetch("/financeGasControl");
      centers = await response.json();
      renderCentersList();
    } catch (error) {
      console.error("Error loading centers:", error);
    }
  }

  function renderCentersList() {
    centersList.innerHTML = "";

    if (centers.length === 0) {
      centersList.innerHTML =
        '<li class="list-group-item text-muted">No centers found</li>';
      return;
    }

    centers.forEach((center) => {
      const li = document.createElement("li");
      li.className =
        "list-group-item d-flex justify-content-between align-items-center";

      const centerName = document.createElement("span");
      centerName.textContent = center.name;
      centerName.style.cursor = "pointer";
      centerName.addEventListener("click", () => showCenterDetails(center));

      const deleteBtn = document.createElement("span");
      deleteBtn.className = "delete-center-btn text-danger";
      deleteBtn.innerHTML = "&times;";
      deleteBtn.title = "Delete center";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteCenter(center._id);
      });

      li.appendChild(centerName);
      li.appendChild(deleteBtn);
      centersList.appendChild(li);
    });
  }

  async function showCenterDetails(center) {
    currentCenter = center;
    selectedCenterTitle.textContent = center.name;

    // Create year tabs
    let html = '<ul class="nav nav-tabs" id="yearTabs" role="tablist">';

    center.years.forEach((yearData, index) => {
      html += `
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
    });

    // Add button to add new year
    html += `
      <li class="nav-item">
        <button class="nav-link text-success" id="addYearBtn">
          + Add Year
        </button>
      </li>
    `;

    html += '</ul><div class="tab-content" id="yearTabsContent">';

    center.years.forEach((yearData, index) => {
      html += `
        <div class="tab-pane fade ${index === 0 ? "show active" : ""}" 
             id="year-${yearData.year}" 
             role="tabpanel">
          ${renderYearContent(yearData)}
        </div>
      `;
    });

    html += "</div>";
    centerDetails.innerHTML = html;

    // Add event listener for add year button
    document.getElementById("addYearBtn").addEventListener("click", addNewYear);

    // Add event listeners to month cards and entry buttons
    setupMonthCardsEventListeners();
  }

  async function addNewYear() {
    if (!currentCenter) return;

    const currentYear = new Date().getFullYear();
    const existingYears = currentCenter.years.map((y) => y.year);
    let newYear = currentYear;

    // Find the next available year (in case current year already exists)
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
        showCenterDetails(updatedCenter);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error("Error adding year:", error);
      alert("Failed to add year");
    }
  }

  function setupMonthCardsEventListeners() {
    // Add event listeners to month cards
    document.querySelectorAll(".month-card").forEach((card) => {
      card.addEventListener("click", function () {
        const monthName = this.getAttribute("data-month");
        const year = this.getAttribute("data-year");
        const entriesDiv = document.getElementById(
          `monthEntries-${year}-${monthName}`
        );
        entriesDiv.style.display =
          entriesDiv.style.display === "none" ? "block" : "none";
      });
    });

    // Add event listeners to "Add Entry" buttons
    document.querySelectorAll(".add-entry-btn").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const monthName = this.getAttribute("data-month");
        const year = this.getAttribute("data-year");
        showEntryModal(monthName, year);
      });
    });

    // Add event listeners to delete buttons
    document.querySelectorAll(".delete-entry-btn").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const monthName = this.getAttribute("data-month");
        const year = this.getAttribute("data-year");
        const entryIndex = this.getAttribute("data-index");
        deleteMonthEntry(monthName, year, entryIndex);
      });
    });

    // Add event listeners to edit buttons
    document.querySelectorAll(".edit-entry-btn").forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const monthName = this.getAttribute("data-month");
        const year = this.getAttribute("data-year");
        const entryIndex = this.getAttribute("data-index");
        showEditEntryModal(monthName, year, entryIndex);
      });
    });
  }

  async function showEditEntryModal(monthName, year, entryIndex) {
    if (!currentCenter) return;

    const yearData = currentCenter.years.find((y) => y.year === parseInt(year));
    if (!yearData) return;

    const month = yearData.months.find((m) => m.name === monthName);
    if (!month || entryIndex < 0 || entryIndex >= month.entries.length) return;

    const entry = month.entries[entryIndex];

    // Fill the form with existing data
    document.getElementById("purchaseAmount").value =
      entry.purchaseContract?.amount || 0;
    document.getElementById("purchaseUnitCost").value =
      entry.purchaseContract?.unitCost || 0;
    document.getElementById("purchaseTotalCost").value =
      entry.purchaseContract?.totalCost || 0;

    document.getElementById("saleAmount").value =
      entry.saleContract?.amount || 0;
    document.getElementById("saleUnitCost").value =
      entry.saleContract?.unitCost || 0;
    document.getElementById("saleTotalCost").value =
      entry.saleContract?.totalCost || 0;

    document.getElementById("salary").value = entry.salary || 0;
    document.getElementById("transportCost").value = entry.transportCost || 0;
    document.getElementById("currencyExchangeRate").value =
      entry.currencyExchangeRate || 1;

    document.getElementById("commissionRatePurchase").value =
      entry.commissionRatePurchase || 0;
    document.getElementById("commissionRateSale").value =
      entry.commissionRateSale || 0;
    document.getElementById("commissionBonusPurchase").value =
      entry.commissionBonus?.purchase || 0;
    document.getElementById("commissionBonusSale").value =
      entry.commissionBonus?.sale || 0;

    // Set current center, year, month and entry index
    currentCenterId.value = currentCenter._id;
    currentMonthName.value = monthName;
    document.getElementById("currentYear").value = year;
    document.getElementById("currentEntryIndex").value = entryIndex;

    document.getElementById(
      "entryModalTitle"
    ).textContent = `Edit Entry for ${monthName} ${year}`;
    document.getElementById("saveEntryBtn").textContent = "Update Entry";

    // Show modal
    entryModal.show();
  }

  async function deleteMonthEntry(monthName, year, entryIndex) {
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
        showCenterDetails(updatedCenter);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Failed to delete entry");
    }
  }

  function renderYearContent(yearData) {
    let html = '<div class="row">';

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

    months.forEach((monthName) => {
      const monthData = yearData.months.find((m) => m.name === monthName) || {
        entries: [],
      };

      // Calculate totals for the month
      const totals = calculateMonthTotals(monthData.entries);

      html += `
        <div class="col-md-4 mb-3">
          <div class="card month-card" data-month="${monthName}" data-year="${
        yearData.year
      }">
            <div class="card-header">
              <h5>${monthName}</h5>
            </div>
            <div class="card-body">
              <p class="card-text">Entries: ${monthData.entries.length}</p>
              <div class="d-flex justify-content-between">
                <span>Total Purchase: $${totals.purchase.toFixed(2)}</span>
                <span>Total Sale: $${totals.sale.toFixed(2)}</span>
              </div>
              <button class="btn btn-sm btn-primary mt-2 add-entry-btn" 
                      data-month="${monthName}" 
                      data-year="${yearData.year}">
                Add Entry
              </button>
            </div>
          </div>
          
          <div id="monthEntries-${
            yearData.year
          }-${monthName}" class="mt-2" style="display: none;">
            ${renderMonthEntries(monthData.entries, monthName, yearData.year)}
          </div>
        </div>
      `;
    });

    html += "</div>";
    return html;
  }

  function calculateMonthTotals(entries) {
    const totals = {
      purchase: 0,
      sale: 0,
      salary: 0,
      transport: 0,
      commissionPurchase: 0,
      commissionSale: 0,
    };

    entries.forEach((entry) => {
      if (entry.purchaseContract) {
        totals.purchase += entry.purchaseContract.totalCost || 0;
      }
      if (entry.saleContract) {
        totals.sale += entry.saleContract.totalCost || 0;
      }
      totals.salary += entry.salary || 0;
      totals.transport += entry.transportCost || 0;
      if (entry.commissionBonus) {
        totals.commissionPurchase += entry.commissionBonus.purchase || 0;
        totals.commissionSale += entry.commissionBonus.sale || 0;
      }
    });

    return totals;
  }

  function renderMonthEntries(entries, monthName, year) {
    if (entries.length === 0) {
      return '<p class="text-muted">No entries for this month</p>';
    }

    let html = "";
    const totals = calculateMonthTotals(entries);

    entries.forEach((entry, index) => {
      html += `
        <div class="card mb-2 entry-item">
          <div class="card-body p-2">
            <div class="d-flex justify-content-between">
              <small class="text-muted">Entry #${index + 1}</small>
              <div>
                <button class="btn btn-sm btn-outline-primary py-0 edit-entry-btn" 
                  data-month="${monthName}" 
                  data-year="${year}"
                  data-index="${index}">
                  Edit
                </button>
                <button class="btn btn-sm btn-outline-danger py-0 delete-entry-btn" 
                  data-month="${monthName}" 
                  data-year="${year}"
                  data-index="${index}">
                  &times;
                </button>
              </div>
            </div>
            <div class="row small">
              <div class="col-6">
                <div>Purchase: $${(
                  entry.purchaseContract?.totalCost || 0
                ).toFixed(2)}</div>
                <div>Sale: $${(entry.saleContract?.totalCost || 0).toFixed(
                  2
                )}</div>
              </div>
              <div class="col-6">
                <div>Salary: $${(entry.salary || 0).toFixed(2)}</div>
                <div>Transport: $${(entry.transportCost || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    // Add totals
    html += `
      <div class="card total-row">
        <div class="card-body p-2">
          <div class="row small">
            <div class="col-6">
              <div>Total Purchase: $${totals.purchase.toFixed(2)}</div>
              <div>Total Sale: $${totals.sale.toFixed(2)}</div>
            </div>
            <div class="col-6">
              <div>Total Salary: $${totals.salary.toFixed(2)}</div>
              <div>Total Transport: $${totals.transport.toFixed(2)}</div>
            </div>
            <div class="col-12 mt-1">
              <div>Total Commission (Purchase): $${totals.commissionPurchase.toFixed(
                2
              )}</div>
              <div>Total Commission (Sale): $${totals.commissionSale.toFixed(
                2
              )}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  function showEntryModal(monthName, year) {
    if (!currentCenter) return;

    // Reset form
    document.getElementById("entryForm").reset();
    document.getElementById("purchaseTotalCost").value = "0.00";
    document.getElementById("saleTotalCost").value = "0.00";
    document.getElementById("commissionBonusPurchase").value = "0.00";
    document.getElementById("commissionBonusSale").value = "0.00";
    document.getElementById("currencyExchangeRate").value = "1";
    document.getElementById("currentEntryIndex").value = "";
    document.getElementById("saveEntryBtn").textContent = "Save Entry";

    // Set current center, year and month
    currentCenterId.value = currentCenter._id;
    currentMonthName.value = monthName;
    document.getElementById("currentYear").value = year;
    document.getElementById(
      "entryModalTitle"
    ).textContent = `Add Entry to ${monthName} ${year}`;

    // Show modal
    entryModal.show();
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

  async function handleSaveEntry() {
    const centerId = currentCenterId.value;
    const monthName = currentMonthName.value;
    const year = document.getElementById("currentYear").value;
    const entryIndex = document.getElementById("currentEntryIndex").value;

    const entryData = {
      purchaseContract: {
        amount:
          parseFloat(document.getElementById("purchaseAmount").value) || 0,
        unitCost:
          parseFloat(document.getElementById("purchaseUnitCost").value) || 0,
        totalCost:
          parseFloat(document.getElementById("purchaseTotalCost").value) || 0,
      },
      saleContract: {
        amount: parseFloat(document.getElementById("saleAmount").value) || 0,
        unitCost:
          parseFloat(document.getElementById("saleUnitCost").value) || 0,
        totalCost:
          parseFloat(document.getElementById("saleTotalCost").value) || 0,
      },
      salary: parseFloat(document.getElementById("salary").value) || 0,
      transportCost:
        parseFloat(document.getElementById("transportCost").value) || 0,
      commissionRatePurchase:
        parseFloat(document.getElementById("commissionRatePurchase").value) ||
        0,
      commissionRateSale:
        parseFloat(document.getElementById("commissionRateSale").value) || 0,
      currencyExchangeRate:
        parseFloat(document.getElementById("currencyExchangeRate").value) || 1,
      commissionBonus: {
        purchase:
          parseFloat(
            document.getElementById("commissionBonusPurchase").value
          ) || 0,
        sale:
          parseFloat(document.getElementById("commissionBonusSale").value) || 0,
      },
    };

    try {
      let response;
      if (entryIndex) {
        // Update existing entry
        response = await fetch(
          `/financeGasControl/${centerId}/years/${year}/months/${monthName}/entries/${entryIndex}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(entryData),
          }
        );
      } else {
        // Add new entry
        response = await fetch(
          `/financeGasControl/${centerId}/years/${year}/months/${monthName}/entries`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(entryData),
          }
        );
      }

      if (response.ok) {
        entryModal.hide();
        const updatedCenter = await response.json();
        currentCenter = updatedCenter;
        showCenterDetails(updatedCenter);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save entry");
    }
  }

  async function deleteCenter(centerId) {
    if (
      !confirm("Are you sure you want to delete this center and all its data?")
    )
      return;

    try {
      const response = await fetch(`/financeGasControl/${centerId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadCenters();
        if (currentCenter && currentCenter._id === centerId) {
          currentCenter = null;
          selectedCenterTitle.textContent = "Select a Center";
          centerDetails.innerHTML =
            '<p class="text-muted">Please select a center to view and manage its financial data.</p>';
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error("Error deleting center:", error);
      alert("Failed to delete center");
    }
  }
});
