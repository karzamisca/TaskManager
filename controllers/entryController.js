const Entry = require("../models/Entry");
const moment = require("moment-timezone");

// Serve the index.html file for the root route
exports.getFormAndEntries = (req, res) => {
  res.sendFile("index.html", { root: "./views/entries" });
};

// Serve all entries as JSON
exports.getAllEntries = async (req, res) => {
  try {
    const entries = await Entry.find();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Error fetching entries: " + err.message });
  }
};

// Create a new entry
exports.createEntry = async (req, res) => {
  try {
    const { description, unit, amount, unitPrice, vat, deliveryDate } =
      req.body;
    const totalPrice = amount * unitPrice;

    const entry = new Entry({
      description,
      unit,
      amount,
      unitPrice,
      totalPrice,
      vat,
      deliveryDate,
      entryDate: moment().tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss"),
    });

    await entry.save();
    res.redirect("/entry"); // Redirect back to the main page after creating the entry
  } catch (err) {
    res.status(500).send("Error creating entry: " + err.message);
  }
};

// Delete an entry by ID
exports.deleteEntry = async (req, res) => {
  try {
    const entryId = req.params.id;
    await Entry.findByIdAndDelete(entryId);
    res.json({ message: "Entry deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting entry: " + err.message });
  }
};
