// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

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
  res.sendFile("template.html", { root: "./views" }); // Serve the template page
});

module.exports = router;
