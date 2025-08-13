const ExcelJS = require("exceljs");
const multer = require("multer");
const CostCenter = require("../models/CostCenter");
const Product = require("../models/Product");
const FinanceGas = require("../models/FinanceGas");
const fs = require("fs");
const path = require("path");

////COST CENTER ADMIN CONTROLLERS

// Serve the cost center admin page
exports.getCostCenterAdminPage = (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    // Serve the HTML file
    res.sendFile("adminCostCenter.html", {
      root: "./views/adminPages/adminCostCenter",
    });
  } catch (error) {
    console.error("Error serving the cost center admin page:", error);
    res.send("Server error");
  }
};

// API to fetch all cost centers
exports.getCostCenters = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    // Fetch all cost centers
    const costCenters = await CostCenter.find();
    // Sort the cost centers alphabetically by name
    const sortedCostCenters = costCenters.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    res.json(sortedCostCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.json({ message: "Server error" });
  }
};

// Add a new cost center
exports.addCostCenter = async (req, res) => {
  const { name, allowedUsers } = req.body;
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Create new cost center
    const newCostCenter = new CostCenter({
      name,
      allowedUsers: allowedUsers ? allowedUsers.split(",") : [],
    });
    await newCostCenter.save();

    // Create corresponding FinanceGas entry
    const newFinanceGas = new FinanceGas({
      name: name,
      years: [], // Start with empty years array
    });
    await newFinanceGas.save();

    res.redirect("/costCenterAdmin"); // Redirect to the cost center page after adding
  } catch (error) {
    console.error("Error adding cost center:", error);
    // If cost center was created but FinanceGas failed, we should clean up
    try {
      await CostCenter.findOneAndDelete({ name });
    } catch (cleanupError) {
      console.error(
        "Error cleaning up cost center after FinanceGas creation failed:",
        cleanupError
      );
    }
    res.json({ message: "Server error" });
  }
};

