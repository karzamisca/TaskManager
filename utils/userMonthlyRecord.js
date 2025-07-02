// utils/userMonthlyRecord.js
const User = require("../models/User");
const MonthlyUserRecord = require("../models/UserMonthlyRecord");

/**
 * Create monthly records for all users
 * @param {Date} recordDate - The date for which to create records (defaults to current date)
 * @returns {Object} Summary of the operation
 */
async function createMonthlyUserRecords(recordDate = new Date()) {
  try {
    const month = recordDate.getMonth() + 1; // JavaScript months are 0-indexed
    const year = recordDate.getFullYear();

    // Get all users
    const users = await User.find({}).populate("costCenter assignedManager");

    if (users.length === 0) {
      return {
        success: true,
        message: "No users found",
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: [],
      };
    }

    let recordsCreated = 0;
    let recordsSkipped = 0;
    const errors = [];

    // Process each user
    for (const user of users) {
      try {
        // Check if record already exists for this user/month/year
        const existingRecord = await MonthlyUserRecord.findOne({
          userId: user._id,
          recordMonth: month,
          recordYear: year,
        });

        if (existingRecord) {
          recordsSkipped++;
          continue;
        }

        // Create new monthly record with graceful field handling
        const monthlyRecord = new MonthlyUserRecord({
          userId: user._id,
          recordDate: recordDate,
          recordMonth: month,
          recordYear: year,

          // Handle required fields with fallbacks
          username: user.username || `user_${user._id}`,
          realName:
            user.realName || user.username || `Unknown User ${user._id}`,

          // Copy optional user data (use existing values or let schema defaults apply)
          role: user.role,
          department: user.department,
          email: user.email,
          costCenter: user.costCenter,
          assignedManager: user.assignedManager,

          // Copy banking and ID information (fallback to schema defaults if missing)
          beneficiaryBank: user.beneficiaryBank,
          bankAccountNumber: user.bankAccountNumber,
          citizenID: user.citizenID,

          // Copy salary data (fallback to schema defaults if missing)
          baseSalary: user.baseSalary,
          hourlyWage: user.hourlyWage,
          commissionBonus: user.commissionBonus,
          responsibility: user.responsibility,
          weekdayOvertimeHour: user.weekdayOvertimeHour,
          weekendOvertimeHour: user.weekendOvertimeHour,
          holidayOvertimeHour: user.holidayOvertimeHour,
          overtimePay: user.overtimePay,
          insurableSalary: user.insurableSalary,
          mandatoryInsurance: user.mandatoryInsurance,
          currentSalary: user.currentSalary,
          grossSalary: user.grossSalary,

          // Copy tax data (fallback to schema defaults if missing)
          tax: user.tax,
          dependantCount: user.dependantCount,
          taxableIncome: user.taxableIncome,

          // Copy travel expenses (fallback to schema defaults if missing)
          travelExpense: user.travelExpense,
        });

        await monthlyRecord.save();
        recordsCreated++;
      } catch (userError) {
        errors.push({
          username: user.username || `user_${user._id}`,
          userId: user._id,
          error: userError.message,
        });
      }
    }

    const summary = {
      success: true,
      message: `Monthly user records creation completed for ${month}/${year}`,
      recordsCreated,
      recordsSkipped,
      totalUsers: users.length,
      errors,
    };

    return summary;
  } catch (error) {
    return {
      success: false,
      message: error.message,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: [{ general: error.message }],
    };
  }
}

/**
 * Get monthly records for a specific month and year
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Array} Array of monthly user records
 */
async function getMonthlyRecords(month, year) {
  try {
    const records = await MonthlyUserRecord.find({
      recordMonth: month,
      recordYear: year,
    })
      .populate("userId", "username email")
      .populate("costCenter", "name")
      .populate("assignedManager", "username")
      .sort({ username: 1 });

    return records;
  } catch (error) {
    throw error;
  }
}

/**
 * Get all records for a specific user
 * @param {string} userId - User ID
 * @returns {Array} Array of monthly records for the user
 */
async function getUserMonthlyHistory(userId) {
  try {
    const records = await MonthlyUserRecord.find({ userId })
      .populate("costCenter", "name")
      .populate("assignedManager", "username")
      .sort({ recordYear: -1, recordMonth: -1 });

    return records;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  createMonthlyUserRecords,
  getMonthlyRecords,
  getUserMonthlyHistory,
};
