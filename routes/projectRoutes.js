const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

/**
 * Admins see every project in their company. project_manager and
 * site_engineer only see the single project they're assigned to
 * (req.user.projectId, taken from their JWT).
 */
router.get("/", protect, async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query(
        "SELECT * FROM projects WHERE company_id = $1 ORDER BY created_at DESC",
        [req.user.companyId]
      );
    } else {
      result = await pool.query(
        "SELECT * FROM projects WHERE company_id = $1 AND id = $2 ORDER BY created_at DESC",
        [req.user.companyId, req.user.projectId]
      );
    }
    res.json({ projects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Same rule for a single project: non-admins can only fetch their own project
router.get("/:id", protect, async (req, res) => {
  if (req.user.role !== "admin" && req.params.id !== req.user.projectId) {
    return res.status(403).json({ message: "You don't have access to this project" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE id = $1 AND company_id = $2",
      [req.params.id, req.user.companyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Only admin creates projects — non-admins are assigned to one via Team, not self-serve
router.post("/", protect, authorize("admin"), async (req, res) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ message: "Project name is required" });

  try {
    const result = await pool.query(
      `INSERT INTO projects (company_id, name, location, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.companyId, name, location || null, req.user.id]
    );
    res.status(201).json({ project: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;