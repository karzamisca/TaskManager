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
        "headOfProject",
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
        "headOfProject",
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
      "headOfProject",
    ];

    const managers = await User.find({
      role: { $in: privilegedRoles },
    }).select("_id username role");

    res.json(managers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const privilegedRoles = [
      "superAdmin",
      "deputyDirector",
      "director",
      "headOfAccounting",
    ];

    const baseQuery = {
      role: { $nin: privilegedRoles },
    };

    let finalQuery = { ...baseQuery };

    if (!privilegedRoles.includes(req.user.role)) {
      finalQuery.assignedManager = req._id;
    }

    const users = await User.find(finalQuery).populate("costCenter").populate({
      path: "assignedManager",
      select: "username role",
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
        "headOfProject",
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
        "headOfProject",
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
      dayOff,
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
      dayOff: dayOff || 0,
    });

    const savedUser = await newUser.save();
    await savedUser.populate("costCenter");
    res.status(201).json(savedUser);
  } catch (err) {
    console.error("Create user error:", err);
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
        "headOfProject",
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
      dayOff,
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
    if (commissionBonus !== undefined) user.commissionBonus = commissionBonus;
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
    if (dayOff !== undefined) user.dayOff = dayOff;

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
    console.error("Update user error:", err);
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
        "headOfProject",
      ].includes(req.user.role)
    ) {
      return res.send("Truy cập bị từ chối. Bạn không có quyền truy cập.");
    }

    const costCenters = await CostCenter.find();

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

    let matchQuery = {};

    if (!privilegedRoles.includes(req.user.role)) {
      matchQuery.assignedManager = req.user._id;
    }

    const records = await UserMonthlyRecord.find(matchQuery)
      .populate({
        path: "userId",
        select: "username role",
        match: { role: { $nin: privilegedRoles } },
      })
      .populate("costCenter", "name")
      .populate({
        path: "assignedManager",
        select: "username role",
      })
      .sort({ recordYear: -1, recordMonth: -1 });

    const filteredRecords = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin",
    );

    res.json(filteredRecords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Font URLs and helper functions
const FONT_URLS = {
  normal: "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
  bold: "https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap",
  italics:
    "https://fonts.googleapis.com/css2?family=Roboto:ital@1&display=swap",
  bolditalics:
    "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@1,700&display=swap",
};

const FONT_CACHE_DIR = path.join(__dirname, "../font_cache");

if (!fs.existsSync(FONT_CACHE_DIR)) {
  fs.mkdirSync(FONT_CACHE_DIR);
}

async function getFontUrl(type) {
  try {
    const response = await axios.get(FONT_URLS[type]);
    const css = response.data;
    const fontUrl = css.match(/src:\s*url\(([^)]+)\)/)[1];
    return fontUrl.replace(/^['"]|['"]$/g, "");
  } catch (error) {
    console.error(`Error getting font URL for ${type}:`, error);
    throw new Error(`Could not retrieve font URL for ${type}`);
  }
}

async function downloadFont(type) {
  const fontPath = path.join(FONT_CACHE_DIR, `Roboto-${type}.ttf`);

  if (fs.existsSync(fontPath)) {
    return fontPath;
  }

  try {
    const fontUrl = await getFontUrl(type);
    const response = await axios.get(fontUrl, {
      responseType: "arraybuffer",
    });
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

    const query = {
      recordYear: parseInt(year),
    };

    if (month) {
      query.recordMonth = parseInt(month);
    }

    if (!fullAccessRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    let records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role realName",
        match: { role: { $nin: privilegedRoles } },
      })
      .populate("costCenter")
      .populate({
        path: "assignedManager",
        select: "role",
      })
      .sort({ recordMonth: 1, realName: 1 });

    records = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin",
    );

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

    records.sort((a, b) => {
      if (a.recordMonth < b.recordMonth) return -1;
      if (a.recordMonth > b.recordMonth) return 1;

      const costCenterA = a.costCenter?.name || "";
      const costCenterB = b.costCenter?.name || "";
      if (costCenterA < costCenterB) return -1;
      if (costCenterA > costCenterB) return 1;

      const nameA = a.realName || "";
      const nameB = b.realName || "";
      return nameA.localeCompare(nameB);
    });

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

    const reportTitle = month
      ? `DANH SÁCH CHI LƯƠNG THÁNG ${month} NĂM ${year}`
      : `DANH SÁCH CHI LƯƠNG NĂM ${year}`;

    const description = month
      ? `(Kèm theo Hợp đồng Dịch vụ chi lương số 41/HDCL-HDBCH ngày 15 tháng 09 năm 2022 được kì kết giữa Ngân Hàng TMCP Phát Triển TP. Hồ Chí Minh – Chi nhánh Cộng Hòa và Công ty TNHH Đầu Tư Thương Mại Dịch Vụ Kỳ Long)`
      : `Báo cáo chi lương cả năm ${year}`;

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

    if (!month) {
      const userSummary = {};

      records.forEach((record) => {
        const userName = record.realName || "N/A";
        const costCenterName = record.costCenter?.name || "N/A";
        const salary = Math.ceil(record.currentSalary);
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

      const summaryArray = Object.values(userSummary).map((user) => ({
        ...user,
        monthsCount: user.monthsWorked.size,
      }));

      summaryArray.sort((a, b) => {
        const costCenterA = a.costCenter || "";
        const costCenterB = b.costCenter || "";
        if (costCenterA < costCenterB) return -1;
        if (costCenterA > costCenterB) return 1;
        return a.userName.localeCompare(b.userName);
      });

      const summaryTotalSalary = summaryArray.reduce(
        (sum, user) => sum + user.totalSalary,
        0,
      );

      content.push({
        text: "TỔNG HỢP LƯƠNG CẢ NĂM THEO NHÂN VIÊN",
        style: "summaryHeader",
        margin: [0, 20, 0, 10],
      });

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
              {},
              {},
              {},
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

    content.push({
      text: `Tổng lương thực lĩnh: ${totalSalary.toLocaleString("vi-VN")} VND`,
      style: "total",
      margin: [0, 15, 0, 0],
    });

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

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

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

    const query = {
      recordYear: parseInt(year),
    };

    if (month) {
      query.recordMonth = parseInt(month);
    }

    if (!fullAccessRoles.includes(req.user.role)) {
      query.assignedManager = req.user._id;
    }

    let records = await UserMonthlyRecord.find(query)
      .populate({
        path: "userId",
        select: "username role realName",
        match: { role: { $nin: privilegedRoles } },
      })
      .populate("costCenter")
      .populate({
        path: "assignedManager",
        select: "role",
      })
      .sort({ recordMonth: 1, realName: 1 });

    records = records.filter(
      (record) =>
        record.userId !== null && record.assignedManager?.role !== "superAdmin",
    );

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

    const sortedCostCenters = Object.keys(groupedRecords).sort();

    const workbook = new ExcelJS.Workbook();
    const worksheetName = month
      ? `Chi tiết lương tháng ${month}-${year}`
      : `Chi tiết lương năm ${year}`;
    const worksheet = workbook.addWorksheet(worksheetName);

    worksheet.pageSetup = {
      paperSize: 9,
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

    const reportTitle = month
      ? `BÁO CÁO CHI TIẾT LƯƠNG THÁNG ${month} NĂM ${year}`
      : `BÁO CÁO CHI TIẾT LƯƠNG NĂM ${year}`;

    const columnsCount = 21; // Increased from 20 to 21 for dayOff

    worksheet.mergeCells(`A1:${String.fromCharCode(64 + columnsCount)}1`);
    worksheet.getCell("A1").value = reportTitle;
    worksheet.getCell("A1").font = { bold: true, size: 16, name: "Arial" };
    worksheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getRow(1).height = 25;

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

    worksheet.addRow([]);

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
      { header: "Phụ cấp chung", key: "allowanceGeneral", width: 11 },
      { header: "Ngày nghỉ (KL)", key: "dayOff", width: 10 },
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

    worksheet.columns = headers;

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

    let totalRecords = 0;
    let totalBaseSalary = 0;
    let totalHourlyWage = 0;
    let totalResponsibility = 0;
    let totalTravelExpense = 0;
    let totalCommissionBonus = 0;
    let totalOtherBonus = 0;
    let totalAllowanceGeneral = 0;
    let totalDayOff = 0;
    let totalWeekdayOvertime = 0;
    let totalWeekendOvertime = 0;
    let totalHolidayOvertime = 0;
    let totalOvertimePay = 0;
    let totalTaxableIncome = 0;
    let totalGrossSalary = 0;
    let totalTax = 0;
    let totalCurrentSalary = 0;

    let currentRow = 6;
    let globalIndex = 1;

    sortedCostCenters.forEach((costCenterName, costCenterIndex) => {
      const costCenterRow = worksheet.getRow(currentRow++);
      costCenterRow.height = 22;

      worksheet.mergeCells(`A${currentRow - 1}:U${currentRow - 1}`);
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

      const usersInCostCenter = Object.keys(
        groupedRecords[costCenterName],
      ).sort();

      usersInCostCenter.forEach((userName, userIndex) => {
        const userRecords = groupedRecords[costCenterName][userName];

        userRecords.sort((a, b) => a.recordMonth - b.recordMonth);

        const userHeaderRow = worksheet.getRow(currentRow++);
        userHeaderRow.height = 20;

        worksheet.mergeCells(`A${currentRow - 1}:U${currentRow - 1}`);
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

        let userTotalBaseSalary = 0;
        let userTotalHourlyWage = 0;
        let userTotalResponsibility = 0;
        let userTotalTravelExpense = 0;
        let userTotalCommissionBonus = 0;
        let userTotalOtherBonus = 0;
        let userTotalAllowanceGeneral = 0;
        let userTotalDayOff = 0;
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
            allowanceGeneral: Math.ceil(record.allowanceGeneral || 0),
            dayOff: record.dayOff || 0,
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

          userTotalBaseSalary += rowData.baseSalary;
          userTotalHourlyWage += rowData.hourlyWage;
          userTotalResponsibility += rowData.responsibility;
          userTotalTravelExpense += rowData.travelExpense;
          userTotalCommissionBonus += rowData.commissionBonus;
          userTotalOtherBonus += rowData.otherBonus;
          userTotalAllowanceGeneral += rowData.allowanceGeneral;
          userTotalDayOff += rowData.dayOff;
          userTotalWeekdayOvertime += rowData.weekdayOvertime;
          userTotalWeekendOvertime += rowData.weekendOvertime;
          userTotalHolidayOvertime += rowData.holidayOvertime;
          userTotalOvertimePay += rowData.overtimePay;
          userTotalTaxableIncome += rowData.taxableIncome;
          userTotalGrossSalary += rowData.grossSalary;
          userTotalTax += rowData.tax;
          userTotalCurrentSalary += rowData.currentSalary;

          totalBaseSalary += rowData.baseSalary;
          totalHourlyWage += rowData.hourlyWage;
          totalResponsibility += rowData.responsibility;
          totalTravelExpense += rowData.travelExpense;
          totalCommissionBonus += rowData.commissionBonus;
          totalOtherBonus += rowData.otherBonus;
          totalAllowanceGeneral += rowData.allowanceGeneral;
          totalDayOff += rowData.dayOff;
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
          dataRow.getCell(11).value = rowData.allowanceGeneral;
          dataRow.getCell(12).value = rowData.dayOff;
          dataRow.getCell(13).value = rowData.weekdayOvertime;
          dataRow.getCell(14).value = rowData.weekendOvertime;
          dataRow.getCell(15).value = rowData.holidayOvertime;
          dataRow.getCell(16).value = rowData.overtimePay;
          dataRow.getCell(17).value = rowData.taxableIncome;
          dataRow.getCell(18).value = rowData.grossSalary;
          dataRow.getCell(19).value = rowData.tax;
          dataRow.getCell(20).value = rowData.currentSalary;
          dataRow.getCell(21).value = rowData.costCenter;

          dataRow.eachCell((cell, colNumber) => {
            cell.font = { size: 8, name: "Arial" };
            cell.border = {
              top: { style: "thin", color: { argb: "FF000000" } },
              left: { style: "thin", color: { argb: "FF000000" } },
              bottom: { style: "thin", color: { argb: "FF000000" } },
              right: { style: "thin", color: { argb: "FF000000" } },
            };

            if (recordIndex % 2 === 0) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF9F9F9" },
              };
            }

            if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else if (colNumber === 12) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
            } else if (colNumber >= 5 && colNumber <= 11) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "#,##0";
            } else if (colNumber >= 13 && colNumber <= 15) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.numFmt = "0.0";
            } else if (colNumber >= 16 && colNumber <= 20) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "#,##0";
            } else if (colNumber === 21) {
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

        const userSummaryRow = worksheet.getRow(currentRow++);
        userSummaryRow.height = 20;

        const userRecordCount = userRecords.length;
        const userAverageCurrentSalary =
          userRecordCount > 0
            ? Math.round(userTotalCurrentSalary / userRecordCount)
            : 0;
        const userAverageTax =
          userRecordCount > 0 ? Math.round(userTotalTax / userRecordCount) : 0;

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

        userSummaryRow.getCell(3).value = "";
        userSummaryRow.getCell(4).value = "";
        userSummaryRow.getCell(5).value = userTotalBaseSalary;
        userSummaryRow.getCell(6).value = userTotalHourlyWage;
        userSummaryRow.getCell(7).value = userTotalResponsibility;
        userSummaryRow.getCell(8).value = userTotalTravelExpense;
        userSummaryRow.getCell(9).value = userTotalCommissionBonus;
        userSummaryRow.getCell(10).value = userTotalOtherBonus;
        userSummaryRow.getCell(11).value = userTotalAllowanceGeneral;
        userSummaryRow.getCell(12).value = userTotalDayOff;
        userSummaryRow.getCell(13).value = userTotalWeekdayOvertime;
        userSummaryRow.getCell(14).value = userTotalWeekendOvertime;
        userSummaryRow.getCell(15).value = userTotalHolidayOvertime;
        userSummaryRow.getCell(16).value = userTotalOvertimePay;
        userSummaryRow.getCell(17).value = userTotalTaxableIncome;
        userSummaryRow.getCell(18).value = userTotalGrossSalary;
        userSummaryRow.getCell(19).value = userTotalTax;
        userSummaryRow.getCell(19).font = {
          bold: true,
          size: 9,
          name: "Arial",
        };
        userSummaryRow.getCell(20).value = userTotalCurrentSalary;
        userSummaryRow.getCell(20).font = {
          bold: true,
          size: 9,
          name: "Arial",
        };

        worksheet.mergeCells(`U${currentRow - 1}:V${currentRow - 1}`);
        userSummaryRow.getCell(21).value =
          `TB: ${userAverageCurrentSalary.toLocaleString()} | Thuế TB: ${userAverageTax.toLocaleString()}`;
        userSummaryRow.getCell(21).font = { size: 8, name: "Arial" };
        userSummaryRow.getCell(21).alignment = {
          horizontal: "left",
          vertical: "middle",
        };

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

          if (colNumber === 1 || colNumber === 2) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else if (colNumber === 12) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (colNumber >= 5 && colNumber <= 11) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "#,##0";
          } else if (colNumber >= 13 && colNumber <= 15) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.numFmt = "0.0";
          } else if (colNumber >= 16 && colNumber <= 20) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.numFmt = "#,##0";
          } else if (colNumber === 21 || colNumber === 22) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else if (colNumber === 3 || colNumber === 4) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        });

        currentRow++;
      });

      const separatorRow = worksheet.getRow(currentRow++);
      separatorRow.height = 5;
      worksheet.mergeCells(`A${currentRow - 1}:U${currentRow - 1}`);
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

    const totalRowIndex = currentRow;
    const totalRow = worksheet.getRow(totalRowIndex);
    totalRow.height = 22;

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

    const totals = [
      { col: 5, value: totalBaseSalary },
      { col: 6, value: totalHourlyWage },
      { col: 7, value: totalResponsibility },
      { col: 8, value: totalTravelExpense },
      { col: 9, value: totalCommissionBonus },
      { col: 10, value: totalOtherBonus },
      { col: 11, value: totalAllowanceGeneral },
      { col: 12, value: totalDayOff },
      { col: 13, value: totalWeekdayOvertime },
      { col: 14, value: totalWeekendOvertime },
      { col: 15, value: totalHolidayOvertime },
      { col: 16, value: totalOvertimePay },
      { col: 17, value: totalTaxableIncome },
      { col: 18, value: totalGrossSalary },
      { col: 19, value: totalTax },
      { col: 20, value: totalCurrentSalary },
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

      if (total.col === 12) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (total.col >= 13 && total.col <= 15) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.numFmt = "0.0";
      } else {
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "#,##0";
      }
    });

    for (let i = 1; i <= columnsCount; i++) {
      totalRow.getCell(i).border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }

    if (includeSummary === "true") {
      currentRow += 2;
      worksheet.addRow([]);
      worksheet.addRow([]);

      const summaryTitleRow = worksheet.getRow(currentRow++);
      worksheet.mergeCells(
        `A${summaryTitleRow.number}:U${summaryTitleRow.number}`,
      );
      summaryTitleRow.getCell(1).value = "TỔNG HỢP THỐNG KÊ";
      summaryTitleRow.getCell(1).font = { bold: true, size: 14, name: "Arial" };
      summaryTitleRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      summaryTitleRow.height = 25;

      const averageCurrentSalary = Math.round(
        totalCurrentSalary / totalRecords,
      );
      const averageTax = Math.round(totalTax / totalRecords);
      const averageBaseSalary = Math.round(totalBaseSalary / totalRecords);
      const averageAllowanceGeneral = Math.round(
        totalAllowanceGeneral / totalRecords,
      );
      const averageDayOff = totalRecords > 0 ? totalDayOff / totalRecords : 0;

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
        [
          "Tổng ngày nghỉ",
          totalDayOff,
          "Ngày nghỉ TB",
          averageDayOff.toFixed(1),
        ],
      ];

      summaryData.forEach((row, index) => {
        const summaryRow = worksheet.getRow(currentRow++);
        summaryRow.height = 18;

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

        for (let i = 1; i <= 12; i++) {
          if (summaryRow.getCell(i)) {
            summaryRow.getCell(i).border = {
              top: { style: "thin", color: { argb: "FF000000" } },
              left: { style: "thin", color: { argb: "FF000000" } },
              bottom: { style: "thin", color: { argb: "FF000000" } },
              right: { style: "thin", color: { argb: "FF000000" } },
            };

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

    const printAreaEnd = currentRow + 2;
    worksheet.pageSetup.printArea = `A1:${String.fromCharCode(64 + columnsCount)}${printAreaEnd}`;

    worksheet.views = [
      { state: "frozen", xSplit: 0, ySplit: 5, activeCell: "A6" },
    ];

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

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting Excel:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi xuất file Excel: " + error.message });
  }
};

exports.getUserMonthlyRecords = async (req, res) => {
  try {
    const { userId } = req.params;

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
        "headOfProject",
      ].includes(req.user.role)
    ) {
      return res
        .status(403)
        .json({ message: "Truy cập bị từ chối. Bạn không có quyền truy cập." });
    }

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

    const users = await User.find({ _id: { $in: userIds } });

    if (users.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy nhân viên đã chọn",
      });
    }

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

    let displayMonth, displayYear;
    if (parseInt(month) === 1) {
      displayMonth = 12;
      displayYear = parseInt(year) - 1;
    } else {
      displayMonth = parseInt(month) - 1;
      displayYear = parseInt(year);
    }

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
          dayOff: userRecord.dayOff || 0,
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

exports.updateUserEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        message: "Thiếu userId hoặc email",
      });
    }

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

exports.lockSalaryCalculation = async (req, res) => {
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

    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn ít nhất một nhân viên" });
    }

    const updateData = {
      userSalaryCalculationLocked: true,
      userSalaryCalculationLockedDateFrom: null,
      userSalaryCalculationLockedDateTo: null,
    };

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updateData },
    );

    res.json({
      message: `Đã khóa chỉnh sửa lương cho ${result.modifiedCount} nhân viên`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error locking salary calculation:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi khóa chỉnh sửa lương: " + error.message });
  }
};

exports.unlockSalaryCalculation = async (req, res) => {
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

    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn ít nhất một nhân viên" });
    }

    const updateData = {
      userSalaryCalculationLocked: false,
      userSalaryCalculationLockedDateFrom: null,
      userSalaryCalculationLockedDateTo: null,
    };

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updateData },
    );

    res.json({
      message: `Đã mở khóa chỉnh sửa lương cho ${result.modifiedCount} nhân viên`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error unlocking salary calculation:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi mở khóa chỉnh sửa lương: " + error.message });
  }
};
