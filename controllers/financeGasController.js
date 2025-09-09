// controllers/financeGasController.js
const Center = require("../models/CostCenter"); // Changed from FinanceGas to CostCenter
const ExcelJS = require("exceljs");

exports.getAllCenters = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }

    const centers = await Center.find().sort({ name: 1 }); // 1 = ascending A-Z
    res.json(centers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.exportAllCentersSummaryToExcel = async (req, res) => {
  try {
    // Fetch all centers data
    const centers = await Center.find().lean();

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tổng hợp tất cả trạm");

    // Set columns
    worksheet.columns = [
      { header: "Trạm", key: "center", width: 20 },
      { header: "Tháng", key: "month", width: 15 },
      {
        header: "Số lượng mua",
        key: "purchaseAmount",
        width: 15,
        style: { numFmt: "#,##0" },
      },
      {
        header: "Tổng mua",
        key: "purchaseTotal",
        width: 15,
        style: { numFmt: "#,##0" },
      },
      {
        header: "Số lượng bán",
        key: "saleAmount",
        width: 15,
        style: { numFmt: "#,##0" },
      },
      {
        header: "Tổng bán",
        key: "saleTotal",
        width: 15,
        style: { numFmt: "#,##0" },
      },
      {
        header: "Vận chuyển",
        key: "transport",
        width: 15,
        style: { numFmt: "#,##0" },
      },
      {
        header: "Hoa hồng mua",
        key: "commissionPurchase",
        width: 15,
        style: { numFmt: "#,##0" },
      },
      {
        header: "Hoa hồng bán",
        key: "commissionSale",
        width: 15,
        style: { numFmt: "#,##0" },
      },
    ];

    // Add data rows
    let grandTotals = {
      purchaseAmount: 0,
      purchaseTotal: 0,
      saleAmount: 0,
      saleTotal: 0,
      salary: 0,
      transport: 0,
      commissionPurchase: 0,
      commissionSale: 0,
    };

    centers.forEach((center) => {
      center.years.forEach((yearData) => {
        yearData.months.forEach((monthData) => {
          if (monthData.entries.length > 0) {
            const monthTotals = calculateMonthTotals(monthData.entries);

            // Add to grand totals
            Object.keys(grandTotals).forEach((key) => {
              grandTotals[key] += monthTotals[key];
            });

            // Add row
            worksheet.addRow({
              center: center.name,
              month: `${monthData.name} ${yearData.year}`,
              purchaseAmount: monthTotals.purchaseAmount,
              purchaseTotal: monthTotals.purchaseTotal,
              saleAmount: monthTotals.saleAmount,
              saleTotal: monthTotals.saleTotal,
              salary: monthTotals.salary,
              transport: monthTotals.transport,
              commissionPurchase: monthTotals.commissionPurchase,
              commissionSale: monthTotals.commissionSale,
            });
          }
        });
      });
    });

    // Add grand totals row
    worksheet.addRow({
      center: "TỔNG CỘNG",
      month: "",
      purchaseAmount: grandTotals.purchaseAmount,
      purchaseTotal: grandTotals.purchaseTotal,
      saleAmount: grandTotals.saleAmount,
      saleTotal: grandTotals.saleTotal,
      salary: grandTotals.salary,
      transport: grandTotals.transport,
      commissionPurchase: grandTotals.commissionPurchase,
      commissionSale: grandTotals.commissionSale,
    });

    // Style the grand totals row
    const lastRow = worksheet.lastRow;
    lastRow.font = { bold: true };
    lastRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" }, // Yellow background
    };

    // Set response headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=tong_hop_tat_ca_tram.xlsx"
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    res.status(500).json({ message: "Lỗi khi xuất file Excel" });
  }
};

// Helper function to calculate month totals (same as frontend)
function calculateMonthTotals(entries) {
  const totals = {
    purchaseAmount: 0,
    purchaseTotal: 0,
    saleAmount: 0,
    saleTotal: 0,
    transport: 0,
    commissionPurchase: 0,
    commissionSale: 0,
  };

  entries.forEach((entry) => {
    totals.purchaseAmount += entry.purchaseContract?.amount || 0;
    totals.purchaseTotal += entry.purchaseContract?.totalCost || 0;
    totals.saleAmount += entry.saleContract?.amount || 0;
    totals.saleTotal += entry.saleContract?.totalCost || 0;
    totals.transport += entry.transportCost || 0;
    totals.commissionPurchase += entry.commissionBonus?.purchase || 0;
    totals.commissionSale += entry.commissionBonus?.sale || 0;
  });

  return totals;
}

exports.createCenter = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { name, category = "Mua bán khí" } = req.body; // Add category with default

  const currentYear = new Date().getFullYear();
  const months = [
    "Tháng Một",
    "Tháng Hai",
    "Tháng Ba",
    "Tháng Tư",
    "Tháng Năm",
    "Tháng Sáu",
    "Tháng Bảy",
    "Tháng Tám",
    "Tháng Chín",
    "Tháng Mười",
    "Tháng Mười Một",
    "Tháng Mười Hai",
  ].map((month) => ({ name: month, entries: [] }));

  const center = new Center({
    name,
    category,
    years: [{ year: currentYear, months }],
  });

  try {
    const newCenter = await center.save();
    res.status(201).json(newCenter);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.addMonthEntry = async (req, res) => {
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
        "Tháng Một",
        "Tháng Hai",
        "Tháng Ba",
        "Tháng Tư",
        "Tháng Năm",
        "Tháng Sáu",
        "Tháng Bảy",
        "Tháng Tám",
        "Tháng Chín",
        "Tháng Mười",
        "Tháng Mười Một",
        "Tháng Mười Hai",
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

    month.entries.push(entryData);
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCenter = async (req, res) => {
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

exports.addYear = async (req, res) => {
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
      "Tháng Một",
      "Tháng Hai",
      "Tháng Ba",
      "Tháng Tư",
      "Tháng Năm",
      "Tháng Sáu",
      "Tháng Bảy",
      "Tháng Tám",
      "Tháng Chín",
      "Tháng Mười",
      "Tháng Mười Một",
      "Tháng Mười Hai",
    ].map((month) => ({ name: month, entries: [] }));

    center.years.push({ year, months });
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateYear = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { centerId, year } = req.params;
  const { newYear } = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    const yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      return res.status(404).json({ message: "Year not found" });
    }

    // Check if new year already exists
    if (center.years.some((y) => y.year === newYear)) {
      return res.status(400).json({ message: "Year already exists" });
    }

    // Update the year
    yearData.year = newYear;
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.reorderYears = async (req, res) => {
  try {
    if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
    }
    const { centerId } = req.params;
    const { fromIndex, toIndex } = req.body;

    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    // Reorder the years array
    const [movedYear] = center.years.splice(fromIndex, 1);
    center.years.splice(toIndex, 0, movedYear);

    await center.save();
    res.json(center);
  } catch (error) {
    console.error("Error reordering years:", error);
    res.status(500).json({ message: "Error reordering years" });
  }
};

exports.deleteMonthEntry = async (req, res) => {
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

exports.updateMonthEntry = async (req, res) => {
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

    month.entries[entryIndex] = entryData;
    await center.save();
    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateCenter = async (req, res) => {
  if (!["superAdmin", "director", "deputyDirector"].includes(req.user.role)) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  try {
    const { category } = req.body;
    const center = await Center.findByIdAndUpdate(
      req.params.id,
      { category },
      { new: true, runValidators: true }
    );

    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    res.json(center);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
