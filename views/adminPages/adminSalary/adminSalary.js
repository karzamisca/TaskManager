//views\adminPages\adminSalary\adminSalary.js
document.addEventListener("DOMContentLoaded", function () {
  const currentDate = new Date();
  document.getElementById("month-select").value = currentDate.getMonth() + 1;
  document.getElementById("year-input").value = currentDate.getFullYear();
  document.getElementById("salary-month").value = currentDate.getMonth() + 1;
  document.getElementById("salary-year").value = currentDate.getFullYear();

  loadCostCenters();
  loadEmployees();
  loadSalaryRecords();

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", function () {
      document
        .querySelectorAll(".tab-pane")
        .forEach((tab) => tab.classList.remove("active"));
      document
        .querySelectorAll(".tab-button")
        .forEach((btn) => btn.classList.remove("active"));
      document
        .getElementById(this.getAttribute("data-tab"))
        .classList.add("active");
      this.classList.add("active");
    });
  });

  document
    .getElementById("filter-button")
    .addEventListener("click", applyFilters);

  // Add event listeners for form submissions
  document
    .getElementById("add-employee-form")
    .addEventListener("submit", addEmployee);

  document
    .getElementById("add-salary-record-form")
    .addEventListener("submit", addSalaryRecord);

  // Add event listener for employee selection in salary record form
  document
    .getElementById("salary-employee")
    .addEventListener("change", populateBonusRates);
});

let allEmployees = [];
let allSalaryRecords = [];

async function loadCostCenters() {
  try {
    const res = await fetch("/api/employees/get/cost-centers");
    const costCenters = await res.json();
    const selects = [
      document.getElementById("cost-center-select"),
      document.getElementById("employee-cost-center-filter"),
      document.getElementById("new-cost-center"),
    ];
    selects.forEach((select) => {
      if (!select) return;
      select.innerHTML = `<option value="all">All Cost Centers</option>`;
      costCenters.forEach((cc) => {
        const option = document.createElement("option");
        option.value = cc._id;
        option.textContent = cc.name;
        select.appendChild(option);
      });

      // Remove "All Cost Centers" from the new employee form
      if (select.id === "new-cost-center") {
        select.removeChild(select.querySelector('option[value="all"]'));
      }
    });
  } catch (err) {
    showError("Failed to load cost centers");
  }
}

async function loadEmployees() {
  try {
    const res = await fetch("/api/employees");
    allEmployees = await res.json();
    renderEmployees();
    populateEmployeeDropdown();
  } catch (err) {
    showError("Failed to load employees");
  }
}

async function loadSalaryRecords() {
  try {
    const res = await fetch("/api/salary-records");
    allSalaryRecords = await res.json();
    renderSalaryRecords();
  } catch (err) {
    showError("Failed to load salary records");
  }
}

function populateEmployeeDropdown() {
  const employeeSelect = document.getElementById("salary-employee");
  employeeSelect.innerHTML = "";

  allEmployees.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp._id;
    option.textContent = emp.username;
    employeeSelect.appendChild(option);
  });

  // Trigger the change event to populate initial bonus rates
  if (allEmployees.length > 0) {
    populateBonusRates();
  }
}

function populateBonusRates() {
  const employeeId = document.getElementById("salary-employee").value;
  if (!employeeId) return;

  const selectedEmployee = allEmployees.find((emp) => emp._id === employeeId);
  if (selectedEmployee) {
    document.getElementById("holiday-bonus-rate").value =
      selectedEmployee.holidayBonusPerDay;
    document.getElementById("night-shift-bonus-rate").value =
      selectedEmployee.nightShiftBonusPerDay;
  }
}

function applyFilters() {
  renderEmployees();
  renderSalaryRecords();
}

