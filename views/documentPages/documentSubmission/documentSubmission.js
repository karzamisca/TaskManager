// views/documentPages/documentSubmission/documentSubmission.js

// Global variable to store Choice.js instances
let choiceInstances = [];
let isSubmitting = false;
let productEntries = [];
let grandTotalCost = 0;

// Modal elements
let addProductModal = null;
let addProductForm = null;
let addProductMessage = null;

// Product Management Modal elements
let productManagementModal = null;
let allProducts = [];
let filteredProducts = [];
let currentEditingProduct = null;

// Initialize Choice.js for product dropdowns
function initializeProductDropdowns() {
  document.querySelectorAll(".product-dropdown").forEach((select) => {
    if (!select.hasAttribute("data-choice-initialized")) {
      const choiceInstance = new Choices(select, {
        searchEnabled: true,
        searchPlaceholderValue: "Tìm kiếm sản phẩm...",
        placeholder: true,
        placeholderValue: "Chọn sản phẩm",
        searchResultLimit: 10,
        shouldSort: false,
        itemSelectText: "Nhấn để chọn",
        noResultsText: "Không tìm thấy sản phẩm",
        noChoicesText: "Không có sản phẩm nào để chọn",
        loadingText: "Đang tải...",
        searchChoices: true,
        position: "auto",
      });

      choiceInstance.passedElement.element.addEventListener(
        "change",
        function () {
          const productEntry = this.closest(".product-entry");
          if (productEntry) {
            const index = parseInt(productEntry.id.split("-")[2]);
            updateProductEntryCost(index);
          }
        },
      );

      select.setAttribute("data-choice-initialized", "true");
      choiceInstances.push(choiceInstance);
    }
  });
}

// Enhanced function to populate product dropdowns with Choice.js
async function populateProductDropdowns() {
  try {
    const products = await fetchProducts();

    document.querySelectorAll(".product-dropdown").forEach((dropdown) => {
      const choiceInstance = choiceInstances.find(
        (instance) => instance.passedElement.element === dropdown,
      );
      const currentValue = choiceInstance
        ? choiceInstance.getValue(true)
        : null;

      const defaultOption = dropdown.querySelector('option[value=""]');
      dropdown.innerHTML = "";
      if (defaultOption) {
        dropdown.appendChild(defaultOption);
      }

      products.forEach((product) => {
        const option = document.createElement("option");
        option.value = product.name;
        option.textContent = `${product.name} (${product.code})`;
        option.dataset.productCode = product.code;
        dropdown.appendChild(option);
      });

      if (choiceInstance) {
        choiceInstance.setChoices(
          products.map((product) => ({
            value: product.name,
            label: `${product.name} (${product.code})`,
            customProperties: { code: product.code },
          })),
          "value",
          "label",
          true,
        );

        if (currentValue) {
          choiceInstance.setChoiceByValue(currentValue);
        }
      }
    });
  } catch (error) {
    console.error("Error populating product dropdowns:", error);
    return [];
  }
}

// Function to calculate cost for a single product entry
function calculateProductCost(index) {
  const productEntry = document.getElementById(`product-entry-${index}`);
  if (!productEntry) return 0;

  const costPerUnitInput = productEntry.querySelector(
    `input[name="products[${index}][costPerUnit]"]`,
  );
  const amountInput = productEntry.querySelector(
    `input[name="products[${index}][amount]"]`,
  );
  const vatInput = productEntry.querySelector(
    `input[name="products[${index}][vat]"]`,
  );
  const productNameSelect = productEntry.querySelector(
    `select[name="products[${index}][productName]"]`,
  );

  if (!costPerUnitInput || !amountInput || !vatInput || !productNameSelect) {
    return 0;
  }

  const costPerUnit = parseFloat(costPerUnitInput.value) || 0;
  const amount = parseFloat(amountInput.value) || 0;
  const vat = parseFloat(vatInput.value) || 0;
  const productName = productNameSelect.value || `Sản phẩm ${index + 1}`;

  const subtotal = costPerUnit * amount;
  const vatAmount = subtotal * (vat / 100);
  const totalCost = subtotal + vatAmount;

  const costDisplayId = `product-cost-${index}`;
  let costDisplay = document.getElementById(costDisplayId);

  if (!costDisplay) {
    costDisplay = document.createElement("div");
    costDisplay.id = costDisplayId;
    costDisplay.className = "product-entry-cost";

    const noteInput = productEntry.querySelector(
      `input[name="products[${index}][note]"]`,
    );
    if (noteInput && noteInput.parentNode) {
      noteInput.parentNode.insertBefore(costDisplay, noteInput.nextSibling);
    }
  }

  if (totalCost < 0) {
    costDisplay.style.color = "#e53e3e";
  } else {
    costDisplay.style.color = "#38a169";
  }

  costDisplay.textContent = `Tổng chi phí: ${totalCost.toLocaleString("vi-VN")}₫ (${subtotal.toLocaleString("vi-VN")}₫ + ${vatAmount.toLocaleString("vi-VN")}₫ VAT)`;

  productEntries[index] = {
    productName,
    costPerUnit,
    amount,
    vat,
    subtotal,
    vatAmount,
    totalCost,
    productEntryId: `product-entry-${index}`,
  };

  updateGrandTotal();

  return totalCost;
}

// Function to update product entry when product name changes
function updateProductEntryCost(index) {
  calculateProductCost(index);
}

// Function to update grand total display with summary at top and bottom
function updateGrandTotal() {
  grandTotalCost = productEntries.reduce(
    (total, product) => total + (product?.totalCost || 0),
    0,
  );

  const productEntriesContainer = document.getElementById("product-entries");
  if (!productEntriesContainer) return;

  const existingTopSummary = document.getElementById("cost-summary-top");
  const existingBottomSummary = document.getElementById("cost-summary-bottom");
  if (existingTopSummary) existingTopSummary.remove();
  if (existingBottomSummary) existingBottomSummary.remove();

  if (productEntries.length > 0 && productEntries.some((p) => p)) {
    const topSummaryDiv = document.createElement("div");
    topSummaryDiv.id = "cost-summary-top";
    topSummaryDiv.className = "cost-summary cost-summary-top";

    const bottomSummaryDiv = document.createElement("div");
    bottomSummaryDiv.id = "cost-summary-bottom";
    bottomSummaryDiv.className = "cost-summary cost-summary-bottom";

    const buildSummaryContent = () => {
      let summaryHTML =
        '<h4><i class="fas fa-calculator"></i> Tổng hợp chi phí</h4>';

      productEntries.forEach((product, index) => {
        if (product) {
          const displayName = product.productName || `Sản phẩm ${index + 1}`;
          const costClass = product.totalCost > 0 ? "summary-highlight" : "";
          const costColor = product.totalCost < 0 ? "color: #e53e3e;" : "";
          summaryHTML += `
            <div class="item-cost ${costClass}">
              <span class="cost-label product-name-summary" title="${displayName}">
                ${displayName}
              </span>
              <span class="cost-value product-cost-summary" style="${costColor}">
                ${product.totalCost.toLocaleString("vi-VN")}₫
              </span>
            </div>
          `;
        }
      });

      const totalColor =
        grandTotalCost < 0 ? "color: #e53e3e;" : "color: var(--primary-color);";
      summaryHTML += `
        <div class="total-cost">
          <span class="cost-label">TỔNG CỘNG:</span>
          <span class="cost-value" style="${totalColor}">${grandTotalCost.toLocaleString("vi-VN")}₫</span>
        </div>
      `;

      return summaryHTML;
    };

    topSummaryDiv.innerHTML = buildSummaryContent();
    bottomSummaryDiv.innerHTML = buildSummaryContent();

    productEntriesContainer.insertBefore(
      topSummaryDiv,
      productEntriesContainer.firstChild,
    );

    productEntriesContainer.appendChild(bottomSummaryDiv);
  }
}

