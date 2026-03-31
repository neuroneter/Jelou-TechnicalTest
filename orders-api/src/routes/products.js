const { Router } = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { authenticateJWT } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  price_cents: z.number().int().min(0, 'Price must be non-negative'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price_cents: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).optional(),
});

// POST /products
router.post('/', authenticateJWT, validate(createProductSchema), async (req, res) => {
  try {
    const { sku, name, price_cents, stock } = req.body;
    const [result] = await pool.query(
      'INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)',
      [sku, name, price_cents, stock]
    );
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A product with this SKU already exists' });
    }
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /products/:id
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /products?search=&cursor=&limit=
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { search, cursor, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 20, 100);
    const cursorId = parseInt(cursor) || 0;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ?)';
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
    console.error('Error listing products:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /products/:id
router.patch('/:id', authenticateJWT, validate(updateProductSchema), async (req, res) => {
  try {
    const { name, price_cents, stock } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (price_cents !== undefined) { fields.push('price_cents = ?'); params.push(price_cents); }
    if (stock !== undefined) { fields.push('stock = ?'); params.push(stock); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    const [result] = await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
