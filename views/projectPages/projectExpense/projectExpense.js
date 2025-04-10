////views\projectPages\projectExpense\projectExpense.js
// Load Flatpickr for the Delivery Date and ProjectExpense Date inputs
document.addEventListener("DOMContentLoaded", () => {
  flatpickr("#searchDeliveryDate", { dateFormat: "d-m-Y" });
  flatpickr("#searchEntryDate", { dateFormat: "d-m-Y" });
  flatpickr("#deliveryDate", {
    dateFormat: "d-m-Y",
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const tagDropdown = document.getElementById("tag");

  try {
    // Fetch tags from the server
    const response = await fetch("/projectExpenseTags");
    const tags = await response.json();

    // Populate the dropdown
    tags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag.tag;
      option.textContent = tag.tag;
      tagDropdown.appendChild(option);
    });
  } catch (err) {
    console.error("Error fetching tags:", err);
  }
});

// Sort table function
function sortTable(columnIndex) {
  const table = document.getElementById("projectExpenseTable");
  let rows,
    switching,
    i,
    x,
    y,
    shouldSwitch,
    dir,
    switchCount = 0;
  switching = true;
  dir = "asc"; // Set the sorting direction to ascending

  // Helper function to parse numeric strings with toLocaleString formatting
  const parseNumeric = (str) => parseFloat(str.replace(/[^0-9.-]+/g, "")) || 0;

  // Define numeric columns
  const numericColumns = [6, 7, 8, 9, 10, 11]; // Indices of numeric columns

  while (switching) {
    switching = false;
    rows = table.rows;
    for (i = 1; i < rows.length - 1; i++) {
      shouldSwitch = false;
      x = rows[i].getElementsByTagName("TD")[columnIndex];
      y = rows[i + 1].getElementsByTagName("TD")[columnIndex];

      // Get cell values and trim whitespace
      const xValue = x.innerHTML.trim();
      const yValue = y.innerHTML.trim();

      // Check if the current column is numeric
      if (numericColumns.includes(columnIndex)) {
        // Parse numeric values
        const xNum = parseNumeric(xValue);
        const yNum = parseNumeric(yValue);

        // Compare numbers
        if (dir === "asc" && xNum > yNum) {
          shouldSwitch = true;
          break;
        } else if (dir === "desc" && xNum < yNum) {
          shouldSwitch = true;
          break;
        }
      } else {
        // Compare strings
        if (dir === "asc" && xValue.toLowerCase() > yValue.toLowerCase()) {
          shouldSwitch = true;
          break;
        } else if (
          dir === "desc" &&
          xValue.toLowerCase() < yValue.toLowerCase()
        ) {
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchCount++;
    } else {
      if (switchCount === 0 && dir === "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}

// Search function for each field
function filterTable() {
  const filters = {
    tag: document.getElementById("searchTag").value.toLowerCase(),
    name: document.getElementById("searchName").value.toLowerCase(),
    description: document
      .getElementById("searchDescription")
      .value.toLowerCase(),
    package: document.getElementById("searchPackage").value.toLowerCase(),
    unit: document.getElementById("searchUnit").value.toLowerCase(),
    amount: parseFloat(document.getElementById("searchAmount").value) || null,
    unitPrice:
      parseFloat(document.getElementById("searchUnitPrice").value) || null,
    totalPrice:
      parseFloat(document.getElementById("searchTotalPrice").value) || null,
    vat: parseFloat(document.getElementById("searchVAT").value) || null,
    vatValue:
      parseFloat(document.getElementById("searchVATValue").value) || null,
    totalPriceAfterVAT:
      parseFloat(document.getElementById("searchTotalPriceAfterVAT").value) ||
      null,
    paid: parseFloat(document.getElementById("searchPaid").value) || null,
    deliveryDate: document.getElementById("searchDeliveryDate").value,
    note: document.getElementById("searchNote").value.toLowerCase(),
    entryDate: document.getElementById("searchEntryDate").value,
    submitter: document.getElementById("searchSubmitter").value.toLowerCase(),
    confirmedReceived: document
      .getElementById("searchConfirmedReceived")
      .value.toLowerCase(),
  };

  const rows = document.querySelectorAll("#projectExpenseTable tbody tr");
  let filteredTotalPaid = 0;
  let filteredTotalUnpaid = 0;

  rows.forEach((row) => {
    const cells = Array.from(row.cells);
    // Helper function to parse numeric strings with toLocaleString formatting
    const parseNumeric = (str) =>
      parseFloat(str.replace(/[^0-9.-]+/g, "")) || 0;

    // Map column indices to their corresponding filters
    const columnData = {
      tag: cells[1]?.textContent.toLowerCase(),
      name: cells[2]?.textContent.toLowerCase(),
      description: cells[3]?.textContent.toLowerCase(),
      package: cells[4]?.textContent.toLowerCase(),
      unit: cells[5]?.textContent.toLowerCase(),
      amount: parseNumeric(cells[6]?.textContent),
      unitPrice: parseNumeric(cells[7]?.textContent),
      totalPrice: parseNumeric(cells[8]?.textContent),
      vat: parseNumeric(cells[9]?.textContent),
      vatValue: parseNumeric(cells[10]?.textContent),
      totalPriceAfterVAT: parseNumeric(cells[11]?.textContent),
      paid: parseNumeric(cells[12]?.textContent),
      deliveryDate: cells[13]?.textContent,
      note: cells[14]?.textContent.toLowerCase(),
      entryDate: cells[15]?.textContent,
      submitter: cells[16]?.textContent.toLowerCase(),
      confirmedReceived: cells[17]?.textContent.toLowerCase(),
    };

    // Check if the row matches all filters
    const isVisible = Object.keys(filters).every((key) => {
      const filterValue = filters[key];
      const cellValue = columnData[key];

      // Skip if the filter is empty
      if (filterValue === null || filterValue === "") return true;

      // Numeric comparisons
      if (typeof filterValue === "number") {
        return cellValue !== null && cellValue === filterValue;
      }

      // String comparisons
      return cellValue && cellValue.includes(filterValue);
    });

    // Show or hide the row based on filter matching
    row.style.display = isVisible ? "" : "none";

    // Update trackers only for visible rows
    if (isVisible) {
      const amount = columnData.amount;
      const unitPrice = columnData.unitPrice;
      const vat = columnData.vat;
      const paid = columnData.paid;

      const totalWithVat =
        amount * unitPrice + amount * unitPrice * (vat / 100);
      filteredTotalPaid += paid;
      filteredTotalUnpaid += totalWithVat - paid;
    }
  });

  // Update the tracker display with the filtered totals
  const unpaidTracker = document.getElementById("unpaidTracker");
  const paidTracker = document.getElementById("paidTracker");

  unpaidTracker.textContent = filteredTotalUnpaid.toLocaleString();
  paidTracker.textContent = filteredTotalPaid.toLocaleString();

  // Update the "Select All" checkbox based on visible rows
  const allVisibleCheckboxes = Array.from(
    document.querySelectorAll(".row-checkbox")
  ).filter((checkbox) => checkbox.closest("tr").style.display !== "none");

  const allChecked = allVisibleCheckboxes.every((checkbox) => checkbox.checked);
  const selectAllCheckbox = document.getElementById("selectAll");
  selectAllCheckbox.checked = allVisibleCheckboxes.length > 0 && allChecked;
}

window.onload = async function () {
  const tableBody = document.querySelector("#projectExpenseTable tbody");
  const exportButton = document.getElementById("exportButton");
  const unpaidTracker = document.getElementById("unpaidTracker");
  const paidTracker = document.getElementById("paidTracker");

  // Fetch projectExpense from the backend
  const response = await fetch("/projectExpenseAll");
  const projectExpense = await response.json();

  let totalUnpaid = 0;
  let totalPaid = 0;

  projectExpense.forEach((projectExpense) => {
    const row = document.createElement("tr");

    row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" data-id="${
              projectExpense._id
            }" /></td>
            <td>${projectExpense.tag}</td>
            <td>${projectExpense.name}</td>
            <td>${projectExpense.description}</td>
            <td>${projectExpense.package}</td>
            <td>${projectExpense.unit}</td>
            <td>${projectExpense.amount.toLocaleString()}</td>
            <td>${projectExpense.unitPrice.toLocaleString()}</td>
            <td>${(
              projectExpense.amount * projectExpense.unitPrice
            ).toLocaleString()}</td>
            <td>${projectExpense.vat.toLocaleString()}</td>
            <td>${(
              projectExpense.amount *
              projectExpense.unitPrice *
              (projectExpense.vat / 100)
            ).toLocaleString()}</td>
            <td>${(
              projectExpense.amount * projectExpense.unitPrice +
              projectExpense.amount *
                projectExpense.unitPrice *
                (projectExpense.vat / 100)
            ).toLocaleString()}</td>
            <td>${projectExpense.paid.toLocaleString()}</td>
            <td>${projectExpense.deliveryDate}</td>
            <td>${projectExpense.note}</td>
            <td>${projectExpense.entryDate}</td>
            <td>${projectExpense.submittedBy.username} (${
      projectExpense.submittedBy.department
    })</td>
            <td>
            ${
              projectExpense.approvalReceive
                ? `${projectExpense.approvedReceiveBy.username} (${projectExpense.approvedReceiveBy.department}) vào ${projectExpense.approvalReceiveDate}`
                : "Chưa xác nhận"
            }
            </td>
            <td>
              <button class="edit-button" data-projectExpense='${JSON.stringify(
                {
                  tag: projectExpense.tag,
                  name: projectExpense.name,
                  description: projectExpense.description,
                  package: projectExpense.package,
                  unit: projectExpense.unit,
                  amount: projectExpense.amount,
                  unitPrice: projectExpense.unitPrice,
                  vat: projectExpense.vat,
                  paid: projectExpense.paid,
                  deliveryDate: projectExpense.deliveryDate,
                  note: projectExpense.note,
                }
              )}'>Sửa/Edit</button>
            ${
              projectExpense.approvalReceive
                ? ""
                : `<button class="approve-receive-button" data-id="${projectExpense._id}">Xác nhận đã nhận hàng/Confirm Receipt</button>`
            }
            <button class="delete-button" data-id="${
              projectExpense._id
            }">Xóa/Delete</button>
            </td>
            `;

    tableBody.appendChild(row);

    totalPaid += projectExpense.paid;
    totalUnpaid +=
      projectExpense.amount * projectExpense.unitPrice +
      projectExpense.amount *
        projectExpense.unitPrice *
        (projectExpense.vat / 100) -
      projectExpense.paid;
  });

  unpaidTracker.textContent = totalUnpaid.toLocaleString();
  paidTracker.textContent = totalPaid.toLocaleString();

  const tableHeader = document.querySelector("#projectExpenseTable thead tr");
  tableHeader.insertAdjacentHTML(
    "afterbegin",
    `<th><input type="checkbox" id="selectAll" /></th>`
  );

  // Add event listener for "Select All" functionality
  document.getElementById("selectAll").addEventListener("change", (event) => {
    const isChecked = event.target.checked;
    const visibleCheckboxes = Array.from(
      document.querySelectorAll(".row-checkbox")
    ).filter((checkbox) => checkbox.closest("tr").style.display !== "none");

    visibleCheckboxes.forEach((checkbox) => {
      checkbox.checked = isChecked;
    });
  });

  // Add the event listener for edit buttons after the delete button event listeners:
  document.querySelectorAll(".edit-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const projectExpenseData = JSON.parse(
        event.target.getAttribute("data-projectExpense")
      );

      // Get the update form elements
      const updateForm = document.getElementById("updateForm");

      // Set the values in the update form
      updateForm.querySelector("#tag").value = projectExpenseData.tag;
      updateForm.querySelector("#name").value = projectExpenseData.name;
      updateForm.querySelector("#description").value =
        projectExpenseData.description;
      updateForm.querySelector("#package").value = projectExpenseData.package;
      updateForm.querySelector("#unit").value = projectExpenseData.unit;
      updateForm.querySelector("#amount").value = projectExpenseData.amount;
      updateForm.querySelector("#unitPrice").value =
        projectExpenseData.unitPrice;
      updateForm.querySelector("#vat").value = projectExpenseData.vat;
      updateForm.querySelector("#paid").value = projectExpenseData.paid;
      updateForm.querySelector("#deliveryDate").value =
        projectExpenseData.deliveryDate;
      updateForm.querySelector("#note").value = projectExpenseData.note;

      // Scroll to the update form
      updateForm.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const projectExpenseId = event.target.getAttribute("data-id");
      if (
        confirm(
          "Bạn có chắc chắn muốn xóa dữ liệu này không?/Are you sure you want to delete this projectExpense?"
        )
      ) {
        const deleteResponse = await fetch(
          `/projectExpenseDelete/${projectExpenseId}`,
          {
            method: "DELETE",
          }
        );

        if (deleteResponse.ok) {
          alert("Xóa dữ liệu thành công/ProjectExpense deleted successfully!");
          location.reload(); // Reload the page after deletion
        } else {
          const errorData = await deleteResponse.json();
          alert("Error deleting projectExpense: " + errorData.error);
        }
      }
    });
  });

  document.getElementById("deleteSelected").addEventListener("click", () => {
    const selectedIds = Array.from(
      document.querySelectorAll(".row-checkbox:checked")
    ).map((checkbox) => checkbox.getAttribute("data-id"));

    console.log("Selected IDs for deletion:", selectedIds);

    if (selectedIds.length === 0) {
      alert("No projectExpense selected for deletion.");
      return;
    }

    if (
      confirm(
        `Bạn có chắc xóa ${selectedIds.length} dữ liệu này không?/Are you sure you want to delete ${selectedIds.length} projectExpense?`
      )
    ) {
      deleteProjectExpense(selectedIds);
    }
  });

  async function deleteProjectExpense(ids) {
    try {
      console.log("Sending request to delete projectExpense with IDs:", ids);

      const response = await fetch("/projectExpenseDelete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (response.ok) {
        alert("Selected projectExpense deleted successfully.");
        location.reload(); // Reload the page
      } else {
        const errorData = await response.json();
        console.error("Error response from server:", errorData);
        alert("Error deleting projectExpense: " + errorData.error);
      }
    } catch (error) {
      console.error("Error during deletion request:", error);
    }
  }

  document.querySelectorAll(".approve-receive-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const projectExpenseId = event.target.getAttribute("data-id");
      const approveResponse = await fetch(
        `/projectExpenseReceiveApprove/${projectExpenseId}`,
        {
          method: "POST",
        }
      );

      if (approveResponse.ok) {
        alert("ProjectExpense approved successfully!");
        location.reload(); // Reload the page after approval
      } else {
        const errorData = await approveResponse.json();
        alert("Error approving projectExpense: " + errorData.error);
      }
    });
  });

  // Add event listeners to each search field
  document
    .querySelectorAll(
      "#searchTag, #searchName, #searchDescription, #searchPackage, #searchUnit, #searchAmount, #searchUnitPrice, #searchTotalPrice, #searchVAT, #searchVATValue, #searchTotalPriceAfterVAT, #searchPaid, #searchDeliveryDate, #searchNote, #searchEntryDate, #searchSubmitter, #searchConfirmedReceived"
    )
    .forEach((input) => input.addEventListener("input", filterTable));

  exportButton.addEventListener("click", () => {
    window.location.href = "/projectExpenseExport";
  });
};
