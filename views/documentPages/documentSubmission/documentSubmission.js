// views\documentPages\documentSubmission\documentSubmission.js

// Global variable to store Choice.js instances
let choiceInstances = [];

// Initialize Choice.js for product dropdowns
function initializeProductDropdowns() {
  document.querySelectorAll(".product-dropdown").forEach((select) => {
    // Only initialize if not already a Choice.js element and doesn't have data-initialized attribute
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
        classNames: {
          containerInner: "choices__inner",
          input: "choices__input",
          list: "choices__list",
          listItems: "choices__list--multiple",
          listSingle: "choices__list--single",
          listDropdown: "choices__list--dropdown",
          item: "choices__item",
          itemSelectable: "choices__item--selectable",
          itemDisabled: "choices__item--disabled",
          itemChoice: "choices__item--choice",
          placeholder: "choices__placeholder",
          group: "choices__group",
          groupHeading: "choices__heading",
          button: "choices__button",
          activeState: "is-active",
          focusState: "is-focused",
          openState: "is-open",
          disabledState: "is-disabled",
          highlightedState: "is-highlighted",
          selectedState: "is-selected",
          flippedState: "is-flipped",
          loadingState: "is-loading",
          noResults: "has-no-results",
          noChoices: "has-no-choices",
        },
      });

      // Mark as initialized
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
      // Store current value before updating
      const choiceInstance = choiceInstances.find(
        (instance) => instance.passedElement.element === dropdown
      );
      const currentValue = choiceInstance
        ? choiceInstance.getValue(true)
        : null;

      // Clear and rebuild options
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

      // Update Choice instance if it exists
      if (choiceInstance) {
        choiceInstance.setChoices(
          products.map((product) => ({
            value: product.name,
            label: `${product.name} (${product.code})`,
            customProperties: { code: product.code },
          })),
          "value",
          "label",
          true
        );

        // Restore previous value
        if (currentValue) {
          choiceInstance.setChoiceByValue(currentValue);
        }
      }
    });
  } catch (error) {
    console.error("Error populating product dropdowns:", error);
  }
}

// Enhanced addProductEntry function with Choice.js support
function addProductEntry() {
  const productEntries = document.getElementById("product-entries");
  const selectedTitle = document.getElementById("title-dropdown").value;

  // Count existing product entries
  const existingProductEntries =
    productEntries.querySelectorAll(".product-dropdown");
  const productCount = existingProductEntries.length;

  let newEntry;
  if (selectedTitle === "Purchasing Document") {
    newEntry = `
      <label>Tên sản phẩm</label>
      <select name="products[${productCount}][productName]" class="product-dropdown" required>
        <option value="">Chọn sản phẩm</option>
      </select>
      <label>Đơn giá</label><input type="number" step="0.01" name="products[${productCount}][costPerUnit]" required />
      <label>Số lượng</label><input type="number" step="0.01" name="products[${productCount}][amount]" required />
      <label>Thuế VAT(%)</label><input type="number" step="0.01" name="products[${productCount}][vat]" required />
      <label>Trạm sản phẩm</label>
      <select name="products[${productCount}][costCenter]" class="product-cost-center" required>
        <option value="">Chọn trạm</option>
      </select>
      <label>Ghi chú</label><input type="text" name="products[${productCount}][note]" />
    `;
  } else {
    newEntry = `
      <label>Tên sản phẩm</label>
      <select name="products[${productCount}][productName]" class="product-dropdown" required>
        <option value="">Chọn sản phẩm</option>
      </select>
      <label>Đơn giá</label><input type="number" step="0.01" name="products[${productCount}][costPerUnit]" required />
      <label>Số lượng</label><input type="number" step="0.01" name="products[${productCount}][amount]" required />
      <label>Thuế (%)</label><input type="number" step="0.01" name="products[${productCount}][vat]" required />
      <label>Ghi chú</label><input type="text" name="products[${productCount}][note]" />
    `;
  }

  productEntries.insertAdjacentHTML("beforeend", newEntry);

  // Get the newly added dropdown
  const newDropdowns = productEntries.querySelectorAll(
    ".product-dropdown:not([data-choice-initialized])"
  );

  // Initialize only the new dropdown and populate it
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

    newDropdown.setAttribute("data-choice-initialized", "true");
    choiceInstances.push(choiceInstance);

    // Populate the new dropdown with products
    populateSingleProductDropdown(newDropdown);
  });

  // Only populate cost centers for purchasing documents
  if (selectedTitle === "Purchasing Document") {
    populateProductCostCenters();
  }
}

