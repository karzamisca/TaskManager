// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.cookies.token; // Get token from cookies
  if (!token) {
    return res
      .status(401)
      .send(
        "Truy cập đã hết hạn. Vui lòng đăng nhập lại./Access has expired. Please login again."
      );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user data to the request
    next();
  } catch (err) {
    res.status(400).send("Invalid token.");
  }
};
