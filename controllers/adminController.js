const CostCenter = require("../models/CostCenter");
const path = require("path");

exports.getAdminPage = (req, res) => {
  try {
    if (
      ![
        "approver",
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "captainOfMech",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    // Serve the HTML file
    res.sendFile("adminMain.html", {
      root: "./views/adminPages/adminMain",
    });
  } catch (error) {
    console.error("Error serving the cost center admin page:", error);
    res.send("Server error");
  }
};

// Serve the cost center admin page
exports.getCostCenterAdminPage = (req, res) => {
  try {
    if (
      ![
        "approver",
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "captainOfMech",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
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
      ![
        "approver",
        "superAdmin",
        "headOfMechanical",
        "headOfAccounting",
        "headOfPurchasing",
        "director",
        "captainOfMech",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const costCenters = await CostCenter.find();
    res.json(costCenters);
  } catch (error) {
    console.error("Error fetching cost centers:", error);
    res.json({ message: "Server error" });
  }
};
// Add a new cost center
exports.addCostCenter = async (req, res) => {
  const { name, allowedUsers } = req.body;

  try {
    const newCostCenter = new CostCenter({
      name,
      allowedUsers: allowedUsers ? allowedUsers.split(",") : [],
    });

    await newCostCenter.save();
    res.redirect("/costCenterAdmin"); // Redirect to the cost center page after adding
  } catch (error) {
    console.error("Error adding cost center:", error);
    res.json({ message: "Server error" });
  }
};
// Edit an existing cost center
exports.editCostCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, allowedUsers } = req.body;

    // Ensure allowedUsers is a string
    let usersArray = [];

    if (typeof allowedUsers === "string") {
      usersArray = allowedUsers.split(",").map((user) => user.trim());
    } else if (Array.isArray(allowedUsers)) {
      usersArray = allowedUsers;
    }

    // Update cost center with the new allowed users list
    const updatedCostCenter = await CostCenter.findByIdAndUpdate(
      id,
      { name, allowedUsers: usersArray },
      { new: true }
    );

    if (!updatedCostCenter) {
      return res.status(404).json({ message: "Cost center not found" });
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
    const { id } = req.params;
    await CostCenter.findByIdAndDelete(id);
    res.json({ message: "Cost Center deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
