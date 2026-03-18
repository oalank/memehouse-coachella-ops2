const bcrypt = require('bcrypt');
const { pool } = require('../config');

const SALT_ROUNDS = 12;

/**
 * Find user by email. Returns null if not found.
 * Shape: { id, email, password_hash, role, operator_id, is_active, created_at, updated_at }
 */
async function findByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, role, operator_id, is_active, created_at, updated_at FROM users WHERE email = $1 AND is_active = true',
    [email.trim().toLowerCase()]
  );
  return rows[0] || null;
}

/**
 * Find user by id. Returns null if not found. Excludes password_hash for safe use in session.
 */
async function findById(id) {
  if (id == null) return null;
  const { rows } = await pool.query(
    'SELECT id, email, role, operator_id, is_active, created_at, updated_at FROM users WHERE id = $1 AND is_active = true',
    [Number(id)]
  );
  return rows[0] || null;
}

/**
 * Verify password against hash. Returns true if match.
 */
function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false;
  return bcrypt.compareSync(plainPassword, hash);
}

/**
 * Hash password for storage.
 */
function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, SALT_ROUNDS);
}

/**
 * Authenticate email + password. Returns user (without password_hash) or null.
 */
async function authenticate(email, password) {
  const user = await findByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = {
  findByEmail,
  findById,
  verifyPassword,
  hashPassword,
  authenticate,
};
