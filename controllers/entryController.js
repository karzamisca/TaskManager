const Entry = require("../models/Entry");

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
    });

    await entry.save();
    res.redirect("/entries"); // Redirect back to the main page after creating the entry
  } catch (err) {
    res.status(500).send("Error creating entry: " + err.message);
  }
};
