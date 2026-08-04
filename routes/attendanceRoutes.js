const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { markAttendance, getAttendanceByDate } = require("../controllers/attendanceController");

router.post("/", protect, markAttendance);
router.get("/project/:projectId", protect, getAttendanceByDate);

module.exports = router;