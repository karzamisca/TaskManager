// Keep track of current products
let products = [];
let editMode = false;

// DOM elements
const productForm = document.getElementById("productForm");
const productId = document.getElementById("productId");
const nameInput = document.getElementById("name");
const codeInput = document.getElementById("code");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const productsTableBody = document.getElementById("productsTableBody");
const importForm = document.getElementById("importForm");
const importMessage = document.getElementById("importMessage");
const exportBtn = document.getElementById("exportBtn");

// Load products when page loads
document.addEventListener("DOMContentLoaded", fetchProducts);

// Event listeners
productForm.addEventListener("submit", handleProductSubmit);
cancelBtn.addEventListener("click", resetForm);
importForm.addEventListener("submit", handleExcelImport);
exportBtn.addEventListener("click", exportProducts);

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
        "error"
      );
    });
}

// Render the product table
function renderProductTable() {
  productsTableBody.innerHTML = "";

  if (products.length === 0) {
    productsTableBody.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align:center">No products found</td>
                    </tr>
                `;
    return;
  }

  products.forEach((product) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
                    <td>${product.name}</td>
                    <td>${product.code}</td>
                    <td>
                        <button onclick="editProduct('${product._id}')" class="edit-btn">Edit</button>
                        <button onclick="deleteProduct('${product._id}')" class="delete-btn">Delete</button>
                    </td>
                `;
    productsTableBody.appendChild(tr);
  });
}

// Handle product form submission
function handleProductSubmit(e) {
  e.preventDefault();

  const product = {
    name: nameInput.value,
    code: codeInput.value,
  };

  if (editMode) {
    // Update existing product
    product._id = productId.value;
    updateProduct(product);
  } else {
    // Add new product
    createProduct(product);
  }
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
      showFormMessage("Product added successfully!", "success");
    })
    .catch((error) => {
      console.error("Error creating product:", error);
      showFormMessage(
        error.message || "Error creating product. Please try again.",
        "error"
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
      resetForm();
      showFormMessage("Product updated successfully!", "success");
    })
    .catch((error) => {
      console.error("Error updating product:", error);
      showFormMessage(
        error.message || "Error updating product. Please try again.",
        "error"
      );
    });
}

// Delete a product
function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) {
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
      showFormMessage("Product deleted successfully!", "success");
    })
    .catch((error) => {
      console.error("Error deleting product:", error);
      showFormMessage(
        error.message || "Error deleting product. Please try again.",
        "error"
      );
    });
}

// Edit a product
function editProduct(id) {
  const product = products.find((product) => product._id === id);
  if (!product) return;

  // Set form to edit mode
  editMode = true;
  formTitle.textContent = "Edit Product";
  submitBtn.textContent = "Update Product";
  cancelBtn.classList.remove("hidden");

  // Fill form with product data
  productId.value = product._id;
  nameInput.value = product.name;
  codeInput.value = product.code;

  // Scroll to form
  productForm.scrollIntoView({ behavior: "smooth" });
}

// Reset the form
function resetForm() {
  editMode = false;
  formTitle.textContent = "Add New Product";
  submitBtn.textContent = "Add Product";
  cancelBtn.classList.add("hidden");

  productForm.reset();
  productId.value = "";
  formMessage.innerHTML = "";
}

// Show form message
function showFormMessage(message, type) {
  formMessage.innerHTML = `<div class="${type}">${message}</div>`;
  setTimeout(() => {
    formMessage.innerHTML = "";
  }, 3000);
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
    showImportMessage("Please select an Excel file", "error");
    return;
  }

  const formData = new FormData();
  formData.append("excelFile", file);

  // Show loading message
  showImportMessage("Importing products...", "success");

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
        showImportMessage(`${data.message}<br>${errorList}`, "error");
      } else {
        showImportMessage(data.message, "success");
      }
    })
    .catch((error) => {
      console.error("Error importing products:", error);
      showImportMessage(
        error.message || "Error importing products. Please try again.",
        "error"
      );
      fileInput.value = "";
    });
}

// Export products to Excel
function exportProducts() {
  window.location.href = "/products/export/excel";
}
