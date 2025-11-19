//controllers\userController.js
const User = require("../models/User");
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const CostCenter = require("../models/CostCenter");
const PdfPrinter = require("pdfmake");
const ExcelJS = require("exceljs");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

exports.getUserMainPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
        "headOfSales",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    res.sendFile("userMain.html", {
      root: "./views/userPages/userMain",
    });
  } catch (error) {
    console.error("Error serving the user main page:", error);
    res.send("Server error");
  }
};

exports.getUserSalaryCalculationPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
        "headOfSales",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    res.sendFile("userSalaryCalculation.html", {
      root: "./views/userPages/userSalaryCalculation",
    });
  } catch (error) {
    console.error("Error serving the user's salary page:", error);
    res.send("Server error");
  }
};

exports.getManagers = async (req, res) => {
  try {
    const privilegedRoles = [
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfMechanical",
      "headOfTechnical",
      "headOfAccounting",
      "headOfPurchasing",
      "headOfOperations",
      "headOfNorthernRepresentativeOffice",
      "headOfSales",
    ];

    const managers = await User.find({
      role: { $in: privilegedRoles },
    }).select("_id username role"); // Only return necessary fields

    res.json(managers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all users except privileged roles
exports.getAllUsers = async (req, res) => {
  try {
    const privilegedRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];

    // Always exclude privileged roles from results
    const baseQuery = {
      role: { $nin: privilegedRoles },
    };

    let finalQuery = { ...baseQuery };

    // If user is not in privileged roles, only show users they manage
    if (!privilegedRoles.includes(req.user.role)) {
      finalQuery.assignedManager = req._id;
    }

    const users = await User.find(finalQuery).populate("costCenter").populate({
      path: "assignedManager",
      select: "username role", // Only return these fields for manager
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
        "headOfSales",
      ].includes(req.user.role)
    ) {
      return res.send(
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access."
      );
    }
    const user = await User.findById(req.params.id).populate("costCenter");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
        "headOfSales",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const {
      username,
      realName,
      costCenter,
      assignedManager,
      beneficiaryBank,
      bankAccountNumber,
      citizenID,
      baseSalary,
      commissionBonus,
      responsibility,
      weekdayOvertimeHour,
      weekendOvertimeHour,
      holidayOvertimeHour,
      insurableSalary,
      travelExpense,
      email,
      facebookUserId,
    } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const costCenterExists = await CostCenter.findById(costCenter);
    if (!costCenterExists) {
      return res.status(404).json({ message: "Cost center not found" });
    }

    const newUser = new User({
      username,
      realName,
      costCenter,
      assignedManager,
      beneficiaryBank,
      bankAccountNumber: bankAccountNumber.toString(),
      citizenID: citizenID.toString(),
      baseSalary,
      commissionBonus: commissionBonus || 0,
      responsibility: responsibility || 0,
      weekdayOvertimeHour: weekdayOvertimeHour || 0,
      weekendOvertimeHour: weekendOvertimeHour || 0,
      holidayOvertimeHour: holidayOvertimeHour || 0,
      insurableSalary: insurableSalary || 0,
      dependantCount: req.body.dependantCount || 0,
      travelExpense: travelExpense || 0,
      email: email || "",
      facebookUserId: facebookUserId || "",
    });

    const savedUser = await newUser.save();
    await savedUser.populate("costCenter");
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
        "headOfSales",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const {
      username,
      realName,
      costCenter,
      assignedManager,
      baseSalary,
      beneficiaryBank,
      bankAccountNumber,
      citizenID,
      commissionBonus,
      responsibility,
      weekdayOvertimeHour,
      weekendOvertimeHour,
      holidayOvertimeHour,
      insurableSalary,
      travelExpense,
      email,
      facebookUserId,
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      user.username = username;
    }

    if (realName !== undefined) user.realName = realName;

    if (costCenter) {
      const costCenterExists = await CostCenter.findById(costCenter);
      if (!costCenterExists) {
        return res.status(404).json({ message: "Cost center not found" });
      }
      user.costCenter = costCenter;
    }

    if (beneficiaryBank !== undefined) user.beneficiaryBank = beneficiaryBank;
    if (bankAccountNumber !== undefined)
      user.bankAccountNumber = bankAccountNumber.toString();
    if (citizenID !== undefined) user.citizenID = citizenID.toString();
    if (baseSalary !== undefined) user.baseSalary = baseSalary;
    if (commissionBonus !== undefined) {
      user.commissionBonus = commissionBonus;
    }
    if (responsibility !== undefined) user.responsibility = responsibility;
    if (weekdayOvertimeHour !== undefined)
      user.weekdayOvertimeHour = weekdayOvertimeHour;
    if (weekendOvertimeHour !== undefined)
      user.weekendOvertimeHour = weekendOvertimeHour;
    if (holidayOvertimeHour !== undefined)
      user.holidayOvertimeHour = holidayOvertimeHour;
    if (insurableSalary !== undefined) user.insurableSalary = insurableSalary;
    if (travelExpense !== undefined) user.travelExpense = travelExpense;
    if (email !== undefined) user.email = email;
    if (facebookUserId !== undefined) user.facebookUserId = facebookUserId;
    if (assignedManager) {
      const managerExists = await User.findById(assignedManager);
      if (!managerExists) {
        return res.status(404).json({ message: "Manager not found" });
      }
      user.assignedManager = assignedManager;
    }
    if (req.body.dependantCount !== undefined) {
      user.dependantCount = req.body.dependantCount;
    }

    const updatedUser = await user.save();
    await updatedUser.populate("costCenter");
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!["superAdmin"].includes(req.user.role)) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    await user.deleteOne();
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllCostCenters = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfMechanical",
        "headOfTechnical",
        "headOfAccounting",
        "headOfPurchasing",
        "headOfOperations",
        "headOfNorthernRepresentativeOffice",
        "headOfSales",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    // Fetch all cost centers
    const costCenters = await CostCenter.find();

    // Sort the cost centers alphabetically by name
    // Assuming each cost center has a 'name' field - adjust if your field is named differently
    const sortedCostCenters = costCenters.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    res.json(sortedCostCenters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserMonthlyRecordPage = (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }
    res.sendFile("userMonthlyRecord.html", {
      root: "./views/userPages/userMonthlyRecord",
    });
  } catch (error) {
    console.error("Error serving the user main page:", error);
    res.send("Server error");
  }
};

exports.getAllUserMonthlyRecord = async (req, res) => {
  try {
    const privilegedRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];

    // Create base query to exclude privileged roles
    let matchQuery = {};

    // If user is not in privileged roles, only show records they manage
    if (!privilegedRoles.includes(req.user.role)) {
      matchQuery.assignedManager = req.user._id;
    }

    const records = await UserMonthlyRecord.find(matchQuery)
      .populate({
        path: "userId",
        select: "username role",
        match: { role: { $nin: privilegedRoles } }, // Exclude privileged users
      })
      .populate("costCenter", "name")
      .populate("assignedManager", "username")
      .sort({ recordYear: -1, recordMonth: -1 });

    // Filter out records where userId is null (due to populate match filter)
    const filteredRecords = records.filter((record) => record.userId !== null);

    res.json(filteredRecords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Updated reliable font URLs from Google Fonts
const FONT_URLS = {
  normal: "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
  bold: "https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap",
  italics:
    "https://fonts.googleapis.com/css2?family=Roboto:ital@1&display=swap",
  bolditalics:
    "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@1,700&display=swap",
};

// Directory to cache downloaded fonts
const FONT_CACHE_DIR = path.join(__dirname, "../font_cache");

// Ensure cache directory exists
if (!fs.existsSync(FONT_CACHE_DIR)) {
  fs.mkdirSync(FONT_CACHE_DIR);
}

async function getFontUrl(type) {
  try {
    const response = await axios.get(FONT_URLS[type]);
    const css = response.data;
    // Extract the actual font URL from the CSS
    const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)[1];
    return fontUrl.replace(/^['"]|['"]$/g, "");
  } catch (error) {
    console.error(`Error getting font URL for ${type}:`, error);
    throw new Error(`Could not retrieve font URL for ${type}`);
  }
}

async function downloadFont(type) {
  const fontPath = path.join(FONT_CACHE_DIR, `Roboto-${type}.ttf`);

  // Return cached font if exists
  if (fs.existsSync(fontPath)) {
    return fontPath;
  }

  try {
    // First get the actual font URL from Google Fonts CSS
    const fontUrl = await getFontUrl(type);

    // Download the font file
    const response = await axios.get(fontUrl, {
      responseType: "arraybuffer",
    });

    // Save to cache
    fs.writeFileSync(fontPath, response.data);
    return fontPath;
  } catch (error) {
    console.error(`Error downloading font ${type}:`, error);
    throw new Error(`Could not download font ${type}`);
  }
}

exports.exportSalaryPaymentPDF = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Truy cập bị từ chối. Bạn không có quyền truy cập." });
    }

    const {
      month,
      year,
      costCenter,
      beneficiaryBank,
      costCenterReverse,
      beneficiaryBankReverse,
    } = req.query;

    // Validate input
    if (!month || !year) {
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });
    }

    const privilegedRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];
    const fullAccessRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];

    // Build base query
    const query = {
      recordMonth: parseInt(month),
      recordYear: parseInt(year),
    };

    // If user is not in full access roles, only show records they manage
    if (!fullAccessRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    // Get records with population first
    let records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role",
        match: { role: { $nin: privilegedRoles } }, // Exclude privileged users
      })
      .populate("costCenter")
      .sort({ realName: 1 });

    // Filter out records where userId is null (due to populate match filter)
    records = records.filter((record) => record.userId !== null);

    // Apply cost center filter AFTER population
    if (costCenter) {
      if (costCenterReverse === "true") {
        records = records.filter(
          (record) => record.costCenter?.name !== costCenter
        );
      } else {
        records = records.filter(
          (record) => record.costCenter?.name === costCenter
        );
      }
    }

    // Apply beneficiary bank filter
    if (beneficiaryBank) {
      if (beneficiaryBankReverse === "true") {
        records = records.filter(
          (record) =>
            !record.beneficiaryBank ||
            !record.beneficiaryBank
              .toLowerCase()
              .includes(beneficiaryBank.toLowerCase())
        );
      } else {
        records = records.filter(
          (record) =>
            record.beneficiaryBank &&
            record.beneficiaryBank
              .toLowerCase()
              .includes(beneficiaryBank.toLowerCase())
        );
      }
    }

    if (records.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi nào phù hợp" });
    }

    // Download fonts with error handling
    let fonts;
    try {
      const [normal, bold, italics, bolditalics] = await Promise.all([
        downloadFont("normal"),
        downloadFont("bold"),
        downloadFont("italics"),
        downloadFont("bolditalics"),
      ]);

      fonts = {
        Roboto: {
          normal,
          bold,
          italics,
          bolditalics,
        },
      };
    } catch (fontError) {
      console.error("Font download failed, using fallback fonts:", fontError);
      // Fallback to built-in PDFMake fonts if download fails
      fonts = {
        Roboto: {
          normal: "Helvetica",
          bold: "Helvetica-Bold",
          italics: "Helvetica-Oblique",
          bolditalics: "Helvetica-BoldOblique",
        },
      };
    }

    const printer = new PdfPrinter(fonts);

    // Prepare document content
    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [15, 15, 15, 15], // Minimal margins for maximum space
      content: [
        {
          text: "DANH SÁCH CHI LƯƠNG",
          style: "header",
          alignment: "center",
        },
        {
          text: "(Kèm theo Hợp đồng Dịch vụ chi lương số 41/HDCL-HDBCH ngày 15 tháng 09 năm 2022 được kì kết giữa Ngân Hàng TMCP Phát Triển TP. Hồ Chí Minh – Chi nhánh Cộng Hòa và Công ty TNHH Đầu Tư Thương Mại Dịch Vụ Kỳ Long)",
          style: "subheader",
          alignment: "center",
          margin: [0, 0, 0, 15],
        },
        {
          table: {
            headerRows: 1,
            widths: ["4%", "17%", "13%", "10%", "13%", "17%", "11%", "15%"],
            body: [
              [
                { text: "STT", style: "tableHeader" },
                { text: "Họ và tên", style: "tableHeader" },
                { text: "Số tài khoản", style: "tableHeader" },
                { text: "Số CMND/CCCD", style: "tableHeader" },
                { text: "Số tiền chi lương", style: "tableHeader" },
                { text: "Nội dung chi lương", style: "tableHeader" },
                { text: "Trạm", style: "tableHeader" },
                { text: "Ngân hàng hưởng", style: "tableHeader" },
              ],
              ...records.map((record, index) => [
                {
                  text: (index + 1).toString(),
                  style: "tableContent",
                  alignment: "center",
                },
                { text: record.realName || "N/A", style: "tableContent" },
                {
                  text: record.bankAccountNumber || "N/A",
                  style: "tableContent",
                  alignment: "center",
                },
                {
                  text: record.citizenID || "N/A",
                  style: "tableContent",
                  alignment: "center",
                },
                {
                  text: Math.ceil(record.currentSalary).toLocaleString("vi-VN"),
                  style: "tableContent",
                  alignment: "right",
                },
                {
                  text: `Thanh toán lương tháng ${parseInt(month) - 1}`,
                  style: "tableContent",
                },
                {
                  text: record.costCenter?.name || "N/A",
                  style: "tableContent",
                },
                {
                  text: record.beneficiaryBank || "N/A",
                  style: "tableContent",
                },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#aaa",
            vLineColor: () => "#aaa",
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
        },
        {
          text: `Tổng: ${records
            .reduce((sum, record) => sum + Math.ceil(record.currentSalary), 0)
            .toLocaleString("vi-VN")} VND`,
          style: "total",
          margin: [0, 15, 0, 0],
        },
        {
          columns: [
            {
              width: "50%",
              text: "",
            },
            {
              width: "50%",
              text: "ĐẠI DIỆN CÔNG TY",
              style: "signature",
              alignment: "center",
            },
          ],
          margin: [0, 30, 0, 0],
        },
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 10],
        },
        subheader: {
          fontSize: 9,
          margin: [0, 0, 0, 10],
        },
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: "black",
          fillColor: "#f5f5f5",
          alignment: "center",
        },
        tableContent: {
          fontSize: 8,
          margin: [0, 1, 0, 1],
        },
        total: {
          bold: true,
          fontSize: 12,
          alignment: "right",
        },
        signature: {
          bold: true,
          fontSize: 12,
        },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
      },
    };

    // Create PDF stream
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers
    let fileName = `ChiLuong_${month}_${year}`;
    if (costCenter) {
      // Sanitize costCenter name to remove invalid characters
      const sanitizedCostCenter = costCenter.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        ""
      );
      fileName += `_${sanitizedCostCenter}`;
    }
    fileName += ".pdf";

    // Ensure filename is properly encoded
    const encodedFileName = encodeURIComponent(fileName).replace(
      /['()]/g,
      escape
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
    );

    // Stream the PDF to the response
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error exporting PDF:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xuất file PDF: " + error.message });
  }
};

