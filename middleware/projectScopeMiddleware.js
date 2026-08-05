/**
 * Restricts non-admin users (project_manager, site_engineer) to only the
 * project they're assigned to. Admins bypass this check and can access
 * any project within their own company (already enforced by company_id
 * scoping in each controller).
 *
 * Looks for the target project id in req.params.projectId first (routes
 * like /project/:projectId), falling back to req.body.project_id (routes
 * like POST / where the project is sent in the body).
 */
function restrictToOwnProject(req, res, next) {
  if (req.user.role === "admin") {
    return next();
  }

  const requestedProjectId = req.params.projectId || req.body.project_id;

  if (!requestedProjectId) {
    return res.status(400).json({ message: "A project_id is required" });
  }

  if (requestedProjectId !== req.user.projectId) {
    return res.status(403).json({ message: "You don't have access to this project" });
  }

  next();
}

module.exports = { restrictToOwnProject };