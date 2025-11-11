// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return handleRefreshToken(req, res, next);
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    req.user = decoded;
    req._id = decoded.id;
    req.role = decoded.role;
    req.permissions = decoded.permissions;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return handleRefreshToken(req, res, next);
    } else {
      return res.redirect("/login");
    }
  }
};

async function handleRefreshToken(req, res, next) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.redirect("/login");
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    req.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      department: user.department,
      permissions: user.permissions,
    };
    req._id = user._id;
    req.role = user.role;
    req.permissions = user.permissions;

    next();
  } catch (err) {
    console.error(err);
    return res.redirect("/login");
  }
}