function renderEmployees() {
  const filterCostCenterId = document.getElementById(
    "employee-cost-center-filter"
  ).value;
  const tbody = document.querySelector("#employees-table tbody");
  tbody.innerHTML = "";

  const filtered =
    filterCostCenterId === "all"
      ? allEmployees
      : allEmployees.filter(
          (e) => e.costCenter && e.costCenter._id === filterCostCenterId
        );

  filtered.forEach((emp) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${emp.username}</td>
      <td>${emp.costCenter ? emp.costCenter.name : "N/A"}</td>
      <td>${emp.baseSalary.toFixed(2)}</td>
      <td>${emp.holidayBonusPerDay.toFixed(2)}</td>
      <td>${emp.nightShiftBonusPerDay.toFixed(2)}</td>
      <td>${emp.socialInsurance.toFixed(2)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-danger" onclick="deleteEmployee('${
            emp._id
          }')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderSalaryRecords() {
  const costCenterId = document.getElementById("cost-center-select").value;
  const month = parseInt(document.getElementById("month-select").value);
  const year = parseInt(document.getElementById("year-input").value);
  const tbody = document.querySelector("#salary-records-table tbody");
  tbody.innerHTML = "";

  const monthNames = [
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

  const filtered = allSalaryRecords.filter((record) => {
    const matchCostCenter =
      costCenterId === "all" ||
      (record.employee.costCenter &&
        record.employee.costCenter._id === costCenterId);
    const matchMonth = !month || record.month === month;
    const matchYear = !year || record.year === year;
    return matchCostCenter && matchMonth && matchYear;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No records found</td></tr>`;
    return;
  }

  filtered.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.employee ? record.employee.username : "Unknown"}</td>
      <td>${
        record.employee && record.employee.costCenter
          ? record.employee.costCenter.name
          : "N/A"
      }</td>
      <td>${monthNames[record.month - 1]} ${record.year}</td>
      <td>${record.holidayDays}</td>
      <td>${record.nightShiftDays}</td>
      <td>${
        record.holidayBonusRate ? record.holidayBonusRate.toFixed(2) : "N/A"
      }</td>
      <td>${
        record.nightShiftBonusRate
          ? record.nightShiftBonusRate.toFixed(2)
          : "N/A"
      }</td>
      <td>${record.totalSalary.toFixed(2)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-danger" onclick="deleteSalaryRecord('${
            record._id
          }')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function addEmployee(e) {
  e.preventDefault();

  const newEmployee = {
    username: document.getElementById("new-username").value,
    costCenter: document.getElementById("new-cost-center").value,
    baseSalary: parseFloat(document.getElementById("new-base-salary").value),
    holidayBonusPerDay: parseFloat(
      document.getElementById("new-holiday-bonus").value
    ),
    nightShiftBonusPerDay: parseFloat(
      document.getElementById("new-night-shift-bonus").value
    ),
    socialInsurance: parseFloat(
      document.getElementById("new-social-insurance").value
    ),
  };

  try {
    const response = await fetch("/api/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newEmployee),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add employee");
    }

    // Reset form
    document.getElementById("add-employee-form").reset();

    // Show success message
    showSuccess("Employee added successfully!");

    // Reload employees
    loadEmployees();

    // Switch to employees tab
    document.querySelector('[data-tab="employees"]').click();
  } catch (err) {
    showError(err.message || "Error adding employee");
  }
}

async function addSalaryRecord(e) {
  e.preventDefault();

  const employeeId = document.getElementById("salary-employee").value;
  const month = parseInt(document.getElementById("salary-month").value);
  const year = parseInt(document.getElementById("salary-year").value);
  const holidayDays = parseInt(document.getElementById("holiday-days").value);
  const nightShiftDays = parseInt(
    document.getElementById("night-shift-days").value
  );
  const holidayBonusRate = parseFloat(
    document.getElementById("holiday-bonus-rate").value
  );
  const nightShiftBonusRate = parseFloat(
    document.getElementById("night-shift-bonus-rate").value
  );

  const selectedEmployee = allEmployees.find((emp) => emp._id === employeeId);
  if (!selectedEmployee) {
    showError("Selected employee not found");
    return;
  }

  // Calculate total salary
  const baseSalary = selectedEmployee.baseSalary;
  const holidayBonus = holidayDays * holidayBonusRate;
  const nightShiftBonus = nightShiftDays * nightShiftBonusRate;
  const socialInsurance = selectedEmployee.socialInsurance;

  const totalSalary =
    baseSalary + holidayBonus + nightShiftBonus - socialInsurance;

  const salaryRecord = {
    employee: employeeId,
    month,
    year,
    holidayDays,
    nightShiftDays,
    holidayBonusRate,
    nightShiftBonusRate,
    totalSalary,
  };

  try {
    const response = await fetch("/api/salary-records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(salaryRecord),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add salary record");
    }

    // Reset form
    document.getElementById("add-salary-record-form").reset();
    // Re-populate default values
    document.getElementById("salary-month").value = new Date().getMonth() + 1;
    document.getElementById("salary-year").value = new Date().getFullYear();

    // Show success message
    showSuccess("Salary record added successfully!");

    // Reload salary records
    loadSalaryRecords();

    // Switch to salary records tab
    document.querySelector('[data-tab="salary-records"]').click();
  } catch (err) {
    showError(err.message || "Error adding salary record");
  }
}

async function deleteEmployee(id) {
  if (!confirm("Are you sure you want to delete this employee?")) return;

  try {
    const response = await fetch(`/api/employees/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete employee");
    }

    // Reload employees
    loadEmployees();
    // Also reload salary records as they may reference this employee
    loadSalaryRecords();

    showSuccess("Employee deleted successfully!");
  } catch (err) {
    showError(err.message);
  }
}

async function deleteSalaryRecord(id) {
  if (!confirm("Are you sure you want to delete this salary record?")) return;

  try {
    const response = await fetch(`/api/salary-records/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete salary record");
    }

    // Reload salary records
    loadSalaryRecords();

    showSuccess("Salary record deleted successfully!");
  } catch (err) {
    showError(err.message);
  }
}

function showSuccess(message) {
  // Create success message element if it doesn't exist
  let successEl = document.querySelector(".success-message");
  if (!successEl) {
    successEl = document.createElement("div");
    successEl.className = "success-message";
    document.querySelector(".container").prepend(successEl);
  }

  successEl.textContent = message;
  successEl.style.display = "block";

  // Hide after 3 seconds
  setTimeout(() => {
    successEl.style.display = "none";
  }, 3000);
}

function showError(message) {
  // Create error message element if it doesn't exist
  let errorEl = document.querySelector(".error-message");
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.className = "error-message";
    document.querySelector(".container").prepend(errorEl);
  }

  errorEl.textContent = message;
  errorEl.style.display = "block";

  // Hide after 3 seconds
  setTimeout(() => {
    errorEl.style.display = "none";
  }, 3000);
}
