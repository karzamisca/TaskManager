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

// Check if order number exists
exports.checkOrderNumber = async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;
    const order = await Order.findOne({ orderNumber: orderNumber });

    res.json({ exists: !!order });
  } catch (error) {
    console.error("Error checking order number:", error);
    res.status(500).json({ error: "Failed to check order number" });
  }
};

// Get all order numbers
exports.getAllOrderNumbers = async (req, res) => {
  try {
    const orders = await Order.find({}, "orderNumber");
    const orderNumbers = orders.map((order) => order.orderNumber);
    res.json(orderNumbers);
  } catch (error) {
    console.error("Error fetching order numbers:", error);
    res.status(500).json({ error: "Failed to fetch order numbers" });
  }
};

// Check if user has permission to view all orders
const canViewAllOrders = (user) => {
  const allowedRoles = [
    "superAdmin",
    "director",
    "deputyDirector",
    "headOfPurchasing",
    "captainOfPurchasing",
  ];
  return user && user.role && allowedRoles.includes(user.role);
};

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const { items, notes, customOrderNumber, groups } = req.body;
    const user = req.user;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in order" });
    }

    // Validate custom order number if provided
    let orderNumber;
    if (customOrderNumber) {
      // Check if custom order number already exists
      const existingOrder = await Order.findOne({
        orderNumber: customOrderNumber,
      });
      if (existingOrder) {
        return res.status(400).json({ error: "Order number already exists" });
      }
      orderNumber = customOrderNumber;
    } else {
      // Generate unique order number based on timestamp
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      orderNumber = `ORD-${timestamp}${random}`;
    }

    // Validate and process items
    const processedItems = [];
    let totalAmount = 0;
    let totalAmountAfterVAT = 0;

    // Create a map of item IDs for quick lookup
    const itemIdMap = new Map();

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
      const itemTotalAfterVAT = item.unitPriceAfterVAT * quantity;

      const processedItem = {
        itemId: item._id,
        itemName: item.name,
        itemCode: item.code,
        unit: item.unit,
        unitPrice: item.unitPrice,
        vat: item.vat,
        unitPriceAfterVAT: item.unitPriceAfterVAT,
        quantity: quantity,
        totalPrice: itemTotal,
        totalPriceAfterVAT: itemTotalAfterVAT,
      };

      processedItems.push(processedItem);
      itemIdMap.set(item._id.toString(), processedItem);

      totalAmount += itemTotal;
      totalAmountAfterVAT += itemTotalAfterVAT;
    }

    // Process groups - validate that all items in groups exist in order
    const processedGroups = [];
    if (groups && Array.isArray(groups)) {
      for (const group of groups) {
        if (group.name && group.items && Array.isArray(group.items)) {
          // Filter out items that don't exist in the order
          const validItems = group.items.filter((itemId) =>
            itemIdMap.has(itemId.toString())
          );

          if (validItems.length > 0) {
            processedGroups.push({
              name: group.name.trim(),
              items: validItems,
            });
          }
        }
      }
    }

    // Format dates
    const currentDate = new Date();
    const formattedOrderDate = formatDate(currentDate);
    const formattedUpdatedAt = formatDateTime(currentDate);

    // Create order
    const orderData = {
      orderNumber: orderNumber,
      user: user.id,
      username: user.username,
      items: processedItems,
      totalAmount: totalAmount,
      totalAmountAfterVAT: totalAmountAfterVAT,
      notes: notes || "",
      status: "pending",
      formattedOrderDate: formattedOrderDate,
      formattedUpdatedAt: formattedUpdatedAt,
      groups: processedGroups,
    };

    const order = new Order(orderData);
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

    // Handle duplicate order number error
    if (
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.orderNumber
    ) {
      return res.status(400).json({ error: "Order number already exists" });
    }

    res.status(500).json({ error: "Failed to create order" });
  }
};

