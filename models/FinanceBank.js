//models/FinanceBank.js
const mongoose = require("mongoose");

const monthEntrySchema = new mongoose.Schema({
  inflows: {
    type: Number,
    default: 0,
    description: "Total incoming funds for the month",
  },
  outflows: {
    type: Number,
    default: 0,
    description: "Total outgoing funds for the month",
  },
  balance: {
    type: Number,
    default: 0,
    description: "Calculated balance (previous balance + inflows - outflows)",
  },
  treasurerNote: {
    type: String,
    default: "",
    description: "Notes from the treasurer about this month's transactions",
  },
  bankNote: {
    type: String,
    default: "",
    description: "Notes from bank statements or reconciliations",
  },
  generalNote: {
    type: String,
    default: "",
    description: "General notes about this month's financial activities",
  },
});

const monthSchema = new mongoose.Schema({
  name: { type: String, required: true },
  entries: [monthEntrySchema],
});

const yearSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  months: [monthSchema],
});

const centerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  years: [yearSchema],
});

// Pre-save hook to calculate balance
monthEntrySchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      // For new entries, we need to get the previous balance
      const Center = mongoose.model("FinanceBank");
      const center = await Center.findOne({
        "years.months.entries": this._id,
      });

      if (center) {
        let prevBalance = 0;
        // Find the previous month's last entry to get its balance
        const allMonths = center.years.flatMap((y) => y.months);
        const currentMonthIndex = allMonths.findIndex((m) =>
          m.entries.some((e) => e._id.equals(this._id))
        );

        if (currentMonthIndex > 0) {
          const prevMonth = allMonths[currentMonthIndex - 1];
          if (prevMonth.entries.length > 0) {
            prevBalance =
              prevMonth.entries[prevMonth.entries.length - 1].balance;
          }
        }

        this.balance = prevBalance + this.inflows - this.outflows;
      }
    } else {
      // For updates, just recalculate based on current inflows/outflows
      this.balance = this.balance + (this.inflows - this.outflows);
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("FinanceBank", centerSchema);
