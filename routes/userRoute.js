//routes\userRoute.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/userMain", authMiddleware, userController.getUserMainPage);
router.get("/userControl", authMiddleware, userController.getAllUsers);
router.get("/userControl/:id", authMiddleware, userController.getUserById);
router.post("/userControl", authMiddleware, userController.createUser);
router.put("/userControl/:id", authMiddleware, userController.updateUser);
router.delete("/userControl/:id", authMiddleware, userController.deleteUser);
router.get(
  "/userControlCostCenters",
  authMiddleware,
  userController.getAllCostCenters
);

module.exports = router;
