// controllers/itemOrderController.js
const Order = require("../models/ItemOrder");
const Item = require("../models/Item");

// Format date helper function
const formatDate = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Format date with time helper function
const formatDateTime = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const { items, notes } = req.body;
    const user = req.user;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in order" });
    }

    // Validate and process items
    const processedItems = [];
    let totalAmount = 0;

    for (const orderItem of items) {
      const item = await Item.findById(orderItem.itemId);

      if (!item) {
        return res.status(404).json({
          error: `Item with ID ${orderItem.itemId} not found`,
        });
      }

      if (item.isDeleted) {
        return res.status(400).json({
          error: `Item "${item.name}" is deleted and cannot be ordered`,
        });
      }

      const quantity = parseInt(orderItem.quantity);
      if (isNaN(quantity) || quantity < 1) {
        return res.status(400).json({
          error: `Invalid quantity for item "${item.name}"`,
        });
      }

      const itemTotal = item.unitPrice * quantity;

      processedItems.push({
        itemId: item._id,
        itemName: item.name,
        itemCode: item.code,
        unitPrice: item.unitPrice,
        quantity: quantity,
        totalPrice: itemTotal,
      });

      totalAmount += itemTotal;
    }

    // Generate unique order number based on timestamp
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const orderNumber = `ORD-${timestamp}${random}`;

    // Format dates
    const currentDate = new Date();
    const formattedOrderDate = formatDate(currentDate);
    const formattedUpdatedAt = formatDateTime(currentDate);

    // Create order
    const order = new Order({
      orderNumber: orderNumber,
      user: user.id,
      username: user.username,
      items: processedItems,
      totalAmount: totalAmount,
      notes: notes || "",
      status: "pending",
      formattedOrderDate: formattedOrderDate,
      formattedUpdatedAt: formattedUpdatedAt,
    });

    await order.save();

    res.status(201).json({
      message: "Order created successfully",
      order: {
        ...order.toObject(),
        formattedOrderDate: formattedOrderDate,
        formattedUpdatedAt: formattedUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating order:", error);

    // Handle duplicate order number error (rare but possible)
    if (
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.orderNumber
    ) {
      // Duplicate order number, retry with a new number
      return exports.createOrder(req, res);
    }

    res.status(500).json({ error: "Failed to create order" });
  }
};

// Get all orders for current user
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({
      orderDate: -1,
    });

    // Add formatted dates to each order
    const ordersWithFormattedDates = orders.map((order) => ({
      ...order.toObject(),
      formattedOrderDate: formatDate(order.orderDate),
      formattedUpdatedAt: formatDateTime(order.updatedAt),
    }));

    res.json(ordersWithFormattedDates);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, username } = req.query;
    let query = {};

    // For regular users, only show their own orders
    if (!req.user.role || req.user.role !== "admin") {
      query.user = req.user.id;
    }

    // Apply filters
    if (status && status !== "all") {
      query.status = status;
    }

    if (username) {
      query.username = { $regex: username, $options: "i" };
    }

    // Convert date strings to Date objects for filtering
    if (startDate || endDate) {
      query.orderDate = {};

      if (startDate) {
        // Convert yyyy-mm-dd to Date object
        const startDateObj = new Date(startDate);
        query.orderDate.$gte = startDateObj;
      }

      if (endDate) {
        // Convert yyyy-mm-dd to Date object, set to end of day
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.orderDate.$lte = endDateObj;
      }
    }

    const orders = await Order.find(query).sort({ orderDate: -1 });

    // Add formatted dates to each order
    const ordersWithFormattedDates = orders.map((order) => ({
      ...order.toObject(),
      formattedOrderDate:
        order.formattedOrderDate || formatDate(order.orderDate),
      formattedUpdatedAt:
        order.formattedUpdatedAt || formatDateTime(order.updatedAt),
    }));

    res.json(ordersWithFormattedDates);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// Get single order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if user is authorized to view this order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized to view this order" });
    }

    // Add formatted dates
    const orderWithFormattedDates = {
      ...order.toObject(),
      formattedOrderDate: formatDate(order.orderDate),
      formattedUpdatedAt: formatDateTime(order.updatedAt),
    };

    res.json(orderWithFormattedDates);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["pending", "processing", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if user is authorized
    if (order.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this order" });
    }

    order.status = status;

    // Update formatted date
    order.formattedUpdatedAt = formatDateTime(new Date());

    await order.save();

    res.json({
      message: "Order status updated successfully",
      order: {
        ...order.toObject(),
        formattedOrderDate: formatDate(order.orderDate),
        formattedUpdatedAt: order.formattedUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

// Add notes to order
exports.addOrderNotes = async (req, res) => {
  try {
    const { notes } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if user is authorized
    if (order.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to update this order" });
    }

    order.notes = notes || "";

    // Update formatted date
    order.formattedUpdatedAt = formatDateTime(new Date());

    await order.save();

    res.json({
      message: "Order notes updated successfully",
      order: {
        ...order.toObject(),
        formattedOrderDate: formatDate(order.orderDate),
        formattedUpdatedAt: order.formattedUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating order notes:", error);
    res.status(500).json({ error: "Failed to update order notes" });
  }
};

// Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    // For regular users, only get their own statistics
    const userFilter = { user: req.user.id };

    const [
      totalOrders,
      totalAmount,
      pendingOrders,
      processingOrders,
      completedOrders,
    ] = await Promise.all([
      // Total orders
      Order.countDocuments(userFilter),

      // Total amount
      Order.aggregate([
        { $match: userFilter },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Status counts
      Order.countDocuments({ ...userFilter, status: "pending" }),
      Order.countDocuments({ ...userFilter, status: "processing" }),
      Order.countDocuments({ ...userFilter, status: "completed" }),
    ]);

    res.json({
      totalOrders,
      totalAmount: totalAmount[0]?.total || 0,
      statusCounts: {
        pending: pendingOrders,
        processing: processingOrders,
        completed: completedOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: "Failed to fetch order statistics" });
  }
};
