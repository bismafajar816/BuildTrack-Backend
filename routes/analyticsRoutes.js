const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getCompanyOverview, getProjectAnalytics } = require("../controllers/analyticsController");

// Company-wide summary + trends across all projects
router.get("/overview", protect, getCompanyOverview);

// Summary + trends for a single project
router.get("/project/:projectId", protect, getProjectAnalytics);

module.exports = router;