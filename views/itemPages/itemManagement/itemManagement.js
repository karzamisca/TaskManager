// views/itemPages/itemManagement/itemManagement.js
// All item operations are cost-center-aware.

// ─── State ────────────────────────────────────────────────────────────────────
let currentItemId = null;
let showDeleted = false;
let allItems = [];
let costCenters = [];
let selectedCostCenterId = null;
let selectedCostCenterName = "";
let errorFileData = null;

let currentSort = { field: "name", order: "asc" };
const sortStates = {
  code: "none",
  name: "asc",
  unit: "none",
  unitPrice: "none",
  vat: "none",
  unitPriceAfterVAT: "none",
  inStorage: "none",
  createdAt: "none",
};

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadCostCenters();

  document
    .getElementById("cost-center-select")
    .addEventListener("change", onCostCenterChange);
  document
    .getElementById("unitPrice")
    .addEventListener("input", calculatePriceAfterVAT);
  document
    .getElementById("vat")
    .addEventListener("input", calculatePriceAfterVAT);

  window.onclick = (e) => {
    if (e.target === document.getElementById("item-modal")) closeModal();
    if (e.target === document.getElementById("import-modal"))
      closeImportModal();
    if (e.target === document.getElementById("stock-edit-modal"))
      closeStockEditModal();
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeImportModal();
      closeStockEditModal();
    }
  });
});