// Function to populate a single product dropdown without affecting others
async function populateSingleProductDropdown(dropdown) {
  try {
    const products = await fetchProducts();

    // Clear existing options except the default one
    const defaultOption = dropdown.querySelector('option[value=""]');
    dropdown.innerHTML = "";
    if (defaultOption) {
      dropdown.appendChild(defaultOption);
    }

    // Add product options
    products.forEach((product) => {
      const option = document.createElement("option");
      option.value = product.name;
      option.textContent = `${product.name} (${product.code})`;
      option.dataset.productCode = product.code;
      dropdown.appendChild(option);
    });

    // Find the corresponding Choice instance and update it
    const choiceInstance = choiceInstances.find(
      (instance) => instance.passedElement.element === dropdown
    );

    if (choiceInstance) {
      // Store the current value before updating
      const currentValue = choiceInstance.getValue(true);

      // Update the choices
      choiceInstance.setChoices(
        products.map((product) => ({
          value: product.name,
          label: `${product.name} (${product.code})`,
          customProperties: { code: product.code },
        })),
        "value",
        "label",
        true
      );

      // Restore the previous value if it exists
      if (currentValue) {
        choiceInstance.setChoiceByValue(currentValue);
      }
    }
  } catch (error) {
    console.error("Error populating product dropdown:", error);
  }
}

flatpickr("#dateOfError", {
  dateFormat: "d-m-Y",
  defaultDate: "today",
});

////DOCUMENT SELECT HANDLERS
// Function to handle Proposal Document selection
function handleProposalDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");

  contentFields.innerHTML = `
      <label for="task">Công việc</label>
      <input type="text" name="task" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <label for="dateOfError">Ngày xảy ra lỗi</label>
      <input type="text" name="dateOfError" id="dateOfError" required />
      <label for="detailsDescription">Mô tả chi tiết</label>
      <textarea name="detailsDescription" rows="3" required></textarea>
      <label for="direction">Hướng xử lý</label>
      <input type="text" name="direction" required />
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>          
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  // Fetch current user and populate cost centers
  fetchCostCenters();

  flatpickr("#dateOfError", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  addContentButton.style.display = "none";
}

// Function to handle Purchasing Document selection
function handlePurchasingDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <div id="product-entries">
        <label>Tên sản phẩm</label>
        <select name="products[0][productName]" class="product-dropdown" required>
          <option value="">Chọn sản phẩm</option>
        </select> 
        <label>Đơn giá</label><input type="number" step="0.01" name="products[0][costPerUnit]" required />
        <label>Số lượng</label><input type="number" step="0.01" name="products[0][amount]" required />
        <label>Thuế (%)</label><input type="number" step="0.01" name="products[0][vat]" required />
        <label>Trạm sản phẩm</label>
        <select name="products[0][costCenter]" class="product-cost-center" required>
          <option value="">Chọn trạm</option>
        </select>
        <label>Ghi chú</label><input type="text" name="products[0][note]" />
      </div>
      <button type="button" onclick="addProductEntry()">Thêm sản phẩm</button>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>     
    `;

  // Initialize Choice.js for the initial product dropdown
  setTimeout(() => {
    initializeProductDropdowns();
    populateProductDropdowns();
  }, 100);

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";

  // Get proposal documents for Purchasing Document
  fetchApprovedProposalsForPurchasing();

  // Fetch current user and populate cost centers
  fetchCostCenters();

  // Populate product cost centers
  populateProductCostCenters();
}

