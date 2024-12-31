// controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.send(
        "Tên đăng nhập hoặc mật khẩu không hợp lệ/Invalid username or password"
      );
    }

    // Generate a JWT token
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        department: user.department,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set the token in a secure cookie
    res.cookie("token", token, {
      httpOnly: true, // Prevents JavaScript from accessing the cookie
      secure: process.env.NODE_ENV === "production", // Set to true in production to enforce HTTPS
      sameSite: "none",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.redirect("/main");
  } catch (err) {
    console.error(err);
    res.send("Lỗi server/Server error");
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token"); // Clear the JWT cookie on logout
  res.redirect("/login");
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id); // Fetch current user based on decoded JWT
    if (!user) {
      return res.status(404).send("User not found."); // Ensure single response
    }

    // Verify current password
    if (user.password !== currentPassword) {
      return res.status(400).send("Current password is incorrect."); // Ensure single response
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Clear the JWT cookie to log the user out
    res.clearCookie("token");

    // Redirect to login page
    return res.redirect("/login");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error updating password.");
  }
};
