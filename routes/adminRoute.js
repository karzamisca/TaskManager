const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const adminController = require("../controllers/adminController");

////COST CENTER ADMIN ROUTERS
// Serve the Cost Center Admin page
router.get(
  "/costCenterAdmin",
  authMiddleware,
  adminController.getCostCenterAdminPage
);
// API to get all cost centers
router.get(
  "/getCostCenterAdmin",
  authMiddleware,
  adminController.getCostCenters
);
router.post("/addCostCenter", authMiddleware, adminController.addCostCenter);
router.post(
  "/editCostCenter/:id",
  authMiddleware,
  adminController.editCostCenter
);
router.delete(
  "/deleteCostCenter/:id",
  authMiddleware,
  adminController.deleteCostCenter
);
////END OF COST CENTER ADMIN ROUTERS

////PRODUCT ADMIN ROUTERS
// Serve the Product Admin page
router.get(
  "/productAdmin",
  authMiddleware,
  adminController.getProductAdminPage
);
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".xlsx" && ext !== ".xls") {
      return cb(new Error("Only Excel files are allowed"), false);
    }
    cb(null, true);
  },
});

// GET all products
router.get("/products", authMiddleware, adminController.getProducts);

// GET a single product by ID
router.get("/products/:id", authMiddleware, adminController.getProductById);

// POST create a new product
router.post("/products", authMiddleware, adminController.createProduct);

// PUT update a product
router.put("/products/:id", authMiddleware, adminController.updateProduct);

// DELETE a product
router.delete("/products/:id", authMiddleware, adminController.deleteProduct);

// POST import products from JSON data
router.post("/products/import", authMiddleware, adminController.importProducts);

// POST import products from Excel file
router.post(
  "/products/import/file",
  upload.single("excelFile"),
  authMiddleware,
  adminController.importProductsFromFile
);

// GET export products to Excel
router.get(
  "/products/export/excel",
  authMiddleware,
  adminController.exportProducts
);

////END OF PRODUCT ADMIN ROUTERS

module.exports = router;
