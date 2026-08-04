const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { summarizeProject, translateToUrdu, summarizeProjectBilingual } = require("../services/aiSummaryService");

/**
 * Creates a daily update for a project. Body is multipart/form-data:
 *   project_id, project_name, entry_type ('text' | 'image'), entry_date, content
 *   image (file, required when entry_type === 'image')
 *
 * Text entries: content is required.
 * Image entries: an uploaded file is required; content (caption) is optional.
 */
async function createReport(req, res) {
  const { project_id, entry_type, content, entry_date } = req.body;
  const { companyId, id: userId } = req.user;

  if (!project_id || !entry_type) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "project_id and entry_type are required" });
  }
  if (!["text", "image"].includes(entry_type)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "entry_type must be 'text' or 'image'" });
  }

  try {
    // Make sure the project belongs to the requester's company (tenant check)
    const projCheck = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND company_id = $2",
      [project_id, companyId]
    );
    if (projCheck.rows.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "Project not found" });
    }

    let imagePath = null;

    if (entry_type === "image") {
      if (!req.file) {
        return res.status(400).json({ message: "An image file is required for photo updates" });
      }
      // Store a path relative to the backend root, e.g. uploads/model-town/12345.jpg
      imagePath = path.relative(path.join(__dirname, ".."), req.file.path).replace(/\\/g, "/");
    } else {
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Text content is required for text updates" });
      }
    }

    const result = await pool.query(
      `INSERT INTO daily_reports (project_id, company_id, created_by, entry_type, content, image_path, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE))
       RETURNING *`,
      [project_id, companyId, userId, entry_type, content || null, imagePath, entry_date || null]
    );

    return res.status(201).json({ report: result.rows[0] });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error(err);
    return res.status(500).json({ message: "Server error while saving the update" });
  }
}

/**
 * Returns a project (tenant-checked) plus its daily updates, newest first.
 */
