// controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).send("Invalid username or password");
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set the token in a secure cookie
    res.cookie("token", token, {
      httpOnly: true,   // Prevents JavaScript from accessing the cookie
      secure: process.env.NODE_ENV === "production", // Set to true in production to enforce HTTPS
      sameSite: "strict", // Prevents CSRF attacks
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.redirect("/main");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token");  // Clear the JWT cookie on logout
  res.redirect("/login");
};
