// controllers/entryController.js
const Entry = require("../models/Entry");
const moment = require("moment-timezone");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

// Serve the index.html file for the root route
exports.getFormAndEntries = (req, res) => {
  if (req.user.role !== "approver") {
    return res
      .status(404)
      .send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
  }
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
      paid,
      deliveryDate,
      note,
    } = req.body;
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
      vat,
      paid,
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

//For updating entry
exports.getTags = async (req, res) => {
  try {
    const tags = await Entry.find({}, "tag").exec(); // Retrieve only the 'tag' field
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: "Error fetching tags: " + err.message });
  }
};
exports.updateEntry = async (req, res) => {
  try {
    const { tag, ...updatedFields } = req.body;

    if (!tag) {
      return res
        .status(400)
        .json({ error: "Tag is required for updating the entry." });
    }

    const entry = await Entry.findOne({ tag });

    if (!entry) {
      return res.status(404).json({ error: "Entry not found." });
    }

    // Overwrite only the provided fields that are not empty or undefined
    Object.keys(updatedFields).forEach((key) => {
      if (
        updatedFields[key] !== undefined &&
        updatedFields[key] !== null &&
        updatedFields[key] !== ""
      ) {
        entry[key] = updatedFields[key];
      }
    });

    await entry.save();

    res.redirect("/entry"); // Redirect back to the main entry page
  } catch (err) {
    res.status(500).json({ error: "Error updating entry: " + err.message });
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
      { header: "Paid", key: "paid", width: 10 },
      { header: "Delivery Date", key: "deliveryDate", width: 15 },
      { header: "Note", key: "note", width: 30 },
      { header: "Entry Date", key: "entryDate", width: 20 },
      { header: "Submitted By", key: "submittedBy", width: 30 },
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
        totalPrice: entry.amount * entry.unitPrice,
        vat: entry.vat,
        vatValue: entry.amount * entry.unitPrice * (entry.vat / 100),
        totalPriceAfterVat:
          entry.amount * entry.unitPrice +
          entry.amount * entry.unitPrice * (entry.vat / 100),
        paid: entry.paid,
        deliveryDate: entry.deliveryDate,
        note: entry.note,
        entryDate: entry.entryDate,
        submittedBy: `${entry.submittedBy.username} (${entry.submittedBy.department})`,
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

exports.importFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const filePath = path.join(__dirname, "..", req.file.path);
    const workbook = new ExcelJS.Workbook();

    // Use streaming to handle large files
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet("Entries");
    const rows = [];

    // Process rows one at a time
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber >= 2) {
        // Skip the header row
        const entry = {
          tag: `${req.user.id}-${req.user.department}-${moment()
            .tz("Asia/Bangkok")
            .format("DD-MM-YYYY HH:mm:ss")}`,
          name: row.getCell(2).value ?? "",
          description: row.getCell(3).value ?? "",
          unit: row.getCell(4).value ?? "",
          amount: row.getCell(5).value ?? 0,
          unitPrice: row.getCell(6).value ?? 0,
          totalPrice: 0,
          vat: row.getCell(8).value ?? 0,
          vatValue: 0,
          totalPriceAfterVat: 0,
          paid: row.getCell(11).value ?? 0,
          deliveryDate:
            row.getCell(12).value ??
            moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
          note: row.getCell(13).value ?? "",
          entryDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),

          // Automatically set to the importing user
          submittedBy: req.user.id,

          // Set approval fields to default
          approvalReceive: false,
          approvedReceiveBy: { username: "", department: "" },
          approvalReceiveDate: null,
        };

        rows.push(entry);
      }
    });

    // Batch insert in chunks to reduce memory consumption
    const batchSize = 500; // Adjust the batch size as needed
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await Entry.insertMany(batch);
    }

    // Delete the uploaded file after processing
    fs.unlinkSync(filePath);

    res.redirect("/entry"); // Redirect back to the main page after importing
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).send("Error importing from Excel: " + err.message);
  }
};
