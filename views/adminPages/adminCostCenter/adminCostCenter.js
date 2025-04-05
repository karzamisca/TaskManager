// Fetch all existing cost centers and render them on page load
window.onload = function () {
  fetch("/getCostCenterAdmin")
    .then((response) => response.json())
    .then((data) => renderCostCenters(data));
};

function renderCostCenters(costCenters) {
  const tableBody = document.querySelector("#costCentersTable tbody");
  tableBody.innerHTML = ""; // Clear the table body first

  costCenters.forEach(function (costCenter) {
    const row = document.createElement("tr");

    // Name column
    const nameCell = document.createElement("td");
    nameCell.textContent = costCenter.name;
    row.appendChild(nameCell);

    // Allowed users column
    const usersCell = document.createElement("td");
    usersCell.textContent = costCenter.allowedUsers.join(", ");
    row.appendChild(usersCell);

    // Actions column
    const actionsCell = document.createElement("td");
    actionsCell.innerHTML = `
          <button onclick="editCostCenter('${costCenter._id}', '${
      costCenter.name
    }', '${costCenter.allowedUsers.join(", ")}')">Sửa/Edit</button>
          <button onclick="deleteCostCenter('${
            costCenter._id
          }')">Xóa/Delete</button>
        `;
    row.appendChild(actionsCell);

    tableBody.appendChild(row);
  });
}

// Add a new cost center
document
  .getElementById("addCostCenterForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value;
    const allowedUsers = document.getElementById("allowedUsers").value;

    fetch("/addCostCenter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `name=${name}&allowedUsers=${allowedUsers}`,
    }).then((response) => response.redirected && window.location.reload()); // Reload the page to reflect the new cost center
  });

// Edit an existing cost center
function editCostCenter(id, name, allowedUsers) {
  document.getElementById("editName").value = name;

  const usersArray = allowedUsers.split(", ");
  const allowedUsersContainer = document.getElementById(
    "allowedUsersContainer"
  );
  allowedUsersContainer.innerHTML = ""; // Clear previous inputs

  usersArray.forEach((user) => {
    addUserInput(user);
  });

  const form = document.getElementById("editForm");
  form.action = `/editCostCenter/${id}`;

  document.getElementById("editModal").style.display = "block";
}

// Delete a cost center
function deleteCostCenter(id) {
  if (
    confirm(
      "Bạn có chắc muốn xóa trạm nào không?/Are you sure you want to delete this center?"
    )
  ) {
    fetch(`/deleteCostCenter/${id}`, { method: "DELETE" }).then(() =>
      window.location.reload()
    );
  }
}

// Add a new input field for an allowed user
function addUserInput(user = "") {
  const container = document.getElementById("allowedUsersContainer");
  const userRow = document.createElement("div");
  userRow.classList.add("user-row");

  userRow.innerHTML = `
        <input type="text" name="allowedUsers[]" value="${user}" />
        <button type="button" onclick="removeUserInput(this)">X</button>
      `;
  container.appendChild(userRow);
}

// Remove an input field
function removeUserInput(button) {
  button.parentElement.remove();
}

// Close the edit modal
function closeModal() {
  document.getElementById("editModal").style.display = "none";
}
