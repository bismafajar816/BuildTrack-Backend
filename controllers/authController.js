const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

function signToken(user) {
  return jwt.sign(
    { id: user.id, companyId: user.company_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

function validateEmail(email) {
  return typeof email === "string" && email.trim().includes("@");
}

function validatePassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/**
 * Registers a new COMPANY along with its first user, who becomes the admin.
 * This is the signup flow for a construction company joining BuildTrack.
 */
async function registerCompany(req, res) {
  const { companyName, fullName, email, password } = req.body;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!companyName || !fullName || !normalizedEmail || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Email must contain an '@' sign" });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({
      message: "Password must be at least 8 characters long and include at least one digit and one special character",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
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
      [company.id, fullName, normalizedEmail, passwordHash]
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
 * Admin/PM invites a new team member (project_manager or site_engineer)
 * into their own company. Requires an authenticated admin.
 */
async function inviteUser(req, res) {
  const { fullName, email, password, role } = req.body;
  const { companyId, role: requesterRole } = req.user;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (requesterRole !== "admin") {
    return res.status(403).json({ message: "Only an admin can add team members" });
  }
  if (!["project_manager", "site_engineer"].includes(role)) {
    return res.status(400).json({ message: "Role must be project_manager or site_engineer" });
  }
  if (!fullName || !normalizedEmail || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Email must contain an '@' sign" });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({
      message: "Password must be at least 8 characters long and include at least one digit and one special character",
    });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, fullName, normalizedEmail, passwordHash, role]
    );

    return res.status(201).json({ user: sanitizeUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error while adding team member" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Email must contain an '@' sign" });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({
      message: "Password must be at least 8 characters long and include at least one digit and one special character",
    });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
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

module.exports = { registerCompany, inviteUser, login, getMe };