async function getReportsByProject(req, res) {
  const { projectId } = req.params;
  const { companyId } = req.user;

  try {
    const projCheck = await pool.query(
      "SELECT id, name, location FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const result = await pool.query(
      `SELECT dr.*, u.full_name AS created_by_name
       FROM daily_reports dr
       LEFT JOIN users u ON u.id = dr.created_by
       WHERE dr.project_id = $1
       ORDER BY dr.entry_date DESC, dr.created_at DESC`,
      [projectId]
    );

    return res.json({ project: projCheck.rows[0], reports: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while loading updates" });
  }
}

/**
 * Deletes a daily update. Only the user who created it, or an admin,
 * may delete it. If it was an image entry, the file on disk is removed too.
 */
async function deleteReport(req, res) {
  const { id } = req.params;
  const { companyId, id: userId, role } = req.user;

  try {
    const result = await pool.query(
      "SELECT * FROM daily_reports WHERE id = $1 AND company_id = $2",
      [id, companyId]
    );
    const report = result.rows[0];

    if (!report) {
      return res.status(404).json({ message: "Update not found" });
    }
    if (report.created_by !== userId && role !== "admin") {
      return res.status(403).json({ message: "You can only delete your own updates" });
    }

    await pool.query("DELETE FROM daily_reports WHERE id = $1", [id]);

    if (report.entry_type === "image" && report.image_path) {
      const fullPath = path.join(__dirname, "..", report.image_path);
      fs.unlink(fullPath, () => {}); // best-effort; ignore if already missing
    }

    return res.json({ message: "Update deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while deleting the update" });
  }
}

/**
 * Generates an AI summary of a project's daily updates.
 * Supports language parameter: ?lang=urdu or ?lang=bilingual
 * Default: English only
 */
async function getProjectSummary(req, res) {
  const { projectId } = req.params;
  const { companyId } = req.user;
  const { lang } = req.query;

  try {
    // Verify project exists and belongs to user's company
    const projCheck = await pool.query(
      "SELECT id, name, location FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Get all reports for the project
    const reportsResult = await pool.query(
      `SELECT entry_type, content, image_path, entry_date
       FROM daily_reports
       WHERE project_id = $1
       ORDER BY entry_date DESC, created_at DESC`,
      [projectId]
    );

    if (reportsResult.rows.length === 0) {
      return res.status(400).json({ message: "No daily updates yet to summarize." });
    }

    const project = projCheck.rows[0];
    const reports = reportsResult.rows;

    // Handle different language options
    if (lang === "bilingual") {
      const summaries = await summarizeProjectBilingual(project, reports);
      return res.json({
        summary: summaries.english,
        english: summaries.english,
        urdu: summaries.urdu,
        updatesCount: reports.length
      });
    } else if (lang === "urdu") {
      const englishSummary = await summarizeProject(project, reports);
      let urduSummary = null;
      try {
        urduSummary = await translateToUrdu(englishSummary);
      } catch (err) {
        console.error("Urdu translation error:", err);
      }
      return res.json({
        summary: urduSummary || englishSummary,
        english: englishSummary,
        urdu: urduSummary,
        updatesCount: reports.length
      });
    } else {
      const summary = await summarizeProject(project, reports);
      return res.json({
        summary,
        english: summary,
        updatesCount: reports.length
      });
    }
  } catch (err) {
    console.error("Error generating project summary:", err);
    return res.status(500).json({ 
      message: err.message || "Could not generate summary"
    });
  }
}

/**
 * Generates Urdu-only summary
 */
async function getProjectSummaryUrdu(req, res) {
  const { projectId } = req.params;
  const { companyId } = req.user;

  try {
    const projCheck = await pool.query(
      "SELECT id, name, location FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const reportsResult = await pool.query(
      `SELECT entry_type, content, image_path, entry_date
       FROM daily_reports
       WHERE project_id = $1
       ORDER BY entry_date DESC, created_at DESC`,
      [projectId]
    );

    if (reportsResult.rows.length === 0) {
      return res.status(400).json({ message: "No daily updates yet to summarize." });
    }

    const project = projCheck.rows[0];
    const reports = reportsResult.rows;

    // Generate English first, then translate to Urdu
    const englishSummary = await summarizeProject(project, reports);
    let urduSummary = null;
    try {
      urduSummary = await translateToUrdu(englishSummary);
    } catch (err) {
      console.error("Urdu translation failed:", err);
    }

    return res.json({
      summary: urduSummary || englishSummary,
      english: englishSummary,
      urdu: urduSummary,
      updatesCount: reports.length
    });
  } catch (err) {
    console.error("Error generating Urdu summary:", err);
    return res.status(500).json({ 
      message: err.message || "Could not generate Urdu summary"
    });
  }
}

/**
 * Generates bilingual (English + Urdu) summary
 */
async function getProjectSummaryBilingual(req, res) {
  const { projectId } = req.params;
  const { companyId } = req.user;

  try {
    const projCheck = await pool.query(
      "SELECT id, name, location FROM projects WHERE id = $1 AND company_id = $2",
      [projectId, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const reportsResult = await pool.query(
      `SELECT entry_type, content, image_path, entry_date
       FROM daily_reports
       WHERE project_id = $1
       ORDER BY entry_date DESC, created_at DESC`,
      [projectId]
    );

    if (reportsResult.rows.length === 0) {
      return res.status(400).json({ message: "No daily updates yet to summarize." });
    }

    const project = projCheck.rows[0];
    const reports = reportsResult.rows;
    const summaries = await summarizeProjectBilingual(project, reports);

    return res.json({
      summary: summaries.english,
      urdu: summaries.urdu,
      updatesCount: reports.length
    });
  } catch (err) {
    console.error("Error generating bilingual summary:", err);
    return res.status(500).json({ 
      message: err.message || "Could not generate bilingual summary"
    });
  }
}

module.exports = { 
  createReport, 
  getReportsByProject, 
  deleteReport, 
  getProjectSummary,
  getProjectSummaryUrdu,
  getProjectSummaryBilingual
};