// Edit an existing cost center
exports.editCostCenter = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { id } = req.params;
    const { name, allowedUsers } = req.body;

    // Get the current cost center to check if name is changing
    const currentCostCenter = await CostCenter.findById(id);
    if (!currentCostCenter) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    const oldName = currentCostCenter.name;
    const nameChanged = oldName !== name;

    // Ensure allowedUsers is a string
    let usersArray = [];
    if (typeof allowedUsers === "string" && allowedUsers.trim() !== "") {
      usersArray = allowedUsers
        .split(",")
        .map((user) => user.trim())
        .filter((user) => user !== "");
    } else if (Array.isArray(allowedUsers)) {
      usersArray = allowedUsers.filter((user) => user && user.trim() !== "");
    }

    // Update cost center with the new allowed users list
    const updatedCostCenter = await CostCenter.findByIdAndUpdate(
      id,
      { name, allowedUsers: usersArray },
      { new: true }
    );

    // If name changed, update the corresponding FinanceGas entry instead of creating new one
    if (nameChanged) {
      const updatedFinanceGas = await FinanceGas.findOneAndUpdate(
        { name: oldName }, // Find by old name
        { name: name }, // Update to new name
        { new: true }
      );

      if (!updatedFinanceGas) {
        console.warn(
          `FinanceGas entry with name "${oldName}" not found. Creating new one.`
        );
        // If for some reason the FinanceGas entry doesn't exist, create it
        const newFinanceGas = new FinanceGas({
          name: name,
          years: [], // Start with empty years array
        });
        await newFinanceGas.save();
      }
    }

    res.redirect("/costCenterAdmin");
  } catch (error) {
    console.error("Error editing cost center:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a cost center
exports.deleteCostCenter = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const { id } = req.params;
    await CostCenter.findByIdAndDelete(id);
    res.json({ message: "Cost Center deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

////END OF COST CENTER ADMIN CONTROLLERS

////PRODUCT ADMIN CONTROLLERS
// Serve the product admin page
exports.getProductAdminPage = (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    // Serve the HTML file
    res.sendFile("adminProduct.html", {
      root: "./views/adminPages/adminProduct",
    });
  } catch (error) {
    console.error("Error serving the cost center admin page:", error);
    res.send("Server error");
  }
};

// Get all products
exports.getProducts = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const { name, code } = req.body;

    // Check if product with the same code already exists
    const existingProduct = await Product.findOne({ code });
    if (existingProduct) {
      return res
        .status(400)
        .json({ message: "A product with this code already exists" });
    }

    const product = new Product({
      name,
      code,
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const { name, code } = req.body;

    // Check if another product with the same code already exists
    const existingProduct = await Product.findOne({
      code,
      _id: { $ne: req.params.id },
    });

    if (existingProduct) {
      return res
        .status(400)
        .json({ message: "Another product with this code already exists" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, code },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Import products from Excel (JSON data)
exports.importProducts = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Invalid products data" });
    }

    const results = {
      imported: 0,
      errors: [],
    };

    // Process each product
    for (const product of products) {
      try {
        const { name, code } = product;

        if (!name || !code) {
          results.errors.push(
            `Missing required fields for product: ${JSON.stringify(product)}`
          );
          continue;
        }

        // Check if product with the same code already exists
        const existingProduct = await Product.findOne({ code });
        if (existingProduct) {
          results.errors.push(`Product with code '${code}' already exists`);
          continue;
        }

        // Create the product
        const newProduct = new Product({
          name,
          code,
        });

        await newProduct.save();
        results.imported++;
      } catch (error) {
        results.errors.push(
          `Error importing product: ${JSON.stringify(product)} - ${
            error.message
          }`
        );
      }
    }

    res.status(200).json({
      message: `Imported ${results.imported} products successfully. ${results.errors.length} errors.`,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Import products from uploaded Excel file
exports.importProductsFromFile = async (req, res) => {
  let filePath = null;

  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    filePath = req.file.path;

    // Read the Excel file using ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Get the first worksheet
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return res
        .status(400)
        .json({ message: "No worksheet found in the Excel file" });
    }

    // Get the headers (assuming first row contains headers)
    const headers = [];
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value.toLowerCase().trim());
    });

    // Check if required headers exist
    const nameIndex = headers.indexOf("name");
    const codeIndex = headers.indexOf("code");

    if (nameIndex === -1 || codeIndex === -1) {
      return res.status(400).json({
        message: 'Excel file must have "name" and "code" columns',
        headers: headers,
      });
    }

    const results = {
      imported: 0,
      errors: [],
    };

    // Define the processRow function that returns a Promise
    async function processRow(row, rowNum) {
      // Skip header row
      if (rowNum === 1) return;

      try {
        // Get cell values (adding 1 because ExcelJS columns are 1-based)
        const name = row.getCell(nameIndex + 1).value;
        const code = row.getCell(codeIndex + 1).value;

        if (!name || !code) {
          results.errors.push(`Row ${rowNum}: Missing required fields`);
          return;
        }

        // Convert to string in case they're numbers in the Excel
        const nameStr = String(name).trim();
        const codeStr = String(code).trim();

        // Check if product with the same code already exists
        const existingProduct = await Product.findOne({ code: codeStr });
        if (existingProduct) {
          results.errors.push(
            `Row ${rowNum}: Product with code '${codeStr}' already exists`
          );
          return;
        }

        // Create the product
        const newProduct = new Product({
          name: nameStr,
          code: codeStr,
        });

        await newProduct.save();
        results.imported++;
      } catch (error) {
        results.errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    // Process all rows asynchronously (use Promise.all with an array of promises)
    const rowProcessingPromises = [];

    // Start from 2 to skip the header row (row 1)
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      rowProcessingPromises.push(processRow(row, rowNum));
    }

    // Wait for all processing to complete
    await Promise.all(rowProcessingPromises);

    res.status(200).json({
      message: `Imported ${results.imported} products successfully. ${results.errors.length} errors.`,
      results,
    });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    res.status(500).json({ message: error.message });
  } finally {
    // Always attempt to delete the file if it exists, regardless of success or failure
    if (filePath) {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting temporary file:", err);
      });
    }
  }
};

// Export products to Excel
exports.exportProducts = async (req, res) => {
  try {
    if (
      !["superAdmin", "director", "headOfPurchasing"].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    // Get all products
    const products = await Product.find();

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");

    // Add headers
    worksheet.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Code", key: "code", width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };

    // Add products data
    products.forEach((product) => {
      worksheet.addRow({
        name: product.name,
        code: product.code,
      });
    });

    // Set content type and disposition
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
////END OF ADMIN PRODUCT CONTROLLERS