// Function to attach event listeners to product inputs
function attachProductCostListeners(index) {
  const productEntry = document.getElementById(`product-entry-${index}`);
  if (!productEntry) return;

  const costInputs = [
    productEntry.querySelector(`input[name="products[${index}][costPerUnit]"]`),
    productEntry.querySelector(`input[name="products[${index}][amount]"]`),
    productEntry.querySelector(`input[name="products[${index}][vat]"]`),
  ];

  costInputs.forEach((input) => {
    if (input) {
      const newInput = input.cloneNode(true);
      input.parentNode.replaceChild(newInput, input);

      newInput.addEventListener("input", () => calculateProductCost(index));
      newInput.addEventListener("change", () => calculateProductCost(index));

      newInput.addEventListener("blur", () => {
        if (newInput.value && !isNaN(newInput.value)) {
          newInput.value = parseFloat(newInput.value).toFixed(2);
        }
        calculateProductCost(index);
      });
    }
  });

  const productNameSelect = productEntry.querySelector(
    `select[name="products[${index}][productName]"]`,
  );
  if (productNameSelect) {
    productNameSelect.addEventListener("change", () =>
      calculateProductCost(index),
    );
  }
}

// Function to remove a product entry
function removeProductEntry(index) {
  const productEntry = document.getElementById(`product-entry-${index}`);
  if (!productEntry) return;

  const dropdown = productEntry.querySelector(".product-dropdown");
  if (dropdown) {
    const choiceInstance = choiceInstances.find(
      (instance) => instance.passedElement.element === dropdown,
    );
    if (choiceInstance) {
      choiceInstance.destroy();
      const instanceIndex = choiceInstances.indexOf(choiceInstance);
      if (instanceIndex > -1) {
        choiceInstances.splice(instanceIndex, 1);
      }
    }
  }

  productEntry.remove();
  reindexProductEntries();
  updateGrandTotal();
}

// Function to reindex product entries after removal
function reindexProductEntries() {
  const productEntriesContainer = document.getElementById("product-entries");
  const entries = productEntriesContainer.querySelectorAll(".product-entry");

  const newProductEntries = [];

  entries.forEach((entry, newIndex) => {
    const oldId = entry.id;
    const oldIndex = parseInt(oldId.split("-")[2]);

    entry.id = `product-entry-${newIndex}`;

    const removeBtn = entry.querySelector(".remove-product-btn");
    if (removeBtn) {
      removeBtn.setAttribute("onclick", `removeProductEntry(${newIndex})`);
    }

    const inputs = entry.querySelectorAll('[name^="products["]');
    inputs.forEach((input) => {
      const oldName = input.getAttribute("name");
      const newName = oldName.replace(
        /products\[\d+\]/,
        `products[${newIndex}]`,
      );
      input.setAttribute("name", newName);
    });

    const costDisplay = entry.querySelector(".product-entry-cost");
    if (costDisplay) {
      costDisplay.id = `product-cost-${newIndex}`;
    }

    const oldData = productEntries[oldIndex];
    if (oldData) {
      newProductEntries[newIndex] = { ...oldData };
    }
  });

  productEntries = newProductEntries;

  entries.forEach((entry, index) => {
    attachProductCostListeners(index);
  });
}

// Enhanced addProductEntry function with cost calculation and product management buttons
function addProductEntry() {
  const productEntriesContainer = document.getElementById("product-entries");
  const selectedTitle = document.getElementById("title-dropdown").value;

  const existingProductEntries =
    productEntriesContainer.querySelectorAll(".product-entry");
  const productCount = existingProductEntries.length;

  let newEntry;
  if (selectedTitle === "Purchasing Document") {
    newEntry = `
      <div class="product-entry" id="product-entry-${productCount}">
        <button type="button" class="remove-product-btn" onclick="removeProductEntry(${productCount})" title="Xóa sản phẩm">
          <i class="fas fa-trash-alt"></i>
        </button>
        <label><i class="fas fa-box"></i> Tên sản phẩm</label>
        <div style="display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;">
          <select name="products[${productCount}][productName]" class="product-dropdown" required style="flex: 1; min-width: 200px;">
            <option value="">Chọn sản phẩm</option>
          </select>
          <div style="display: flex; gap: 5px;">
            <button type="button" class="add-product-btn" onclick="openAddProductModal()" title="Thêm sản phẩm mới">
              <i class="fas fa-plus"></i>
            </button>
            <button type="button" class="view-all-products-btn" onclick="openProductManagementModal()" title="Xem tất cả sản phẩm">
              <i class="fas fa-list"></i>
            </button>
          </div>
        </div>
        <label><i class="fas fa-tag"></i> Đơn giá (₫)</label>
        <input type="number" step="0.01" name="products[${productCount}][costPerUnit]" required 
               placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
        <label><i class="fas fa-hashtag"></i> Số lượng</label>
        <input type="number" step="0.01" min="0" name="products[${productCount}][amount]" required 
               placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
        <label><i class="fas fa-percentage"></i> Thuế VAT (%)</label>
        <input type="number" step="0.01" min="0" max="100" name="products[${productCount}][vat]" required 
               placeholder="10" value="10" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='10'" />
        <label><i class="fas fa-building"></i> Trạm sản phẩm</label>
        <select name="products[${productCount}][costCenter]" class="product-cost-center" required>
          <option value="">Chọn trạm</option>
        </select>
        <label><i class="fas fa-sticky-note"></i> Ghi chú</label>
        <input type="text" name="products[${productCount}][note]" />
      </div>
    `;
  } else {
    newEntry = `
      <div class="product-entry" id="product-entry-${productCount}">
        <button type="button" class="remove-product-btn" onclick="removeProductEntry(${productCount})" title="Xóa sản phẩm">
          <i class="fas fa-trash-alt"></i>
        </button>
        <label><i class="fas fa-box"></i> Tên sản phẩm</label>
        <div style="display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;">
          <select name="products[${productCount}][productName]" class="product-dropdown" required style="flex: 1; min-width: 200px;">
            <option value="">Chọn sản phẩm</option>
          </select>
          <div style="display: flex; gap: 5px;">
            <button type="button" class="add-product-btn" onclick="openAddProductModal()" title="Thêm sản phẩm mới">
              <i class="fas fa-plus"></i>
            </button>
            <button type="button" class="view-all-products-btn" onclick="openProductManagementModal()" title="Xem tất cả sản phẩm">
              <i class="fas fa-list"></i>
            </button>
          </div>
        </div>
        <label><i class="fas fa-tag"></i> Đơn giá (₫)</label>
        <input type="number" step="0.01" name="products[${productCount}][costPerUnit]" required 
               placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
        <label><i class="fas fa-hashtag"></i> Số lượng</label>
        <input type="number" step="0.01" min="0" name="products[${productCount}][amount]" required 
               placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
        <label><i class="fas fa-percentage"></i> Thuế (%)</label>
        <input type="number" step="0.01" min="0" max="100" name="products[${productCount}][vat]" required 
               placeholder="10" value="10" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='10'" />
        <label><i class="fas fa-sticky-note"></i> Ghi chú</label>
        <input type="text" name="products[${productCount}][note]" />
      </div>
    `;
  }

  const bottomSummary = document.getElementById("cost-summary-bottom");
  if (bottomSummary) {
    productEntriesContainer.insertBefore(
      document.createRange().createContextualFragment(newEntry),
      bottomSummary,
    );
  } else {
    productEntriesContainer.insertAdjacentHTML("beforeend", newEntry);
  }

  initializeNewProductEntry(productCount);
}

