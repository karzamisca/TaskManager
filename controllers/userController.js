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
        "Truy cập bị từ chối. Bạn không có quyền truy cập./Access denied. You don't have permission to access.",
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
      otherBonus,
      weekdayOvertimeHour,
      weekendOvertimeHour,
      holidayOvertimeHour,
      insurableSalary,
      travelExpense,
      email,
      facebookUserId,
      allowanceGeneral,
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
      otherBonus: otherBonus || 0,
      weekdayOvertimeHour: weekdayOvertimeHour || 0,
      weekendOvertimeHour: weekendOvertimeHour || 0,
      holidayOvertimeHour: holidayOvertimeHour || 0,
      insurableSalary: insurableSalary || 0,
      dependantCount: req.body.dependantCount || 0,
      travelExpense: travelExpense || 0,
      allowanceGeneral: allowanceGeneral || 0,
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
      otherBonus,
      weekdayOvertimeHour,
      weekendOvertimeHour,
      holidayOvertimeHour,
      insurableSalary,
      travelExpense,
      email,
      facebookUserId,
      allowanceGeneral,
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
    if (otherBonus !== undefined) user.otherBonus = otherBonus;
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
    if (allowanceGeneral !== undefined)
      user.allowanceGeneral = allowanceGeneral;
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
      .populate({
        path: "assignedManager",
        select: "username role",
      })
      .sort({ recordYear: -1, recordMonth: -1 });

    // Filter out records where:
    // 1. userId is null (due to populate match filter)
    // 2. assignedManager has role "superAdmin"
    const filteredRecords = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin",
    );

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

    // Validate input - only year is required
    if (!year) {
      return res.status(400).json({ message: "Thiếu năm" });
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
      recordYear: parseInt(year),
    };

    // Add month filter if provided
    if (month) {
      query.recordMonth = parseInt(month);
    }

    // If user is not in full access roles, only show records they manage
    if (!fullAccessRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    // Get records with population first
    let records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role realName",
        match: { role: { $nin: privilegedRoles } }, // Exclude privileged users
      })
      .populate("costCenter")
      .populate({
        path: "assignedManager",
        select: "role",
      })
      .sort({ recordMonth: 1, realName: 1 }); // Sort by month, then name

    // Filter out records where:
    // 1. userId is null (due to populate match filter)
    // 2. assignedManager has role "superAdmin"
    records = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin",
    );

    // Apply cost center filter AFTER population
    if (costCenter) {
      if (costCenterReverse === "true") {
        records = records.filter(
          (record) => record.costCenter?.name !== costCenter,
        );
      } else {
        records = records.filter(
          (record) => record.costCenter?.name === costCenter,
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
              .includes(beneficiaryBank.toLowerCase()),
        );
      } else {
        records = records.filter(
          (record) =>
            record.beneficiaryBank &&
            record.beneficiaryBank
              .toLowerCase()
              .includes(beneficiaryBank.toLowerCase()),
        );
      }
    }

    if (records.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi nào phù hợp" });
    }

    // Sort records by month, then by costCenter name, then by realName
    records.sort((a, b) => {
      // First sort by month
      if (a.recordMonth < b.recordMonth) return -1;
      if (a.recordMonth > b.recordMonth) return 1;

      // If same month, sort by cost center
      const costCenterA = a.costCenter?.name || "";
      const costCenterB = b.costCenter?.name || "";
      if (costCenterA < costCenterB) return -1;
      if (costCenterA > costCenterB) return 1;

      // If same cost center, sort by name
      const nameA = a.realName || "";
      const nameB = b.realName || "";
      return nameA.localeCompare(nameB);
    });

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

    // Prepare document content - modified for year report
    const reportTitle = month
      ? `DANH SÁCH CHI LƯƠNG THÁNG ${month} NĂM ${year}`
      : `DANH SÁCH CHI LƯƠNG NĂM ${year}`;

    const description = month
      ? `(Kèm theo Hợp đồng Dịch vụ chi lương số 41/HDCL-HDBCH ngày 15 tháng 09 năm 2022 được kì kết giữa Ngân Hàng TMCP Phát Triển TP. Hồ Chí Minh – Chi nhánh Cộng Hòa và Công ty TNHH Đầu Tư Thương Mại Dịch Vụ Kỳ Long)`
      : `Báo cáo chi lương cả năm ${year}`;

    // Calculate totals for summary
    const totalSalary = records.reduce(
      (sum, record) => sum + Math.ceil(record.currentSalary),
      0,
    );
    const totalTax = records.reduce(
      (sum, record) => sum + Math.ceil(record.tax || 0),
      0,
    );
    const totalGross = records.reduce(
      (sum, record) => sum + Math.ceil(record.grossSalary || 0),
      0,
    );

    // Prepare content array
    const content = [
      {
        text: reportTitle,
        style: "header",
        alignment: "center",
        margin: [0, 0, 0, 5],
      },
      {
        text: description,
        style: "subheader",
        alignment: "center",
        margin: [0, 0, 0, 15],
      },
    ];

    // Main table for monthly records
    content.push({
      table: {
        headerRows: 1,
        widths: month
          ? ["4%", "16%", "12%", "10%", "12%", "15%", "10%", "12%", "9%"]
          : ["4%", "14%", "11%", "9%", "11%", "13%", "9%", "11%", "8%", "10%"],
        body: [
          month
            ? [
                { text: "STT", style: "tableHeader" },
                { text: "Họ và tên", style: "tableHeader" },
                { text: "Số tài khoản", style: "tableHeader" },
                { text: "Số CMND/CCCD", style: "tableHeader" },
                { text: "Số tiền chi lương", style: "tableHeader" },
                { text: "Nội dung chi lương", style: "tableHeader" },
                { text: "Trạm", style: "tableHeader" },
                { text: "Ngân hàng hưởng", style: "tableHeader" },
                { text: "Tháng", style: "tableHeader" },
              ]
            : [
                { text: "STT", style: "tableHeader" },
                { text: "Họ và tên", style: "tableHeader" },
                { text: "Số tài khoản", style: "tableHeader" },
                { text: "Số CMND/CCCD", style: "tableHeader" },
                { text: "Số tiền chi lương", style: "tableHeader" },
                { text: "Nội dung chi lương", style: "tableHeader" },
                { text: "Tháng", style: "tableHeader" },
                { text: "Trạm", style: "tableHeader" },
                { text: "Ngân hàng hưởng", style: "tableHeader" },
                { text: "Thuế", style: "tableHeader" },
              ],
          ...records.map((record, index) => {
            const descriptionText = month
              ? `Thanh toán lương tháng ${parseInt(month) - 1}`
              : `Thanh toán lương tháng ${record.recordMonth}`;

            const baseRow = [
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
                text: descriptionText,
                style: "tableContent",
              },
            ];

            if (month) {
              // Monthly report layout
              baseRow.push(
                {
                  text: record.costCenter?.name || "N/A",
                  style: "tableContent",
                },
                {
                  text: record.beneficiaryBank || "N/A",
                  style: "tableContent",
                },
                {
                  text: record.recordMonth.toString(),
                  style: "tableContent",
                  alignment: "center",
                },
              );
            } else {
              // Yearly report layout
              baseRow.push(
                {
                  text: record.recordMonth.toString(),
                  style: "tableContent",
                  alignment: "center",
                },
                {
                  text: record.costCenter?.name || "N/A",
                  style: "tableContent",
                },
                {
                  text: record.beneficiaryBank || "N/A",
                  style: "tableContent",
                },
                {
                  text: Math.ceil(record.tax || 0).toLocaleString("vi-VN"),
                  style: "tableContent",
                  alignment: "right",
                },
              );
            }

            return baseRow;
          }),
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
    });

    // Add summary table for yearly report only
    if (!month) {
      // Create summary data: total salary per user per year
      // Use the records that are already filtered and displayed in the main table
      const userSummary = {};

      records.forEach((record) => {
        // Use realName from the record (already available)
        const userName = record.realName || "N/A";
        const costCenterName = record.costCenter?.name || "N/A";
        const salary = Math.ceil(record.currentSalary);

        // Create a unique key using name and cost center to group by user
        const userKey = `${userName}-${costCenterName}`;

        if (!userSummary[userKey]) {
          userSummary[userKey] = {
            userName: userName,
            costCenter: costCenterName,
            totalSalary: 0,
            monthsWorked: new Set(),
          };
        }

        userSummary[userKey].totalSalary += salary;
        userSummary[userKey].monthsWorked.add(record.recordMonth);
      });

      // Convert to array and sort by costCenter, then by name
      const summaryArray = Object.values(userSummary).map((user) => ({
        ...user,
        monthsCount: user.monthsWorked.size,
      }));

      summaryArray.sort((a, b) => {
        // First sort by cost center
        const costCenterA = a.costCenter || "";
        const costCenterB = b.costCenter || "";
        if (costCenterA < costCenterB) return -1;
        if (costCenterA > costCenterB) return 1;

        // If same cost center, sort by name
        return a.userName.localeCompare(b.userName);
      });

      // Calculate total summary salary
      const summaryTotalSalary = summaryArray.reduce(
        (sum, user) => sum + user.totalSalary,
        0,
      );

      // Add spacing before summary table
      content.push({
        text: "TỔNG HỢP LƯƠNG CẢ NĂM THEO NHÂN VIÊN",
        style: "summaryHeader",
        margin: [0, 20, 0, 10],
      });

      // Add summary table
      content.push({
        table: {
          headerRows: 1,
          widths: ["4%", "20%", "20%", "18%", "18%", "20%"],
          body: [
            [
              { text: "STT", style: "tableHeader" },
              { text: "Họ và tên", style: "tableHeader" },
              { text: "Trạm", style: "tableHeader" },
              { text: "Số tháng làm việc", style: "tableHeader" },
              { text: "Tổng lương cả năm", style: "tableHeader" },
              { text: "Ghi chú", style: "tableHeader" },
            ],
            ...summaryArray.map((user, index) => [
              {
                text: (index + 1).toString(),
                style: "tableContent",
                alignment: "center",
              },
              { text: user.userName, style: "tableContent" },
              { text: user.costCenter, style: "tableContent" },
              {
                text: user.monthsCount.toString(),
                style: "tableContent",
                alignment: "center",
              },
              {
                text: user.totalSalary.toLocaleString("vi-VN"),
                style: "tableContent",
                alignment: "right",
              },
              {
                text:
                  user.monthsCount === 12
                    ? "Làm việc cả năm"
                    : `Thiếu ${12 - user.monthsCount} tháng`,
                style: "tableContent",
              },
            ]),
            [
              {
                text: "TỔNG CỘNG",
                style: "tableHeader",
                colSpan: 4,
                alignment: "center",
              },
              {}, // empty for colspan
              {}, // empty for colspan
              {}, // empty for colspan
              {
                text: summaryTotalSalary.toLocaleString("vi-VN"),
                style: "tableHeader",
                alignment: "right",
              },
              {
                text: "",
                style: "tableHeader",
              },
            ],
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
      });

      // Add yearly summary section
      content.push({
        text: [
          { text: "TỔNG HỢP NĂM:\n", style: "summaryHeader" },
          {
            text: `Tổng lương thực lĩnh: ${totalSalary.toLocaleString(
              "vi-VN",
            )} VND\n`,
            style: "summaryText",
          },
          {
            text: `Tổng thuế thu nhập: ${totalTax.toLocaleString(
              "vi-VN",
            )} VND\n`,
            style: "summaryText",
          },
          {
            text: `Tổng lương gộp: ${totalGross.toLocaleString("vi-VN")} VND`,
            style: "summaryText",
          },
        ],
        style: "summary",
        margin: [0, 15, 0, 0],
      });
    }

    // Add total salary row
    content.push({
      text: `Tổng lương thực lĩnh: ${totalSalary.toLocaleString("vi-VN")} VND`,
      style: "total",
      margin: [0, 15, 0, 0],
    });

    // Add signature
    content.push({
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
    });

    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [15, 15, 15, 15],
      content: content,
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
          fontSize: month ? 8 : 7,
          color: "black",
          fillColor: "#f5f5f5",
          alignment: "center",
        },
        tableContent: {
          fontSize: month ? 7 : 6.5,
          margin: [0, 1, 0, 1],
        },
        total: {
          bold: true,
          fontSize: 11,
          alignment: "right",
        },
        signature: {
          bold: true,
          fontSize: 11,
        },
        summary: {
          fontSize: 9,
          margin: [0, 10, 0, 5],
          background: "#f0f0f0",
          padding: 5,
        },
        summaryHeader: {
          bold: true,
          fontSize: 10,
          margin: [0, 5, 0, 5],
        },
        summaryText: {
          fontSize: 9,
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
    let fileName = month
      ? `ChiLuong_Thang${month}_${year}`
      : `ChiLuong_Nam${year}`;

    if (costCenter) {
      const sanitizedCostCenter = costCenter.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        "",
      );
      fileName += `_${sanitizedCostCenter}`;
    }
    fileName += ".pdf";

    const encodedFileName = encodeURIComponent(fileName).replace(
      /['()]/g,
      escape,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
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
      realName,
      costCenterReverse,
      beneficiaryBankReverse,
      realNameReverse,
      includeSummary,
    } = req.query;

    // Validate input - only year is required
    if (!year) {
      return res.status(400).json({ message: "Thiếu năm" });
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
      recordYear: parseInt(year),
    };

    // Add month filter if provided
    if (month) {
      query.recordMonth = parseInt(month);
    }

    // If user is not in full access roles, only show records they manage
    if (!fullAccessRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    // Get records with population first
    let records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role realName",
        match: { role: { $nin: privilegedRoles } }, // Exclude privileged users
      })
      .populate("costCenter")
      .populate({
        path: "assignedManager",
        select: "role",
      })
      .sort({ recordMonth: 1, realName: 1 });

    // Filter out records where:
    // 1. userId is null (due to populate match filter)
    // 2. assignedManager has role "superAdmin"
    records = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin",
    );

    // Apply cost center filter AFTER population
    if (costCenter) {
      if (costCenterReverse === "true") {
        records = records.filter(
          (record) => record.costCenter?.name !== costCenter,
        );
      } else {
        records = records.filter(
          (record) => record.costCenter?.name === costCenter,
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
              .includes(beneficiaryBank.toLowerCase()),
        );
      } else {
        records = records.filter(
          (record) =>
            record.beneficiaryBank &&
            record.beneficiaryBank
              .toLowerCase()
              .includes(beneficiaryBank.toLowerCase()),
        );
      }
    }

    // Apply realName filter
    if (realName) {
      if (realNameReverse === "true") {
        records = records.filter(
          (record) =>
            !record.realName ||
            !record.realName.toLowerCase().includes(realName.toLowerCase()),
        );
      } else {
        records = records.filter(
          (record) =>
            record.realName &&
            record.realName.toLowerCase().includes(realName.toLowerCase()),
        );
      }
    }

    if (records.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản ghi nào phù hợp" });
    }

    // Group records by cost center, then by user (similar to HTML view)
    const groupedRecords = {};

    records.forEach((record) => {
      const costCenterName = record.costCenter?.name || "Không có trạm";
      const userName = record.realName || "Không có tên";

      if (!groupedRecords[costCenterName]) {
        groupedRecords[costCenterName] = {};
      }

      if (!groupedRecords[costCenterName][userName]) {
        groupedRecords[costCenterName][userName] = [];
      }

      groupedRecords[costCenterName][userName].push(record);
    });

    // Sort cost centers alphabetically
    const sortedCostCenters = Object.keys(groupedRecords).sort();

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheetName = month
      ? `Chi tiết lương tháng ${month}-${year}`
      : `Chi tiết lương năm ${year}`;
    const worksheet = workbook.addWorksheet(worksheetName);

    // Set page setup for better printing
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    };

    // Add main title
    const reportTitle = month
      ? `BÁO CÁO CHI TIẾT LƯƠNG THÁNG ${month} NĂM ${year}`
      : `BÁO CÁO CHI TIẾT LƯƠNG NĂM ${year}`;

    const columnsCount = 20; // Updated from 19 to 20 for allowanceGeneral

    worksheet.mergeCells(`A1:${String.fromCharCode(64 + columnsCount)}1`);
    worksheet.getCell("A1").value = reportTitle;
    worksheet.getCell("A1").font = { bold: true, size: 16, name: "Arial" };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(1).height = 25;

    // Add subtitle
    worksheet.mergeCells(`A2:${String.fromCharCode(64 + columnsCount)}3`);
    const description = month
      ? "(Kèm theo Hợp đồng Dịch vụ chi lương số 41/HDCL-HDBCH ngày 15 tháng 09 năm 2022)"
      : `Báo cáo chi tiết lương cả năm ${year}`;

    worksheet.getCell("A2").value = description;
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

    // Define headers for all fields
    const headers = [
      { header: "STT", key: "stt", width: 4 },
      { header: "Họ và tên", key: "name", width: 18 },
      { header: "Tháng", key: "month", width: 6 },
      { header: "Năm", key: "year", width: 6 },
      { header: "Lương cơ bản", key: "baseSalary", width: 12 },
      { header: "Lương theo giờ", key: "hourlyWage", width: 12 },
      { header: "Trách nhiệm", key: "responsibility", width: 11 },
      { header: "Công tác phí", key: "travelExpense", width: 11 },
      { header: "Hoa hồng", key: "commissionBonus", width: 11 },
      { header: "Thưởng khác", key: "otherBonus", width: 11 },
      { header: "Phụ cấp chung", key: "allowanceGeneral", width: 11 }, // Added allowanceGeneral
      { header: "Giờ TC tuần", key: "weekdayOvertime", width: 9 },
      { header: "Giờ TC CN", key: "weekendOvertime", width: 8 },
      { header: "Giờ TC lễ", key: "holidayOvertime", width: 8 },
      { header: "Lương tăng ca", key: "overtimePay", width: 11 },
      { header: "Lương tính thuế", key: "taxableIncome", width: 11 },
      { header: "Lương gộp", key: "grossSalary", width: 10 },
      { header: "Thuế", key: "tax", width: 10 },
      { header: "Lương thực lĩnh", key: "currentSalary", width: 12 },
      { header: "Trạm", key: "costCenter", width: 15 },
    ];

    // Set column widths
    worksheet.columns = headers;

    // Add header row (row 5)
    const headerRow = worksheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header.header;
      cell.font = { bold: true, size: 9, name: "Arial" };
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

    // Initialize totals
    let totalRecords = 0;
    let totalBaseSalary = 0;
    let totalHourlyWage = 0;
    let totalResponsibility = 0;
    let totalTravelExpense = 0;
    let totalCommissionBonus = 0;
    let totalOtherBonus = 0;
    let totalAllowanceGeneral = 0; // Added for allowanceGeneral
    let totalWeekdayOvertime = 0;
    let totalWeekendOvertime = 0;
    let totalHolidayOvertime = 0;
    let totalOvertimePay = 0;
    let totalTaxableIncome = 0;
    let totalGrossSalary = 0;
    let totalTax = 0;
    let totalCurrentSalary = 0;

    let currentRow = 6; // Start after header row
    let globalIndex = 1;

    // Process each cost center group
    sortedCostCenters.forEach((costCenterName, costCenterIndex) => {
      // Add cost center header row
      const costCenterRow = worksheet.getRow(currentRow++);
      costCenterRow.height = 22;

      // Merge all cells for cost center header
      worksheet.mergeCells(`A${currentRow - 1}:T${currentRow - 1}`); // Updated from S to T
      costCenterRow.getCell(1).value = `TRẠM ${
        costCenterIndex + 1
      }: ${costCenterName}`;
      costCenterRow.getCell(1).font = {
        bold: true,
        size: 11,
        name: "Arial",
        color: { argb: "FF1976D2" },
      };
      costCenterRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8F5E8" },
      };
      costCenterRow.getCell(1).alignment = {
        horizontal: "left",
        vertical: "middle",
      };

      // Style all cells in the cost center row
      for (let i = 1; i <= columnsCount; i++) {
        costCenterRow.getCell(i).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE8F5E8" },
        };
        costCenterRow.getCell(i).border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      }

      // Get users in this cost center and sort them alphabetically
      const usersInCostCenter = Object.keys(
        groupedRecords[costCenterName],
      ).sort();

      // Process each user in this cost center
      usersInCostCenter.forEach((userName, userIndex) => {
        const userRecords = groupedRecords[costCenterName][userName];

        // Sort user's records by month
        userRecords.sort((a, b) => a.recordMonth - b.recordMonth);

        // Add user group header row
        const userHeaderRow = worksheet.getRow(currentRow++);
        userHeaderRow.height = 20;

        // Merge all cells for user header
        worksheet.mergeCells(`A${currentRow - 1}:T${currentRow - 1}`); // Updated from S to T
        userHeaderRow.getCell(1).value = `Nhân viên ${
          userIndex + 1
        }: ${userName}${costCenterName ? ` - ${costCenterName}` : ""}`;
        userHeaderRow.getCell(1).font = {
          bold: true,
          size: 10,
          name: "Arial",
        };
        userHeaderRow.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F8FF" },
        };
        userHeaderRow.getCell(1).alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        // Style all cells in the user header row
        for (let i = 1; i <= columnsCount; i++) {
          userHeaderRow.getCell(i).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F8FF" },
          };
          userHeaderRow.getCell(i).border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } },
          };
        }

        // Add individual records for this user
        let userTotalBaseSalary = 0;
        let userTotalHourlyWage = 0;
        let userTotalResponsibility = 0;
        let userTotalTravelExpense = 0;
        let userTotalCommissionBonus = 0;
        let userTotalOtherBonus = 0;
        let userTotalAllowanceGeneral = 0; // Added for allowanceGeneral
        let userTotalWeekdayOvertime = 0;
        let userTotalWeekendOvertime = 0;
        let userTotalHolidayOvertime = 0;
        let userTotalOvertimePay = 0;
        let userTotalTaxableIncome = 0;
        let userTotalGrossSalary = 0;
        let userTotalTax = 0;
        let userTotalCurrentSalary = 0;

        userRecords.forEach((record, recordIndex) => {
          const rowData = {
            stt: globalIndex++,
            name: record.realName || "N/A",
            month: record.recordMonth,
            year: record.recordYear,
            baseSalary: Math.ceil(record.baseSalary || 0),
            hourlyWage: Math.ceil(record.hourlyWage || 0),
            responsibility: Math.ceil(record.responsibility || 0),
            travelExpense: Math.ceil(record.travelExpense || 0),
            commissionBonus: Math.ceil(record.commissionBonus || 0),
            otherBonus: Math.ceil(record.otherBonus || 0),
            allowanceGeneral: Math.ceil(record.allowanceGeneral || 0), // Added allowanceGeneral
            weekdayOvertime: record.weekdayOvertimeHour || 0,
            weekendOvertime: record.weekendOvertimeHour || 0,
            holidayOvertime: record.holidayOvertimeHour || 0,
            overtimePay: Math.ceil(record.overtimePay || 0),
            taxableIncome: Math.ceil(record.taxableIncome || 0),
            grossSalary: Math.ceil(record.grossSalary || 0),
            tax: Math.ceil(record.tax || 0),
            currentSalary: Math.ceil(record.currentSalary || 0),
            costCenter: record.costCenter?.name || "N/A",
          };

          // Accumulate user totals
          userTotalBaseSalary += rowData.baseSalary;
          userTotalHourlyWage += rowData.hourlyWage;
          userTotalResponsibility += rowData.responsibility;
          userTotalTravelExpense += rowData.travelExpense;
          userTotalCommissionBonus += rowData.commissionBonus;
          userTotalOtherBonus += rowData.otherBonus;
          userTotalAllowanceGeneral += rowData.allowanceGeneral; // Added
          userTotalWeekdayOvertime += rowData.weekdayOvertime;
          userTotalWeekendOvertime += rowData.weekendOvertime;
          userTotalHolidayOvertime += rowData.holidayOvertime;
          userTotalOvertimePay += rowData.overtimePay;
          userTotalTaxableIncome += rowData.taxableIncome;
          userTotalGrossSalary += rowData.grossSalary;
          userTotalTax += rowData.tax;
          userTotalCurrentSalary += rowData.currentSalary;

          // Add to global totals
          totalBaseSalary += rowData.baseSalary;
          totalHourlyWage += rowData.hourlyWage;
          totalResponsibility += rowData.responsibility;
          totalTravelExpense += rowData.travelExpense;
          totalCommissionBonus += rowData.commissionBonus;
          totalOtherBonus += rowData.otherBonus;
          totalAllowanceGeneral += rowData.allowanceGeneral; // Added
          totalWeekdayOvertime += rowData.weekdayOvertime;
          totalWeekendOvertime += rowData.weekendOvertime;
          totalHolidayOvertime += rowData.holidayOvertime;
          totalOvertimePay += rowData.overtimePay;
          totalTaxableIncome += rowData.taxableIncome;
          totalGrossSalary += rowData.grossSalary;
          totalTax += rowData.tax;
          totalCurrentSalary += rowData.currentSalary;
          totalRecords++;

          const dataRow = worksheet.getRow(currentRow++);

          // Set values for each cell (now 20 columns)
          dataRow.getCell(1).value = rowData.stt;
          dataRow.getCell(2).value = rowData.name;
          dataRow.getCell(3).value = rowData.month;
          dataRow.getCell(4).value = rowData.year;
          dataRow.getCell(5).value = rowData.baseSalary;
          dataRow.getCell(6).value = rowData.hourlyWage;
          dataRow.getCell(7).value = rowData.responsibility;
          dataRow.getCell(8).value = rowData.travelExpense;
          dataRow.getCell(9).value = rowData.commissionBonus;
          dataRow.getCell(10).value = rowData.otherBonus;
          dataRow.getCell(11).value = rowData.allowanceGeneral; // Added
          dataRow.getCell(12).value = rowData.weekdayOvertime;
          dataRow.getCell(13).value = rowData.weekendOvertime;
          dataRow.getCell(14).value = rowData.holidayOvertime;
          dataRow.getCell(15).value = rowData.overtimePay;
          dataRow.getCell(16).value = rowData.taxableIncome;
          dataRow.getCell(17).value = rowData.grossSalary;
          dataRow.getCell(18).value = rowData.tax;
          dataRow.getCell(19).value = rowData.currentSalary;
          dataRow.getCell(20).value = rowData.costCenter;

          // Format each cell in the data row
          dataRow.eachCell((cell, colNumber) => {
            cell.font = { size: 8, name: "Arial" };
            cell.border = {
              top: { style: "thin", color: { argb: "FF000000" } },
              left: { style: "thin", color: { argb: "FF000000" } },
              bottom: { style: "thin", color: { argb: "FF000000" } },
              right: { style: "thin", color: { argb: "FF000000" } },
            };

            // Alternate row colors for readability
            if (recordIndex % 2 === 0) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF9F9F9" },
              };
            }

            // Alignment based on column
            if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
              // STT, Month, Year
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else if (colNumber >= 5 && colNumber <= 11) {
              // Salary fields (5-11): baseSalary to allowanceGeneral
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "#,##0";
            } else if (colNumber >= 12 && colNumber <= 14) {
              // Overtime hours (12-14)
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.numFmt = "0.0";
            } else if (colNumber >= 15 && colNumber <= 19) {
              // Other salary fields (15-19): overtimePay to currentSalary
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "#,##0";
            } else if (colNumber === 20) {
              // Cost center
              cell.alignment = { horizontal: "left", vertical: "middle" };
            } else {
              cell.alignment = {
                horizontal: "left",
                vertical: "middle",
                wrapText: true,
              };
            }
          });

          dataRow.height = 18;
        });

        // Add user summary row
        const userSummaryRow = worksheet.getRow(currentRow++);
        userSummaryRow.height = 20;

        // Calculate user averages
        const userRecordCount = userRecords.length;
        const userAverageCurrentSalary =
          userRecordCount > 0
            ? Math.round(userTotalCurrentSalary / userRecordCount)
            : 0;
        const userAverageTax =
          userRecordCount > 0 ? Math.round(userTotalTax / userRecordCount) : 0;

        // User summary row with merged cells
        worksheet.mergeCells(`A${currentRow - 1}:B${currentRow - 1}`);
        userSummaryRow.getCell(1).value = "Tổng hợp:";
        userSummaryRow.getCell(1).font = {
          bold: true,
          size: 9,
          name: "Arial",
          italic: true,
        };
        userSummaryRow.getCell(1).alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        // Set user summary values (now 20 columns)
        userSummaryRow.getCell(3).value = ""; // Month column
        userSummaryRow.getCell(4).value = ""; // Year column
        userSummaryRow.getCell(5).value = userTotalBaseSalary;
        userSummaryRow.getCell(6).value = userTotalHourlyWage;
        userSummaryRow.getCell(7).value = userTotalResponsibility;
        userSummaryRow.getCell(8).value = userTotalTravelExpense;
        userSummaryRow.getCell(9).value = userTotalCommissionBonus;
        userSummaryRow.getCell(10).value = userTotalOtherBonus;
        userSummaryRow.getCell(11).value = userTotalAllowanceGeneral; // Added
        userSummaryRow.getCell(12).value = userTotalWeekdayOvertime;
        userSummaryRow.getCell(13).value = userTotalWeekendOvertime;
        userSummaryRow.getCell(14).value = userTotalHolidayOvertime;
        userSummaryRow.getCell(15).value = userTotalOvertimePay;
        userSummaryRow.getCell(16).value = userTotalTaxableIncome;
        userSummaryRow.getCell(17).value = userTotalGrossSalary;
        userSummaryRow.getCell(18).value = userTotalTax;
        userSummaryRow.getCell(19).value = userTotalCurrentSalary;
        userSummaryRow.getCell(19).font = {
          bold: true,
          size: 9,
          name: "Arial",
        };

        // Merge last two cells for note
        worksheet.mergeCells(`T${currentRow - 1}:U${currentRow - 1}`); // Updated from S:T to T:U
        userSummaryRow.getCell(20).value =
          `TB: ${userAverageCurrentSalary.toLocaleString()} | Thuế TB: ${userAverageTax.toLocaleString()}`;
        userSummaryRow.getCell(20).font = { size: 8, name: "Arial" };
        userSummaryRow.getCell(20).alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        // Format user summary row
        userSummaryRow.eachCell((cell, colNumber) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0FFF0" },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } },
          };
          cell.font = { size: 8, name: "Arial" };

          // Alignment for summary row
          if (colNumber === 1 || colNumber === 2) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else if (colNumber >= 5 && colNumber <= 11) {
            // Updated range for allowanceGeneral
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "#,##0";
          } else if (colNumber >= 12 && colNumber <= 14) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.numFmt = "0.0";
          } else if (colNumber >= 15 && colNumber <= 19) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "#,##0";
          } else if (colNumber === 20 || colNumber === 21) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else if (colNumber === 3 || colNumber === 4) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        });

        // Add empty row between users
        currentRow++;
      });

      // Add empty row between cost centers
      const separatorRow = worksheet.getRow(currentRow++);
      separatorRow.height = 5;
      worksheet.mergeCells(`A${currentRow - 1}:T${currentRow - 1}`); // Updated from S to T
      separatorRow.getCell(1).value = "";
      separatorRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" },
      };

      for (let i = 1; i <= columnsCount; i++) {
        separatorRow.getCell(i).border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };
      }
    });

    // Add grand total row
    const totalRowIndex = currentRow;
    const totalRow = worksheet.getRow(totalRowIndex);
    totalRow.height = 22;

    // Merge cells for total label
    worksheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`);
    totalRow.getCell(1).value = "TỔNG CỘNG";
    totalRow.getCell(1).font = { bold: true, size: 10, name: "Arial" };
    totalRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE6E6E6" },
    };
    totalRow.getCell(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // Add totals for each column
    const totals = [
      { col: 5, value: totalBaseSalary }, // baseSalary
      { col: 6, value: totalHourlyWage }, // hourlyWage
      { col: 7, value: totalResponsibility }, // responsibility
      { col: 8, value: totalTravelExpense }, // travelExpense
      { col: 9, value: totalCommissionBonus }, // commissionBonus
      { col: 10, value: totalOtherBonus }, // otherBonus
      { col: 11, value: totalAllowanceGeneral }, // allowanceGeneral
      { col: 12, value: totalWeekdayOvertime }, // weekdayOvertime
      { col: 13, value: totalWeekendOvertime }, // weekendOvertime
      { col: 14, value: totalHolidayOvertime }, // holidayOvertime
      { col: 15, value: totalOvertimePay }, // overtimePay
      { col: 16, value: totalTaxableIncome }, // taxableIncome
      { col: 17, value: totalGrossSalary }, // grossSalary
      { col: 18, value: totalTax }, // tax
      { col: 19, value: totalCurrentSalary }, // currentSalary
    ];

    totals.forEach((total) => {
      const cell = totalRow.getCell(total.col);
      cell.value = total.value;
      cell.font = { bold: true, size: 9, name: "Arial" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6E6" },
      };

      if (total.col >= 12 && total.col <= 14) {
        // Overtime hours
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.numFmt = "0.0";
      } else {
        // Money fields
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "#,##0";
      }
    });

    // Add borders to total row
    for (let i = 1; i <= columnsCount; i++) {
      totalRow.getCell(i).border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }

    // Add summary section if requested
    if (includeSummary === "true") {
      // Add empty rows before summary
      currentRow += 2;
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Add summary title
      const summaryTitleRow = worksheet.getRow(currentRow++);
      worksheet.mergeCells(
        `A${summaryTitleRow.number}:T${summaryTitleRow.number}`, // Updated from S to T
      );
      summaryTitleRow.getCell(1).value = "TỔNG HỢP THỐNG KÊ";
      summaryTitleRow.getCell(1).font = { bold: true, size: 14, name: "Arial" };
      summaryTitleRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      summaryTitleRow.height = 25;

      // Calculate averages
      const averageCurrentSalary = Math.round(
        totalCurrentSalary / totalRecords,
      );
      const averageTax = Math.round(totalTax / totalRecords);
      const averageBaseSalary = Math.round(totalBaseSalary / totalRecords);
      const averageAllowanceGeneral = Math.round(
        totalAllowanceGeneral / totalRecords,
      ); // Added

      // Add summary data in a compact format
      const summaryData = [
        [
          "Tổng số bản ghi",
          totalRecords,
          "Tổng lương thực lĩnh",
          totalCurrentSalary,
        ],
        ["Tổng thuế", totalTax, "Thuế TB", averageTax],
        [
          "Tổng lương gộp",
          totalGrossSalary,
          "Lương TB thực lĩnh",
          averageCurrentSalary,
        ],
        [
          "Tổng lương cơ bản",
          totalBaseSalary,
          "Lương TB cơ bản",
          averageBaseSalary,
        ],
        [
          "Tổng phụ cấp chung",
          totalAllowanceGeneral,
          "Phụ cấp TB",
          averageAllowanceGeneral,
        ],
      ];

      summaryData.forEach((row, index) => {
        const summaryRow = worksheet.getRow(currentRow++);
        summaryRow.height = 18;

        // Create two columns of summary data
        worksheet.mergeCells(`A${summaryRow.number}:C${summaryRow.number}`);
        summaryRow.getCell(1).value = row[0];
        summaryRow.getCell(1).font = { size: 9, name: "Arial" };
        summaryRow.getCell(1).alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        worksheet.mergeCells(`D${summaryRow.number}:F${summaryRow.number}`);
        summaryRow.getCell(4).value = row[1];
        summaryRow.getCell(4).font = { bold: true, size: 9, name: "Arial" };
        summaryRow.getCell(4).alignment = {
          horizontal: "right",
          vertical: "middle",
        };
        summaryRow.getCell(4).numFmt =
          typeof row[1] === "number" ? "#,##0" : "0";

        worksheet.mergeCells(`G${summaryRow.number}:I${summaryRow.number}`);
        summaryRow.getCell(7).value = row[2];
        summaryRow.getCell(7).font = { size: 9, name: "Arial" };
        summaryRow.getCell(7).alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        worksheet.mergeCells(`J${summaryRow.number}:L${summaryRow.number}`);
        summaryRow.getCell(10).value = row[3];
        summaryRow.getCell(10).font = { bold: true, size: 9, name: "Arial" };
        summaryRow.getCell(10).alignment = {
          horizontal: "right",
          vertical: "middle",
        };
        summaryRow.getCell(10).numFmt =
          typeof row[3] === "number" ? "#,##0" : "0";

        // Add borders
        for (let i = 1; i <= 12; i++) {
          if (summaryRow.getCell(i)) {
            summaryRow.getCell(i).border = {
              top: { style: "thin", color: { argb: "FF000000" } },
              left: { style: "thin", color: { argb: "FF000000" } },
              bottom: { style: "thin", color: { argb: "FF000000" } },
              right: { style: "thin", color: { argb: "FF000000" } },
            };

            // Alternate row colors
            if (index % 2 === 0) {
              summaryRow.getCell(i).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF0F8FF" },
              };
            }
          }
        }
      });
    }

    // Add signature section
    currentRow += 3;
    const signatureRow = worksheet.getRow(currentRow);
    const signatureColumn = String.fromCharCode(
      64 + Math.floor(columnsCount / 2),
    );
    signatureRow.getCell(signatureColumn).value = "ĐẠI DIỆN CÔNG TY";
    signatureRow.getCell(signatureColumn).font = {
      bold: true,
      size: 11,
      name: "Arial",
    };
    signatureRow.getCell(signatureColumn).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    signatureRow.height = 20;

    // Set print area
    const printAreaEnd = currentRow + 2;
    worksheet.pageSetup.printArea = `A1:${String.fromCharCode(
      64 + columnsCount,
    )}${printAreaEnd}`;

    // Freeze header row
    worksheet.views = [
      { state: "frozen", xSplit: 0, ySplit: 5, activeCell: "A6" },
    ];

    // Set response headers
    let fileName = month
      ? `BaoCaoLuong_Thang${month}_${year}_TheoTrạmVàNhanVien`
      : `BaoCaoLuong_Nam${year}_TheoTrạmVàNhanVien`;

    if (costCenter) {
      const sanitizedCostCenter = costCenter.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        "",
      );
      fileName += `_${sanitizedCostCenter}`;
    }
    if (realName) {
      const sanitizedRealName = realName.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        "",
      );
      fileName += `_${sanitizedRealName}`;
    }
    fileName += ".xlsx";

    const encodedFileName = encodeURIComponent(fileName).replace(
      /['()]/g,
      escape,
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
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

// Add this function to exports.getAllUserMonthlyRecord
exports.getUserMonthlyRecords = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user has permission
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
      return res
        .status(403)
        .json({ message: "Truy cập bị từ chối. Bạn không có quyền truy cập." });
    }

    // Get all monthly records for this user
    const records = await UserMonthlyRecord.find({ userId })
      .populate("costCenter", "name")
      .populate({
        path: "assignedManager",
        select: "username realName",
      })
      .sort({ recordYear: -1, recordMonth: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendSalaryCalculationEmails = async (req, res) => {
  try {
    const { userIds, month, year } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        message: "Vui lòng chọn ít nhất một nhân viên",
      });
    }

    if (!month || !year) {
      return res.status(400).json({
        message: "Vui lòng chọn tháng và năm",
      });
    }

    // Check permission
    const allowedRoles = [
      "superAdmin",
      "director",
      "deputyDirector",
      "headOfAccounting",
    ];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền gửi email bảng lương",
      });
    }

    // Fetch selected users with their monthly records
    const users = await User.find({ _id: { $in: userIds } });

    if (users.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy nhân viên đã chọn",
      });
    }

    // Check for users without email
    const usersWithoutEmail = users.filter(
      (user) => !user.email || user.email.trim() === "",
    );

    if (usersWithoutEmail.length > 0) {
      const userNames = usersWithoutEmail
        .map((u) => u.realName || u.username)
        .join(", ");
      return res.status(400).json({
        message: `Các nhân viên sau không có email: ${userNames}. Vui lòng cập nhật email trước khi gửi.`,
        usersWithoutEmail: usersWithoutEmail.map((u) => ({
          id: u._id,
          name: u.realName || u.username,
        })),
      });
    }

    // Get monthly records for the selected users
    const records = await UserMonthlyRecord.find({
      userId: { $in: userIds },
      recordMonth: parseInt(month),
      recordYear: parseInt(year),
    }).populate("costCenter");

    if (records.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy bản ghi lương cho tháng/năm đã chọn",
      });
    }

    const emailService = require("../utils/emailService");
    const results = [];
    let successfulCount = 0;
    let failedCount = 0;

    // Calculate previous month and year for display
    let displayMonth, displayYear;
    if (parseInt(month) === 1) {
      displayMonth = 12;
      displayYear = parseInt(year) - 1;
    } else {
      displayMonth = parseInt(month) - 1;
      displayYear = parseInt(year);
    }

    // Send emails to each user
    for (const user of users) {
      const userRecord = records.find(
        (r) => r.userId.toString() === user._id.toString(),
      );

      if (!userRecord) {
        results.push({
          userId: user._id,
          username: user.username,
          realName: user.realName,
          status: "failed",
          reason: "Không tìm thấy bản ghi lương",
        });
        failedCount++;
        continue;
      }

      try {
        const subject = `Bảng lương tháng ${displayMonth}/${displayYear} - ${user.realName}`;
        const htmlContent = emailService.generateSalaryEmailContent(user, {
          month,
          year,
          baseSalary: userRecord.baseSalary,
          commissionBonus: userRecord.commissionBonus,
          responsibility: userRecord.responsibility,
          otherBonus: userRecord.otherBonus,
          allowanceGeneral: userRecord.allowanceGeneral || 0,
          overtimePay: userRecord.overtimePay,
          travelExpense: userRecord.travelExpense,
          grossSalary: userRecord.grossSalary,
          mandatoryInsurance: userRecord.mandatoryInsurance,
          tax: userRecord.tax,
          currentSalary: userRecord.currentSalary,
        });

        const result = await emailService.sendSalaryEmail(
          user.email,
          subject,
          htmlContent,
        );

        if (result.success) {
          results.push({
            userId: user._id,
            username: user.username,
            realName: user.realName,
            email: user.email,
            status: "success",
            messageId: result.messageId,
            salaryPeriod: {
              displayMonth,
              displayYear,
              recordedMonth: parseInt(month),
              recordedYear: parseInt(year),
            },
          });
          successfulCount++;
        } else {
          results.push({
            userId: user._id,
            username: user.username,
            realName: user.realName,
            email: user.email,
            status: "failed",
            reason: result.error,
          });
          failedCount++;
        }
      } catch (error) {
        results.push({
          userId: user._id,
          username: user.username,
          realName: user.realName,
          email: user.email,
          status: "failed",
          reason: error.message,
        });
        failedCount++;
      }
    }

    res.json({
      message: `Đã gửi email bảng lương tháng ${displayMonth}/${displayYear} thành công cho ${successfulCount}/${users.length} nhân viên`,
      total: users.length,
      successful: successfulCount,
      failed: failedCount,
      salaryPeriod: {
        display: `Tháng ${displayMonth}/${displayYear}`,
        recorded: `Tháng ${month}/${year}`,
      },
      details: results,
    });
  } catch (error) {
    console.error("Error sending salary emails:", error);
    res.status(500).json({
      message: "Lỗi khi gửi email: " + error.message,
    });
  }
};

// Also add a function to update email only
exports.updateUserEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        message: "Thiếu userId hoặc email",
      });
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Email không hợp lệ",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy nhân viên",
      });
    }

    // Check if email already exists for another user
    const existingUser = await User.findOne({
      email: email.trim().toLowerCase(),
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email đã được sử dụng bởi nhân viên khác",
      });
    }

    user.email = email.trim().toLowerCase();
    await user.save();

    res.json({
      message: "Cập nhật email thành công",
      user: {
        id: user._id,
        username: user.username,
        realName: user.realName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error updating user email:", error);
    res.status(500).json({
      message: "Lỗi khi cập nhật email: " + error.message,
    });
  }
};
