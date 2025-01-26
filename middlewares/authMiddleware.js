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

// Helper function to handle refresh tokens
async function handleRefreshToken(req, res, next) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.send(
      "Truy cập đã hết hạn. Vui lòng đăng nhập lại./Access has expired. Please login again."
    );
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

    // Set the new access token in a secure cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Attach the new access token's payload to the request
    req.user = decoded;
    req._id = decoded.id;
    req.role = decoded.role;

    next();
  } catch (err) {
    console.error(err);
    return res.send("Invalid refresh token.");
  }
}