// Function to initialize a new product entry
function initializeNewProductEntry(index) {
  const newDropdowns = document.querySelectorAll(
    `#product-entry-${index} .product-dropdown:not([data-choice-initialized])`,
  );

  newDropdowns.forEach((newDropdown) => {
    const choiceInstance = new Choices(newDropdown, {
      searchEnabled: true,
      searchPlaceholderValue: "Tìm kiếm sản phẩm...",
      placeholder: true,
      placeholderValue: "Chọn sản phẩm",
      searchResultLimit: 10,
      shouldSort: false,
      itemSelectText: "Nhấn để chọn",
      noResultsText: "Không tìm thấy sản phẩm",
      noChoicesText: "Không có sản phẩm nào để chọn",
      loadingText: "Đang tải...",
      searchChoices: true,
      position: "auto",
    });

    choiceInstance.passedElement.element.addEventListener(
      "change",
      function () {
        updateProductEntryCost(index);
      },
    );

    newDropdown.setAttribute("data-choice-initialized", "true");
    choiceInstances.push(choiceInstance);

    populateSingleProductDropdown(newDropdown);
  });

  const selectedTitle = document.getElementById("title-dropdown").value;
  if (selectedTitle === "Purchasing Document") {
    populateProductCostCenters();
  }

  const productEntry = document.getElementById(`product-entry-${index}`);
  if (productEntry) {
    productEntry.productEntryId = `product-entry-${index}`;
  }

  setTimeout(() => {
    attachProductCostListeners(index);
    calculateProductCost(index);
  }, 100);
}

// Function to populate a single product dropdown without affecting others
async function populateSingleProductDropdown(dropdown) {
  try {
    const products = await fetchProducts();

    const defaultOption = dropdown.querySelector('option[value=""]');
    dropdown.innerHTML = "";
    if (defaultOption) {
      dropdown.appendChild(defaultOption);
    }

    products.forEach((product) => {
      const option = document.createElement("option");
      option.value = product.name;
      option.textContent = `${product.name} (${product.code})`;
      option.dataset.productCode = product.code;
      dropdown.appendChild(option);
    });

    const choiceInstance = choiceInstances.find(
      (instance) => instance.passedElement.element === dropdown,
    );

    if (choiceInstance) {
      const currentValue = choiceInstance.getValue(true);

      choiceInstance.setChoices(
        products.map((product) => ({
          value: product.name,
          label: `${product.name} (${product.code})`,
          customProperties: { code: product.code },
        })),
        "value",
        "label",
        true,
      );

      if (currentValue) {
        choiceInstance.setChoiceByValue(currentValue);
      }
    }
  } catch (error) {
    console.error("Error populating product dropdown:", error);
  }
}

// ==================== ADD PRODUCT MODAL FUNCTIONS ====================

function openAddProductModal() {
  if (!addProductModal) {
    addProductModal = document.getElementById("addProductModal");
    addProductForm = document.getElementById("addProductForm");
    addProductMessage = document.getElementById("addProductMessage");

    if (addProductForm) {
      addProductForm.addEventListener("submit", handleAddProductSubmit);
    }

    if (addProductModal) {
      addProductModal.addEventListener("click", function (e) {
        if (e.target === addProductModal) {
          closeAddProductModal();
        }
      });
    }
  }

  if (addProductMessage) {
    addProductMessage.innerHTML = "";
    addProductMessage.className = "modal-message";
  }
  if (addProductForm) {
    addProductForm.reset();
  }

  if (addProductModal) {
    addProductModal.classList.remove("modal-hidden");
  }
}

function closeAddProductModal() {
  if (addProductModal) {
    addProductModal.classList.add("modal-hidden");
  }
  if (addProductForm) {
    addProductForm.reset();
  }
  if (addProductMessage) {
    addProductMessage.innerHTML = "";
    addProductMessage.className = "modal-message";
  }
}

async function handleAddProductSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById("newProductName");
  const codeInput = document.getElementById("newProductCode");

  const product = {
    name: nameInput.value.trim(),
    code: codeInput.value.trim(),
  };

  if (!product.name || !product.code) {
    showAddProductMessage("Vui lòng điền đầy đủ thông tin", "error");
    return;
  }

  try {
    const response = await fetch("/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(product),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Không thể thêm sản phẩm");
    }

    showAddProductMessage("Sản phẩm đã được thêm thành công!", "success");
    addProductForm.reset();

    await refreshAllProductDropdowns();

    setTimeout(() => {
      closeAddProductModal();
    }, 1500);
  } catch (error) {
    console.error("Error adding product:", error);
    showAddProductMessage(
      error.message || "Lỗi khi thêm sản phẩm. Vui lòng thử lại.",
      "error",
    );
  }
}

function showAddProductMessage(message, type) {
  if (addProductMessage) {
    addProductMessage.innerHTML = message;
    addProductMessage.className = `modal-message ${type}`;

    if (type === "success") {
      setTimeout(() => {
        if (addProductMessage) {
          addProductMessage.innerHTML = "";
          addProductMessage.className = "modal-message";
        }
      }, 5000);
    }
  }
}

async function refreshAllProductDropdowns() {
  try {
    const products = await fetchProducts();

    document.querySelectorAll(".product-dropdown").forEach((dropdown) => {
      const choiceInstance = choiceInstances.find(
        (instance) => instance.passedElement.element === dropdown,
      );

      if (choiceInstance) {
        const currentValue = choiceInstance.getValue(true);

        choiceInstance.setChoices(
          products.map((product) => ({
            value: product.name,
            label: `${product.name} (${product.code})`,
            customProperties: { code: product.code },
          })),
          "value",
          "label",
          true,
        );

        if (currentValue) {
          choiceInstance.setChoiceByValue(currentValue);
        }
      }
    });

    document
      .querySelectorAll(".product-dropdown:not([data-choice-initialized])")
      .forEach((dropdown) => {
        populateSingleProductDropdown(dropdown);
      });

    console.log("All product dropdowns refreshed successfully");
  } catch (error) {
    console.error("Error refreshing product dropdowns:", error);
  }
}

// ==================== PRODUCT MANAGEMENT MODAL FUNCTIONS ====================

function initProductManagementModal() {
  if (!productManagementModal) {
    productManagementModal = document.getElementById("productManagementModal");

    if (productManagementModal) {
      productManagementModal.addEventListener("click", function (e) {
        if (e.target === productManagementModal) {
          closeProductManagementModal();
        }
      });
    }

    const editProductForm = document.getElementById("editProductForm");
    if (editProductForm) {
      editProductForm.addEventListener("submit", handleEditProductSubmit);
    }
  }
}

async function openProductManagementModal() {
  initProductManagementModal();

  if (productManagementModal) {
    productManagementModal.classList.remove("modal-hidden");

    const editSection = document.getElementById("editProductSection");
    if (editSection) {
      editSection.style.display = "none";
    }

    const searchInput = document.getElementById("productSearchInput");
    if (searchInput) {
      searchInput.value = "";
    }

    await loadProductsForManagement();
  }
}

function closeProductManagementModal() {
  if (productManagementModal) {
    productManagementModal.classList.add("modal-hidden");
  }

  const editSection = document.getElementById("editProductSection");
  if (editSection) {
    editSection.style.display = "none";
  }

  const editMessage = document.getElementById("editProductMessage");
  if (editMessage) {
    editMessage.innerHTML = "";
    editMessage.className = "modal-message";
  }
}

async function loadProductsForManagement() {
  const tableBody = document.getElementById("productManagementTableBody");

  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="loading-spinner">
        <i class="fas fa-spinner"></i>
        <p>Đang tải danh sách sản phẩm...</p>
      </td>
    </tr>
  `;

  try {
    const response = await fetch("/products");
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }

    allProducts = await response.json();
    filteredProducts = [...allProducts];

    renderProductManagementTable();
    updateProductStats();
  } catch (error) {
    console.error("Error loading products:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="no-products-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Không thể tải danh sách sản phẩm. Vui lòng thử lại.</p>
        </td>
      </tr>
    `;
  }
}

