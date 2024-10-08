// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Login route
router.get("/login", (req, res) => {
  res.sendFile("login.html", { root: "./views" });
});

// Post request for login
router.post("/login", authController.login);

// Logout route
router.get("/logout", authController.logout);

// Main page route
router.get("/main", (req, res) => {
  res.sendFile("main.html", { root: "./views" }); // Serve the main page
});

module.exports = router;
