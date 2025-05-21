// controllers/reportController.js
const Report = require("../models/Report");
const User = require("../models/User");
const mongoose = require("mongoose");
const moment = require("moment-timezone");

// Get all reports with filtering options
exports.getReports = async (req, res) => {
  try {
    const {
      reportType,
      costCenter,
      date,
      inspector,
      limit = 20,
      page = 1,
    } = req.query;

    // Build filter object based on query parameters
    const filter = {};

    if (reportType) {
      filter.reportType = reportType;
    }

    if (inspector) {
      filter.inspector = mongoose.Types.ObjectId.isValid(inspector)
        ? mongoose.Types.ObjectId(inspector)
        : null;
    }

    if (date) {
      // Convert date input to match the format in the database (DD-MM-YYYY)
      const searchDate = new Date(date);
      const formattedDate = `${String(searchDate.getDate()).padStart(
        2,
        "0"
      )}-${String(searchDate.getMonth() + 1).padStart(
        2,
        "0"
      )}-${searchDate.getFullYear()}`;

      // Search for reports that start with this date string
      filter.submissionDate = { $regex: `^${formattedDate}` };
    }

    // Handle cost center search - try to find by ID or by name
    if (costCenter) {
      if (mongoose.Types.ObjectId.isValid(costCenter)) {
        filter.costCenter = mongoose.Types.ObjectId(costCenter);
      } else {
        // Search by cost center name requires a lookup
        // We'll modify the aggregation pipeline instead
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Create aggregation pipeline for reports with populated references
    const aggregationPipeline = [
      { $match: filter },
      { $sort: { submissionDate: -1 } }, // Sort by submission date, newest first
      {
        $lookup: {
          from: "users",
          localField: "inspector",
          foreignField: "_id",
          as: "inspector",
        },
      },
      {
        $lookup: {
          from: "costcenters",
          localField: "costCenter",
          foreignField: "_id",
          as: "costCenter",
        },
      },
      {
        $unwind: {
          path: "$inspector",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$costCenter",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          reportType: 1,
          submissionDate: 1,
          inspectionTime: 1,
          items: 1,
          "inspector._id": 1,
          "inspector.username": 1,
          "costCenter._id": 1,
          "costCenter.name": 1,
        },
      },
    ];

    // If searching by cost center name, add appropriate filter
    if (costCenter && !mongoose.Types.ObjectId.isValid(costCenter)) {
      // Add a match stage after the lookup to filter by cost center name
      aggregationPipeline.push({
        $match: {
          "costCenter.name": { $regex: costCenter, $options: "i" },
        },
      });
    }

    // Add pagination to the pipeline
    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: parseInt(limit) });

    // Execute the aggregation pipeline
    const reports = await Report.aggregate(aggregationPipeline);

    // Count total documents for pagination info
    const countFilter = { ...filter };

    // Special handling for cost center name search in count
    if (costCenter && !mongoose.Types.ObjectId.isValid(costCenter)) {
      const costCenterIds = await mongoose
        .model("CostCenter")
        .find({ name: { $regex: costCenter, $options: "i" } }, { _id: 1 });

      if (costCenterIds.length > 0) {
        countFilter.costCenter = { $in: costCenterIds.map((cc) => cc._id) };
      } else {
        // No matching cost centers, return empty array
        return res.json(reports);
      }
    }

    const total = await Report.countDocuments(countFilter);
    const pages = Math.ceil(total / parseInt(limit));

    return res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Get a single report by ID
exports.getReportById = async (req, res) => {
  try {
    const reportId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }

    const report = await Report.findById(reportId)
      .populate("inspector", "username")
      .populate("costCenter", "name");

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

exports.reportSubmission = async (req, res) => {
  try {
    const { reportType, inspectionTime, items } = req.body;

    // Get user with cost center populated
    const user = await User.findById(req._id).populate("costCenter");
    if (!user || !user.costCenter) {
      return res.status(400).json({
        error:
          "Tài khoản của bạn chưa được gán Cost Center. Vui lòng liên hệ quản trị viên.",
      });
    }

    const report = new Report({
      reportType,
      submissionDate: moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss"),
      inspectionTime,
      inspector: req._id,
      costCenter: user.costCenter._id,
      items,
    });

    await report.save();
    res.status(201).send(report);
  } catch (error) {
    console.error("Report creation error:", error);
    res.status(400).send({
      error: error.message || "Lỗi khi tạo báo cáo",
    });
  }
};