function renderProductManagementTable() {
  const tableBody = document.getElementById("productManagementTableBody");

  if (!tableBody) return;

  if (filteredProducts.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="no-products-message">
          <i class="fas fa-box-open"></i>
          <p>Không tìm thấy sản phẩm nào</p>
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  filteredProducts.forEach((product) => {
    html += `
      <tr>
        <td>
          <strong>${product.name}</strong>
          ${product.code ? `<span class="product-code-badge">${product.code}</span>` : ""}
        </td>
        <td>${product.code || "—"}</td>
        <td>${product.inStorage || 0}</td>
        <td>${product.aboutToTransfer || 0}</td>
        <td class="product-actions">
          <button class="edit-btn" onclick="startEditProduct('${product._id}')" title="Chỉnh sửa">
            <i class="fas fa-edit"></i> Sửa
          </button>
          <button class="delete-btn" onclick="deleteProductFromManagement('${product._id}')" title="Xóa">
            <i class="fas fa-trash"></i> Xóa
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

function updateProductStats() {
  const statsSpan = document.getElementById("productCountDisplay");
  if (statsSpan) {
    const total = allProducts.length;
    const filtered = filteredProducts.length;

    if (total === filtered) {
      statsSpan.textContent = `Tổng số sản phẩm: ${total}`;
    } else {
      statsSpan.textContent = `Hiển thị ${filtered} / ${total} sản phẩm`;
    }
  }
}

function filterProducts() {
  const searchInput = document.getElementById("productSearchInput");
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase().trim();

  if (!searchTerm) {
    filteredProducts = [...allProducts];
  } else {
    filteredProducts = allProducts.filter(
      (product) =>
        (product.name && product.name.toLowerCase().includes(searchTerm)) ||
        (product.code && product.code.toLowerCase().includes(searchTerm)),
    );
  }

  renderProductManagementTable();
  updateProductStats();
}

async function refreshProductList() {
  await loadProductsForManagement();
  await refreshAllProductDropdowns();

  const statsSpan = document.getElementById("productCountDisplay");
  if (statsSpan) {
    statsSpan.innerHTML =
      '<i class="fas fa-check-circle"></i> Danh sách đã được làm mới!';
    setTimeout(() => {
      updateProductStats();
    }, 2000);
  }
}

function startEditProduct(productId) {
  const product = allProducts.find((p) => p._id === productId);
  if (!product) return;

  currentEditingProduct = product;

  document.getElementById("editProductId").value = product._id;
  document.getElementById("editProductName").value = product.name || "";
  document.getElementById("editProductCode").value = product.code || "";

  const editMessage = document.getElementById("editProductMessage");
  if (editMessage) {
    editMessage.innerHTML = "";
    editMessage.className = "modal-message";
  }

  const editSection = document.getElementById("editProductSection");
  if (editSection) {
    editSection.style.display = "block";
  }

  editSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cancelEditProduct() {
  const editSection = document.getElementById("editProductSection");
  if (editSection) {
    editSection.style.display = "none";
  }

  document.getElementById("editProductForm").reset();
  document.getElementById("editProductId").value = "";

  const editMessage = document.getElementById("editProductMessage");
  if (editMessage) {
    editMessage.innerHTML = "";
    editMessage.className = "modal-message";
  }

  currentEditingProduct = null;
}

async function handleEditProductSubmit(e) {
  e.preventDefault();

  const productId = document.getElementById("editProductId").value;
  const productName = document.getElementById("editProductName").value.trim();
  const productCode = document.getElementById("editProductCode").value.trim();

  if (!productName || !productCode) {
    showEditProductMessage("Vui lòng điền đầy đủ thông tin", "error");
    return;
  }

  const updatedProduct = {
    _id: productId,
    name: productName,
    code: productCode,
  };

  try {
    const response = await fetch(`/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedProduct),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Không thể cập nhật sản phẩm");
    }

    showEditProductMessage("Sản phẩm đã được cập nhật thành công!", "success");

    await loadProductsForManagement();
    await refreshAllProductDropdowns();

    setTimeout(() => {
      cancelEditProduct();
    }, 1500);
  } catch (error) {
    console.error("Error updating product:", error);
    showEditProductMessage(
      error.message || "Lỗi khi cập nhật sản phẩm. Vui lòng thử lại.",
      "error",
    );
  }
}

function showEditProductMessage(message, type) {
  const editMessage = document.getElementById("editProductMessage");
  if (editMessage) {
    editMessage.innerHTML = message;
    editMessage.className = `modal-message ${type}`;

    if (type === "success") {
      setTimeout(() => {
        editMessage.innerHTML = "";
        editMessage.className = "modal-message";
      }, 5000);
    }
  }
}

