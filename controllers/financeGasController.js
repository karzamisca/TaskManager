//controllers/financeGasController.js
const Center = require("../models/FinanceGas");

const getAllCenters = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }

    const centers = await Center.find();
    res.json(centers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createCenter = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { name } = req.body;
  const currentYear = new Date().getFullYear();

  const center = new Center({
    name,
    years: [createYearData(currentYear)],
  });

  try {
    const newCenter = await center.save();
    res.status(201).json(newCenter);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const addMonthEntry = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { centerId, year, monthName } = req.params;
  const entryData = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    // Find or create the year
    let yearData = center.years.find((y) => y.year == year);
    if (!yearData) {
      yearData = createYearData(year);
      center.years.push(yearData);
    }

    const month = yearData.months.find((m) => m.name === monthName);
    if (!month) {
      return res.status(404).json({ message: "Month not found" });
    }

    // Calculate totals before adding
    if (entryData.purchaseContract) {
      entryData.purchaseContract.totalCost =
        entryData.purchaseContract.amount * entryData.purchaseContract.unitCost;
    }

    if (entryData.saleContract) {
      entryData.saleContract.totalCost =
        entryData.saleContract.amount * entryData.saleContract.unitCost;
    }

    // Calculate commission bonuses
    if (
      entryData.commissionRatePurchase &&
      entryData.purchaseContract &&
      entryData.currencyExchangeRate
    ) {
      entryData.commissionBonus = entryData.commissionBonus || {};
      entryData.commissionBonus.purchase =
        entryData.commissionRatePurchase *
        entryData.purchaseContract.amount *
        entryData.currencyExchangeRate;
    }

    if (
      entryData.commissionRateSale &&
      entryData.saleContract &&
      entryData.currencyExchangeRate
    ) {
      entryData.commissionBonus = entryData.commissionBonus || {};
      entryData.commissionBonus.sale =
        entryData.commissionRateSale *
        entryData.saleContract.amount *
        entryData.currencyExchangeRate;
    }

    month.entries.push(entryData);
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteCenter = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }

    await Center.findByIdAndDelete(req.params.id);
    res.json({ message: "Center deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper function to create a new year with all months
function createYearData(year) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((month) => ({ name: month, entries: [] }));

  return {
    year: parseInt(year),
    months,
  };
}

module.exports = {
  getAllCenters,
  createCenter,
  addMonthEntry,
  deleteCenter,
};
