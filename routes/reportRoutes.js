const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect } = require("../middleware/authMiddleware");
const {
  createReport,
  getReportsByProject,
  deleteReport,
  getProjectSummary,
} = require("../controllers/reportController");

// Any authenticated user can add an update (text or image) to a project
router.post("/", protect, upload.single("image"), createReport);

// Any authenticated user can view a project's update timeline
router.get("/project/:projectId", protect, getReportsByProject);

// AI-generated summary of all updates for a project (text + photos)
router.get("/project/:projectId/summary", protect, getProjectSummary);

// Only the creator or an admin can delete an update
router.delete("/:id", protect, deleteReport);

module.exports = router;