async function deleteProductFromManagement(productId) {
  const product = allProducts.find((p) => p._id === productId);
  if (!product) return;

  if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${product.name}" không?`)) {
    return;
  }

  try {
    const response = await fetch(`/products/${productId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Không thể xóa sản phẩm");
    }

    await loadProductsForManagement();
    await refreshAllProductDropdowns();

    if (currentEditingProduct && currentEditingProduct._id === productId) {
      cancelEditProduct();
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    alert(error.message || "Lỗi khi xóa sản phẩm. Vui lòng thử lại.");
  }
}

function openAddProductFromManagement() {
  closeProductManagementModal();
  openAddProductModal();

  const originalCloseHandler = closeAddProductModal;
  closeAddProductModal = function () {
    originalCloseHandler();

    setTimeout(async () => {
      await loadProductsForManagement();
      openProductManagementModal();
      closeAddProductModal = originalCloseHandler;
    }, 100);
  };
}

// ==================== END PRODUCT MANAGEMENT MODAL FUNCTIONS ====================

flatpickr("#dateOfError", {
  dateFormat: "d-m-Y",
  defaultDate: "today",
});

////DOCUMENT SELECT HANDLERS
function handleProposalDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");

  contentFields.innerHTML = `
      <label for="task"><i class="fas fa-tasks"></i> Công việc</label>
      <input type="text" name="task" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <label for="dateOfError"><i class="fas fa-calendar-day"></i> Ngày xảy ra lỗi</label>
      <input type="text" name="dateOfError" id="dateOfError" required />
      <label for="detailsDescription"><i class="fas fa-align-left"></i> Mô tả chi tiết</label>
      <textarea name="detailsDescription" rows="3" required></textarea>
      <label for="direction"><i class="fas fa-directions"></i> Hướng xử lý</label>
      <input type="text" name="direction" required />
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>          
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  fetchCostCenters();

  flatpickr("#dateOfError", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  addContentButton.style.display = "none";
}

function handlePurchasingDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section",
  );

  productEntries = [];
  grandTotalCost = 0;

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <div id="product-entries">
        <div class="product-entry" id="product-entry-0">
          <button type="button" class="remove-product-btn" onclick="removeProductEntry(0)" title="Xóa sản phẩm">
            <i class="fas fa-trash-alt"></i>
          </button>
          <label><i class="fas fa-box"></i> Tên sản phẩm</label>
          <div style="display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;">
            <select name="products[0][productName]" class="product-dropdown" required style="flex: 1; min-width: 200px;">
              <option value="">Chọn sản phẩm</option>
            </select>
            <div style="display: flex; gap: 5px;">
              <button type="button" class="add-product-btn" onclick="openAddProductModal()" title="Thêm sản phẩm mới">
                <i class="fas fa-plus"></i>
              </button>
              <button type="button" class="view-all-products-btn" onclick="openProductManagementModal()" title="Xem tất cả sản phẩm">
                <i class="fas fa-list"></i>
              </button>
            </div>
          </div>
          <label><i class="fas fa-tag"></i> Đơn giá (₫)</label>
          <input type="number" step="0.01" name="products[0][costPerUnit]" required 
                 placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
          <label><i class="fas fa-hashtag"></i> Số lượng</label>
          <input type="number" step="0.01" min="0" name="products[0][amount]" required 
                 placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
          <label><i class="fas fa-percentage"></i> Thuế VAT (%)</label>
          <input type="number" step="0.01" min="0" max="100" name="products[0][vat]" required 
                 placeholder="10" value="10" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='10'" />
          <label><i class="fas fa-building"></i> Trạm sản phẩm</label>
          <select name="products[0][costCenter]" class="product-cost-center" required>
            <option value="">Chọn trạm</option>
          </select>
          <label><i class="fas fa-sticky-note"></i> Ghi chú</label>
          <input type="text" name="products[0][note]" />
        </div>
      </div>
      <button type="button" onclick="addProductEntry()" class="secondary-button">
        <i class="fas fa-plus"></i> Thêm sản phẩm
      </button>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>     
    `;

  setTimeout(() => {
    initializeProductDropdowns();
    populateProductDropdowns();
    populateProductCostCenters();
    attachProductCostListeners(0);
    calculateProductCost(0);
  }, 100);

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";
  fetchApprovedProposalsForPurchasing();
  fetchCostCenters();
}

function handlePaymentDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section",
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocumentsForPayment();

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="content"><i class="fas fa-align-left"></i> Nội dung</label>
      <input type="text" name="content" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm</option>
      </select>
      <label for="paymentMethod"><i class="fas fa-credit-card"></i> Hình thức thanh toán</label>
      <select name="paymentMethod">
        <option value="Tiền mặt">Tiền mặt</option>
        <option value="Chuyển khoản nội bộ">Chuyển khoản nội bộ</option>
        <option value="Hợp đồng">Hợp đồng</option>
      </select>
      <label for="totalPayment"><i class="fas fa-money-bill-wave"></i> Tổng thanh toán:</label>
      <input type="number" step="0.01" name="totalPayment" required />
      <label for="paymentDeadline"><i class="fas fa-calendar-times"></i> Thời hạn trả</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <label for="priority"><i class="fas fa-exclamation-triangle"></i> Mức độ ưu tiên</label>
      <select name="priority" id="priority" required>
        <option value="Thấp" selected>Thấp</option>
        <option value="Trung bình">Trung bình</option>
        <option value="Cao">Cao</option>
      </select>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>       
      <label for="notes"><i class="fas fa-sticky-note"></i> Ghi chú</label>
        <textarea name="notes" rows="3"></textarea>            
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  flatpickr("#paymentDeadline", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  fetchCostCenters();
}

function handleAdvancePaymentDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section",
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocumentsForAdvancePayment();

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="content"><i class="fas fa-align-left"></i> Nội dung</label>
      <input type="text" name="content" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm</option>
      </select>
      <label for="paymentMethod"><i class="fas fa-credit-card"></i> Hình thức thanh toán</label>
      <select name="paymentMethod">
        <option value="Tiền mặt">Tiền mặt</option>
        <option value="Chuyển khoản nội bộ">Chuyển khoản nội bộ</option>
        <option value="Hợp đồng">Hợp đồng</option>
      </select>
      <label for="advancePayment"><i class="fas fa-money-bill-wave"></i> Tạm ứng:</label>
      <input type="number" step="0.01" name="advancePayment"/>
      <label for="paymentDeadline"><i class="fas fa-calendar-times"></i> Thời hạn trả</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  flatpickr("#paymentDeadline", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  fetchCostCenters();
}

function handleAdvancePaymentReclaimDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section",
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocumentsForAdvancePaymentReclaim();

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="content"><i class="fas fa-align-left"></i> Nội dung</label>
      <input type="text" name="content" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm</option>
      </select>
      <label for="paymentMethod"><i class="fas fa-credit-card"></i> Hình thức thanh toán</label>
      <select name="paymentMethod">
        <option value="Tiền mặt">Tiền mặt</option>
        <option value="Chuyển khoản nội bộ">Chuyển khoản nội bộ</option>
        <option value="Hợp đồng">Hợp đồng</option>
      </select>
      <label for="advancePaymentReclaim"><i class="fas fa-money-bill-wave"></i> Số tiền thu lại:</label>
      <input type="number" step="0.01" name="advancePaymentReclaim"/>
      <label for="paymentDeadline"><i class="fas fa-calendar-times"></i> Thời hạn trả</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  flatpickr("#paymentDeadline", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  fetchCostCenters();
}

function handleDeliveryDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section",
  );

  productEntries = [];
  grandTotalCost = 0;

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <div id="product-entries">
        <div class="product-entry" id="product-entry-0">
          <button type="button" class="remove-product-btn" onclick="removeProductEntry(0)" title="Xóa sản phẩm">
            <i class="fas fa-trash-alt"></i>
          </button>
          <label><i class="fas fa-box"></i> Tên sản phẩm</label>
          <div style="display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;">
            <select name="products[0][productName]" class="product-dropdown" required style="flex: 1; min-width: 200px;">
              <option value="">Chọn sản phẩm</option>
            </select>
            <div style="display: flex; gap: 5px;">
              <button type="button" class="add-product-btn" onclick="openAddProductModal()" title="Thêm sản phẩm mới">
                <i class="fas fa-plus"></i>
              </button>
              <button type="button" class="view-all-products-btn" onclick="openProductManagementModal()" title="Xem tất cả sản phẩm">
                <i class="fas fa-list"></i>
              </button>
            </div>
          </div>
          <label><i class="fas fa-tag"></i> Đơn giá (₫)</label>
          <input type="number" step="0.01" name="products[0][costPerUnit]" required 
                 placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
          <label><i class="fas fa-hashtag"></i> Số lượng</label>
          <input type="number" step="0.01" min="0" name="products[0][amount]" required 
                 placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
          <label><i class="fas fa-percentage"></i> Thuế (%)</label>
          <input type="number" step="0.01" min="0" max="100" name="products[0][vat]" required 
                 placeholder="10" value="10" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='10'" />
          <label><i class="fas fa-sticky-note"></i> Ghi chú</label>
          <input type="text" name="products[0][note]" />
        </div>
      </div>
      <button type="button" onclick="addProductEntry()" class="secondary-button">
        <i class="fas fa-plus"></i> Thêm sản phẩm
      </button>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;

  setTimeout(() => {
    initializeProductDropdowns();
    populateProductDropdowns();
    attachProductCostListeners(0);
    calculateProductCost(0);
  }, 100);

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";
  fetchApprovedProposalsForDelivery();
  fetchCostCenters();
}

function handleReceiptDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section",
  );

  productEntries = [];
  grandTotalCost = 0;

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="costCenter"><i class="fas fa-building"></i> Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <div id="product-entries">
        <div class="product-entry" id="product-entry-0">
          <button type="button" class="remove-product-btn" onclick="removeProductEntry(0)" title="Xóa sản phẩm">
            <i class="fas fa-trash-alt"></i>
          </button>
          <label><i class="fas fa-box"></i> Tên sản phẩm</label>
          <div style="display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap;">
            <select name="products[0][productName]" class="product-dropdown" required style="flex: 1; min-width: 200px;">
              <option value="">Chọn sản phẩm</option>
            </select>
            <div style="display: flex; gap: 5px;">
              <button type="button" class="add-product-btn" onclick="openAddProductModal()" title="Thêm sản phẩm mới">
                <i class="fas fa-plus"></i>
              </button>
              <button type="button" class="view-all-products-btn" onclick="openProductManagementModal()" title="Xem tất cả sản phẩm">
                <i class="fas fa-list"></i>
              </button>
            </div>
          </div>
          <label><i class="fas fa-tag"></i> Đơn giá (₫)</label>
          <input type="number" step="0.01" name="products[0][costPerUnit]" required 
                 placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
          <label><i class="fas fa-hashtag"></i> Số lượng</label>
          <input type="number" step="0.01" min="0" name="products[0][amount]" required 
                 placeholder="0.00" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='0.00'" />
          <label><i class="fas fa-percentage"></i> Thuế (%)</label>
          <input type="number" step="0.01" min="0" max="100" name="products[0][vat]" required 
                 placeholder="10" value="10" onfocus="this.placeholder=''" onblur="if(this.value==='')this.placeholder='10'" />
          <label><i class="fas fa-sticky-note"></i> Ghi chú</label>
          <input type="text" name="products[0][note]" />
        </div>
      </div>
      <button type="button" onclick="addProductEntry()" class="secondary-button">
        <i class="fas fa-plus"></i> Thêm sản phẩm
      </button>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;

  setTimeout(() => {
    initializeProductDropdowns();
    populateProductDropdowns();
    attachProductCostListeners(0);
    calculateProductCost(0);
  }, 100);

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";
  fetchApprovedProposalsForReceipt();
  fetchCostCenters();
}

function handleProjectProposalDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");
  const appendApprovedDocumentsSection = document.getElementById(
    "append-approved-documents-section",
  );

  contentFields.innerHTML = `
      <label for="name"><i class="fas fa-file-signature"></i> Tên</label>
      <input type="text" name="name" required />
      <label for="contentName"><i class="fas fa-heading"></i> Tên nội dung</label>
      <input type="text" name="contentName" required />
      <label for="contentText"><i class="fas fa-align-left"></i> Nội dung</label>
      <textarea name="contentText" rows="5" required></textarea>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  addContentButton.style.display = "inline-block";
  appendApprovedDocumentsSection.style.display = "none";
}

function handleGenericDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");
  const appendApprovedDocumentsSection = document.getElementById(
    "append-approved-documents-section",
  );

  contentFields.innerHTML = `
      <label for="contentName"><i class="fas fa-heading"></i> Tên nội dung</label>
      <input type="text" name="contentName" required />
      <label for="contentText"><i class="fas fa-align-left"></i> Nội dung</label>
      <textarea name="contentText" rows="5" required></textarea>
      <label for="groupName"><i class="fas fa-users"></i> Nhóm</label>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <label for="projectName"><i class="fas fa-project-diagram"></i> Dự án</label>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  addContentButton.style.display = "inline-block";
  appendApprovedDocumentsSection.style.display = "none";
}

// Utility function to fetch and populate cost centers
function fetchCostCenters() {
  fetch("/getCurrentUser")
    .then((response) => response.json())
    .then((userData) => {
      const currentUser = userData.username;

      fetch("/costCenters")
        .then((response) => response.json())
        .then((costCenters) => {
          const costCenterSelect = document.getElementById("costCenter");
          if (costCenterSelect) {
            costCenterSelect.innerHTML =
              '<option value="">Chọn một trạm</option>';

            costCenters.forEach((center) => {
              if (
                center.allowedUsers.length === 0 ||
                center.allowedUsers.includes(currentUser)
              ) {
                const option = document.createElement("option");
                option.value = center.name;
                option.textContent = center.name;
                costCenterSelect.appendChild(option);
              }
            });
          }
        })
        .catch((error) => {
          console.error("Error fetching cost centers:", error);
        });
    })
    .catch((error) => {
      console.error("Error fetching current user:", error);
    });
}

async function fetchProducts() {
  try {
    const response = await fetch("/documentProduct");
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

// Main event listener for document type dropdown
document
  .getElementById("title-dropdown")
  .addEventListener("change", function () {
    const selectedTitle = this.value;
    const contentFields = document.getElementById("content-fields");
    const addContentButton = document.getElementById("add-content-btn");
    const approvedProposalSection = document.getElementById(
      "approved-proposal-section",
    );
    const appendApprovedDocumentsSection = document.getElementById(
      "append-approved-documents-section",
    );
    const appendPurchasingSection = document.getElementById(
      "append-purchasing-documents-section",
    );
    const purchasingDocumentPreview = document.getElementById(
      "purchasingDocumentPreview",
    );

    contentFields.innerHTML = "";
    addContentButton.style.display = "none";
    approvedProposalSection.style.display = "none";
    appendApprovedDocumentsSection.style.display = "none";
    appendPurchasingSection.style.display = "none";
    purchasingDocumentPreview.style.display = "none";

    productEntries = [];
    grandTotalCost = 0;

    switch (selectedTitle) {
      case "Proposal Document":
        handleProposalDocument();
        break;
      case "Purchasing Document":
        handlePurchasingDocument();
        break;
      case "Payment Document":
        handlePaymentDocument();
        break;
      case "Advance Payment Document":
        handleAdvancePaymentDocument();
        break;
      case "Advance Payment Reclaim Document":
        handleAdvancePaymentReclaimDocument();
        break;
      case "Delivery Document":
        handleDeliveryDocument();
        break;
      case "Receipt Document":
        handleReceiptDocument();
        break;
      case "Project Proposal Document":
        handleProjectProposalDocument();
        break;
      default:
        handleGenericDocument();
        break;
    }
  });

async function populateProductCostCenters() {
  try {
    const userResponse = await fetch("/getCurrentUser");
    const userData = await userResponse.json();
    const currentUser = userData.username;

    const costCenterResponse = await fetch("/costCenters");
    const costCenters = await costCenterResponse.json();

    document.querySelectorAll(".product-cost-center").forEach((select) => {
      if (select.options.length <= 1) {
        costCenters.forEach((center) => {
          if (
            center.allowedUsers.length === 0 ||
            center.allowedUsers.includes(currentUser)
          ) {
            const option = document.createElement("option");
            option.value = center.name;
            option.textContent = center.name;
            select.appendChild(option);
          }
        });
      }
    });
  } catch (error) {
    console.error("Error populating product cost centers:", error);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const productDropdowns = document.querySelectorAll(".product-dropdown");
  if (productDropdowns.length > 0) {
    setTimeout(() => {
      initializeProductDropdowns();
      populateProductDropdowns();
    }, 500);
  }
});

window.addEventListener("beforeunload", function () {
  choiceInstances.forEach((instance) => {
    if (instance && typeof instance.destroy === "function") {
      instance.destroy();
    }
  });
});

async function fetchApprovers() {
  const response = await fetch("/approvers");
  const approvers = await response.json();
  const approverSelect = document.getElementById("approver-selection");

  approvers.forEach((approver) => {
    const approverDiv = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = approver.username;
    approverDiv.appendChild(label);

    const approverInput = document.createElement("input");
    approverInput.type = "checkbox";
    approverInput.name = "approvers";
    approverInput.value = approver._id;
    approverDiv.appendChild(approverInput);

    const subRoleInput = document.createElement("input");
    subRoleInput.type = "text";
    subRoleInput.name = `subRole_${approver._id}`;
    subRoleInput.placeholder = "";
    subRoleInput.disabled = true;
    approverDiv.appendChild(subRoleInput);

    approverInput.addEventListener("change", function () {
      subRoleInput.disabled = !approverInput.checked;
      subRoleInput.required = approverInput.checked;
    });

    approverSelect.appendChild(approverDiv);
  });
}

function addProposalEntry() {
  const container = document.getElementById("proposal-selections");
  const newEntry = document.createElement("div");
  newEntry.className = "proposal-entry";
  newEntry.innerHTML = `
      <select class="approved-proposal-dropdown" name="approvedProposals[]" onchange="previewProposalContent(this)">
        <option value="">Chọn phiếu đề xuất</option>
      </select>
      <button type="button" class="remove-proposal" onclick="removeProposalEntry(this)">Xóa</button>
    `;
  container.appendChild(newEntry);

  const selectedTitle = document.getElementById("title-dropdown").value;
  if (selectedTitle === "Purchasing Document") {
    fetchApprovedProposalsForPurchasing(newEntry.querySelector("select"));
  } else if (selectedTitle === "Delivery Document") {
    fetchApprovedProposalsForDelivery(newEntry.querySelector("select"));
  } else if (selectedTitle === "Receipt Document") {
    fetchApprovedProposalsForReceipt(newEntry.querySelector("select"));
  }
}

function removeProposalEntry(button) {
  const entry = button.parentElement;
  const previewId = entry.querySelector("select").value;
  if (previewId) {
    const previewElement = document.getElementById(`preview-${previewId}`);
    if (previewElement) previewElement.remove();
  }
  entry.remove();
}

async function fetchApprovedProposalsForPurchasing(dropdown = null) {
  const response = await fetch("/approvedProposalsForPurchasing");
  const approvedProposals = await response.json();

  if (!dropdown) {
    document
      .querySelectorAll(".approved-proposal-dropdown")
      .forEach((select) => {
        populateDropdown(select, approvedProposals);
      });
  } else {
    populateDropdown(dropdown, approvedProposals);
  }
}

async function fetchApprovedProposalsForDelivery(dropdown = null) {
  const response = await fetch("/approvedProposalsForDelivery");
  const approvedProposals = await response.json();

  if (!dropdown) {
    document
      .querySelectorAll(".approved-proposal-dropdown")
      .forEach((select) => {
        populateDropdown(select, approvedProposals);
      });
  } else {
    populateDropdown(dropdown, approvedProposals);
  }
}

async function fetchApprovedProposalsForReceipt(dropdown = null) {
  const response = await fetch("/approvedProposalsForReceipt");
  const approvedProposals = await response.json();

  if (!dropdown) {
    document
      .querySelectorAll(".approved-proposal-dropdown")
      .forEach((select) => {
        populateDropdown(select, approvedProposals);
      });
  } else {
    populateDropdown(dropdown, approvedProposals);
  }
}

function populateDropdown(select, proposals) {
  select.innerHTML = '<option value="">Chọn phiếu đề xuất</option>';
  proposals.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc._id;
    option.textContent = doc.task;
    select.appendChild(option);
  });
}

async function previewProposalContent(selectElement) {
  const documentId = selectElement.value;
  const previewsContainer = document.getElementById("proposalPreviews");

  // Find the specific preview container for this select element
  const selectContainer = selectElement.closest(".proposal-entry");
  const existingPreview = selectContainer.querySelector(".proposal-preview");
  if (existingPreview) {
    existingPreview.remove();
  }

  if (!documentId) return;

  const response = await fetch(`/proposalDocument/${documentId}`);
  const proposal = await response.json();

  const previewDiv = document.createElement("div");
  previewDiv.className = "proposal-preview";

  let filesHtml = "<p>Không có tệp đính kèm</p>";
  if (proposal.fileMetadata && proposal.fileMetadata.length > 0) {
    filesHtml = `
      <p><strong>Tệp đính kèm:</strong></p>
      <ul>
        ${proposal.fileMetadata
          .map(
            (file) => `
          <li>
            <a href="${file.link}" target="_blank">${
              file.name || file.displayName || file.actualFilename
            }</a>
            ${file.size ? ` (${file.size})` : ""}
          </li>
        `,
          )
          .join("")}
      </ul>
    `;
  }

  previewDiv.innerHTML = `
      <h3>Xem trước phiếu đề xuất ${documentId}</h3>
      <p><strong>Tình trạng phê duyệt:</strong> ${proposal.status}<br></p>
      <p><strong>Công việc:</strong> ${proposal.task}</p>
      <p><strong>Trạm:</strong> ${proposal.costCenter}</p>
      <p><strong>Nhóm:</strong> ${proposal.groupName}</p>
      <p><strong>Dự án:</strong> ${proposal.projectName || "Không có"}</p>
      <p><strong>Ngày xảy ra lỗi:</strong> ${proposal.dateOfError}</p>
      <p><strong>Mô tả chi tiết:</strong> ${proposal.detailsDescription}</p>
      <p><strong>Hướng xử lý:</strong> ${proposal.direction}</p>
      <p><strong>Ngày nộp:</strong> ${proposal.submissionDate}</p>
      <p><strong>Người nộp:</strong> ${
        proposal.submittedBy?.username || "Không rõ"
      }</p>
            <p><strong>Trạng thái:</strong> ${proposal.status}</p>
      ${
        proposal.declaration
          ? `<p><strong>Kê khai:</strong> ${proposal.declaration}</p>`
          : ""
      }
      ${
        proposal.suspendReason
          ? `<p><strong>Lý do tạm dừng:</strong> ${proposal.suspendReason}</p>`
          : ""
      }
      ${filesHtml}
      <h4>Đã phê duyệt bởi:</h4>
      <ul>
        ${proposal.approvedBy
          .map(
            (approval) => `
          <li>${approval.username} - ${approval.approvalDate}</li>
        `,
          )
          .join("")}
      </ul>
    `;

  selectContainer.appendChild(previewDiv);
}

async function fetchPurchasingDocumentsForPayment() {
  const response = await fetch("/approvedPurchasingDocumentsForPayment");
  const purchasingDocs = await response.json();
  populatePurchasingDocumentsDropdown(purchasingDocs);
}

async function fetchPurchasingDocumentsForAdvancePayment() {
  const response = await fetch("/approvedPurchasingDocumentsForAdvancePayment");
  const purchasingDocs = await response.json();
  populatePurchasingDocumentsDropdown(purchasingDocs);
}

async function fetchPurchasingDocumentsForAdvancePaymentReclaim() {
  const response = await fetch(
    "/approvedPurchasingDocumentsForAdvancePaymentReclaim",
  );
  const purchasingDocs = await response.json();
  populatePurchasingDocumentsDropdown(purchasingDocs);
}

function populatePurchasingDocumentsDropdown(purchasingDocs) {
  const dropdown = document.getElementById("purchasingDocumentsDropdown");
  if (!dropdown) return;

  dropdown.innerHTML = '<option value="">Hãy chọn một phiếu mua hàng</option>';
  purchasingDocs.forEach((doc) => {
    const option = document.createElement("option");
    option.value = doc._id;
    option.textContent = `${doc.name ? doc.name + " - " : ""}${
      doc.submissionDate
    }`;
    dropdown.appendChild(option);
  });
}

document
  .getElementById("add-purchasing-document-btn")
  ?.addEventListener("click", async () => {
    const dropdown = document.getElementById("purchasingDocumentsDropdown");
    const selectedDocId = dropdown.value;
    const purchasingDocumentsList = document.getElementById(
      "purchasingDocumentsList",
    );

    if (!selectedDocId) {
      alert("Xin hãy chọn phiếu mua hàng.");
      return;
    }

    if (document.querySelector(`#doc-${selectedDocId}`)) {
      alert("Bạn đã thêm phiếu này rồi.");
      return;
    }

    try {
      const response = await fetch(`/purchasingDocument/${selectedDocId}`);
      if (!response.ok) throw new Error("Failed to fetch document details.");
      const doc = await response.json();

      const purchasingFilesHtml =
        doc.fileMetadata && doc.fileMetadata.length > 0
          ? `
        <p><strong>Tệp đính kèm phiếu mua hàng:</strong></p>
        <ul>
          ${doc.fileMetadata
            .map(
              (file) => `
            <li>
              <a href="${file.link}" target="_blank">${
                file.name || file.displayName || file.actualFilename
              }</a>
              ${file.size ? ` (${file.size})` : ""}
            </li>
          `,
            )
            .join("")}
        </ul>
      `
          : "<p>Không có tệp đính kèm</p>";

      const appendedProposalsHtml =
        doc.appendedProposals.length > 0
          ? doc.appendedProposals
              .map((proposal) => {
                const proposalFilesHtml =
                  proposal.fileMetadata && proposal.fileMetadata.length > 0
                    ? `
              <p><strong>Tệp đính kèm phiếu đề xuất:</strong></p>
              <ul>
                ${proposal.fileMetadata
                  .map(
                    (file) => `
                  <li>
                    <a href="${file.link}" target="_blank">${
                      file.name || file.displayName || file.actualFilename
                    }</a>
                    ${file.size ? ` (${file.size})` : ""}
                  </li>
                `,
                  )
                  .join("")}
              </ul>
            `
                    : "<p>Không có tệp đính kèm</p>";

                return `
            <li>
              <strong>${proposal.task}</strong><br>
              Trạm: ${proposal.costCenter}<br>
              Nhóm: ${proposal.groupName}<br>
              Ngày xảy ra lỗi: ${proposal.dateOfError}<br>
              Mô tả chi tiết: ${proposal.detailsDescription} <br>
              Hướng xử lý: ${proposal.direction}<br>
              ${proposalFilesHtml}
            </li>
          `;
              })
              .join("")
          : "<p>Không có phiếu đề xuất đính kèm</p>";

      const listItem = document.createElement("li");
      listItem.id = `doc-${selectedDocId}`;
      listItem.innerHTML = `
        <strong>Mã:</strong> ${doc._id}<br>
        <strong>Tình trạng phê duyệt:</strong> ${doc.status}<br>
        <strong>Trạm:</strong> ${doc.costCenter ? doc.costCenter : ""}<br>
        <strong>Nhóm:</strong> ${doc.groupName ? doc.groupName : ""}<br>
        <strong>Chi phí:</strong> ${doc.grandTotalCost.toLocaleString()}<br>
        <h3>Sản phẩm:</h3>
        <ul>
            ${doc.products
              .map(
                (product) => `
                <li>
                    <strong>${product.productName}</strong><br>
                    Đơn giá: ${product.costPerUnit.toLocaleString()}<br>
                    Số lượng: ${product.amount.toLocaleString()}<br>
                    Thuế (%): ${product.vat.toLocaleString()}<br>
                    Thành tiền: ${product.totalCost.toLocaleString()}<br>
                    Thành tiền sau thuế: ${product.totalCostAfterVat.toLocaleString()}<br>
                    Ghi chú: ${product.note || "None"}
                </li>
            `,
              )
              .join("")}
        </ul>
        <h2>Các phiếu đề xuất đính kèm:</h2>
        <ul>${appendedProposalsHtml}</ul>
        ${purchasingFilesHtml}
        <button type="button" onclick="removePurchasingDocument('${selectedDocId}')">Xóa</button>
    `;

      purchasingDocumentsList.appendChild(listItem);

      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "approvedPurchasingDocuments[]";
      hiddenInput.value = selectedDocId;
      hiddenInput.id = `input-${selectedDocId}`;
      document.getElementById("submit-form").appendChild(hiddenInput);
    } catch (error) {
      console.error("Error fetching document details:", error);
      alert("Không thể thêm phiếu mua hàng. Vui lòng thử lại.");
    }
  });

