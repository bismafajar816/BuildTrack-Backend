const pool = require("../config/db");

const ALLOWED_ROLES = ["admin", "project_manager", "site_engineer"];
const VALID_STATUSES = ["present", "absent", "half_day", "leave"];

/**
 * Marks attendance for one or more laborers on one project for one date.
 * Body: { project_id, attendance_date, records: [{ laborer_id, status }, ...] }
 *
 * Upserts: marking the same laborer + date again updates the existing row
 * instead of creating a duplicate, so admins can correct a day's attendance.
 */
async function markAttendance(req, res) {
  const { project_id, attendance_date, records } = req.body;
  const { companyId, id: userId, role } = req.user;

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ message: "You are not allowed to mark attendance" });
  }
  if (!project_id || !attendance_date || !Array.isArray(records) || records.length === 0) {
    return res
      .status(400)
      .json({ message: "project_id, attendance_date, and at least one record are required" });
  }
  for (const r of records) {
    if (!r.laborer_id || !VALID_STATUSES.includes(r.status)) {
      return res.status(400).json({
        message: `Each record needs a laborer_id and a status of: ${VALID_STATUSES.join(", ")}`,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const projCheck = await client.query(
      "SELECT id FROM projects WHERE id = $1 AND company_id = $2",
      [project_id, companyId]
    );
    if (projCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Project not found" });
    }

    const saved = [];
    for (const r of records) {
      const result = await client.query(
        `INSERT INTO attendance_records (laborer_id, project_id, company_id, attendance_date, status, marked_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (laborer_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = now()
         RETURNING *`,
        [r.laborer_id, project_id, companyId, attendance_date, r.status, userId]
      );
      saved.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return res.status(201).json({ records: saved });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Server error while saving attendance" });
  } finally {
    client.release();
  }
}

/**
 * Returns every active laborer on a project, each with their attendance
 * status for the given date (null if that laborer hasn't been marked yet).
 * Query param: ?date=YYYY-MM-DD
 */
async function getAttendanceByDate(req, res) {
  const { projectId } = req.params;
  const { date } = req.query;
  const { companyId } = req.user;

  if (!date) {
    return res.status(400).json({ message: "A date query parameter is required" });
  }

  try {
    const projCheck = await pool.query(
      "SELECT id, name FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const result = await pool.query(
      `SELECT l.id AS laborer_id, l.full_name, l.trade, l.phone,
              ar.id AS attendance_id, ar.status
       FROM laborers l
       LEFT JOIN attendance_records ar
         ON ar.laborer_id = l.id AND ar.attendance_date = $2
       WHERE l.project_id = $1 AND l.is_active = true
       ORDER BY l.full_name`,
      [projectId, date]
    );

    return res.json({ project: projCheck.rows[0], date, attendance: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while loading attendance" });
  }
}

module.exports = { markAttendance, getAttendanceByDate };