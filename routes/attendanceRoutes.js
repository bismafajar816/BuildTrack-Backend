const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { restrictToOwnProject } = require("../middleware/projectScopeMiddleware");
const { markAttendance, getAttendanceByDate } = require("../controllers/attendanceController");

router.post("/", protect, restrictToOwnProject, markAttendance);
router.get("/project/:projectId", protect, restrictToOwnProject, getAttendanceByDate);

module.exports = router;