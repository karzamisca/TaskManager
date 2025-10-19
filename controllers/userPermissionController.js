// controllers/userPermissionsController.js
const User = require("../models/User");

// Serve the cost center admin page
exports.getUserPermissionPage = (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    // Serve the HTML file
    res.sendFile("userPermission.html", {
      root: "./views/userPages/userPermission",
    });
  } catch (error) {
    console.error("Error serving the cost center admin page:", error);
    res.send("Server error");
  }
};

// Get user data for permissions editing
exports.getUserForPermissions = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const userId = req.params.id;
    const user = await User.findById(userId).select(
      "username realName permissions"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        realName: user.realName,
        permissions: user.permissions || [],
      },
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update user permissions
exports.updateUserPermissions = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const userId = req.params.id;
    const { permissions } = req.body;

    // Validate permissions is an array
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: "Permissions must be an array" });
    }

    // Update user permissions
    const user = await User.findByIdAndUpdate(
      userId,
      { permissions: permissions },
      { new: true, runValidators: true }
    ).select("username realName permissions");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Permissions updated successfully",
      user: {
        id: user._id,
        username: user.username,
        realName: user.realName,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error("Error updating user permissions:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid permissions data" });
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all users with permissions (for management view)
exports.getAllUsersWithPermissions = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const users = await User.find({})
      .select("username realName role department permissions")
      .sort({ username: 1 });

    res.json({
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        department: user.department,
        permissions: user.permissions || [],
      })),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
