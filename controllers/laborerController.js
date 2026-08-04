const pool = require("../config/db");

const ALLOWED_ROLES = ["admin", "project_manager", "site_engineer"];

/**
 * Adds a laborer to a project. Any of admin / project_manager / site_engineer
 * may do this (matches who is allowed to mark attendance).
 */
async function createLaborer(req, res) {
  const { project_id, full_name, phone, trade, daily_wage } = req.body;
  const { companyId, id: userId, role } = req.user;

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ message: "You are not allowed to add laborers" });
  }
  if (!project_id || !full_name || !full_name.trim()) {
    return res.status(400).json({ message: "project_id and full_name are required" });
  }

  try {
    const projCheck = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND company_id = $2",
      [project_id, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const result = await pool.query(
      `INSERT INTO laborers (project_id, company_id, full_name, phone, trade, daily_wage, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        project_id,
        companyId,
        full_name.trim(),
        phone || null,
        trade || null,
        daily_wage || null,
        userId,
      ]
    );

    return res.status(201).json({ laborer: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while adding laborer" });
  }
}

/**
 * Lists laborers on a project. Active only by default; pass
 * ?includeInactive=true to also see removed laborers (e.g. for history).
 */
async function getLaborersByProject(req, res) {
  const { projectId } = req.params;
  const { companyId } = req.user;
  const includeInactive = req.query.includeInactive === "true";

  try {
    const projCheck = await pool.query(
      "SELECT id, name FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const query = includeInactive
      ? "SELECT * FROM laborers WHERE project_id = $1 ORDER BY full_name"
      : "SELECT * FROM laborers WHERE project_id = $1 AND is_active = true ORDER BY full_name";

    const result = await pool.query(query, [projectId]);
    return res.json({ project: projCheck.rows[0], laborers: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while loading laborers" });
  }
}

/**
 * Soft-removes a laborer (kept for attendance history, hidden from active lists).
 */
async function deactivateLaborer(req, res) {
  const { id } = req.params;
  const { companyId, role } = req.user;

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ message: "You are not allowed to remove laborers" });
  }

  try {
    const result = await pool.query(
      "UPDATE laborers SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING *",
      [id, companyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Laborer not found" });
    }
    return res.json({ message: "Laborer removed", laborer: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while removing laborer" });
  }
}

module.exports = { createLaborer, getLaborersByProject, deactivateLaborer };