function removePurchasingDocument(docId) {
  document.getElementById(`doc-${docId}`).remove();
  document.getElementById(`input-${docId}`).remove();
}

async function fetchGroups() {
  try {
    const response = await fetch("/getGroupDocument");
    const groups = await response.json();
    return groups;
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

async function populateGroupDropdown() {
  const groups = await fetchGroups();
  const groupSelect = document.getElementById("groupName");
  if (!groupSelect) return;

  groupSelect.innerHTML = '<option value="">Chọn nhóm</option>';

  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
}

async function fetchProjects() {
  try {
    const response = await fetch("/getProjectDocument");
    const projects = await response.json();
    return projects;
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

async function populateProjectDropdown() {
  const projects = await fetchProjects();
  const projectSelect = document.getElementById("projectName");

  projectSelect.innerHTML = '<option value="">Chọn dự án</option>';

  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.name;
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });
}

fetchApprovers();

document
  .getElementById("submit-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (isSubmitting) {
      console.log("Submission already in progress, ignoring duplicate");
      return;
    }

    const approvers = document.querySelectorAll(
      'input[name="approvers"]:checked',
    );
    if (approvers.length === 0) {
      alert("Xin hãy chọn ít nhất một người phê duyệt");
      return;
    }

    const productCostCenters = document.querySelectorAll(
      ".product-cost-center",
    );
    let allCostCentersValid = true;

    try {
      const userResponse = await fetch("/getCurrentUser");
      const userData = await userResponse.json();
      const currentUser = userData.username;

      const costCenterResponse = await fetch("/costCenters");
      const costCenters = await costCenterResponse.json();
      const allowedCostCenters = costCenters
        .filter(
          (center) =>
            center.allowedUsers.length === 0 ||
            center.allowedUsers.includes(currentUser),
        )
        .map((center) => center.name);

      productCostCenters.forEach((select) => {
        if (!allowedCostCenters.includes(select.value)) {
          allCostCentersValid = false;
          select.style.border = "1px solid red";
        } else {
          select.style.border = "";
        }
      });

      if (!allCostCentersValid) {
        alert(
          "Một số trạm sản phẩm không hợp lệ hoặc bạn không có quyền sử dụng. Vui lòng kiểm tra lại.",
        );
        return;
      }

      const selectedTitle = document.getElementById("title-dropdown").value;
      if (
        [
          "Purchasing Document",
          "Delivery Document",
          "Receipt Document",
        ].includes(selectedTitle)
      ) {
        const existingField = document.getElementById("grand-total-hidden");
        if (existingField) {
          existingField.remove();
        }

        const grandTotalField = document.createElement("input");
        grandTotalField.type = "hidden";
        grandTotalField.name = "grandTotalCost";
        grandTotalField.value = grandTotalCost.toFixed(2);
        grandTotalField.id = "grand-total-hidden";
        this.appendChild(grandTotalField);

        productEntries.forEach((product, index) => {
          if (product) {
            const productCostField = document.createElement("input");
            productCostField.type = "hidden";
            productCostField.name = `products[${index}][totalCost]`;
            productCostField.value = product.totalCost.toFixed(2);
            this.appendChild(productCostField);
          }
        });
      }

      isSubmitting = true;

      const submitButton = this.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
      }

      this.submit();
    } catch (error) {
      console.error("Error validating cost centers:", error);
      isSubmitting = false;

      const submitButton = this.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Nộp phiếu';
      }
      return;
    }
  });

