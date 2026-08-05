const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect } = require("../middleware/authMiddleware");
const { restrictToOwnProject } = require("../middleware/projectScopeMiddleware");
const {
  createReport,
  getReportsByProject,
  deleteReport,
  getProjectSummary,
} = require("../controllers/reportController");

// Any authenticated user can add an update (text or image) to their project.
// upload.single runs first so req.body.project_id is parsed before the check.
router.post("/", protect, upload.single("image"), restrictToOwnProject, createReport);

// View a project's update timeline — non-admins limited to their own project
router.get("/project/:projectId", protect, restrictToOwnProject, getReportsByProject);

// AI-generated summary of all updates for a project (text + photos)
router.get("/project/:projectId/summary", protect, restrictToOwnProject, getProjectSummary);

// Only the creator or an admin can delete an update
router.delete("/:id", protect, deleteReport);

module.exports = router;