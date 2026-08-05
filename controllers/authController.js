const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

function signToken(user) {
  return jwt.sign(
    { id: user.id, companyId: user.company_id, role: user.role, projectId: user.project_id || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Registers a new COMPANY along with its first user, who becomes the admin.
 * This is the signup flow for a construction company joining BuildTrack.
 */
async function registerCompany(req, res) {
  const { companyName, fullName, email, password } = req.body;

  if (!companyName || !fullName || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const companyResult = await client.query(
      "INSERT INTO companies (name) VALUES ($1) RETURNING *",
      [companyName]
    );
    const company = companyResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING *`,
      [company.id, fullName, email, passwordHash]
    );
    const user = userResult.rows[0];

    await client.query("COMMIT");

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
      company,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ message: "Server error during registration" });
  } finally {
    client.release();
  }
}

/**
 * Admin invites a new team member (project_manager or site_engineer) into
 * their own company, assigned to one of their company's projects.
 */
async function inviteUser(req, res) {
  const { fullName, email, password, role, project_id } = req.body;
  const { companyId, role: requesterRole } = req.user;

  if (requesterRole !== "admin") {
    return res.status(403).json({ message: "Only an admin can add team members" });
  }
  if (!["project_manager", "site_engineer"].includes(role)) {
    return res.status(400).json({ message: "Role must be project_manager or site_engineer" });
  }
  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!project_id) {
    return res.status(400).json({ message: "Please select a project for this team member" });
  }

  try {
    // The chosen project must belong to the admin's own company —
    // admins can only staff projects that exist in their company.
    const projCheck = await pool.query(
      "SELECT id FROM projects WHERE id = $1 AND company_id = $2",
      [project_id, companyId]
    );
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ message: "Selected project was not found in your company" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role, project_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, fullName, email, passwordHash, role, project_id]
    );

    return res.status(201).json({ user: sanitizeUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while adding team member" });
  }
}

/**
 * Lists everyone in the admin's company, with their assigned project name.
 * Admin-only — this powers the Team page.
 */
async function getTeam(req, res) {
  const { companyId, role } = req.user;

  if (role !== "admin") {
    return res.status(403).json({ message: "Only an admin can view the team" });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.created_at,
              p.id AS project_id, p.name AS project_name
       FROM users u
       LEFT JOIN projects p ON p.id = u.project_id
       WHERE u.company_id = $1
       ORDER BY (u.role = 'admin') DESC, u.full_name`,
      [companyId]
    );
    return res.json({ team: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while loading the team" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login" });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user: sanitizeUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { registerCompany, inviteUser, login, getMe, getTeam };