// Function to handle Payment Document selection
function handlePaymentDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section"
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocumentsForPayment(); // Changed to specialized function

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="content">Nội dung</label>
      <input type="text" name="content" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm</option>
      </select>
      <label for="paymentMethod">Hình thức thanh toán</label>
      <select name="paymentMethod">
        <option value="Tiền mặt">Tiền mặt</option>
        <option value="Chuyển khoản nội bộ">Chuyển khoản nội bộ</option>
        <option value="Hợp đồng">Hợp đồng</option>
      </select>
      <label for="totalPayment">Tổng thanh toán:</label>
      <input type="number" step="0.01" name="totalPayment" required />
      <label for="paymentDeadline">Thời hạn trả</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <label for="priority">Mức độ ưu tiên</label>
      <select name="priority" id="priority" required>
        <option value="Thấp" selected>Thấp</option>
        <option value="Trung bình">Trung bình</option>
        <option value="Cao">Cao</option>
      </select>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>       
      <label for="notes">Ghi chú</label>
        <textarea name="notes" rows="3"></textarea>            
    `;
  populateGroupDropdown();
  populateProjectDropdown();

  flatpickr("#paymentDeadline", {
    dateFormat: "d-m-Y",
    defaultDate: "today",
  });

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Advance Payment Document selection
function handleAdvancePaymentDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section"
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocumentsForAdvancePayment(); // Changed to specialized function

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="content">Nội dung</label>
      <input type="text" name="content" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm</option>
      </select>
      <label for="paymentMethod">Hình thức thanh toán</label>
      <select name="paymentMethod">
        <option value="Tiền mặt">Tiền mặt</option>
        <option value="Chuyển khoản nội bộ">Chuyển khoản nội bộ</option>
        <option value="Hợp đồng">Hợp đồng</option>
      </select>
      <label for="advancePayment">Tạm ứng:</label>
      <input type="number" step="0.01" name="advancePayment"/>
      <label for="paymentDeadline">Thời hạn trả</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
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

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Advance Payment Document selection
function handleAdvancePaymentReclaimDocument() {
  const contentFields = document.getElementById("content-fields");
  const appendPurchasingSection = document.getElementById(
    "append-purchasing-documents-section"
  );

  appendPurchasingSection.style.display = "block";
  fetchPurchasingDocumentsForAdvancePaymentReclaim(); // Changed to specialized function

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="content">Nội dung</label>
      <input type="text" name="content" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter">
        <option value="">Chọn một trạm</option>
      </select>
      <label for="paymentMethod">Hình thức thanh toán</label>
      <select name="paymentMethod">
        <option value="Tiền mặt">Tiền mặt</option>
        <option value="Chuyển khoản nội bộ">Chuyển khoản nội bộ</option>
        <option value="Hợp đồng">Hợp đồng</option>
      </select>
      <label for="advancePaymentReclaim">Số tiền thu lại:</label>
      <input type="number" step="0.01" name="advancePaymentReclaim"/>
      <label for="paymentDeadline">Thời hạn trả</label>
      <input type="text" name="paymentDeadline" id="paymentDeadline"/>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
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

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Delivery Document selection
function handleDeliveryDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <div id="product-entries">
        <label>Tên sản phẩm</label>
        <select name="products[0][productName]" class="product-dropdown" required>
          <option value="">Chọn sản phẩm</option>
        </select> 
        <label>Đơn giá</label><input type="number" step="0.01" name="products[0][costPerUnit]" required />
        <label>Số lượng</label><input type="number" step="0.01" name="products[0][amount]" required />
        <label>Thuế (%)</label><input type="number" step="0.01" name="products[0][vat]" required />
        <label>Ghi chú</label><input type="text" name="products[0][note]" />
      </div>
      <button type="button" onclick="addProductEntry()">Thêm sản phẩm</button>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;

  // Initialize Choice.js for the initial product dropdown
  setTimeout(() => {
    initializeProductDropdowns();
    populateProductDropdowns();
  }, 100);

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";

  // Get proposal documents for Delivery Document
  fetchApprovedProposalsForDelivery();

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Receipt Document selection
function handleReceiptDocument() {
  const contentFields = document.getElementById("content-fields");
  const approvedProposalSection = document.getElementById(
    "approved-proposal-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="costCenter">Trạm</label>
      <select name="costCenter" id="costCenter" required>
        <option value="">Chọn một trạm</option>
      </select>
      <div id="product-entries">
        <label>Tên sản phẩm</label>
        <select name="products[0][productName]" class="product-dropdown" required>
          <option value="">Chọn sản phẩm</option>
        </select> 
        <label>Đơn giá</label><input type="number" step="0.01" name="products[0][costPerUnit]" required />
        <label>Số lượng</label><input type="number" step="0.01" name="products[0][amount]" required />
        <label>Thuế (%)</label><input type="number" step="0.01" name="products[0][vat]" required />
        <label>Ghi chú</label><input type="text" name="products[0][note]" />
      </div>
      <button type="button" onclick="addProductEntry()">Thêm sản phẩm</button>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;

  // Initialize Choice.js for the initial product dropdown
  setTimeout(() => {
    initializeProductDropdowns();
    populateProductDropdowns();
  }, 100);

  populateGroupDropdown();
  populateProjectDropdown();
  approvedProposalSection.style.display = "block";

  // Get proposal documents for Receipt Document
  fetchApprovedProposalsForReceipt();

  // Fetch current user and populate cost centers
  fetchCostCenters();
}

// Function to handle Project Proposal Document selection
function handleProjectProposalDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");
  const appendApprovedDocumentsSection = document.getElementById(
    "append-approved-documents-section"
  );

  contentFields.innerHTML = `
      <label for="name">Tên</label>
      <input type="text" name="name" required />
      <label for="contentName">Tên nội dung</label>
      <input type="text" name="contentName" required />
      <label for="contentText">Nội dung</label>
      <textarea name="contentText" rows="5" required></textarea>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
      <select name="projectName" id="projectName">
        <option value="">Chọn dự án</option>
      </select>             
    `;
  populateGroupDropdown();
  populateProjectDropdown();
  addContentButton.style.display = "inline-block";
  appendApprovedDocumentsSection.style.display = "none";
}

// Function to handle Generic Document selection
function handleGenericDocument() {
  const contentFields = document.getElementById("content-fields");
  const addContentButton = document.getElementById("add-content-btn");
  const appendApprovedDocumentsSection = document.getElementById(
    "append-approved-documents-section"
  );

  contentFields.innerHTML = `
      <label for="contentName">Tên nội dung</label>
      <input type="text" name="contentName" required />
      <label for="contentText">Nội dung</label>
      <textarea name="contentText" rows="5" required></textarea>
      <select name="groupName" id="groupName">
        <option value="">Chọn nhóm</option>
      </select>
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
      "approved-proposal-section"
    );
    const appendApprovedDocumentsSection = document.getElementById(
      "append-approved-documents-section"
    );
    const appendPurchasingSection = document.getElementById(
      "append-purchasing-documents-section"
    );
    const purchasingDocumentPreview = document.getElementById(
      "purchasingDocumentPreview"
    );

    // Reset all sections and content fields
    contentFields.innerHTML = "";
    addContentButton.style.display = "none";
    approvedProposalSection.style.display = "none";
    appendApprovedDocumentsSection.style.display = "none";
    appendPurchasingSection.style.display = "none";
    purchasingDocumentPreview.style.display = "none";

    // Call respective handler based on selected document type
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
      case "Generic Document":
        handleGenericDocument();
        break;
    }
  });
