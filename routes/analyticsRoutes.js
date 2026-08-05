const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const { restrictToOwnProject } = require("../middleware/projectScopeMiddleware");
const { getCompanyOverview, getProjectAnalytics } = require("../controllers/analyticsController");

// Company-wide summary aggregates every project — admin only
router.get("/overview", protect, authorize("admin"), getCompanyOverview);

// Summary + trends for a single project — non-admins limited to their own project
router.get("/project/:projectId", protect, restrictToOwnProject, getProjectAnalytics);

module.exports = router;