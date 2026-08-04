const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect } = require("../middleware/authMiddleware");
const {
  createReport,
  getReportsByProject,
  deleteReport,
  getProjectSummary,
  getProjectSummaryUrdu,
  getProjectSummaryBilingual,
} = require("../controllers/reportController");

// Any authenticated user can add an update (text or image) to a project
router.post("/", protect, upload.single("image"), createReport);

// Any authenticated user can view a project's update timeline
router.get("/project/:projectId", protect, getReportsByProject);

// AI-generated summary of all updates for a project
// Default: English only
// ?lang=urdu : Urdu translation
// ?lang=bilingual : English + Urdu
router.get("/project/:projectId/summary", protect, getProjectSummary);

// Urdu-only summary endpoint
router.get("/project/:projectId/summary/urdu", protect, getProjectSummaryUrdu);

// Bilingual summary endpoint
router.get("/project/:projectId/summary/bilingual", protect, getProjectSummaryBilingual);

// Only the creator or an admin can delete an update
router.delete("/:id", protect, deleteReport);

module.exports = router;