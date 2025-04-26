// models/Employee.js
const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  costCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CostCenter",
    required: true,
  },
  baseSalary: {
    type: Number,
    required: true,
  },
  holidayBonusPerDay: {
    type: Number,
    default: 0,
  },
  nightShiftBonusPerDay: {
    type: Number,
    default: 0,
  },
  socialInsurance: {
    type: Number,
    default: 0,
  },
});

const Employee = mongoose.model("Employee", employeeSchema);

module.exports = Employee;
