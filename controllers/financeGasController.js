// controllers/financeGasController.js
const Center = require("../models/CostCenter");
const ExcelJS = require("exceljs");
const FinanceGasLog = require("../models/FinanceGasLog");

// Helper function to get client IP
const getClientIp = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

// Helper function to log actions
const logAction = async (
  req,
  res,
  action,
  costCenterId = null,
  entryId = null,
  requestData = null,
  additionalData = {}
) => {
  const logData = {
    userId: req.user.id,
    username: req.user.username,
    userRole: req.user.role,
    userDepartment: req.user.department,
    action: action,
    controller: "financeGasController",
    costCenterId: costCenterId,
    entryId: entryId,
    entryType: "gas",
    requestData: requestData,
    responseStatus: res.statusCode,
    responseMessage: res.statusMessage || getResponseMessage(res),
    ipAddress: getClientIp(req),
    userAgent: req.get("User-Agent"),
    ...additionalData,
  };

  await FinanceGasLog.logAction(logData);
};

// Helper to extract response message
const getResponseMessage = (res) => {
  return "Operation completed";
};

exports.getFinanceGasPage = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
    ) {
      await logAction(req, res, "GET_FINANCE_GAS_PAGE", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua bán khí",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    await logAction(req, res, "GET_FINANCE_GAS_PAGE");
    res.sendFile("financeGas.html", {
      root: "./views/financePages/financeGas",
    });
  } catch (error) {
    await logAction(req, res, "GET_FINANCE_GAS_PAGE", null, null, {
      error: error.message,
    });
    console.error("Error serving the user main page:", error);
    res.send("Server error");
  }
};

exports.getAllCenters = async (req, res) => {
  try {
    const centers = await Center.find().sort({ name: 1 }); // 1 = ascending A-Z

    await logAction(req, res, "GET_ALL_CENTERS_GAS", null, null, null, {
      centersCount: centers.length,
    });

    res.json(centers);
  } catch (err) {
    await logAction(req, res, "GET_ALL_CENTERS_GAS", null, null, {
      error: err.message,
    });
    res.status(500).json({ message: err.message });
  }
};

exports.exportAllCentersSummaryToExcel = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
        "submitterOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
    ) {
      await logAction(req, res, "EXPORT_GAS_SUMMARY_EXCEL", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua bán khí",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

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

    let totalRows = 0;

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
            totalRows++;
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

    // Log the export action
    await logAction(req, res, "EXPORT_GAS_SUMMARY_EXCEL", null, null, null, {
      exportInfo: {
        fileName: "tong_hop_tat_ca_tram.xlsx",
        recordCount: totalRows,
        totalAmounts: grandTotals,
        centersIncluded: centers.length,
      },
    });

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    await logAction(req, res, "EXPORT_GAS_SUMMARY_EXCEL", null, null, {
      error: error.message,
    });
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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
  ) {
    await logAction(req, res, "CREATE_CENTER_GAS", null, null, {
      error: "Permission denied",
      requiredPermission: "Nhập liệu tài chính mua bán khí",
    });
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  const { name, category = "Mua bán khí" } = req.body;

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

    await logAction(req, res, "CREATE_CENTER_GAS", newCenter._id, null, {
      centerData: {
        name: name,
        category: category,
        initialYear: currentYear,
      },
    });

    res.status(201).json(newCenter);
  } catch (err) {
    await logAction(req, res, "CREATE_CENTER_GAS", null, null, {
      error: err.message,
      centerData: { name, category },
    });
    res.status(400).json({ message: err.message });
  }
};

exports.addMonthEntry = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
  ) {
    await logAction(req, res, "ADD_MONTH_ENTRY_GAS", null, null, {
      error: "Permission denied",
      requiredPermission: "Nhập liệu tài chính mua bán khí",
    });
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  const { centerId, year, monthName } = req.params;
  const entryData = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "ADD_MONTH_ENTRY_GAS", centerId, null, {
        error: "Center not found",
        year: year,
        monthName: monthName,
      });
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
      await logAction(req, res, "ADD_MONTH_ENTRY_GAS", centerId, null, {
        error: "Month not found",
        year: year,
        monthName: monthName,
      });
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

    const newEntryIndex = month.entries.length - 1;

    await logAction(
      req,
      res,
      "ADD_MONTH_ENTRY_GAS",
      centerId,
      null,
      {
        entryData: {
          purchaseContract: entryData.purchaseContract,
          saleContract: entryData.saleContract,
          transportCost: entryData.transportCost,
          commissionBonus: entryData.commissionBonus,
        },
      },
      {
        year: parseInt(year),
        monthName: monthName,
        entryIndex: newEntryIndex,
      }
    );

    res.json(center);
  } catch (err) {
    await logAction(
      req,
      res,
      "ADD_MONTH_ENTRY_GAS",
      req.params.centerId,
      null,
      {
        error: err.message,
        year: req.params.year,
        monthName: req.params.monthName,
      }
    );
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCenter = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
    ) {
      await logAction(req, res, "DELETE_CENTER_GAS", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua bán khí",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const center = await Center.findById(req.params.id);
    if (!center) {
      await logAction(req, res, "DELETE_CENTER_GAS", req.params.id, null, {
        error: "Center not found",
      });
      return res.status(404).json({ message: "Center not found" });
    }

    await Center.findByIdAndDelete(req.params.id);

    await logAction(req, res, "DELETE_CENTER_GAS", req.params.id, null, {
      deletedCenter: {
        name: center.name,
        category: center.category,
      },
    });

    res.json({ message: "Center deleted" });
  } catch (err) {
    await logAction(req, res, "DELETE_CENTER_GAS", req.params.id, null, {
      error: err.message,
    });
    res.status(500).json({ message: err.message });
  }
};

