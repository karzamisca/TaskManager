// views/adminPages/adminProduct/adminProduct.js
// Keep track of current products
let products = [];

// DOM elements
const productForm = document.getElementById("productForm");
const nameInput = document.getElementById("name");
const codeInput = document.getElementById("code");
const formMessage = document.getElementById("formMessage");
const productsTableBody = document.getElementById("productsTableBody");
const importForm = document.getElementById("importForm");
const importMessage = document.getElementById("importMessage");
const exportBtn = document.getElementById("exportBtn");

// Edit modal elements
const editModal = document.getElementById("editModal");
const editProductForm = document.getElementById("editProductForm");
const editProductId = document.getElementById("editProductId");
const editNameInput = document.getElementById("editName");
const editCodeInput = document.getElementById("editCode");
const editFormMessage = document.getElementById("editFormMessage");

// Load products when page loads
document.addEventListener("DOMContentLoaded", fetchProducts);

// Event listeners
productForm.addEventListener("submit", handleProductSubmit);
importForm.addEventListener("submit", handleExcelImport);
exportBtn.addEventListener("click", exportProducts);
editProductForm.addEventListener("submit", handleEditProductSubmit);

// Tab switching
function switchTab(tab) {
  // Update tab buttons
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  // Update tab content
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));
  document.getElementById(tab + "-tab").classList.add("active");
}

// Fetch all products from the server
function fetchProducts() {
  fetch("/products")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      products = data;
      renderProductTable();
    })
    .catch((error) => {
      console.error("Error fetching products:", error);
      showFormMessage(
        "Failed to load products from the server. Check your connection to MongoDB.",
        "product-error"
      );
    });
}

// Render the product table
function renderProductTable() {
  productsTableBody.innerHTML = "";

  if (products.length === 0) {
    productsTableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center">Không có sản phẩm</td>
          </tr>
        `;
    return;
  }

  products.forEach((product) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td>${product.name}</td>
          <td>${product.code}</td>
          <td class="storage-column in-storage">${product.inStorage || 0}</td>
          <td class="storage-column about-to-transfer">${
            product.aboutToTransfer || 0
          }</td>
          <td>
            <button onclick="editProduct('${
              product._id
            }')" class="product-btn edit-btn">
              Sửa
            </button>
            <button onclick="deleteProduct('${
              product._id
            }')" class="product-btn delete-btn">
              Xóa
            </button>
          </td>
        `;
    productsTableBody.appendChild(tr);
  });
}

// Handle product form submission (Add new product)
function handleProductSubmit(e) {
  e.preventDefault();

  const product = {
    name: nameInput.value,
    code: codeInput.value,
  };

  createProduct(product);
}

// Handle edit product form submission
function handleEditProductSubmit(e) {
  e.preventDefault();

  const product = {
    _id: editProductId.value,
    name: editNameInput.value,
    code: editCodeInput.value,
  };

  updateProduct(product);
}

// Create a new product
function createProduct(product) {
  fetch("/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.message || "Failed to create product");
        });
      }
      return response.json();
    })
    .then((data) => {
      fetchProducts(); // Refresh the products list
      resetForm();
      showFormMessage("Sản phẩm thêm vào thành công", "product-success");
    })
    .catch((error) => {
      console.error("Error creating product:", error);
      showFormMessage(
        error.message || "Error creating product. Please try again.",
        "product-error"
      );
    });
}

// Update an existing product
function updateProduct(product) {
  fetch(`/products/${product._id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.message || "Failed to update product");
        });
      }
      return response.json();
    })
    .then((data) => {
      fetchProducts(); // Refresh the products list
      closeEditModal();
      showEditFormMessage("Sản phẩm cập nhật thành công", "product-success");
      setTimeout(() => {
        editFormMessage.innerHTML = "";
      }, 3000);
    })
    .catch((error) => {
      console.error("Error updating product:", error);
      showEditFormMessage(
        error.message || "Error updating product. Please try again.",
        "product-error"
      );
    });
}

// Delete a product
function deleteProduct(id) {
  if (!confirm("Bạn muốn xóa sản phẩm này không?")) {
    return;
  }

  fetch(`/products/${id}`, {
    method: "DELETE",
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.message || "Failed to delete product");
        });
      }
      return response.json();
    })
    .then((data) => {
      fetchProducts(); // Refresh the products list
      showFormMessage("Sản phẩm xóa thành công!", "product-success");
    })
    .catch((error) => {
      console.error("Error deleting product:", error);
      showFormMessage(
        error.message || "Error deleting product. Please try again.",
        "product-error"
      );
    });
}

// Edit a product (open modal)
function editProduct(id) {
  const product = products.find((product) => product._id === id);
  if (!product) return;

  // Fill modal form with product data
  editProductId.value = product._id;
  editNameInput.value = product.name;
  editCodeInput.value = product.code;

  // Clear any previous messages
  editFormMessage.innerHTML = "";

  // Show modal
  editModal.classList.remove("product-hidden");
}

// Close edit modal
function closeEditModal() {
  editModal.classList.add("product-hidden");
  editProductForm.reset();
  editFormMessage.innerHTML = "";
}

// Close modal when clicking outside
editModal.addEventListener("click", function (e) {
  if (e.target === editModal) {
    closeEditModal();
  }
});

// Reset the form
function resetForm() {
  productForm.reset();
  formMessage.innerHTML = "";
}

// Show form message
function showFormMessage(message, type) {
  formMessage.innerHTML = `<div class="${type}">${message}</div>`;
  setTimeout(() => {
    formMessage.innerHTML = "";
  }, 3000);
}

// Show edit form message
function showEditFormMessage(message, type) {
  editFormMessage.innerHTML = `<div class="${type}">${message}</div>`;
}

// Show import message
function showImportMessage(message, type) {
  importMessage.innerHTML = `<div class="${type}">${message}</div>`;
  setTimeout(() => {
    importMessage.innerHTML = "";
  }, 3000);
}

// Handle Excel import
function handleExcelImport(e) {
  e.preventDefault();

  const fileInput = document.getElementById("excelFile");
  const file = fileInput.files[0];

  if (!file) {
    showImportMessage("Please select an Excel file", "product-error");
    return;
  }

  const formData = new FormData();
  formData.append("excelFile", file);

  // Show loading message
  showImportMessage("Importing products...", "product-success");

  fetch("/products/import/file", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.message || "Import failed");
        });
      }
      return response.json();
    })
    .then((data) => {
      fileInput.value = "";
      fetchProducts(); // Refresh products list

      if (
        data.results &&
        data.results.errors &&
        data.results.errors.length > 0
      ) {
        const errorList = data.results.errors.join("<br>");
        showImportMessage(`${data.message}<br>${errorList}`, "product-error");
      } else {
        showImportMessage(data.message, "product-success");
      }
    })
    .catch((error) => {
      console.error("Error importing products:", error);
      showImportMessage(
        error.message || "Error importing products. Please try again.",
        "product-error"
      );
      fileInput.value = "";
    });
}

// Export products to Excel
function exportProducts() {
  window.location.href = "/products/export/excel";
}

// Refresh products data (can be called manually if needed)
function refreshProducts() {
  fetchProducts();
}

// Auto-refresh products every 5 minutes to keep storage data updated
setInterval(fetchProducts, 300000); // 300000 ms = 5 minutes
