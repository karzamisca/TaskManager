// routes/userPermissions.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const userPermissionsController = require("../controllers/userPermissionController");

router.get(
  "/userPermission",
  authMiddleware,
  userPermissionsController.getUserPermissionPage
);

// Get user data for permissions editing
router.get(
  "/userPermissionControl/:id",
  authMiddleware,
  userPermissionsController.getUserForPermissions
);

// Update user permissions
router.put(
  "/userPermissionControl/:id/permissions",
  authMiddleware,
  userPermissionsController.updateUserPermissions
);

// Get all users with permissions
router.get(
  "/userPermissionControl",
  authMiddleware,
  userPermissionsController.getAllUsersWithPermissions
);

module.exports = router;
