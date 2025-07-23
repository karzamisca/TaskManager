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

  const center = new Center({
    name,
    years: [{ year: currentYear, months }],
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
    let yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      // If year doesn't exist, create it with all months
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

      yearData = { year: parseInt(year), months };
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

const addYear = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { centerId } = req.params;
  const { year } = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    // Check if year already exists
    if (center.years.some((y) => y.year === year)) {
      return res.status(400).json({ message: "Year already exists" });
    }

    // Create months for the new year
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

    center.years.push({ year, months });
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteMonthEntry = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { centerId, year, monthName, entryIndex } = req.params;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    const yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      return res.status(404).json({ message: "Year not found" });
    }

    const month = yearData.months.find((m) => m.name === monthName);
    if (!month) {
      return res.status(404).json({ message: "Month not found" });
    }

    if (entryIndex < 0 || entryIndex >= month.entries.length) {
      return res.status(404).json({ message: "Entry index out of bounds" });
    }

    month.entries.splice(entryIndex, 1);
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateMonthEntry = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { centerId, year, monthName, entryIndex } = req.params;
  const entryData = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    const yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      return res.status(404).json({ message: "Year not found" });
    }

    const month = yearData.months.find((m) => m.name === monthName);
    if (!month) {
      return res.status(404).json({ message: "Month not found" });
    }

    if (entryIndex < 0 || entryIndex >= month.entries.length) {
      return res.status(404).json({ message: "Entry index out of bounds" });
    }

    // Calculate totals before updating
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

    month.entries[entryIndex] = entryData;
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  getAllCenters,
  createCenter,
  addMonthEntry,
  deleteCenter,
  addYear,
  deleteMonthEntry,
  updateMonthEntry,
};