// ─── Cost Centers ─────────────────────────────────────────────────────────────
async function loadCostCenters() {
  try {
    const res = await fetch("/itemManagementControl/costCenters", {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Không thể tải danh sách cost center");

    costCenters = await res.json();
    const select = document.getElementById("cost-center-select");

    costCenters.forEach((cc) => {
      const opt = document.createElement("option");
      opt.value = cc._id;
      opt.textContent = `${cc.name}${cc.category ? " (" + cc.category + ")" : ""}`;
      select.appendChild(opt);
    });

    if (costCenters.length === 1) {
      select.value = costCenters[0]._id;
      onCostCenterChange();
    } else {
      showNoCostCenterMessage();
    }
  } catch (err) {
    showAlert("Lỗi tải cost center: " + err.message, "error");
  }
}

function onCostCenterChange() {
  const select = document.getElementById("cost-center-select");
  selectedCostCenterId = select.value || null;
  selectedCostCenterName = select.options[select.selectedIndex]?.text || "";

  const badge = document.getElementById("cost-center-badge");
  const hint = document.getElementById("stock-scope-hint");
  const addBtn = document.getElementById("btn-add");
  const importBtn = document.getElementById("btn-import");
  const storageCC = document.getElementById("th-storage-cc");
  const noCCMsg = document.getElementById("no-cost-center-msg");

  if (selectedCostCenterId) {
    badge.textContent = selectedCostCenterName;
    badge.style.display = "inline-block";
    hint.style.display = "inline";
    addBtn.disabled = false;
    importBtn.disabled = false;
    storageCC.textContent = selectedCostCenterName;
    storageCC.style.display = "inline-block";
    noCCMsg.style.display = "none";
    document.getElementById("import-cc-name").textContent =
      selectedCostCenterName;
    fetchItems();
  } else {
    badge.style.display = "none";
    hint.style.display = "none";
    addBtn.disabled = true;
    importBtn.disabled = true;
    storageCC.style.display = "none";
    showNoCostCenterMessage();
  }
}

function showNoCostCenterMessage() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("items-table").style.display = "none";
  document.getElementById("no-cost-center-msg").style.display = "block";
}

// ─── Alert ───────────────────────────────────────────────────────────────────
function showAlert(message, type = "success") {
  const container = document.getElementById("alert-container");
  const alert = document.createElement("div");
  alert.className = `alert alert-${type === "error" ? "danger" : type}`;
  alert.innerHTML = `<i class="bi bi-${type === "error" ? "x-circle" : "check-circle"}"></i> ${message}`;
  container.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

// ─── Price Calculation ────────────────────────────────────────────────────────
function calculatePriceAfterVAT() {
  const price = parseFloat(document.getElementById("unitPrice").value) || 0;
  const vat = parseFloat(document.getElementById("vat").value) || 0;
  document.getElementById("unitPriceAfterVAT").value = (
    price *
    (1 + vat / 100)
  ).toFixed(2);
}

// ─── Fetch Items ──────────────────────────────────────────────────────────────
async function fetchItems() {
  if (!selectedCostCenterId) return;

  document.getElementById("loading").style.display = "block";
  document.getElementById("items-table").style.display = "none";

  try {
    const base = showDeleted
      ? "/itemManagementControl/all"
      : "/itemManagementControl";
    const url = `${base}?sortBy=${currentSort.field}&sortOrder=${currentSort.order}&costCenterId=${selectedCostCenterId}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Không thể tải danh sách mặt hàng");

    allItems = await res.json();
    renderItems(allItems);
    document.getElementById("loading").style.display = "none";
    document.getElementById("items-table").style.display = "table";
  } catch (err) {
    showAlert("Lỗi khi tải mặt hàng: " + err.message, "error");
    document.getElementById("loading").style.display = "none";
  }
}

// ─── Render Items ─────────────────────────────────────────────────────────────
function renderItems(items) {
  const tbody = document.getElementById("items-body");
  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:#666;">Không có mặt hàng nào</td></tr>`;
    return;
  }

  const hasCostCenter = !!selectedCostCenterId;

  items.forEach((item) => {
    const row = document.createElement("tr");
    if (item.isDeleted) row.className = "deleted-item";

    const storageCell = hasCostCenter
      ? `<td class="${item.inStorage > 0 ? "storage-ok" : "storage-zero"}">
           ${item.inStorage ?? 0}
           <button class="btn-storage-edit"
             onclick="showStockEditModal('${item._id}', '${escapeAttr(item.name)}', ${item.inStorage ?? 0})"
             title="Sửa tồn kho">
             <i class="bi bi-pencil-square"></i>
           </button>
           <button class="btn-storage-edit"
             onclick="showStockHistoryPanel('${item._id}', '${escapeAttr(item.name)}', '${selectedCostCenterId}', '${escapeAttr(selectedCostCenterName)}')"
             title="Lịch sử tồn kho">
             <i class="bi bi-clock-history"></i>
           </button>
         </td>`
      : `<td class="text-muted">—</td>`;

    row.innerHTML = `
      <td><code>${item.code}</code></td>
      <td>${item.name}</td>
      <td>${item.unit || "cái"}</td>
      <td class="text-end">${formatCurrency(item.unitPrice)}</td>
      <td class="text-center">${item.vat}%</td>
      <td class="text-end">${formatCurrency(item.unitPriceAfterVAT)}</td>
      ${storageCell}
      <td>${formatDate(item.createdAt)}</td>
      <td>
        <span class="status-badge ${item.isDeleted ? "status-deleted" : "status-active"}">
          ${item.isDeleted ? "Đã xóa" : "Đang hoạt động"}
        </span>
      </td>
      <td>${item.createdBy?.username || "—"}</td>
      <td>
        <div class="action-buttons">
          ${
            !item.isDeleted
              ? `
            <button onclick="showEditModal('${item._id}')" class="action-btn btn-primary">Sửa</button>
            <button onclick="showAllStock('${item._id}', '${escapeAttr(item.name)}')" class="action-btn btn-info">Tồn kho</button>
            <button onclick="showAuditHistory('${item._id}')" class="action-btn btn-secondary">Lịch sử</button>
            <button onclick="deleteItem('${item._id}')" class="action-btn btn-danger">Xóa</button>
          `
              : `
            <button onclick="restoreItem('${item._id}')" class="action-btn btn-success">Khôi phục</button>
            <button onclick="showAuditHistory('${item._id}')" class="action-btn btn-secondary">Lịch sử</button>
          `
          }
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  updateSortIndicators();
}

// ─── Sort ─────────────────────────────────────────────────────────────────────
function sortTable(field) {
  if (currentSort.field === field) {
    currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
  } else {
    currentSort.field = field;
    currentSort.order = "asc";
  }
  Object.keys(sortStates).forEach((k) => (sortStates[k] = "none"));
  sortStates[field] = currentSort.order;
  fetchItems();
}

function updateSortIndicators() {
  document
    .querySelectorAll(".sort-indicator")
    .forEach((el) => (el.textContent = "↕"));
  const el = document.getElementById(
    `sort-${currentSort.field.replace(".", "-")}`,
  );
  if (el) el.textContent = currentSort.order === "asc" ? "↑" : "↓";
}

// ─── Search ───────────────────────────────────────────────────────────────────
function searchItems() {
  const q = document.getElementById("search").value.toLowerCase();
  const filtered = allItems.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.code.toLowerCase().includes(q) ||
      (i.unit || "").toLowerCase().includes(q) ||
      (i.createdBy?.username || "").toLowerCase().includes(q),
  );
  renderItems(filtered);
}

// ─── Toggle deleted ───────────────────────────────────────────────────────────
function toggleDeletedItems() {
  showDeleted = !showDeleted;
  document.getElementById("btn-toggle-deleted").textContent = showDeleted
    ? "Hiện đang hoạt động"
    : "Hiện đã xóa";
  fetchItems();
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────
function showAddModal() {
  if (!selectedCostCenterId) {
    showAlert("Vui lòng chọn cost center trước!", "error");
    return;
  }
  document.getElementById("modal-title").textContent = "Thêm mặt hàng mới";
  document.getElementById("item-form").reset();
  document.getElementById("item-id").value = "";
  document.getElementById("unit").value = "cái";
  document.getElementById("vat").value = "10";
  document.getElementById("inStorage").value = "0";
  document.getElementById("modal-cost-center-name").value =
    selectedCostCenterName;
  document.getElementById("storage-cc-label").textContent =
    `(${selectedCostCenterName})`;
  calculatePriceAfterVAT();
  document.getElementById("item-modal").style.display = "block";
  setTimeout(() => document.getElementById("code").focus(), 100);
}

async function showEditModal(itemId) {
  if (!selectedCostCenterId) {
    showAlert("Vui lòng chọn cost center trước!", "error");
    return;
  }
  try {
    const res = await fetch(
      `/itemManagementControl/${itemId}?costCenterId=${selectedCostCenterId}`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error("Không thể tải thông tin mặt hàng");
    const item = await res.json();

    document.getElementById("modal-title").textContent = "Sửa mặt hàng";
    document.getElementById("item-id").value = item._id;
    document.getElementById("code").value = item.code;
    document.getElementById("name").value = item.name;
    document.getElementById("unit").value = item.unit || "cái";
    document.getElementById("unitPrice").value = item.unitPrice;
    document.getElementById("vat").value = item.vat;
    document.getElementById("unitPriceAfterVAT").value =
      item.unitPriceAfterVAT.toFixed(2);
    document.getElementById("inStorage").value = item.inStorage ?? 0;
    document.getElementById("modal-cost-center-name").value =
      selectedCostCenterName;
    document.getElementById("storage-cc-label").textContent =
      `(${selectedCostCenterName})`;
    document.getElementById("item-modal").style.display = "block";
    setTimeout(() => document.getElementById("code").focus(), 100);
  } catch (err) {
    showAlert("Lỗi khi tải mặt hàng: " + err.message, "error");
  }
}

function closeModal() {
  document.getElementById("item-modal").style.display = "none";
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!selectedCostCenterId) {
    showAlert("Vui lòng chọn cost center!", "error");
    return;
  }

  const itemId = document.getElementById("item-id").value;
  const code = document.getElementById("code").value.trim();
  const name = document.getElementById("name").value.trim();
  const unit = document.getElementById("unit").value.trim();
  const unitPrice = parseFloat(document.getElementById("unitPrice").value);
  const vat = parseFloat(document.getElementById("vat").value);
  const inStorage = parseInt(document.getElementById("inStorage").value) || 0;

  if (!code || !name || !unit || isNaN(unitPrice) || unitPrice < 0) {
    showAlert("Vui lòng nhập đầy đủ và chính xác thông tin!", "error");
    return;
  }
  if (vat < 0 || vat > 100) {
    showAlert("VAT phải nằm trong khoảng 0-100%!", "error");
    return;
  }
  if (inStorage < 0) {
    showAlert("Tồn kho không được âm!", "error");
    return;
  }

  const body = {
    code,
    name,
    unit,
    unitPrice,
    vat,
    inStorage,
    costCenterId: selectedCostCenterId,
  };
  const url = itemId
    ? `/itemManagementControl/${itemId}`
    : "/itemManagementControl";
  const method = itemId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Không thể lưu mặt hàng");
    }

    const result = await res.json();
    const verb = itemId ? "cập nhật" : "tạo";
    let msg = `Mặt hàng đã được ${verb} thành công!`;
    if (result.ordersUpdated)
      msg += ` (${result.ordersUpdated} đơn hàng chờ đã được cập nhật)`;
    showAlert(msg);
    closeModal();
    fetchItems();
  } catch (err) {
    showAlert("Lỗi: " + err.message, "error");
  }
}

// ─── Quick Stock Edit ─────────────────────────────────────────────────────────
function showStockEditModal(itemId, itemName, currentStock) {
  if (!selectedCostCenterId) {
    showAlert("Vui lòng chọn cost center!", "error");
    return;
  }
  document.getElementById("stock-edit-item-id").value = itemId;
  document.getElementById("stock-edit-cc-id").value = selectedCostCenterId;
  document.getElementById("stock-edit-item-label").textContent =
    `Mặt hàng: ${itemName}`;
  document.getElementById("stock-edit-cc-label").textContent =
    `Cost Center: ${selectedCostCenterName}`;
  document.getElementById("stock-edit-value").value = currentStock;
  document.getElementById("stock-edit-modal").style.display = "block";
  setTimeout(() => document.getElementById("stock-edit-value").focus(), 100);
}

function closeStockEditModal() {
  document.getElementById("stock-edit-modal").style.display = "none";
}

async function handleStockEditSubmit(event) {
  event.preventDefault();
  const itemId = document.getElementById("stock-edit-item-id").value;
  const costCenterId = document.getElementById("stock-edit-cc-id").value;
  const inStorage = parseInt(document.getElementById("stock-edit-value").value);

  try {
    const res = await fetch(`/itemManagementControl/${itemId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ costCenterId, inStorage }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Không thể cập nhật tồn kho");
    }
    showAlert("Đã cập nhật tồn kho thành công!");
    closeStockEditModal();
    fetchItems();
  } catch (err) {
    showAlert("Lỗi: " + err.message, "error");
  }
}

// ─── All-CC Stock Panel ───────────────────────────────────────────────────────
async function showAllStock(itemId, itemName) {
  try {
    const res = await fetch(`/itemManagementControl/${itemId}/stock`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Không thể tải tồn kho");
    const stocks = await res.json();

    document.getElementById("stock-panel-title").textContent =
      `Tồn kho: ${itemName}`;
    const tbody = document.getElementById("stock-panel-body");
    tbody.innerHTML = "";

    if (!stocks.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Chưa có tồn kho tại cost center nào</td></tr>`;
    } else {
      stocks.forEach((s) => {
        const ccId = s.costCenterId?._id || "";
        const ccName = s.costCenterId?.name || "";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><strong>${ccName || "—"}</strong></td>
          <td><span class="badge bg-secondary">${s.costCenterId?.category || "—"}</span></td>
          <td class="${s.inStorage > 0 ? "text-success fw-bold" : "text-warning"}">${s.inStorage}</td>
          <td>${s.updatedAt ? formatDate(s.updatedAt) : "—"}</td>
          <td>${s.updatedBy?.username || "—"}</td>
          <td class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-primary"
              onclick="showStockEditModal('${itemId}', '${escapeAttr(itemName)}', ${s.inStorage});
                       document.getElementById('stock-edit-cc-id').value='${ccId}';
                       document.getElementById('stock-edit-cc-label').textContent='Cost Center: ${escapeAttr(ccName)}';">
              Sửa
            </button>
            <button class="btn btn-sm btn-outline-secondary"
              onclick="showStockHistoryPanel('${itemId}', '${escapeAttr(itemName)}', '${ccId}', '${escapeAttr(ccName)}')">
              <i class="bi bi-clock-history"></i> Lịch sử
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById("stock-panel").style.display = "block";
    document
      .getElementById("stock-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showAlert("Lỗi khi tải tồn kho: " + err.message, "error");
  }
}

function hideStockPanel() {
  document.getElementById("stock-panel").style.display = "none";
}

// ─── Stock History Panel ──────────────────────────────────────────────────────
async function showStockHistoryPanel(
  itemId,
  itemName,
  costCenterId,
  costCenterName,
) {
  try {
    const res = await fetch(
      `/itemManagementControl/${itemId}/stock/history?costCenterId=${costCenterId}`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error("Không thể tải lịch sử tồn kho");
    const history = await res.json();

    document.getElementById("stock-history-title").textContent =
      `Lịch sử tồn kho: ${itemName} — ${costCenterName}`;

    const tbody = document.getElementById("stock-history-body");
    tbody.innerHTML = "";

    if (!history.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Chưa có lịch sử tồn kho</td></tr>`;
    } else {
      history.forEach((h) => {
        const isFirst = h.oldInStorage == null;
        const delta = isFirst ? null : h.newInStorage - h.oldInStorage;

        let deltaHtml;
        if (isFirst) {
          deltaHtml = `<span class="text-muted fst-italic">Khởi tạo</span>`;
        } else if (delta > 0) {
          deltaHtml = `<span class="text-success fw-bold">+${delta}</span>`;
        } else if (delta < 0) {
          deltaHtml = `<span class="text-danger fw-bold">${delta}</span>`;
        } else {
          deltaHtml = `<span class="text-muted">0</span>`;
        }

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${formatDate(h.updatedAt)}</td>
          <td>${isFirst ? '<span class="text-muted">—</span>' : h.oldInStorage}</td>
          <td class="${h.newInStorage > 0 ? "text-success fw-bold" : "text-warning"}">${h.newInStorage}</td>
          <td>${deltaHtml}</td>
          <td>${h.updatedBy?.username || "—"}</td>
          <td class="text-muted small">${h.note || "—"}</td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById("stock-history-panel").style.display = "block";
    document
      .getElementById("stock-history-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showAlert("Lỗi khi tải lịch sử tồn kho: " + err.message, "error");
  }
}

function hideStockHistoryPanel() {
  document.getElementById("stock-history-panel").style.display = "none";
}

// ─── Delete / Restore ─────────────────────────────────────────────────────────
async function deleteItem(itemId) {
  if (!confirm("Bạn có chắc chắn muốn xóa mặt hàng này?")) return;
  try {
    const res = await fetch(`/itemManagementControl/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Không thể xóa mặt hàng");
    }
    showAlert("Đã xóa mặt hàng thành công!");
    fetchItems();
  } catch (err) {
    showAlert("Lỗi khi xóa: " + err.message, "error");
  }
}

async function restoreItem(itemId) {
  if (!confirm("Bạn có chắc chắn muốn khôi phục mặt hàng này?")) return;
  try {
    const res = await fetch(`/itemManagementControl/${itemId}/restore`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Không thể khôi phục");
    }
    showAlert("Đã khôi phục mặt hàng thành công!");
    fetchItems();
  } catch (err) {
    showAlert("Lỗi khi khôi phục: " + err.message, "error");
  }
}

// ─── Audit History ────────────────────────────────────────────────────────────
async function showAuditHistory(itemId) {
  try {
    const res = await fetch(`/itemManagementControl/${itemId}/audit`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Không thể tải lịch sử");
    const history = await res.json();

    const tbody = document.getElementById("audit-body");
    tbody.innerHTML = "";

    if (!history.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">Không có lịch sử thay đổi</td></tr>`;
    } else {
      history.forEach((a) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${formatDate(a.editedAt)}</td>
          <td><span class="status-badge ${getActionClass(a.action)}">${getActionText(a.action)}</span></td>
          <td>${a.editedBy?.username || "—"}</td>
          <td class="change-cell">${diffCell(a.oldName, a.newName)}</td>
          <td class="change-cell">${diffCell(a.oldCode, a.newCode)}</td>
          <td class="change-cell">${diffCell(a.oldUnit, a.newUnit)}</td>
          <td class="change-cell">${diffCell(
            a.oldUnitPrice != null ? formatCurrency(a.oldUnitPrice) : null,
            a.newUnitPrice != null ? formatCurrency(a.newUnitPrice) : null,
          )}</td>
          <td class="change-cell">${diffCell(
            a.oldVAT != null ? a.oldVAT + "%" : null,
            a.newVAT != null ? a.newVAT + "%" : null,
          )}</td>
          <td class="change-cell">${diffCell(
            a.oldUnitPriceAfterVAT != null
              ? formatCurrency(a.oldUnitPriceAfterVAT)
              : null,
            a.newUnitPriceAfterVAT != null
              ? formatCurrency(a.newUnitPriceAfterVAT)
              : null,
          )}</td>
          <td class="text-muted small">${a.note || "—"}</td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById("audit-section").style.display = "block";
    document.getElementById("items-table").style.display = "none";
    document
      .getElementById("audit-section")
      .scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    showAlert("Lỗi khi tải lịch sử: " + err.message, "error");
  }
}

function diffCell(oldVal, newVal) {
  if (oldVal == null && newVal == null) return "—";
  if (oldVal == null) return `<span class="new-value">${newVal}</span>`;
  if (newVal == null) return `<span class="old-value">${oldVal}</span>`;
  if (oldVal === newVal) return `<span>${newVal}</span>`;
  return `<span class="old-value">${oldVal}</span> → <span class="new-value">${newVal}</span>`;
}

function hideAuditHistory() {
  document.getElementById("audit-section").style.display = "none";
  document.getElementById("items-table").style.display = "table";
}

// ─── Excel ────────────────────────────────────────────────────────────────────
function downloadTemplate() {
  window.location.href = "/itemManagementControl/template/excel";
}

function exportToExcel(includeDeleted = false, allCostCenters = false) {
  let url = `/itemManagementControl/export/excel?includeDeleted=${includeDeleted}`;
  if (!allCostCenters && selectedCostCenterId) {
    url += `&costCenterId=${selectedCostCenterId}`;
  }
  window.location.href = url;
}

function showImportModal() {
  if (!selectedCostCenterId) {
    showAlert("Vui lòng chọn cost center trước!", "error");
    return;
  }
  document.getElementById("import-cc-name").textContent =
    selectedCostCenterName;
  document.getElementById("import-modal").style.display = "block";
  resetImportForm();
}

function closeImportModal() {
  document.getElementById("import-modal").style.display = "none";
  resetImportForm();
}

function resetImportForm() {
  document.getElementById("excel-file").value = "";
  document.getElementById("import-progress").style.display = "none";
  document.getElementById("import-results").style.display = "none";
  document.getElementById("import-summary").innerHTML = "";
  document.getElementById("import-errors").innerHTML = "";
  document.getElementById("error-download").style.display = "none";
  document.getElementById("import-submit-btn").disabled = false;
  errorFileData = null;
}

async function handleImportSubmit(event) {
  event.preventDefault();
  if (!selectedCostCenterId) {
    showAlert("Vui lòng chọn cost center!", "error");
    return;
  }

  const file = document.getElementById("excel-file").files[0];
  if (!file) {
    showAlert("Vui lòng chọn file Excel", "error");
    return;
  }

  if (
    !confirm(
      `⚠️ Lưu ý: File sẽ được nhập vào cost center "${selectedCostCenterName}".\n` +
        "Nếu có mã hàng trùng, thông tin sẽ được CẬP NHẬT (ghi đè).\n\nTiếp tục?",
    )
  )
    return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("costCenterId", selectedCostCenterId);

  document.getElementById("import-progress").style.display = "block";
  document.getElementById("import-progress-bar").style.width = "30%";
  document.getElementById("import-submit-btn").disabled = true;

  try {
    const res = await fetch("/itemManagementControl/import/excel", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    document.getElementById("import-progress-bar").style.width = "80%";
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error || "Không thể nhập file");
    }

    const result = await res.json();
    document.getElementById("import-progress-bar").style.width = "100%";

    displayImportResults(result);

    if (result.errorFile) {
      errorFileData = result.errorFile;
      document.getElementById("error-download").style.display = "block";
    }

    if (result.summary.success > 0) {
      setTimeout(() => {
        fetchItems();
        showAlert(
          `Đã nhập thành công ${result.summary.success} mặt hàng! ` +
            `(${result.summary.created || 0} mới, ${result.summary.updated || 0} cập nhật)`,
        );
      }, 1500);
    }
  } catch (err) {
    showAlert("Lỗi khi nhập file: " + err.message, "error");
    resetImportForm();
  }
}

function displayImportResults(result) {
  const s = result.summary;
  document.getElementById("import-summary").innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><div class="value">${s.total}</div><div class="label">Tổng dòng</div></div>
      <div class="summary-item success"><div class="value">${s.success}</div><div class="label">Thành công</div></div>
      <div class="summary-item created"><div class="value">${s.created || 0}</div><div class="label">Tạo mới</div></div>
      <div class="summary-item updated"><div class="value">${s.updated || 0}</div><div class="label">Cập nhật</div></div>
      <div class="summary-item failed"><div class="value">${s.failed}</div><div class="label">Thất bại</div></div>
    </div>
  `;

  const errorsDiv = document.getElementById("import-errors");
  if (s.errors && s.errors.length > 0) {
    errorsDiv.innerHTML = `
      <table class="error-table table table-sm">
        <thead><tr><th>Dòng</th><th>Mã hàng</th><th>Thông báo</th><th>Loại</th></tr></thead>
        <tbody>${s.errors
          .map(
            (e) => `
          <tr class="${e.warning ? "table-warning" : "table-danger"}">
            <td>${e.row}</td><td>${e.code}</td><td>${e.error}</td>
            <td><span class="badge ${e.warning ? "bg-warning text-dark" : "bg-danger"}">${e.warning ? "Cảnh báo" : "Lỗi"}</span></td>
          </tr>`,
          )
          .join("")}
        </tbody>
      </table>
    `;
  } else {
    errorsDiv.innerHTML =
      '<p class="text-success"><i class="bi bi-check-circle"></i> Không có lỗi nào.</p>';
  }

  document.getElementById("import-results").style.display = "block";
}

function downloadErrorFile() {
  if (!errorFileData) {
    showAlert("Không có file lỗi để tải", "error");
    return;
  }
  try {
    const bin = atob(errorFileData);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ket-qua-nhap-loi_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showAlert("Lỗi khi tải file: " + err.message, "error");
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0)
    return (
      "Hôm nay, " +
      date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    );
  if (diffDays === 1)
    return (
      "Hôm qua, " +
      date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    );
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function getActionText(action) {
  return (
    { create: "Tạo mới", update: "Cập nhật", delete: "Xóa" }[action] || action
  );
}

function getActionClass(action) {
  return (
    {
      create: "status-active",
      update: "status-badge",
      delete: "status-deleted",
    }[action] || ""
  );
}

function escapeAttr(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
