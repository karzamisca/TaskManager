// controllers/authController.js
const User = require("../models/User");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).send("Invalid username or password");
    }

    req.session.user = user._id; // Store user session
    res.redirect("/main");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error logging out");
    }
    res.redirect("/login");
  });
};
