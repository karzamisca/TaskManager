//views/financePages/financeCostCenterConstruction/financeCostCenterConstrution.js
const API_BASE = "/financeCostCenterConstructionControl";
let currentCostCenterId = null;

// Tải trạm khi trang load
document.addEventListener("DOMContentLoaded", loadCostCenters);

// Tải tất cả trạm cho dropdown
async function loadCostCenters() {
  try {
    const response = await fetch(`${API_BASE}/cost-centers`);
    const costCenters = await response.json();

    const select = document.getElementById("costCenterSelect");
    costCenters.forEach((cc) => {
      const option = document.createElement("option");
      option.value = cc._id;
      option.textContent = cc.name;
      select.appendChild(option);
    });
  } catch (error) {
    alert("Lỗi khi tải trạm: " + error.message);
  }
}

// Tải dữ liệu cho trạm được chọn
async function loadCostCenterData() {
  currentCostCenterId = document.getElementById("costCenterSelect").value;

  if (!currentCostCenterId) {
    document.getElementById("costCenterInfo").classList.add("hidden");
    document.getElementById("addFormContainer").classList.add("hidden");
    document.getElementById("summarySection").classList.add("hidden");
    return;
  }

  // Hiển thị thông tin trạm được chọn
  const selectedOption =
    document.getElementById("costCenterSelect").selectedOptions[0];
  document.getElementById("costCenterName").textContent =
    selectedOption.textContent;
  document.getElementById("costCenterInfo").classList.remove("hidden");
  document.getElementById("addFormContainer").classList.remove("hidden");

  // Tải các mục Mua sắm và Xây dựng
  await loadEntries();
}

// Thêm mục mới
document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentCostCenterId) return;

  const formData = new FormData(e.target);
  const entry = Object.fromEntries(formData);

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    if (response.ok) {
      e.target.reset();
      await loadEntries();
      alert("Thêm mục thành công!");
    } else {
      alert("Lỗi khi thêm mục");
    }
  } catch (error) {
    alert("Lỗi khi thêm mục: " + error.message);
  }
});

// Gửi form chỉnh sửa
document
  .getElementById("editEntryForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentCostCenterId) return;

    const formData = new FormData(e.target);
    const entry = Object.fromEntries(formData);

    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries/${entry.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entry),
        }
      );

      if (response.ok) {
        cancelEdit();
        await loadEntries();
        alert("Cập nhật thành công!");
      } else {
        alert("Lỗi khi cập nhật mục");
      }
    } catch (error) {
      alert("Lỗi khi cập nhật mục: " + error.message);
    }
  });

// Tải tất cả mục cho trạm hiện tại
async function loadEntries() {
  if (!currentCostCenterId) return;

  try {
    const response = await fetch(`${API_BASE}/${currentCostCenterId}/entries`);
    const entries = await response.json();
    renderEntries(entries);
    calculateSummary(entries);
  } catch (error) {
    alert("Lỗi khi tải dữ liệu: " + error.message);
  }
}

// Tính toán tổng kết
function calculateSummary(entries) {
  let totalIncome = 0;
  let totalExpense = 0;

  entries.forEach((entry) => {
    totalIncome += entry.income;
    totalExpense += entry.expense;
  });

  const totalProfit = totalIncome - totalExpense;

  document.getElementById("totalIncome").textContent =
    totalIncome.toLocaleString("vi-VN");
  document.getElementById("totalExpense").textContent =
    totalExpense.toLocaleString("vi-VN");
  document.getElementById("totalProfit").textContent =
    totalProfit.toLocaleString("vi-VN");

  // Hiển thị phần tổng kết
  document.getElementById("summarySection").classList.remove("hidden");
}

// Hiển thị các mục trong bảng
function renderEntries(entries) {
  const tbody = document.getElementById("entriesBody");
  tbody.innerHTML = "";

  if (entries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
                    <td colspan="5" style="text-align: center; color: #666;">
                        Chưa có dữ liệu Mua sắm và Xây dựng nào. Hãy thêm mục mới.
                    </td>
                `;
    tbody.appendChild(row);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
                    <td>${entry.name}</td>
                    <td>${entry.income.toLocaleString("vi-VN")}</td>
                    <td>${entry.expense.toLocaleString("vi-VN")}</td>
                    <td>${entry.date}</td>
                    <td class="actions">
                        <button class="edit-btn" onclick="editEntry('${
                          entry._id
                        }', '${entry.name}', ${entry.income}, ${
      entry.expense
    }, '${entry.date}')">Sửa</button>
                        <button class="delete-btn" onclick="deleteEntry('${
                          entry._id
                        }')">Xóa</button>
                    </td>
                `;
    tbody.appendChild(row);
  });
}

// Chỉnh sửa mục
function editEntry(id, name, income, expense, date) {
  document.getElementById("editId").value = id;
  document.getElementById("editName").value = name;
  document.getElementById("editIncome").value = income;
  document.getElementById("editExpense").value = expense;
  document.getElementById("editDate").value = date;
  document.getElementById("editForm").classList.remove("hidden");

  // Cuộn đến form chỉnh sửa
  document.getElementById("editForm").scrollIntoView({ behavior: "smooth" });
}

// Hủy chỉnh sửa
function cancelEdit() {
  document.getElementById("editForm").classList.add("hidden");
  document.getElementById("editEntryForm").reset();
}

// Xóa mục
async function deleteEntry(entryId) {
  if (!currentCostCenterId) return;

  if (confirm("Bạn có chắc chắn muốn xóa mục này không?")) {
    try {
      const response = await fetch(
        `${API_BASE}/${currentCostCenterId}/entries/${entryId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        await loadEntries();
        alert("Xóa mục thành công!");
      } else {
        alert("Lỗi khi xóa mục");
      }
    } catch (error) {
      alert("Lỗi khi xóa mục: " + error.message);
    }
  }
}
