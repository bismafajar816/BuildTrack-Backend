/**
 * Usage: router.get('/admin-only', protect, authorize('admin'), handler)
 * Pass one or more allowed roles.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires one of: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}

module.exports = { authorize };
