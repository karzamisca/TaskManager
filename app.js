//app.js
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const authRoute = require("./routes/authRoute");
const documentRoute = require("./routes/documentRoute");
const authMiddleware = require("./middlewares/authMiddleware"); // JWT middleware
const entryRoutes = require("./routes/entryRoutes");
require("dotenv").config();

const app = express();

// Database connection
connectDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser()); // Use cookie-parser to parse cookies

// Remove session middleware (since it's no longer needed)

// Routes
app.use("/", authRoute);
app.use("/", authMiddleware, documentRoute); // Apply JWT middleware to document routes
app.use("/", authMiddleware, entryRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
