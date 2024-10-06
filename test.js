require("dotenv").config();
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);
console.log("PORT:", process.env.PORT);
