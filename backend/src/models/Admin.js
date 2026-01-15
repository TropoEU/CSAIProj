import { db } from '../db.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export class Admin {
  /**
   * Create a new admin user
   */
  static async create(username, password, email = null, role = 'admin') {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO admins (username, password_hash, email, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, status, created_at`,
      [username, passwordHash, email, role]
    );
    return result.rows[0];
  }

  /**
   * Find admin by ID
   */
  static async findById(id) {
    const result = await db.query(
      'SELECT id, username, email, role, status, last_login_at, created_at FROM admins WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find admin by username
   */
  static async findByUsername(username) {
    const result = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    return result.rows[0] || null;
  }

  /**
   * Verify password and return admin if valid
   */
  static async verifyCredentials(username, password) {
    const admin = await this.findByUsername(username);
    if (!admin) {
      return null;
    }

    if (admin.status !== 'active') {
      return null;
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await this.updateLastLogin(admin.id);

    // Return admin without password hash
    const { password_hash: _password_hash, ...safeAdmin } = admin;
    return safeAdmin;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(id) {
    await db.query('UPDATE admins SET last_login_at = NOW() WHERE id = $1', [id]);
  }

  /**
   * Update admin password
   */
  static async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await db.query(
      `UPDATE admins SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, role, status`,
      [passwordHash, id]
    );
    return result.rows[0];
  }

  /**
   * Update admin details
   */
  static async update(id, updates) {
    const allowedFields = ['email', 'role', 'status'];
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await db.query(
      `UPDATE admins SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, username, email, role, status`,
      values
    );
    return result.rows[0];
  }

  /**
   * Get all admins
   */
  static async findAll() {
    const result = await db.query(
      'SELECT id, username, email, role, status, last_login_at, created_at FROM admins ORDER BY created_at DESC'
    );
    return result.rows;
  }

  /**
   * Delete admin
   */
  static async delete(id) {
    const result = await db.query('DELETE FROM admins WHERE id = $1 RETURNING id, username', [id]);
    return result.rows[0];
  }
}
