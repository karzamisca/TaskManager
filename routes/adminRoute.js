const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const adminController = require("../controllers/adminController");

router.get("/admin", authMiddleware, adminController.getAdminPage);

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

module.exports = router;
