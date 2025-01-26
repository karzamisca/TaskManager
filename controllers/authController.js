// controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Login function
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.send(
        "Tên đăng nhập hoặc mật khẩu không hợp lệ/Invalid username or password"
      );
    }

    // Generate an access token (short-lived)
    const accessToken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        department: user.department,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } // Short expiration time
    );

    // Generate a refresh token (long-lived)
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" } // Long expiration time
    );

    // Store the refresh token in the database
    user.refreshToken = refreshToken;
    await user.save();

    // Set the access token in a secure cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Set the refresh token in a secure cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect("/main");
  } catch (err) {
    console.error(err);
    res.send("Lỗi server/Server error");
  }
};

// Logout function
exports.logout = async (req, res) => {
  const { refreshToken } = req.cookies;

  try {
    // Clear the refresh token from the database
    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    // Clear both cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.send("Lỗi server/Server error");
  }
};

// Refresh access token function
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).send("Refresh token is missing.");
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find the user in the database
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).send("Invalid refresh token.");
    }

    // Generate a new access token
    const accessToken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        department: user.department,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Set the new access token in a secure cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.status(200).send("Access token refreshed.");
  } catch (err) {
    console.error(err);
    res.status(403).send("Invalid refresh token.");
  }
};

// Change password function
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id); // Fetch current user based on decoded JWT
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Verify current password
    if (user.password !== currentPassword) {
      return res.status(400).send("Current password is incorrect.");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Clear the JWT cookies to log the user out
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    // Redirect to login page
    return res.redirect("/login");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error updating password.");
  }
};
