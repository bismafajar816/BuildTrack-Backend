const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

/**
 * This file is a starting stub for Phase 2 (project management module).
 * It demonstrates the pattern: protect -> authorize -> tenant-scoped query.
 */

// Any authenticated user in the company can view its projects
router.get("/", protect, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM projects WHERE company_id = $1 ORDER BY created_at DESC",
      [req.user.companyId]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Only admin or project_manager can create a new project
router.post("/", protect, authorize("admin", "project_manager"), async (req, res) => {
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
