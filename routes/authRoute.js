// routes/authRoute.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const User = require("../models/User");

// Login route
router.get("/login", (req, res) => {
  res.sendFile("login.html", { root: "./views" }); // Serve the login page
});

// Post request for login
router.post("/login", authController.login);

// Logout route
router.get("/logout", authController.logout);

// Main page route
router.get("/main", authMiddleware, (req, res) => {
  res.sendFile("main.html", { root: "./views" }); // Serve the main page
});

router.get("/template", authMiddleware, (req, res) => {
  res.sendFile("template.html", { root: "./views/approvals" }); // Serve the template page
});

router.get("/approvers", async (req, res) => {
  try {
    const approvers = await User.find({ role: "approver" });
    res.json(approvers);
  } catch (err) {
    console.error(err);
    res.send("Error fetching approvers");
  }
});

router.post("/changePassword", authMiddleware, authController.changePassword);
router.get("/changePassword", authMiddleware, (req, res) => {
  res.sendFile("changePassword.html", { root: "./views" });
});

module.exports = router;
