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
      otherBonus,
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
      otherBonus: otherBonus || 0,
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
      otherBonus,
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
        record.userId !== null && record.assignedManager?.role !== "superAdmin"
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
        record.userId !== null && record.assignedManager?.role !== "superAdmin"
    );

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
      0
    );
    const totalTax = records.reduce(
      (sum, record) => sum + Math.ceil(record.tax || 0),
      0
    );
    const totalGross = records.reduce(
      (sum, record) => sum + Math.ceil(record.grossSalary || 0),
      0
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
                }
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
                }
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
        0
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
              "vi-VN"
            )} VND\n`,
            style: "summaryText",
          },
          {
            text: `Tổng thuế thu nhập: ${totalTax.toLocaleString(
              "vi-VN"
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
        ""
      );
      fileName += `_${sanitizedCostCenter}`;
    }
    fileName += ".pdf";

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
      .sort({ recordMonth: 1, realName: 1 }); // Sort by month, then name

    // Filter out records where:
    // 1. userId is null (due to populate match filter)
    // 2. assignedManager has role "superAdmin"
    records = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin"
    );

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

    // Apply realName filter
    if (realName) {
      if (realNameReverse === "true") {
        records = records.filter(
          (record) =>
            !record.realName ||
            !record.realName.toLowerCase().includes(realName.toLowerCase())
        );
      } else {
        records = records.filter(
          (record) =>
            record.realName &&
            record.realName.toLowerCase().includes(realName.toLowerCase())
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

    const columnsCount = 19; // All fields

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

    // Add data rows starting from row 6
    let totalBaseSalary = 0;
    let totalHourlyWage = 0;
    let totalResponsibility = 0;
    let totalTravelExpense = 0;
    let totalCommissionBonus = 0;
    let totalOtherBonus = 0;
    let totalWeekdayOvertime = 0;
    let totalWeekendOvertime = 0;
    let totalHolidayOvertime = 0;
    let totalOvertimePay = 0;
    let totalTaxableIncome = 0;
    let totalGrossSalary = 0;
    let totalTax = 0;
    let totalCurrentSalary = 0;

    records.forEach((record, index) => {
      const rowData = {
        stt: index + 1,
        name: record.realName || "N/A",
        month: record.recordMonth,
        year: record.recordYear,
        baseSalary: Math.ceil(record.baseSalary || 0),
        hourlyWage: Math.ceil(record.hourlyWage || 0),
        responsibility: Math.ceil(record.responsibility || 0),
        travelExpense: Math.ceil(record.travelExpense || 0),
        commissionBonus: Math.ceil(record.commissionBonus || 0),
        otherBonus: Math.ceil(record.otherBonus || 0),
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

      // Accumulate totals
      totalBaseSalary += rowData.baseSalary;
      totalHourlyWage += rowData.hourlyWage;
      totalResponsibility += rowData.responsibility;
      totalTravelExpense += rowData.travelExpense;
      totalCommissionBonus += rowData.commissionBonus;
      totalOtherBonus += rowData.otherBonus;
      totalWeekdayOvertime += rowData.weekdayOvertime;
      totalWeekendOvertime += rowData.weekendOvertime;
      totalHolidayOvertime += rowData.holidayOvertime;
      totalOvertimePay += rowData.overtimePay;
      totalTaxableIncome += rowData.taxableIncome;
      totalGrossSalary += rowData.grossSalary;
      totalTax += rowData.tax;
      totalCurrentSalary += rowData.currentSalary;

      const dataRow = worksheet.addRow(rowData);

      // Format each cell in the data row
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 8, name: "Arial" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };

        // Alignment based on column
        if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
          // STT, Month, Year
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colNumber >= 5 && colNumber <= 10) {
          // Salary fields (5-10): baseSalary to otherBonus
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0";
        } else if (colNumber >= 11 && colNumber <= 13) {
          // Overtime hours (11-13)
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.numFmt = "0.0";
        } else if (colNumber >= 14 && colNumber <= 18) {
          // Other salary fields (14-18): overtimePay to currentSalary
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0";
        } else if (colNumber === 19) {
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

    // Add total row after all data
    const totalRowIndex = worksheet.lastRow.number + 1;
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
      { col: 11, value: totalWeekdayOvertime }, // weekdayOvertime
      { col: 12, value: totalWeekendOvertime }, // weekendOvertime
      { col: 13, value: totalHolidayOvertime }, // holidayOvertime
      { col: 14, value: totalOvertimePay }, // overtimePay
      { col: 15, value: totalTaxableIncome }, // taxableIncome
      { col: 16, value: totalGrossSalary }, // grossSalary
      { col: 17, value: totalTax }, // tax
      { col: 18, value: totalCurrentSalary }, // currentSalary
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

      if (total.col >= 11 && total.col <= 13) {
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
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Add summary title
      const summaryTitleRow = worksheet.addRow([]);
      worksheet.mergeCells(
        `A${summaryTitleRow.number}:S${summaryTitleRow.number}`
      );
      summaryTitleRow.getCell(1).value = "TỔNG HỢP THỐNG KÊ";
      summaryTitleRow.getCell(1).font = { bold: true, size: 14, name: "Arial" };
      summaryTitleRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      summaryTitleRow.height = 25;

      // Add summary headers
      const summaryHeaders = [
        "Chỉ số",
        "Giá trị",
        "Chỉ số",
        "Giá trị",
        "Chỉ số",
        "Giá trị",
        "Chỉ số",
        "Giá trị",
      ];

      const summaryHeaderRow = worksheet.addRow(summaryHeaders);
      summaryHeaderRow.height = 22;
      summaryHeaderRow.eachCell((cell) => {
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

      // Calculate averages
      const averageCurrentSalary = Math.round(
        totalCurrentSalary / records.length
      );
      const averageTax = Math.round(totalTax / records.length);
      const averageBaseSalary = Math.round(totalBaseSalary / records.length);

      // Add summary data - organized in 4 columns
      const summaryData = [
        [
          "Tổng số bản ghi",
          records.length,
          "Tổng lương cơ bản",
          totalBaseSalary,
          "Tổng lương giờ",
          totalHourlyWage,
          "Tổng trách nhiệm",
          totalResponsibility,
        ],
        [
          "Tổng công tác phí",
          totalTravelExpense,
          "Tổng hoa hồng",
          totalCommissionBonus,
          "Tổng thưởng khác",
          totalOtherBonus,
          "Tổng giờ TC tuần",
          totalWeekdayOvertime,
        ],
        [
          "Tổng giờ TC CN",
          totalWeekendOvertime,
          "Tổng giờ TC lễ",
          totalHolidayOvertime,
          "Tổng lương tăng ca",
          totalOvertimePay,
          "Tổng lương tính thuế",
          totalTaxableIncome,
        ],
        [
          "Tổng lương gộp",
          totalGrossSalary,
          "Tổng thuế",
          totalTax,
          "Tổng lương thực lĩnh",
          totalCurrentSalary,
          "Lương TB thực lĩnh",
          averageCurrentSalary,
        ],
        [
          "Thuế TB",
          averageTax,
          "Lương TB cơ bản",
          averageBaseSalary,
          "",
          "",
          "",
          "",
        ],
      ];

      summaryData.forEach((row) => {
        const summaryRow = worksheet.addRow(row);
        summaryRow.height = 20;

        summaryRow.eachCell((cell, colNumber) => {
          cell.font = { size: 8, name: "Arial" };
          cell.border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } },
          };

          if (colNumber % 2 === 0) {
            // Even columns (values)
            cell.alignment = { horizontal: "right", vertical: "middle" };
            if (typeof row[colNumber - 1] === "number") {
              if (
                colNumber === 2 ||
                colNumber === 4 ||
                colNumber === 6 ||
                colNumber === 8
              ) {
                // Check which columns contain hours vs money
                const headerText = summaryHeaders[colNumber - 2];
                if (headerText.includes("giờ") || headerText.includes("TC")) {
                  // Overtime hours
                  cell.numFmt = "0.0";
                } else if (headerText === "Tổng số bản ghi") {
                  // Count field
                  cell.numFmt = "0";
                } else {
                  // Money fields
                  cell.numFmt = "#,##0";
                }
              }
            }
          } else {
            // Odd columns (labels)
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      });

      // Add final summary row with key metrics
      const finalSummaryRow = worksheet.addRow([]);
      finalSummaryRow.height = 22;
      worksheet.mergeCells(
        `A${finalSummaryRow.number}:H${finalSummaryRow.number}`
      );

      finalSummaryRow.getCell(1).value = `TỔNG KẾT: ${
        records.length
      } bản ghi | Tổng lương thực lĩnh: ${totalCurrentSalary.toLocaleString()} VND | Thuế trung bình: ${averageTax.toLocaleString()} VND`;
      finalSummaryRow.getCell(1).font = {
        bold: true,
        size: 10,
        name: "Arial",
        color: { argb: "FF0000FF" },
      };
      finalSummaryRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" },
      };
      finalSummaryRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      for (let i = 1; i <= 8; i++) {
        finalSummaryRow.getCell(i).border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      }
    }

    // Add empty rows for spacing before signature
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Add signature section
    const signatureRowIndex = worksheet.lastRow.number + 1;
    const signatureRow = worksheet.getRow(signatureRowIndex);
    const signatureColumn = String.fromCharCode(
      64 + Math.floor(columnsCount / 2)
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
    const printAreaEnd = signatureRowIndex + 2;
    worksheet.pageSetup.printArea = `A1:${String.fromCharCode(
      64 + columnsCount
    )}${printAreaEnd}`;

    // Freeze header row
    worksheet.views = [
      { state: "frozen", xSplit: 0, ySplit: 5, activeCell: "A6" },
    ];

    // Set response headers
    let fileName = month
      ? `BaoCaoLuong_Thang${month}_${year}`
      : `BaoCaoLuong_Nam${year}`;

    if (costCenter) {
      const sanitizedCostCenter = costCenter.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        ""
      );
      fileName += `_${sanitizedCostCenter}`;
    }
    if (realName) {
      const sanitizedRealName = realName.replace(
        /[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\s-]/g,
        ""
      );
      fileName += `_${sanitizedRealName}`;
    }
    fileName += ".xlsx";

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
