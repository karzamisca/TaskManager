//controllers/financeBankController.js
const ExcelJS = require("exceljs");
const Center = require("../models/FinanceBank");

exports.getAllCenters = async (req, res) => {
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

    const centers = await Center.find();
    res.json(centers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createCenter = async (req, res) => {
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
    return res
      .status(403)
      .send("Truy cập bị từ chối. Bạn không có quyền truy cập");
  }

  const { name } = req.body;

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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
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

    // Set default values if not provided
    const newEntry = {
      inflows: entryData.inflows || 0,
      outflows: entryData.outflows || 0,
      balance: 0, // Will be calculated by pre-save hook
      treasurerNote: entryData.treasurerNote || "",
      bankNote: entryData.bankNote || "",
      generalNote: entryData.generalNote || "",
    };

    month.entries.push(entryData);
    await center.save();
    res.json(center);
  } catch (err) {
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
      ].includes(req.user.role)
    ) {
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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
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
  if (
    !["superAdmin", "director", "deputyDirector", "captainOfFinance"].includes(
      req.user.role
    )
  ) {
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

exports.exportToExcel = async (req, res) => {
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

    const { centerId } = req.params;
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finance System";
    workbook.created = new Date();

    // Add each year as a separate worksheet
    center.years.forEach((yearData) => {
      const worksheet = workbook.addWorksheet(`Năm ${yearData.year}`);

      // Add header row
      worksheet.addRow([
        "Tháng",
        "Mục",
        "Thu",
        "Chi",
        "Số dư",
        "Ngày",
        "Nội dung thủ quỹ",
        "Nội dung ngân hàng",
        "Ghi chú",
      ]);

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { horizontal: "center" };

      // Add data for each month
      yearData.months.forEach((month) => {
        if (month.entries.length === 0) {
          worksheet.addRow([month.name, "-", "", "", "", "", "", "", ""]);
        } else {
          // Add month total row
          const totals = month.entries.reduce(
            (acc, entry) => {
              acc.inflows += entry.inflows || 0;
              acc.outflows += entry.outflows || 0;
              return acc;
            },
            { inflows: 0, outflows: 0 }
          );

          const totalRow = worksheet.addRow([
            month.name,
            `Tổng ${month.name}`,
            totals.inflows,
            totals.outflows,
            totals.inflows - totals.outflows,
            "",
            "",
            "",
            "",
          ]);

          // Style total row
          totalRow.font = { bold: true };
          totalRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFF00" }, // Yellow background
          };

          // Add individual entries
          month.entries.forEach((entry, index) => {
            worksheet.addRow([
              index === 0 ? month.name : "",
              index + 1,
              entry.inflows || 0,
              entry.outflows || 0,
              entry.balance || 0,
              entry.day || "",
              entry.treasurerNote || "",
              entry.bankNote || "",
              entry.generalNote || "",
            ]);
          });
        }
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        column.width = 15;
      });
    });

    // Set response headers
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${center.name.replace(
        /\s+/g,
        "_"
      )}_finance_data.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting to Excel:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.importFromExcel = async (req, res) => {
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

    const { centerId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({ message: "Center not found" });
    }

    // Create workbook from buffer
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const updatedCenter = JSON.parse(JSON.stringify(center)); // Deep clone

    // Process each worksheet (year)
    workbook.eachSheet((worksheet, sheetId) => {
      // Extract year from sheet name
      const yearMatch = worksheet.name.match(/\d+/);
      if (!yearMatch) return;
      const year = parseInt(yearMatch[0]);

      // Find or create year in center data
      let yearData = updatedCenter.years.find((y) => y.year === year);
      if (!yearData) {
        yearData = {
          year,
          months: months.map((name) => ({ name, entries: [] })),
        };
        updatedCenter.years.push(yearData);
      }

      // Process data rows
      let currentMonth = null;
      let entryIndex = 0;

      worksheet.eachRow((row, rowNumber) => {
        // Skip header row
        if (rowNumber === 1) return;

        const [
          monthCell,
          itemCell,
          inflows,
          outflows,
          balance,
          day,
          treasurerNote,
          bankNote,
          generalNote,
        ] = row.values.slice(1); // Skip first empty value

        // Skip empty rows
        if (!monthCell && !itemCell) return;

        // If month cell has value, it's either a month header or first entry of month
        if (monthCell) {
          const monthName = monthCell.toString().replace("Tổng ", "").trim();
          currentMonth = yearData.months.find((m) => m.name === monthName);
          entryIndex = 0;
        }

        if (!currentMonth) return;

        // If item cell is numeric, it's an entry row
        if (!isNaN(itemCell)) {
          const entry = {
            day: day ? day.toString() : "",
            inflows: Number(inflows) || 0,
            outflows: Number(outflows) || 0,
            balance: Number(balance) || 0,
            treasurerNote: treasurerNote ? treasurerNote.toString() : "",
            bankNote: bankNote ? bankNote.toString() : "",
            generalNote: generalNote ? generalNote.toString() : "",
          };

          // Update existing entry or add new one
          if (entryIndex < currentMonth.entries.length) {
            currentMonth.entries[entryIndex] = entry;
          } else {
            currentMonth.entries.push(entry);
          }
          entryIndex++;
        }
      });
    });

    // Save the updated center
    const savedCenter = await Center.findByIdAndUpdate(
      centerId,
      updatedCenter,
      { new: true }
    );
    res.json(savedCenter);
  } catch (err) {
    console.error("Error importing from Excel:", err);
    res.status(500).json({ message: err.message });
  }
};
