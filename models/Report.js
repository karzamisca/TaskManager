//models/Report.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const reportSchema = new mongoose.Schema({
  reportType: { type: String, enum: ["daily", "weekly"], required: true },
  submissionDate: { type: String, required: true }, // Stored as formatted string
  inspectionTime: { type: String, required: true },
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  costCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CostCenter",
    required: true,
  },
  items: [
    {
      task: { type: String, required: true },
      status: { type: Boolean, required: true },
      notes: { type: String },
    },
  ],
});

// Pre-save hook to format date and ensure cost center exists
reportSchema.pre("save", async function (next) {
  // Format date if not already set
  if (!this.date) {
    this.date = moment().tz("Asia/Bangkok").format("DD-MM-YYYY HH:mm:ss");
  }

  // Verify the inspector has a cost center
  if (!this.costCenter) {
    const user = await mongoose.model("User").findById(this.inspector);
    if (!user) {
      throw new Error("Inspector not found");
    }
    if (!user.costCenter) {
      throw new Error("Inspector has no cost center assigned");
    }
    this.costCenter = user.costCenter;
  }

  next();
});

module.exports = mongoose.model("Report", reportSchema);
