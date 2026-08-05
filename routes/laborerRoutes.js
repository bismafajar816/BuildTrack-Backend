const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { restrictToOwnProject } = require("../middleware/projectScopeMiddleware");
const {
  createLaborer,
  getLaborersByProject,
  deactivateLaborer,
} = require("../controllers/laborerController");

router.post("/", protect, restrictToOwnProject, createLaborer);
router.get("/project/:projectId", protect, restrictToOwnProject, getLaborersByProject);
router.patch("/:id/deactivate", protect, deactivateLaborer);

module.exports = router;