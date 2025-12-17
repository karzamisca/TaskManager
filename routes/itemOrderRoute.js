// routes/itemOrderRoute.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/itemOrderController");
const authMiddleware = require("../middlewares/authMiddleware");

// Order page
router.get("/itemOrder", authMiddleware, (req, res) => {
  res.sendFile("/itemOrder.html", {
    root: "./views/itemPages/itemOrder",
  });
});

// Create new order
router.post("/itemOrderControl", authMiddleware, orderController.createOrder);

// Get current user's orders
router.get(
  "/itemOrderControl/my-orders",
  authMiddleware,
  orderController.getMyOrders
);

// Get all orders (user sees their own, admin sees all)
router.get("/itemOrderControl", authMiddleware, orderController.getAllOrders);

// Get single order
router.get("/itemOrderControl/:id", authMiddleware, orderController.getOrder);

// Update order
router.put(
  "/itemOrderControl/:id",
  authMiddleware,
  orderController.updateOrder
);

// Delete order
router.delete(
  "/itemOrderControl/:id",
  authMiddleware,
  orderController.deleteOrder
);

// Update order status
router.put(
  "/itemOrderControl/:id/status",
  authMiddleware,
  orderController.updateOrderStatus
);

// Add/update order notes
router.put(
  "/itemOrderControl/:id/notes",
  authMiddleware,
  orderController.addOrderNotes
);

// Get order statistics
router.get(
  "/itemOrderControl/orders-stats",
  authMiddleware,
  orderController.getOrderStats
);

// Check if order number exists
router.get(
  "/itemOrderControl/check-order/:orderNumber",
  authMiddleware,
  orderController.checkOrderNumber
);

// Get all order numbers
router.get(
  "/itemOrderControl/all-order-numbers",
  authMiddleware,
  orderController.getAllOrderNumbers
);

module.exports = router;
