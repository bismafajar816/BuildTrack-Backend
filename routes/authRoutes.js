const express = require("express");
const router = express.Router();
const { registerCompany, inviteUser, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// Public
router.post("/register", registerCompany); // Signup: creates company + admin user
router.post("/login", login);

// // Protected
// router.get("/me", protect, getMe);
// router.post("/invite", protect, authorize("admin"), inviteUser); // Admin adds PM/Engineer

module.exports = router;