exports.addYear = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
  ) {
    await logAction(req, res, "ADD_YEAR_GAS", null, null, {
      error: "Permission denied",
      requiredPermission: "Nhập liệu tài chính mua bán khí",
    });
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  const { centerId } = req.params;
  const { year } = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "ADD_YEAR_GAS", centerId, null, {
        error: "Center not found",
        year: year,
      });
      return res.status(404).json({ message: "Center not found" });
    }

    // Check if year already exists
    if (center.years.some((y) => y.year === year)) {
      await logAction(req, res, "ADD_YEAR_GAS", centerId, null, {
        error: "Year already exists",
        year: year,
      });
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

    await logAction(
      req,
      res,
      "ADD_YEAR_GAS",
      centerId,
      null,
      {
        yearAdded: year,
      },
      {
        year: year,
      }
    );

    res.json(center);
  } catch (err) {
    await logAction(req, res, "ADD_YEAR_GAS", req.params.centerId, null, {
      error: err.message,
      year: req.body.year,
    });
    res.status(400).json({ message: err.message });
  }
};

exports.updateYear = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
  ) {
    await logAction(req, res, "UPDATE_YEAR_GAS", null, null, {
      error: "Permission denied",
      requiredPermission: "Nhập liệu tài chính mua bán khí",
    });
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  const { centerId, year } = req.params;
  const { newYear } = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "UPDATE_YEAR_GAS", centerId, null, {
        error: "Center not found",
        oldYear: year,
        newYear: newYear,
      });
      return res.status(404).json({ message: "Center not found" });
    }

    const yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      await logAction(req, res, "UPDATE_YEAR_GAS", centerId, null, {
        error: "Year not found",
        oldYear: year,
        newYear: newYear,
      });
      return res.status(404).json({ message: "Year not found" });
    }

    // Check if new year already exists
    if (center.years.some((y) => y.year === newYear)) {
      await logAction(req, res, "UPDATE_YEAR_GAS", centerId, null, {
        error: "Year already exists",
        oldYear: year,
        newYear: newYear,
      });
      return res.status(400).json({ message: "Year already exists" });
    }

    // Store old year for logging
    const oldYear = yearData.year;

    // Update the year
    yearData.year = newYear;
    await center.save();

    await logAction(
      req,
      res,
      "UPDATE_YEAR_GAS",
      centerId,
      null,
      {
        yearUpdate: {
          from: oldYear,
          to: newYear,
        },
      },
      {
        year: newYear,
      }
    );

    res.json(center);
  } catch (err) {
    await logAction(req, res, "UPDATE_YEAR_GAS", req.params.centerId, null, {
      error: err.message,
      oldYear: req.params.year,
      newYear: req.body.newYear,
    });
    res.status(400).json({ message: err.message });
  }
};

exports.reorderYears = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
    ) {
      await logAction(req, res, "REORDER_YEARS_GAS", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua bán khí",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { centerId } = req.params;
    const { fromIndex, toIndex } = req.body;

    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "REORDER_YEARS_GAS", centerId, null, {
        error: "Center not found",
        reorderData: { fromIndex, toIndex },
      });
      return res.status(404).json({ message: "Center not found" });
    }

    // Store original order for logging
    const originalOrder = center.years.map((y) => y.year);

    // Reorder the years array
    const [movedYear] = center.years.splice(fromIndex, 1);
    center.years.splice(toIndex, 0, movedYear);

    await center.save();

    const newOrder = center.years.map((y) => y.year);

    await logAction(req, res, "REORDER_YEARS_GAS", centerId, null, {
      reorderData: {
        fromIndex: fromIndex,
        toIndex: toIndex,
        movedYear: movedYear.year,
        originalOrder: originalOrder,
        newOrder: newOrder,
      },
    });

    res.json(center);
  } catch (error) {
    await logAction(req, res, "REORDER_YEARS_GAS", req.params.centerId, null, {
      error: error.message,
      reorderData: req.body,
    });
    console.error("Error reordering years:", error);
    res.status(500).json({ message: "Error reordering years" });
  }
};

