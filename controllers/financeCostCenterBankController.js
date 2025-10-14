// controllers/financeCostCenterBankController.js
const CostCenter = require("../models/CostCenter");

// Get bank entries for a specific cost center
exports.getBankEntries = async (req, res) => {
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

    res.json(costCenter.bank || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add new bank entry to a cost center
exports.addBankEntry = async (req, res) => {
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

    // Initialize bank array if it doesn't exist
    if (!costCenter.bank) {
      costCenter.bank = [];
    }

    costCenter.bank.push(newEntry);
    await costCenter.save();

    res.status(201).json(newEntry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update bank entry in a cost center
exports.updateBankEntry = async (req, res) => {
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
    if (!costCenter || !costCenter.bank) {
      return res
        .status(404)
        .json({ message: "Cost center or bank entries not found" });
    }

    const entry = costCenter.bank.id(entryId);
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

// Delete bank entry from a cost center
exports.deleteBankEntry = async (req, res) => {
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

    if (!costCenter || !costCenter.bank) {
      return res
        .status(404)
        .json({ message: "Cost center or bank entries not found" });
    }

    costCenter.bank.pull(entryId);
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

    // Fetch cost centers sorted alphabetically by name
    const costCenters = await CostCenter.find({}, "name _id").sort({ name: 1 });

    res.json(costCenters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
