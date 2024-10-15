const express = require("express");
const entryController = require("../controllers/entryController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", authMiddleware, entryController.getFormAndEntries); // Serve HTML form and table
router.get("/all", authMiddleware, entryController.getAllEntries); // Serve all entries as JSON
router.post("/new", authMiddleware, entryController.createEntry); // Submit new entry

module.exports = router;