exports.deleteMonthEntry = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
  ) {
    await logAction(req, res, "DELETE_MONTH_ENTRY_GAS", null, null, {
      error: "Permission denied",
      requiredPermission: "Nhập liệu tài chính mua bán khí",
    });
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  const { centerId, year, monthName, entryIndex } = req.params;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "DELETE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Center not found",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
      });
      return res.status(404).json({ message: "Center not found" });
    }

    const yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      await logAction(req, res, "DELETE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Year not found",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
      });
      return res.status(404).json({ message: "Year not found" });
    }

    const month = yearData.months.find((m) => m.name === monthName);
    if (!month) {
      await logAction(req, res, "DELETE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Month not found",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
      });
      return res.status(404).json({ message: "Month not found" });
    }

    if (entryIndex < 0 || entryIndex >= month.entries.length) {
      await logAction(req, res, "DELETE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Entry index out of bounds",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
        availableEntries: month.entries.length,
      });
      return res.status(404).json({ message: "Entry index out of bounds" });
    }

    // Store deleted entry data for logging
    const deletedEntry = month.entries[entryIndex];

    month.entries.splice(entryIndex, 1);
    await center.save();

    await logAction(
      req,
      res,
      "DELETE_MONTH_ENTRY_GAS",
      centerId,
      null,
      {
        deletedEntry: deletedEntry,
      },
      {
        year: parseInt(year),
        monthName: monthName,
        entryIndex: parseInt(entryIndex),
      }
    );

    res.json(center);
  } catch (err) {
    await logAction(
      req,
      res,
      "DELETE_MONTH_ENTRY_GAS",
      req.params.centerId,
      null,
      {
        error: err.message,
        year: req.params.year,
        monthName: req.params.monthName,
        entryIndex: req.params.entryIndex,
      }
    );
    res.status(400).json({ message: err.message });
  }
};

exports.updateMonthEntry = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    ) &&
    !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
  ) {
    await logAction(req, res, "UPDATE_MONTH_ENTRY_GAS", null, null, {
      error: "Permission denied",
      requiredPermission: "Nhập liệu tài chính mua bán khí",
    });
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
  }

  const { centerId, year, monthName, entryIndex } = req.params;
  const entryData = req.body;

  try {
    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "UPDATE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Center not found",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
      });
      return res.status(404).json({ message: "Center not found" });
    }

    const yearData = center.years.find((y) => y.year === parseInt(year));
    if (!yearData) {
      await logAction(req, res, "UPDATE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Year not found",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
      });
      return res.status(404).json({ message: "Year not found" });
    }

    const month = yearData.months.find((m) => m.name === monthName);
    if (!month) {
      await logAction(req, res, "UPDATE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Month not found",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
      });
      return res.status(404).json({ message: "Month not found" });
    }

    if (entryIndex < 0 || entryIndex >= month.entries.length) {
      await logAction(req, res, "UPDATE_MONTH_ENTRY_GAS", centerId, null, {
        error: "Entry index out of bounds",
        year: year,
        monthName: monthName,
        entryIndex: entryIndex,
        availableEntries: month.entries.length,
      });
      return res.status(404).json({ message: "Entry index out of bounds" });
    }

    // Store old values for logging
    const oldEntry = { ...month.entries[entryIndex] };

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

    await logAction(
      req,
      res,
      "UPDATE_MONTH_ENTRY_GAS",
      centerId,
      null,
      {
        updateData: {
          oldEntry: oldEntry,
          newEntry: entryData,
        },
      },
      {
        year: parseInt(year),
        monthName: monthName,
        entryIndex: parseInt(entryIndex),
      }
    );

    res.json(center);
  } catch (err) {
    await logAction(
      req,
      res,
      "UPDATE_MONTH_ENTRY_GAS",
      req.params.centerId,
      null,
      {
        error: err.message,
        year: req.params.year,
        monthName: req.params.monthName,
        entryIndex: req.params.entryIndex,
      }
    );
    res.status(400).json({ message: err.message });
  }
};

exports.updateCenter = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "captainOfFinance",
      ].includes(req.user.role) &&
      !req.user.permissions?.includes("Nhập liệu tài chính mua bán khí")
    ) {
      await logAction(req, res, "UPDATE_CENTER_GAS", null, null, {
        error: "Permission denied",
        requiredPermission: "Nhập liệu tài chính mua bán khí",
      });
      return res
        .status(403)
        .send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const { category } = req.body;
    const centerId = req.params.id;

    const center = await Center.findById(centerId);
    if (!center) {
      await logAction(req, res, "UPDATE_CENTER_GAS", centerId, null, {
        error: "Center not found",
        updateData: { category },
      });
      return res.status(404).json({ message: "Center not found" });
    }

    // Store old category for logging
    const oldCategory = center.category;

    const updatedCenter = await Center.findByIdAndUpdate(
      centerId,
      { category },
      { new: true, runValidators: true }
    );

    await logAction(req, res, "UPDATE_CENTER_GAS", centerId, null, {
      updateData: {
        from: oldCategory,
        to: category,
      },
    });

    res.json(updatedCenter);
  } catch (err) {
    await logAction(req, res, "UPDATE_CENTER_GAS", req.params.id, null, {
      error: err.message,
      updateData: req.body,
    });
    res.status(400).json({ message: err.message });
  }
};
