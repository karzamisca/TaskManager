// routes/authRoute.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const User = require("../models/User");

// Login route
router.get("/login", (req, res) => {
  res.sendFile("login.html", { root: "./views/starterPages" }); // Serve the login page
});

// Post request for login
router.post("/login", authController.login);

// Logout route
router.get("/logout", authController.logout);

router.get("/approvers", authMiddleware, async (req, res) => {
  try {
    const approvers = await User.find({
      role: {
        $in: [
          "approver",
          "superAdmin",
          "director",
          "deputyDirector",
          "headOfMechanical",
          "headOfTechnical",
          "headOfAccounting",
          "headOfPurchasing",
          "headOfOperations",
          "headOfNorthernRepresentativeOffice",
          "captainOfMechanical",
          "captainOfTechnical",
          "captainOfPurchasing",
          "captainOfAccounting",
          "captainOfBusiness",
          "transporterOfAccounting",
        ],
      },
    });
    res.json(approvers);
  } catch (err) {
    console.error(err);
    res.send("Error fetching approvers");
  }
});

router.post("/changePassword", authMiddleware, authController.changePassword);
router.get("/changePassword", authMiddleware, (req, res) => {
  res.sendFile("changePassword.html", { root: "./views/starterPages" });
});

module.exports = router;