////END OF DOCUMENT SELECT HANDLERS

async function populateProductCostCenters() {
  try {
    // Get current user to check allowed cost centers
    const userResponse = await fetch("/getCurrentUser");
    const userData = await userResponse.json();
    const currentUser = userData.username;

    // Get all cost centers
    const costCenterResponse = await fetch("/costCenters");
    const costCenters = await costCenterResponse.json();

    // Populate each product cost center dropdown
    document.querySelectorAll(".product-cost-center").forEach((select) => {
      // Only populate if empty (has only the default option)
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

// Initialize Choice.js when the page loads
document.addEventListener("DOMContentLoaded", function () {
  // Check if we're on a page that needs product dropdowns
  const productDropdowns = document.querySelectorAll(".product-dropdown");
  if (productDropdowns.length > 0) {
    // Initialize existing product dropdowns
    setTimeout(() => {
      initializeProductDropdowns();
      populateProductDropdowns();
    }, 500);
  }
});

// Clean up Choice.js instances when leaving the page
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

  // Check which document type is currently selected to determine which proposals to fetch
  const selectedTitle = document.getElementById("title-dropdown").value;
  if (selectedTitle === "Purchasing Document") {
    // Populate the new dropdown for purchasing document
    fetchApprovedProposalsForPurchasing(newEntry.querySelector("select"));
  } else if (selectedTitle === "Delivery Document") {
    // Populate the new dropdown for delivery document
    fetchApprovedProposalsForDelivery(newEntry.querySelector("select"));
  } else if (selectedTitle === "Receipt Document") {
    // Populate the new dropdown for delivery document
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

// Function to fetch proposals for purchasing documents
async function fetchApprovedProposalsForPurchasing(dropdown = null) {
  const response = await fetch("/approvedProposalsForPurchasing");
  const approvedProposals = await response.json();

  if (!dropdown) {
    // If no specific dropdown provided, populate all dropdowns
    document
      .querySelectorAll(".approved-proposal-dropdown")
      .forEach((select) => {
        populateDropdown(select, approvedProposals);
      });
  } else {
    populateDropdown(dropdown, approvedProposals);
  }
}

// Function to fetch proposals for delivery documents
async function fetchApprovedProposalsForDelivery(dropdown = null) {
  const response = await fetch("/approvedProposalsForDelivery");
  const approvedProposals = await response.json();

  if (!dropdown) {
    // If no specific dropdown provided, populate all dropdowns
    document
      .querySelectorAll(".approved-proposal-dropdown")
      .forEach((select) => {
        populateDropdown(select, approvedProposals);
      });
  } else {
    populateDropdown(dropdown, approvedProposals);
  }
}

// Function to fetch proposals for receipt documents
async function fetchApprovedProposalsForReceipt(dropdown = null) {
  const response = await fetch("/approvedProposalsForReceipt");
  const approvedProposals = await response.json();

  if (!dropdown) {
    // If no specific dropdown provided, populate all dropdowns
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

  // Handle multiple files
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
        `
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
        `
          )
          .join("")}
      </ul>
    `;

  // Insert the preview right after the select container
  selectContainer.appendChild(previewDiv);
}

// Function to fetch purchasing documents for payment documents
async function fetchPurchasingDocumentsForPayment() {
  const response = await fetch("/approvedPurchasingDocumentsForPayment");
  const purchasingDocs = await response.json();
  populatePurchasingDocumentsDropdown(purchasingDocs);
}

// Function to fetch purchasing documents for advance payment documents
async function fetchPurchasingDocumentsForAdvancePayment() {
  const response = await fetch("/approvedPurchasingDocumentsForAdvancePayment");
  const purchasingDocs = await response.json();
  populatePurchasingDocumentsDropdown(purchasingDocs);
}

// Function to fetch purchasing documents for advance payment reclaim documents
async function fetchPurchasingDocumentsForAdvancePaymentReclaim() {
  const response = await fetch(
    "/approvedPurchasingDocumentsForAdvancePaymentReclaim"
  );
  const purchasingDocs = await response.json();
  populatePurchasingDocumentsDropdown(purchasingDocs);
}

// Shared function to populate the dropdown with purchasing documents
function populatePurchasingDocumentsDropdown(purchasingDocs) {
  const dropdown = document.getElementById("purchasingDocumentsDropdown");

  // Populate dropdown options
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

// Add selected purchasing document to the list
document
  .getElementById("add-purchasing-document-btn")
  .addEventListener("click", async () => {
    const dropdown = document.getElementById("purchasingDocumentsDropdown");
    const selectedDocId = dropdown.value;
    const purchasingDocumentsList = document.getElementById(
      "purchasingDocumentsList"
    );

    if (!selectedDocId) {
      alert("Xin hãy chọn phiếu mua hàng.");
      return;
    }

    // Check if the document is already added
    if (document.querySelector(`#doc-${selectedDocId}`)) {
      alert("Bạn đã thêm phiếu này rồi.");
      return;
    }

    // Fetch and display the purchasing document details
    try {
      const response = await fetch(`/purchasingDocument/${selectedDocId}`);
      if (!response.ok) throw new Error("Failed to fetch document details.");
      const doc = await response.json();

      // Handle multiple files for purchasing document
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
          `
            )
            .join("")}
        </ul>
      `
          : "<p>Không có tệp đính kèm</p>";

      // Handle multiple files for appended proposals
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
                `
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
            `
              )
              .join("")}
        </ul>
        <h2>Các phiếu đề xuất đính kèm:</h2>
        <ul>${appendedProposalsHtml}</ul>
        ${purchasingFilesHtml}
        <button type="button" onclick="removePurchasingDocument('${selectedDocId}')">Xóa</button>
    `;

      purchasingDocumentsList.appendChild(listItem);

      // Add hidden input for form submission
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.name = "approvedPurchasingDocuments[]";
      hiddenInput.value = selectedDocId;
      hiddenInput.id = `input-${selectedDocId}`;
      document.getElementById("submit-form").appendChild(hiddenInput);
    } catch (error) {
      console.error("Error fetching document details:", error);
      alert("Failed to add the purchasing document. Please try again.");
    }
  });

// Remove a purchasing document
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

  // Clear existing options except the first one
  groupSelect.innerHTML = '<option value="">Chọn nhóm</option>';

  // Add new options
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
    const groups = await response.json();
    return groups;
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

async function populateProjectDropdown() {
  const projects = await fetchProjects();
  const projectSelect = document.getElementById("projectName");

  // Clear existing options except the first one
  projectSelect.innerHTML = '<option value="">Chọn dự án</option>';

  // Add new options
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
    const approvers = document.querySelectorAll(
      'input[name="approvers"]:checked'
    );
    if (approvers.length === 0) {
      event.preventDefault();
      alert("Xin hãy chọn ít nhất một người phê duyệt");
      return;
    }

    // Validate product cost centers
    const productCostCenters = document.querySelectorAll(
      ".product-cost-center"
    );
    let allCostCentersValid = true;

    // Get current user's allowed cost centers
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
            center.allowedUsers.includes(currentUser)
        )
        .map((center) => center.name);

      // Check each product's cost center
      productCostCenters.forEach((select) => {
        if (!allowedCostCenters.includes(select.value)) {
          allCostCentersValid = false;
          select.style.border = "1px solid red";
        } else {
          select.style.border = "";
        }
      });

      if (!allCostCentersValid) {
        event.preventDefault();
        alert(
          "Một số trạm sản phẩm không hợp lệ hoặc bạn không có quyền sử dụng. Vui lòng kiểm tra lại."
        );
        return;
      }
    } catch (error) {
      console.error("Error validating cost centers:", error);
      event.preventDefault();
      return;
    }
  });

document
  .getElementById("add-content-btn")
  .addEventListener("click", function () {
    const contentFields = document.getElementById("content-fields");
    const nameLabel = document.createElement("label");
    nameLabel.innerText = "Tên nội dung";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "contentName";

    const textLabel = document.createElement("label");
    textLabel.innerText = "Nội dung";
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
  fileListElement.innerHTML = "<h4>Tệp sẽ được tải lên:</h4>";

  Array.from(files).forEach((file) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">(${(file.size / 1024 / 1024).toFixed(
        2
      )} MB)</span>
    `;
    fileListElement.appendChild(fileItem);
  });
});
