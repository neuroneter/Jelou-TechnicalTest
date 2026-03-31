const { Router } = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { authenticateJWT } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

// POST /customers
router.post('/', authenticateJWT, validate(createCustomerSchema), async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const [existing] = await pool.query('SELECT id FROM customers WHERE email = ? AND deleted_at IS NULL', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A customer with this email already exists' });
    }
    const [result] = await pool.query(
      'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
      [name, email, phone || null]
    );
    const [rows] = await pool.query('SELECT id, name, email, phone, created_at FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A customer with this email already exists' });
    }
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /customers/:id
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /customers?search=&cursor=&limit=
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { search, cursor, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 20, 100);
    const cursorId = parseInt(cursor) || 0;

    let query = 'SELECT id, name, email, phone, created_at FROM customers WHERE deleted_at IS NULL';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (cursorId > 0) {
      query += ' AND id > ?';
      params.push(cursorId);
    }
    query += ' ORDER BY id ASC LIMIT ?';
    params.push(limit + 1);

    const [rows] = await pool.query(query, params);
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.json({ data, nextCursor, hasMore });
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /customers/:id
router.put('/:id', authenticateJWT, validate(updateCustomerSchema), async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);

    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM customers WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A customer with this email already exists' });
    }
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /customers/:id (soft-delete)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE customers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
