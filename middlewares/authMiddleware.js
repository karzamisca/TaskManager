// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  // Get the access token from cookies
  const accessToken = req.cookies.accessToken;

  // If there's no access token, check for a refresh token
  if (!accessToken) {
    return handleRefreshToken(req, res, next);
  }

  try {
    // Verify the access token
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user data to the request
    req._id = decoded.id; // Attach userId to the request
    req.role = decoded.role; // Attach role to the request
    next();
  } catch (err) {
    // If the access token is expired, try refreshing it
    if (err.name === "TokenExpiredError") {
      return handleRefreshToken(req, res, next);
    } else {
      return res.send("Invalid token.");
    }
  }
};

// Helper function to handle refresh tokens with rotation
async function handleRefreshToken(req, res, next) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.redirect("/login");
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find the user in the database
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      // Invalid refresh token - clear cookies and redirect to login
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.redirect("/login");
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        department: user.department,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } // Short expiration time
    );

    // Generate a new refresh token (TOKEN ROTATION)
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // Update the refresh token in the database
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set the new access token in a secure cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Set the new refresh token in a secure cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Attach the user data to the request (using the original decoded data)
    const userPayload = {
      id: user._id,
      username: user.username,
      role: user.role,
      department: user.department,
    };

    req.user = userPayload;
    req._id = user._id;
    req.role = user.role;
    next();
  } catch (err) {
    console.error(err);
    // Clear cookies and redirect to login on any error
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect("/login");
  }
}
