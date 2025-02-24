const mongoose = require("mongoose");
const PurchasingDocument = require("./models/PurchasingDocument");
const DeliveryDocument = require("./models/DeliveryDocument");

async function updateDocuments() {
  try {
    // Update PurchasingDocuments
    const purchasingDocs = await PurchasingDocument.find({});
    for (const doc of purchasingDocs) {
      // Update each product in the document
      doc.products = doc.products.map((product) => {
        // Add vat if it doesn't exist
        if (!product.vat) {
          product.vat = 0;
        }

        // Recalculate totalCost (in case it's incorrect)
        product.totalCost = product.costPerUnit * product.amount;

        // Calculate totalCostAfterVat
        product.totalCostAfterVat = product.totalCost * (1 + product.vat / 100);

        return product;
      });

      // Recalculate grandTotalCost based on totalCostAfterVat
      doc.grandTotalCost = doc.products.reduce(
        (sum, product) => sum + product.totalCostAfterVat,
        0
      );

      // Save the updated document
      await doc.save();
    }

    // Update DeliveryDocuments
    const deliveryDocs = await DeliveryDocument.find({});
    for (const doc of deliveryDocs) {
      // Update each product in the document
      doc.products = doc.products.map((product) => {
        // Add vat if it doesn't exist
        if (!product.vat) {
          product.vat = 0;
        }

        // Recalculate totalCost (in case it's incorrect)
        product.totalCost = product.costPerUnit * product.amount;

        // Calculate totalCostAfterVat
        product.totalCostAfterVat = product.totalCost * (1 + product.vat / 100);

        return product;
      });

      // Recalculate grandTotalCost based on totalCostAfterVat
      doc.grandTotalCost = doc.products.reduce(
        (sum, product) => sum + product.totalCostAfterVat,
        0
      );

      // Save the updated document
      await doc.save();
    }

    console.log("Successfully updated all documents");
  } catch (error) {
    console.error("Error updating documents:", error);
  } finally {
    // Close the mongoose connection
    await mongoose.connection.close();
  }
}

// Connect to MongoDB and run the update
mongoose
  .connect(
    "mongodb://minhquan:vigjcqq7@222.253.128.123:17575/document?authSource=admin&directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.8"
  )
  .then(() => {
    console.log("Connected to MongoDB");
    return updateDocuments();
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
