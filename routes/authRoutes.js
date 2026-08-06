const express = require("express");
const router = express.Router();
const {
  registerCompany,
  inviteUser,
  login,
  getMe,
  getTeam,
  updateTeamMember,
  deactivateTeamMember,
  reactivateTeamMember,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// Public
router.post("/register", registerCompany); // Signup: creates company + admin user
router.post("/login", login);

// Protected
router.get("/me", protect, getMe);
router.get("/team", protect, authorize("admin"), getTeam); // Admin-only team list
router.post("/invite", protect, authorize("admin"), inviteUser); // Admin adds PM/Engineer
router.patch("/team/:id", protect, authorize("admin"), updateTeamMember); // Edit name/role/project
router.delete("/team/:id", protect, authorize("admin"), deactivateTeamMember); // Soft-delete
router.patch("/team/:id/reactivate", protect, authorize("admin"), reactivateTeamMember);

module.exports = router;