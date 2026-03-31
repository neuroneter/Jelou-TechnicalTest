const { Router } = require('express');
const pool = require('../config/db');
const { authenticateService } = require('../middleware/auth');

const router = Router();

// GET /internal/customers/:id - service-to-service endpoint
router.get('/customers/:id', authenticateService, async (req, res) => {
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

module.exports = router;
