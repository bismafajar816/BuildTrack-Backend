const pool = require("../config/db");

/**
 * Builds an array of the last `days` dates (oldest first) as 'YYYY-MM-DD'
 * strings, so charts always show a full, contiguous timeline even for
 * days with zero activity.
 */
function lastNDates(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function mergeUpdatesTrend(rows, dates) {
  const byDate = Object.fromEntries(rows.map((r) => [r.date.toISOString().slice(0, 10), Number(r.count)]));
  return dates.map((date) => ({ date, count: byDate[date] || 0 }));
}

function mergeAttendanceTrend(rows, dates) {
  const byDate = Object.fromEntries(
    rows.map((r) => [
      r.date.toISOString().slice(0, 10),
      { present: Number(r.present), total: Number(r.total) },
    ])
  );
  return dates.map((date) => {
    const entry = byDate[date];
    const percent = entry && entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0;
    return { date, present: entry?.present || 0, total: entry?.total || 0, percent };
  });
}

/**
 * Company-wide analytics: summary counts + 14-day trends across all projects.
 */
async function getCompanyOverview(req, res) {
  const { companyId } = req.user;
  const dates = lastNDates(14);

  try {
    const summaryResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM projects WHERE company_id = $1) AS project_count,
         (SELECT COUNT(*) FROM laborers WHERE company_id = $1 AND is_active = true) AS laborer_count,
         (SELECT COUNT(*) FROM daily_reports WHERE company_id = $1) AS update_count,
         (SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active = true) AS team_count`,
      [companyId]
    );

    const updatesResult = await pool.query(
      `SELECT entry_date AS date, COUNT(*) AS count
       FROM daily_reports
       WHERE company_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY entry_date
       ORDER BY entry_date`,
      [companyId]
    );

    const attendanceResult = await pool.query(
      `SELECT attendance_date AS date,
              COUNT(*) FILTER (WHERE status = 'present') AS present,
              COUNT(*) AS total
       FROM attendance_records
       WHERE company_id = $1 AND attendance_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY attendance_date
       ORDER BY attendance_date`,
      [companyId]
    );

    return res.json({
      summary: summaryResult.rows[0],
      updatesTrend: mergeUpdatesTrend(updatesResult.rows, dates),
      attendanceTrend: mergeAttendanceTrend(attendanceResult.rows, dates),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while loading analytics" });
  }
}

/**
 * Per-project analytics: summary counts + 14-day trends for one project.
 */
async function getProjectAnalytics(req, res) {
  const { projectId } = req.params;
  const { companyId } = req.user;
  const dates = lastNDates(14);

  try {
    const projCheck = await pool.query(
      "SELECT id, name FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const summaryResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM laborers WHERE project_id = $1 AND is_active = true) AS laborer_count,
         (SELECT COUNT(*) FROM daily_reports WHERE project_id = $1) AS update_count,
         (SELECT COUNT(*) FROM daily_reports WHERE project_id = $1 AND entry_type = 'image') AS photo_count`,
      [projectId]
    );

    const updatesResult = await pool.query(
      `SELECT entry_date AS date, COUNT(*) AS count
       FROM daily_reports
       WHERE project_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY entry_date
       ORDER BY entry_date`,
      [projectId]
    );

    const attendanceResult = await pool.query(
      `SELECT attendance_date AS date,
              COUNT(*) FILTER (WHERE status = 'present') AS present,
              COUNT(*) AS total
       FROM attendance_records
       WHERE project_id = $1 AND attendance_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY attendance_date
       ORDER BY attendance_date`,
      [projectId]
    );

    return res.json({
      project: projCheck.rows[0],
      summary: summaryResult.rows[0],
      updatesTrend: mergeUpdatesTrend(updatesResult.rows, dates),
      attendanceTrend: mergeAttendanceTrend(attendanceResult.rows, dates),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while loading project analytics" });
  }
}

module.exports = { getCompanyOverview, getProjectAnalytics };