// controllers/entryController.js
const Entry = require("../models/Entry");
const moment = require("moment-timezone");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

// Serve the index.html file for the root route
exports.getFormAndEntries = (req, res) => {
  res.sendFile("index.html", { root: "./views/entries" });
};

// Serve all entries as JSON
exports.getAllEntries = async (req, res) => {
  try {
    const entries = await Entry.find()
      .populate("submittedBy", "username department") // Populate name and department from the User model
      .exec();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Error fetching entries: " + err.message });
  }
};

// Create a new entry
exports.createEntry = async (req, res) => {
  try {
    const { name, description, unit, amount, unitPrice, vat, deliveryDate } =
      req.body;
    const totalPrice = amount * unitPrice;
    const totalPriceAfterVat = totalPrice + totalPrice * (vat / 100);
    const submittedBy = req.user.id; // Use the current user's ID as the submitter

    const entry = new Entry({
      name,
      description,
      unit,
      amount,
      unitPrice,
      totalPrice,
      vat,
      totalPriceAfterVat,
      deliveryDate,
      entryDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
      submittedBy, // Store the submitter's ID
    });

    await entry.save();
    res.redirect("/entry"); // Redirect back to the main page after creating the entry
  } catch (err) {
    res.status(500).send("Error creating entry: " + err.message);
  }
};

exports.approvePaymentEntry = async (req, res) => {
  try {
    const entryId = req.params.id;

    if (req.user.role !== "approver") {
      return res
        .status(403)
        .json({ error: "You do not have permission to approve entries" });
    }

    const entry = await Entry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    // Fetch the full user data to ensure username and department are accessible
    const approver = await User.findById(req.user.id);
    if (!approver) {
      return res.status(404).json({ error: "Approver not found" });
    }

    entry.approvalPayment = true;
    entry.approvedPaymentBy = {
      username: approver.username,
      department: approver.department,
    };
    entry.approvalPaymentDate = moment()
      .tz("Asia/Bangkok")
      .format("DD-MM-YYYY HH:mm:ss");

    await entry.save();
    res.json({ message: "Entry approved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error approving entry: " + err.message });
  }
};

exports.approveReceiveEntry = async (req, res) => {
  try {
    const entryId = req.params.id;

    if (req.user.role !== "approver") {
      return res
        .status(403)
        .json({ error: "You do not have permission to approve entries" });
    }

    const entry = await Entry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    // Fetch the full user data to ensure username and department are accessible
    const approver = await User.findById(req.user.id);
    if (!approver) {
      return res.status(404).json({ error: "Approver not found" });
    }

    entry.approvalReceive = true;
    entry.approvedReceiveBy = {
      username: approver.username,
      department: approver.department,
    };
    entry.approvalReceiveDate = moment()
      .tz("Asia/Bangkok")
      .format("DD-MM-YYYY HH:mm:ss");

    await entry.save();
    res.json({ message: "Entry approved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error approving entry: " + err.message });
  }
};

// Delete an entry by ID
exports.deleteEntry = async (req, res) => {
  try {
    const entryId = req.params.id;
    await Entry.findByIdAndDelete(entryId);
    res.json({ message: "Entry deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting entry: " + err.message });
  }
};

// Export all entries to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const entries = await Entry.find();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Entries");

    // Define columns
    worksheet.columns = [
      { header: "Description", key: "description", width: 30 },
      { header: "Unit", key: "unit", width: 15 },
      { header: "Amount", key: "amount", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 15 },
      { header: "Total Price", key: "totalPrice", width: 15 },
      { header: "VAT (%)", key: "vat", width: 10 },
      { header: "Delivery Date", key: "deliveryDate", width: 15 },
      { header: "Entry Date", key: "entryDate", width: 20 },
    ];

    // Add rows
    entries.forEach((entry) => {
      worksheet.addRow({
        description: entry.description,
        unit: entry.unit,
        amount: entry.amount,
        unitPrice: entry.unitPrice,
        totalPrice: entry.totalPrice,
        vat: entry.vat,
        deliveryDate: moment(entry.deliveryDate).format("YYYY-MM-DD"),
        entryDate: entry.entryDate, // Already formatted in the backend
      });
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "entries.xlsx"
    );

    // Write to buffer and send
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send("Error exporting to Excel: " + err.message);
  }
};

// Import entries from Excel
exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const filePath = path.join(__dirname, "..", req.file.path);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet("Entries");

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const entry = {
        description: row.getCell(1).value,
        unit: row.getCell(2).value,
        amount: row.getCell(3).value,
        unitPrice: row.getCell(4).value,
        totalPrice: row.getCell(5).value,
        vat: row.getCell(6).value,
        deliveryDate: moment(row.getCell(7).value, "YYYY-MM-DD").toDate(),
        entryDate: row.getCell(8).value, // Assuming it's already in desired format
      };

      rows.push(entry);
    });

    // Insert entries into the database
    await Entry.insertMany(rows);

    // Delete the uploaded file after processing
    fs.unlinkSync(filePath);

    res.redirect("/entry"); // Redirect back to the main page after importing
  } catch (err) {
    res.status(500).send("Error importing from Excel: " + err.message);
  }
};