document
  .getElementById("add-content-btn")
  .addEventListener("click", function () {
    const contentFields = document.getElementById("content-fields");
    const nameLabel = document.createElement("label");
    nameLabel.innerHTML = '<i class="fas fa-heading"></i> Tên nội dung';
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "contentName";

    const textLabel = document.createElement("label");
    textLabel.innerHTML = '<i class="fas fa-align-left"></i> Nội dung';
    const textArea = document.createElement("textarea");
    textArea.name = "contentText";
    textArea.rows = 5;

    contentFields.appendChild(nameLabel);
    contentFields.appendChild(nameInput);
    contentFields.appendChild(textLabel);
    contentFields.appendChild(textArea);
  });

document.getElementById("files").addEventListener("change", function (e) {
  const files = e.target.files;
  const fileList = document.getElementById("file-list");

  if (!fileList) {
    const fileListDiv = document.createElement("div");
    fileListDiv.id = "file-list";
    fileListDiv.className = "file-list";
    this.parentNode.appendChild(fileListDiv);
  }

  const fileListElement = document.getElementById("file-list");
  fileListElement.innerHTML =
    "<h4><i class='fas fa-file-upload'></i> Tệp sẽ được tải lên:</h4>";

  Array.from(files).forEach((file) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `
      <span class="file-name"><i class="fas fa-file"></i> ${file.name}</span>
      <span class="file-size">(${(file.size / 1024 / 1024).toFixed(
        2,
      )} MB)</span>
    `;
    fileListElement.appendChild(fileItem);
  });
});
