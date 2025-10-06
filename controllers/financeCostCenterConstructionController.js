// controllers/constructionController.js
const CostCenter = require("../models/CostCenter");

// Get construction entries for a specific cost center
exports.getConstructionEntries = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }
    const { costCenterId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    res.json(costCenter.construction || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add new construction entry to a cost center
exports.addConstructionEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }
    const { costCenterId } = req.params;
    const { name, income, expense, date } = req.body;

    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newEntry = {
      name,
      income: parseFloat(income) || 0,
      expense: parseFloat(expense) || 0,
      date,
    };

    // Initialize construction array if it doesn't exist
    if (!costCenter.construction) {
      costCenter.construction = [];
    }

    costCenter.construction.push(newEntry);
    await costCenter.save();

    res.status(201).json(newEntry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update construction entry in a cost center
exports.updateConstructionEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }
    const { costCenterId, entryId } = req.params;
    const { name, income, expense, date } = req.body;

    // Validate date format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (date && !dateRegex.test(date)) {
      return res
        .status(400)
        .json({ message: "Date must be in DD/MM/YYYY format" });
    }

    const costCenter = await CostCenter.findById(costCenterId);
    if (!costCenter || !costCenter.construction) {
      return res
        .status(404)
        .json({ message: "Cost center or construction entries not found" });
    }

    const entry = costCenter.construction.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (name) entry.name = name;
    if (income !== undefined) entry.income = parseFloat(income) || 0;
    if (expense !== undefined) entry.expense = parseFloat(expense) || 0;
    if (date) entry.date = date;

    await costCenter.save();
    res.json(entry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete construction entry from a cost center
exports.deleteConstructionEntry = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }
    const { costCenterId, entryId } = req.params;
    const costCenter = await CostCenter.findById(costCenterId);

    if (!costCenter || !costCenter.construction) {
      return res
        .status(404)
        .json({ message: "Cost center or construction entries not found" });
    }

    costCenter.construction.pull(entryId);
    await costCenter.save();

    res.json({ message: "Entry deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all cost centers (for dropdown selection)
exports.getCostCenters = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }
    const costCenters = await CostCenter.find({}, "name _id");
    res.json(costCenters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
