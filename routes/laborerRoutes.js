const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createLaborer,
  getLaborersByProject,
  deactivateLaborer,
} = require("../controllers/laborerController");

router.post("/", protect, createLaborer);
router.get("/project/:projectId", protect, getLaborersByProject);
router.patch("/:id/deactivate", protect, deactivateLaborer);

module.exports = router;