//controllers\userController.js
const User = require("../models/User");
const UserMonthlyRecord = require("../models/UserMonthlyRecord");
const CostCenter = require("../models/CostCenter");
const PdfPrinter = require("pdfmake");
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
    const privilegedRoles = ["superAdmin", "deputyDirector", "director"];

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
    const privilegedRoles = ["superAdmin", "deputyDirector", "director"];

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

    const { month, year, costCenter } = req.query;

    // Validate input
    if (!month || !year) {
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });
    }

    const privilegedRoles = ["superAdmin", "deputyDirector", "director"];

    // Build query based on filters and user role
    const query = {
      recordMonth: parseInt(month),
      recordYear: parseInt(year),
    };

    if (costCenter) {
      query["costCenter._id"] = costCenter;
    }

    // If user is not in privileged roles, only show records they manage
    if (!privilegedRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    // Get records with filters and populate userId to exclude privileged users
    const records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role",
        match: { role: { $nin: privilegedRoles } }, // Exclude privileged users
      })
      .populate("costCenter")
      .sort({ realName: 1 });

    // Filter out records where userId is null (due to populate match filter)
    const filteredRecords = records.filter((record) => record.userId !== null);

    if (filteredRecords.length === 0) {
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
            // Use percentage-based widths for better scaling
            widths: ["5%", "20%", "15%", "12%", "15%", "20%", "13%"],
            body: [
              [
                { text: "STT", style: "tableHeader" },
                { text: "Họ và tên", style: "tableHeader" },
                { text: "Số tài khoản", style: "tableHeader" },
                { text: "Số CMND/CCCD", style: "tableHeader" },
                { text: "Số tiền chi lương", style: "tableHeader" },
                { text: "Nội dung chi lương", style: "tableHeader" },
                { text: "Ngân hàng hưởng", style: "tableHeader" },
              ],
              ...filteredRecords.map((record, index) => [
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
                  text: record.currentSalary.toLocaleString("vi-VN"),
                  style: "tableContent",
                  alignment: "right",
                },
                {
                  text: `Thanh toán lương tháng ${parseInt(month) - 1}`,
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
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        },
        {
          text: `Tổng: ${filteredRecords
            .reduce((sum, record) => sum + record.currentSalary, 0)
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
          fontSize: 10,
          color: "black",
          fillColor: "#f5f5f5",
          alignment: "center",
        },
        tableContent: {
          fontSize: 9,
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
    const fileName = `ChiLuong_${month}_${year}${
      costCenter ? "_" + costCenter : ""
    }.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

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
