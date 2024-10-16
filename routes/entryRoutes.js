const express = require("express");
const entryController = require("../controllers/entryController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/entry", authMiddleware, entryController.getFormAndEntries); // Serve HTML form and table
router.get("/entryAll", authMiddleware, entryController.getAllEntries); // Serve all entries as JSON
router.post("/entryNew", authMiddleware, entryController.createEntry); // Submit new entry
router.delete("/entryDelete/:id", entryController.deleteEntry); // Delete entry by ID

module.exports = router;
