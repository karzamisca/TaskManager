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
    const {
      name,
      description,
      unit,
      amount,
      unitPrice,
      vat,
      deliveryDate,
      note,
    } = req.body;
    const totalPrice = amount * unitPrice;
    const vatValue = totalPrice * (vat / 100);
    const totalPriceAfterVat = totalPrice + totalPrice * (vat / 100);
    const submittedBy = req.user.id; // Use the current user's ID as the submitter
    const tag = `${req.user.id}-${req.user.department}-${moment()
      .tz("Asia/Bangkok")
      .format("DD-MM-YYYY HH:mm:ss")}`;

    const entry = new Entry({
      tag,
      name,
      description,
      unit,
      amount,
      unitPrice,
      totalPrice,
      vat,
      vatValue,
      totalPriceAfterVat,
      deliveryDate,
      note,
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
      return res.status(403).json({
        error:
          "Truy cập bị từ chối. Bạn không có quyền xác nhận đã thanh toán./Access denied.You do not have permission to approve payment.",
      });
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
    res.json({
      message: "Xác nhận thanh toán thành công/Payment approved successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi xác nhận dữ liệu/Error approving entry: " + err.message,
    });
  }
};

exports.approveReceiveEntry = async (req, res) => {
  try {
    const entryId = req.params.id;

    if (req.user.role !== "approver") {
      return res.status(403).json({
        error:
          "Truy cập bị từ chối. Bạn không có quyền xác nhận đã nhận hàng./Access denied.You do not have permission to confirm received",
      });
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
    res.json({
      message:
        "Xác nhận đã nhận hàng thành công/Confirmed received successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi xác nhận dữ liệu/Error approving entry: " + err.message,
    });
  }
};

// Delete an entry by ID
exports.deleteEntry = async (req, res) => {
  try {
    if (req.user.role !== "approver") {
      return res.status(404).json({
        error:
          "Truy cập bị từ chối. Bạn không có quyền xóa tài liệu./Access denied. You don't have permission to delete document.",
      });
    }
    const entryId = req.params.id;
    await Entry.findByIdAndDelete(entryId);
    res.json({
      message: "Dữ liệu đã xóa thành công/Entry deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi xóa dữ liệu/Error deleting entry: " + err.message });
  }
};

// Export all entries to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const entries = await Entry.find().populate(
      "submittedBy",
      "username department"
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Entries");

    // Define all columns
    worksheet.columns = [
      { header: "Tag", key: "tag", width: 20 },
      { header: "Name", key: "name", width: 20 },
      { header: "Description", key: "description", width: 30 },
      { header: "Unit", key: "unit", width: 15 },
      { header: "Amount", key: "amount", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 15 },
      { header: "Total Price", key: "totalPrice", width: 15 },
      { header: "VAT (%)", key: "vat", width: 10 },
      { header: "VAT Value", key: "vatValue", width: 10 },
      { header: "Total Price After VAT", key: "totalPriceAfterVat", width: 20 },
      { header: "Delivery Date", key: "deliveryDate", width: 15 },
      { header: "Note", key: "note", width: 30 },
      { header: "Entry Date", key: "entryDate", width: 20 },
      { header: "Submitted By", key: "submittedBy", width: 30 },
      { header: "Approval Payment", key: "approvalPayment", width: 15 },
      { header: "Approved Payment By", key: "approvedPaymentBy", width: 30 },
      {
        header: "Approval Payment Date",
        key: "approvalPaymentDate",
        width: 20,
      },
      { header: "Approval Receive", key: "approvalReceive", width: 15 },
      { header: "Approved Receive By", key: "approvedReceiveBy", width: 30 },
      {
        header: "Approval Receive Date",
        key: "approvalReceiveDate",
        width: 20,
      },
    ];

    // Add rows
    entries.forEach((entry) => {
      worksheet.addRow({
        tag: entry.tag,
        name: entry.name,
        description: entry.description,
        unit: entry.unit,
        amount: entry.amount,
        unitPrice: entry.unitPrice,
        totalPrice: entry.totalPrice,
        vat: entry.vat,
        vatValue: entry.vatValue,
        totalPriceAfterVat: entry.totalPriceAfterVat,
        deliveryDate: entry.deliveryDate,
        note: entry.note,
        entryDate: entry.entryDate,
        submittedBy: `${entry.submittedBy.username} (${entry.submittedBy.department})`,
        approvalPayment: entry.approvalPayment ? "Yes" : "No",
        approvedPaymentBy: entry.approvedPaymentBy
          ? `${entry.approvedPaymentBy.username} (${entry.approvedPaymentBy.department})`
          : "",
        approvalPaymentDate: entry.approvalPaymentDate || "",
        approvalReceive: entry.approvalReceive ? "Yes" : "No",
        approvedReceiveBy: entry.approvedReceiveBy
          ? `${entry.approvedReceiveBy.username} (${entry.approvedReceiveBy.department})`
          : "",
        approvalReceiveDate: entry.approvalReceiveDate || "",
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

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      // Start from row 2 to skip headers
      const row = worksheet.getRow(rowNumber);

      const entry = {
        tag: `${req.user.id}-${req.user.department}-${moment()
          .tz("Asia/Bangkok")
          .format("DD-MM-YYYY HH:mm:ss")}`,
        name: row.getCell(2).value,
        description: row.getCell(3).value,
        unit: row.getCell(4).value,
        amount: row.getCell(5).value,
        unitPrice: row.getCell(6).value,
        totalPrice: row.getCell(7).value,
        vat: row.getCell(8).value,
        vatValue: row.getCell(9).value,
        totalPriceAfterVat: row.getCell(10).value,
        deliveryDate: row.getCell(11).value,
        note: row.getCell(12).value,
        entryDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),

        // Automatically set to the importing user
        submittedBy: req.user.id,

        // Set approval fields to default
        approvalPayment: false,
        approvedPaymentBy: { username: "", department: "" },
        approvalPaymentDate: null,
        approvalReceive: false,
        approvedReceiveBy: { username: "", department: "" },
        approvalReceiveDate: null,
      };

      rows.push(entry);
    }

    // Insert entries into the database
    await Entry.insertMany(rows);

    // Delete the uploaded file after processing
    fs.unlinkSync(filePath);

    res.redirect("/entry"); // Redirect back to the main page after importing
  } catch (err) {
    res.status(500).send("Error importing from Excel: " + err.message);
  }
};