// Get all orders for current user (or all orders for privileged users)
exports.getMyOrders = async (req, res) => {
  try {
    let query = {};

    // If user doesn't have permission to view all orders, only show their own
    if (!canViewAllOrders(req.user)) {
      query.user = req.user.id;
    }

    const orders = await Order.find(query).sort({
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

// Get all orders (with filters) - for privileged users only
exports.getAllOrders = async (req, res) => {
  try {
    const { status, startDate, endDate, username, userId } = req.query;
    let query = {};

    // Only privileged users can use getAllOrders endpoint
    if (!canViewAllOrders(req.user)) {
      return res.status(403).json({ error: "Unauthorized to view all orders" });
    }

    // Apply filters
    if (status && status !== "all") {
      query.status = status;
    }

    if (username) {
      query.username = { $regex: username, $options: "i" };
    }

    if (userId) {
      query.user = userId;
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

// Get single order - anyone can view any order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Anyone can view any order
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

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { items, notes, customOrderNumber, groups } = req.body;
    const orderId = req.params.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must have at least one item" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if order can be modified (only pending orders can be modified)
    if (order.status !== "pending") {
      return res.status(400).json({
        error: "Only pending orders can be modified",
      });
    }

    // Check if order number should be updated
    if (customOrderNumber && customOrderNumber !== order.orderNumber) {
      // Check if new order number already exists
      const existingOrder = await Order.findOne({
        orderNumber: customOrderNumber,
        _id: { $ne: orderId },
      });
      if (existingOrder) {
        return res.status(400).json({ error: "Order number already exists" });
      }
      order.orderNumber = customOrderNumber;
    }

    // Process items
    const processedItems = [];
    let totalAmount = 0;
    let totalAmountAfterVAT = 0;

    // Create a map of item IDs for quick lookup
    const itemIdMap = new Map();

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
      const itemTotalAfterVAT = item.unitPriceAfterVAT * quantity;

      const processedItem = {
        itemId: item._id,
        itemName: item.name,
        itemCode: item.code,
        unit: item.unit,
        unitPrice: item.unitPrice,
        vat: item.vat,
        unitPriceAfterVAT: item.unitPriceAfterVAT,
        quantity: quantity,
        totalPrice: itemTotal,
        totalPriceAfterVAT: itemTotalAfterVAT,
      };

      processedItems.push(processedItem);
      itemIdMap.set(item._id.toString(), processedItem);

      totalAmount += itemTotal;
      totalAmountAfterVAT += itemTotalAfterVAT;
    }

    // Process groups - validate that all items in groups exist in order
    const processedGroups = [];
    if (groups && Array.isArray(groups)) {
      for (const group of groups) {
        if (group.name && group.items && Array.isArray(group.items)) {
          // Filter out items that don't exist in the order
          const validItems = group.items.filter((itemId) =>
            itemIdMap.has(itemId.toString())
          );

          if (validItems.length > 0) {
            processedGroups.push({
              name: group.name.trim(),
              items: validItems,
            });
          }
        }
      }
    }

    // Update order
    order.items = processedItems;
    order.totalAmount = totalAmount;
    order.totalAmountAfterVAT = totalAmountAfterVAT;
    order.notes = notes || "";
    order.groups = processedGroups;
    order.formattedUpdatedAt = formatDateTime(new Date());
    order.updatedAt = new Date();

    await order.save();

    res.json({
      message: "Order updated successfully",
      order: {
        ...order.toObject(),
        formattedOrderDate: formatDate(order.orderDate),
        formattedUpdatedAt: order.formattedUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating order:", error);

    // Handle duplicate order number error
    if (
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.orderNumber
    ) {
      return res.status(400).json({ error: "Order number already exists" });
    }

    res.status(500).json({ error: "Failed to update order" });
  }
};

// Delete order - anyone can delete any order
exports.deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if order can be deleted (only pending orders can be deleted)
    if (order.status !== "pending") {
      return res.status(400).json({
        error: "Only pending orders can be deleted",
      });
    }

    await Order.findByIdAndDelete(orderId);

    res.json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};

// Update order status - anyone can update any order status
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

// Add notes to order - anyone can update any order notes
exports.addOrderNotes = async (req, res) => {
  try {
    const { notes } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
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
    let userFilter = {};

    // For regular users, only get their own statistics
    // For privileged users, get all statistics
    if (!canViewAllOrders(req.user)) {
      userFilter.user = req.user.id;
    }

    const [
      totalOrders,
      totalAmount,
      totalAmountAfterVAT,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
    ] = await Promise.all([
      // Total orders
      Order.countDocuments(userFilter),

      // Total amount before VAT
      Order.aggregate([
        { $match: userFilter },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Total amount after VAT
      Order.aggregate([
        { $match: userFilter },
        { $group: { _id: null, total: { $sum: "$totalAmountAfterVAT" } } },
      ]),

      // Status counts
      Order.countDocuments({ ...userFilter, status: "pending" }),
      Order.countDocuments({ ...userFilter, status: "processing" }),
      Order.countDocuments({ ...userFilter, status: "completed" }),
      Order.countDocuments({ ...userFilter, status: "cancelled" }),
    ]);

    res.json({
      totalOrders,
      totalAmount: totalAmount[0]?.total || 0,
      totalAmountAfterVAT: totalAmountAfterVAT[0]?.total || 0,
      statusCounts: {
        pending: pendingOrders,
        processing: processingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: "Failed to fetch order statistics" });
  }
};
