// controllers/projectExpenseController.js
const ProjectExpense = require("../models/ProjectExpense");
const moment = require("moment-timezone");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Serve the index.html file for the root route
exports.getFormAndProjectExpense = (req, res) => {
  if (
    ![
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
      "headOfPurchasing",
      "captainOfPurchasing",
    ].includes(req.user.role)
  ) {
    return res
      .status(403)
      .send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
  }
  res.sendFile("projectExpense.html", {
    root: "./views/projectPages/projectExpense",
  });
};

// Serve all projectExpense as JSON
exports.getAllProjectExpense = async (req, res) => {
  try {
    const projectExpense = await ProjectExpense.find()
      .populate("submittedBy", "username department") // Populate name and department from the User model
      .exec();
    res.json(projectExpense);
  } catch (err) {
    res.send("Error fetching projectExpense: " + err.message);
  }
};

// Create a new projectExpense
exports.createProjectExpense = async (req, res) => {
  try {
    const {
      name,
      description,
      package,
      unit,
      amount,
      unitPrice,
      vat,
      paid,
      deliveryDate,
      note,
    } = req.body;
    const submittedBy = req.user.id; // Use the current user's ID as the submitter
    const randomString = generateRandomString(24);
    const tag = `${randomString}- ${req.user.id}- ${
      req.user.department
    }- ${moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss")}`;

    const projectExpense = new ProjectExpense({
      tag,
      name,
      description,
      package,
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

    await projectExpense.save();
    res.redirect("/projectExpense"); // Redirect back to the main page after creating the projectExpense
  } catch (err) {
    res.send("Error creating projectExpense: " + err.message);
  }
};

//For updating projectExpense
exports.getTags = async (req, res) => {
  try {
    const tags = await ProjectExpense.find({}, "tag").exec(); // Retrieve only the 'tag' field
    res.json(tags);
  } catch (err) {
    res.json({ error: "Error fetching tags: " + err.message });
  }
};
exports.updateProjectExpense = async (req, res) => {
  try {
    const { tag, ...updatedFields } = req.body;

    if (!tag) {
      return res
        .status(400)
        .json({ error: "Tag is required for updating the projectExpense." });
    }

    const projectExpense = await ProjectExpense.findOne({ tag });

    if (!projectExpense) {
      return res.json({ error: "ProjectExpense not found." });
    }

    // Overwrite only the provided fields that are not empty or undefined
    Object.keys(updatedFields).forEach((key) => {
      if (
        updatedFields[key] !== undefined &&
        updatedFields[key] !== null &&
        updatedFields[key] !== ""
      ) {
        projectExpense[key] = updatedFields[key];
      }
    });

    await projectExpense.save();

    res.redirect("/projectExpense"); // Redirect back to the main projectExpense page
  } catch (err) {
    res.send("Error updating projectExpense: " + err.message);
  }
};

exports.approveReceiveProjectExpense = async (req, res) => {
  try {
    const projectExpenseId = req.params.id;

    if (req.user.role !== "approver") {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền xác nhận đã nhận hàng./Access denied.You do not have permission to confirm received"
      );
    }

    const projectExpense = await ProjectExpense.findById(projectExpenseId);
    if (!projectExpense) {
      return res.json({ error: "ProjectExpense not found" });
    }

    // Fetch the full user data to ensure username and department are accessible
    const approver = await User.findById(req.user.id);
    if (!approver) {
      return res.send("Approver not found");
    }

    projectExpense.approvalReceive = true;
    projectExpense.approvedReceiveBy = {
      username: approver.username,
      department: approver.department,
    };
    projectExpense.approvalReceiveDate = moment()
      .tz("Asia/Bangkok")
      .format("DD-MM-YYYY HH:mm:ss");

    await projectExpense.save();
    res.send(
      "Xác nhận đã nhận hàng thành công/Confirmed received successfully"
    );
  } catch (err) {
    res.send(
      "Lỗi xác nhận dữ liệu/Error approving projectExpense: " + err.message
    );
  }
};

// Delete an projectExpense by ID
exports.deleteProjectExpense = async (req, res) => {
  try {
    if (req.user.role !== "approver") {
      return res.json({
        error:
          "Truy cập bị từ chối. Bạn không có quyền xóa tài liệu./Access denied. You don't have permission to delete document.",
      });
    }
    const projectExpenseId = req.params.id;
    await ProjectExpense.findByIdAndDelete(projectExpenseId);
    res.send("Dữ liệu đã xóa thành công/ProjectExpense deleted successfully");
  } catch (err) {
    res.send("Lỗi xóa dữ liệu/Error deleting projectExpense: " + err.message);
  }
};
exports.deleteMultipleProjectExpense = async (req, res) => {
  try {
    if (req.user.role !== "approver") {
      return res.json({
        error:
          "Truy cập bị từ chối. Bạn không có quyền xóa tài liệu./Access denied. You don't have permission to delete document.",
      });
    }
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "No projectExpense IDs provided for deletion." });
    }

    await ProjectExpense.deleteMany({ _id: { $in: ids } });
    res.send("Selected projectExpense deleted successfully.");
  } catch (err) {
    res.status(500).send("Error deleting projectExpense: " + err.message);
  }
};