exports.exportSalaryPaymentExcel = async (req, res) => {
  try {
    if (
      ![
        "superAdmin",
        "director",
        "deputyDirector",
        "headOfAccounting",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Truy cập bị từ chối. Bạn không có quyền truy cập." });
    }

    const {
      month,
      year,
      costCenter,
      beneficiaryBank,
      costCenterReverse,
      beneficiaryBankReverse,
    } = req.query;

    // Validate input
    if (!month || !year) {
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });
    }

    const privilegedRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];
    const fullAccessRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];

    // Build base query
    const query = {
      recordMonth: parseInt(month),
      recordYear: parseInt(year),
    };

    // If user is not in full access roles, only show records they manage
    if (!fullAccessRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    // Get records with population first
    let records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role",
        match: { role: { $nin: privilegedRoles } }, // Exclude privileged users
      })
      .populate("costCenter")
      .sort({ realName: 1 });

    // Filter out records where userId is null (due to populate match filter)
    records = records.filter((record) => record.userId !== null);

    // Apply cost center filter AFTER population
    if (costCenter) {
      if (costCenterReverse === "true") {
        records = records.filter(
          (record) => record.costCenter?.name !== costCenter
        );
      } else {
        records = records.filter(
          (record) => record.costCenter?.name === costCenter
        );
      }
    }

    // Apply beneficiary bank filter
    if (beneficiaryBank) {
      if (beneficiaryBankReverse === "true") {
        records = records.filter(
          (record) =>
            !record.beneficiaryBank ||
            !record.beneficiaryBank
              .toLowerCase()
              .includes(beneficiaryBank.toLowerCase())
        );
      } else {
        records = records.filter(
          (record) =>
            record.beneficiaryBank &&
            record.beneficiaryBank
              .toLowerCase()
              .includes(beneficiaryBank.toLowerCase())
        );
      }
    }

    if (records.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi nào phù hợp" });
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Chi lương ${month}-${year}`);

    // Set page setup for better printing
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    };

    // Add main title
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = "DANH SÁCH CHI LƯƠNG";
    worksheet.getCell("A1").font = { bold: true, size: 16, name: "Arial" };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(1).height = 25;

    // Add subtitle with contract info
    worksheet.mergeCells("A2:H3");
    worksheet.getCell("A2").value =
      "(Kèm theo Hợp đồng Dịch vụ chi lương số 41/HDCL-HDBCH ngày 15 tháng 09 năm 2022 được kì kết giữa Ngân Hàng TMCP Phát Triển TP. Hồ Chí Minh – Chi nhánh Cộng Hòa và Công ty TNHH Đầu Tư Thương Mại Dịch Vụ Kỳ Long)";
    worksheet.getCell("A2").font = { size: 10, name: "Arial" };
    worksheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    worksheet.getRow(2).height = 30;
    worksheet.getRow(3).height = 15;

    // Add empty row for spacing
    worksheet.addRow([]);

    // Define headers with proper widths
    const headers = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Họ và tên", key: "name", width: 25 },
      { header: "Số tài khoản", key: "account", width: 18 },
      { header: "Số CMND/CCCD", key: "id", width: 15 },
      { header: "Số tiền chi lương", key: "salary", width: 16 },
      { header: "Nội dung chi lương", key: "description", width: 22 },
      { header: "Trạm", key: "costCenter", width: 20 },
      { header: "Ngân hàng hưởng", key: "bank", width: 25 },
    ];

    // Set column widths
    worksheet.columns = headers;

    // Add header row (row 5)
    const headerRow = worksheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header.header;
      cell.font = { bold: true, size: 11, name: "Arial" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6E6" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });
    headerRow.height = 25;

    // Add data rows starting from row 6
    let totalSalary = 0;
    records.forEach((record, index) => {
      const salaryAmount = Math.ceil(record.currentSalary);
      totalSalary += salaryAmount;

      const dataRow = worksheet.addRow({
        stt: index + 1,
        name: record.realName || "N/A",
        account: record.bankAccountNumber || "N/A",
        id: record.citizenID || "N/A",
        salary: salaryAmount,
        description: `Thanh toán lương tháng ${parseInt(month) - 1}`,
        costCenter: record.costCenter?.name || "N/A",
        bank: record.beneficiaryBank || "N/A",
      });

      // Format each cell in the data row
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 10, name: "Arial" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };

        // Alignment based on column
        if (colNumber === 1) {
          // STT
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNumber === 5) {
          // Salary
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0";
        } else if (colNumber === 3 || colNumber === 4) {
          // Account & ID
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
          };
        }
      });

      dataRow.height = 22;
    });

    // Add total row
    const totalRowIndex = worksheet.lastRow.number + 1;
    const totalRow = worksheet.getRow(totalRowIndex);

    // Merge cells for "Tổng:" and total amount
    worksheet.mergeCells(`D${totalRowIndex}:E${totalRowIndex}`);
    totalRow.getCell(4).value = `Tổng: ${totalSalary.toLocaleString()} VND`;
    totalRow.getCell(4).font = { bold: true, size: 11, name: "Arial" };
    totalRow.getCell(4).alignment = { horizontal: "right", vertical: "middle" };

    // Add borders to total row
    for (let i = 1; i <= 8; i++) {
      totalRow.getCell(i).border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }
    totalRow.height = 25;

    // Add empty rows for spacing
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Add signature section
    const signatureRowIndex = worksheet.lastRow.number + 1;
    const signatureRow = worksheet.getRow(signatureRowIndex);
    signatureRow.getCell(7).value = "ĐẠI DIỆN CÔNG TY";
    signatureRow.getCell(7).font = { bold: true, size: 11, name: "Arial" };
    signatureRow.getCell(7).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    signatureRow.height = 20;

    // Set print area
    worksheet.pageSetup.printArea = `A1:H${signatureRowIndex}`;

    // Set response headers
    let fileName = `ChiLuong_${month}_${year}`;
    if (costCenter) {
      // Sanitize costCenter name to remove invalid characters
      const sanitizedCostCenter = costCenter.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        ""
      );
      fileName += `_${sanitizedCostCenter}`;
    }
    fileName += ".xlsx";

    // Ensure filename is properly encoded
    const encodedFileName = encodeURIComponent(fileName).replace(
      /['()]/g,
      escape
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
    );

    // Stream the Excel file to the response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting Excel:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xuất file Excel: " + error.message });
  }
};
