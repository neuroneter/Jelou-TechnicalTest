const { Router } = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { authenticateJWT } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'internal-service-token-2024';
const CUSTOMERS_API_BASE = process.env.CUSTOMERS_API_BASE || 'http://localhost:3001';

const createOrderSchema = z.object({
  customer_id: z.number().int().positive(),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    qty: z.number().int().positive(),
  })).min(1, 'At least one item is required'),
});

// Helper: validate customer via Customers API internal endpoint
async function validateCustomer(customerId) {
  const response = await fetch(`${CUSTOMERS_API_BASE}/internal/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${SERVICE_TOKEN}` },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Customers API error: ${response.status}`);
  }
  return response.json();
}

// POST /orders - Create order with stock validation and transaction
router.post('/', authenticateJWT, validate(createOrderSchema), async (req, res) => {
  const { customer_id, items } = req.body;
  const connection = await pool.getConnection();

  try {
    // Validate customer
    const customer = await validateCustomer(customer_id);
    if (!customer) {
      connection.release();
      return res.status(404).json({ error: 'Customer not found' });
    }

    await connection.beginTransaction();

    // Verify stock and get prices for all items
    const orderItems = [];
    let totalCents = 0;

    for (const item of items) {
      const [products] = await connection.query(
        'SELECT id, name, price_cents, stock FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      if (products.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: `Product ${item.product_id} not found` });
      }

      const product = products[0];
      if (product.stock < item.qty) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          error: `Insufficient stock for product ${product.name} (available: ${product.stock}, requested: ${item.qty})`,
        });
      }

      const subtotalCents = product.price_cents * item.qty;
      totalCents += subtotalCents;
      orderItems.push({
        product_id: item.product_id,
        qty: item.qty,
        unit_price_cents: product.price_cents,
        subtotal_cents: subtotalCents,
      });

      // Deduct stock
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.qty, item.product_id]
      );
    }

    // Create order
    const [orderResult] = await connection.query(
      'INSERT INTO orders (customer_id, status, total_cents) VALUES (?, ?, ?)',
      [customer_id, 'CREATED', totalCents]
    );
    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of orderItems) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.qty, item.unit_price_cents, item.subtotal_cents]
      );
    }

    await connection.commit();
    connection.release();

    // Fetch created order with items
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [fetchedItems] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    res.status(201).json({
      ...orders[0],
      items: fetchedItems,
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/:id - Get order with items
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...orders[0], items });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders?status=&from=&to=&cursor=&limit=
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { status, from, to, cursor, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 20, 100);
    const cursorId = parseInt(cursor) || 0;

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (from) {
      query += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND created_at <= ?';
      params.push(to);
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
    console.error('Error listing orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /orders/:id/confirm - Idempotent confirmation with X-Idempotency-Key
router.post('/:id/confirm', authenticateJWT, async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'X-Idempotency-Key header is required' });
  }

  const connection = await pool.getConnection();
  try {
    // Check if this idempotency key was already used
    const [existing] = await connection.query(
      'SELECT * FROM idempotency_keys WHERE `key` = ?',
      [idempotencyKey]
    );

    if (existing.length > 0) {
      connection.release();
      // Return cached response
      const cached = existing[0];
      if (cached.response_body) {
        const body = typeof cached.response_body === 'string'
          ? JSON.parse(cached.response_body)
          : cached.response_body;
        return res.status(200).json(body);
      }
      return res.status(200).json({ message: 'Already processed' });
    }

    await connection.beginTransaction();

    // Lock the order row
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (orders.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    if (order.status === 'CONFIRMED') {
      await connection.rollback();
      connection.release();
      return res.status(200).json({ message: 'Order already confirmed', order });
    }
    if (order.status !== 'CREATED') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `Cannot confirm order with status ${order.status}` });
    }

    // Confirm the order
    await connection.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['CONFIRMED', req.params.id]
    );

    // Get updated order with items
    const [updatedOrders] = await connection.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    const responseBody = { ...updatedOrders[0], items };

    // Store idempotency key
    await connection.query(
      'INSERT INTO idempotency_keys (`key`, target_type, target_id, status, response_body, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [idempotencyKey, 'order_confirm', parseInt(req.params.id), 'COMPLETED', JSON.stringify(responseBody)]
    );

    await connection.commit();
    connection.release();

    res.status(200).json(responseBody);
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error confirming order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /orders/:id/cancel - Cancel order and restore stock
router.post('/:id/cancel', authenticateJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (orders.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    if (order.status === 'CANCELED') {
      await connection.rollback();
      connection.release();
      return res.status(200).json({ message: 'Order already canceled', order });
    }

    if (order.status === 'CONFIRMED') {
      // Can only cancel within 10 minutes of creation
      const createdAt = new Date(order.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / (1000 * 60);
      if (diffMinutes > 10) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          error: 'Cannot cancel a confirmed order after 10 minutes',
        });
      }
    }

    if (order.status !== 'CREATED' && order.status !== 'CONFIRMED') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `Cannot cancel order with status ${order.status}` });
    }

    // Restore stock for all items
    const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    for (const item of items) {
      await connection.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.qty, item.product_id]
      );
    }

    // Update order status
    await connection.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['CANCELED', req.params.id]
    );

    await connection.commit();
    connection.release();

    const [updatedOrders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const [updatedItems] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...updatedOrders[0], items: updatedItems });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error canceling order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