// Export all projectExpense to Excel
exports.exportToExcel = async (req, res) => {
  try {
    const projectExpense = await ProjectExpense.find().populate(
      "submittedBy",
      "username department"
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("ProjectExpense");

    // Define all columns
    worksheet.columns = [
      { header: "Tag", key: "tag", width: 20 },
      { header: "Name", key: "name", width: 20 },
      { header: "Description", key: "description", width: 30 },
      { header: "Package", key: "package", width: 20 },
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
      { header: "ProjectExpense Date", key: "entryDate", width: 20 },
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
    projectExpense.forEach((projectExpense) => {
      worksheet.addRow({
        tag: projectExpense.tag,
        name: projectExpense.name,
        description: projectExpense.description,
        package: projectExpense.package,
        unit: projectExpense.unit,
        amount: projectExpense.amount,
        unitPrice: projectExpense.unitPrice,
        totalPrice: projectExpense.amount * projectExpense.unitPrice,
        vat: projectExpense.vat,
        vatValue:
          projectExpense.amount *
          projectExpense.unitPrice *
          (projectExpense.vat / 100),
        totalPriceAfterVat:
          projectExpense.amount * projectExpense.unitPrice +
          projectExpense.amount *
            projectExpense.unitPrice *
            (projectExpense.vat / 100),
        paid: projectExpense.paid,
        deliveryDate: projectExpense.deliveryDate,
        note: projectExpense.note,
        entryDate: projectExpense.entryDate,
        submittedBy: `${projectExpense.submittedBy.username} (${projectExpense.submittedBy.department})`,
        approvalReceive: projectExpense.approvalReceive ? "Yes" : "No",
        approvedReceiveBy: projectExpense.approvedReceiveBy
          ? `${projectExpense.approvedReceiveBy.username} ${projectExpense.approvedReceiveBy.department}`
          : "",
        approvalReceiveDate: projectExpense.approvalReceiveDate || "",
      });
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "projectExpense.xlsx"
    );

    // Write to buffer and send
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.send("Error exporting to Excel: " + err.message);
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

    const worksheet = workbook.getWorksheet("ProjectExpense");
    const rows = [];

    // Process rows one at a time
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber >= 2) {
        const randomString = generateRandomString(24);
        // Skip the header row
        const projectExpense = {
          tag: `${randomString}- ${req.user.id}- ${
            req.user.department
          }- ${moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss")}`,
          name: row.getCell(2).value ?? "",
          description: row.getCell(3).value ?? "",
          package: row.getCell(4).value ?? "",
          unit: row.getCell(5).value ?? "",
          amount: row.getCell(6).value ?? 0,
          unitPrice: row.getCell(7).value ?? 0,
          totalPrice: 0,
          vat: row.getCell(9).value ?? 0,
          vatValue: 0,
          totalPriceAfterVat: 0,
          paid: row.getCell(12).value ?? 0,
          deliveryDate: row.getCell(13).value ?? "",
          note: row.getCell(14).value ?? "",
          entryDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),

          // Automatically set to the importing user
          submittedBy: req.user.id,

          // Set approval fields to default
          approvalReceive: false,
          approvedReceiveBy: { username: "", department: "" },
          approvalReceiveDate: null,
        };

        rows.push(projectExpense);
      }
    });

    // Batch insert in chunks to reduce memory consumption
    const batchSize = 500; // Adjust the batch size as needed
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await ProjectExpense.insertMany(batch);
    }

    // Delete the uploaded file after processing
    fs.unlinkSync(filePath);

    res.redirect("/projectExpense"); // Redirect back to the main page after importing
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.send("Error importing from Excel: " + err.message);
  }
};
