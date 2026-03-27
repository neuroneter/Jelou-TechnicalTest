const serverless = require('serverless-http');
const express = require('express');

const app = express();
app.use(express.json());

const CUSTOMERS_API_BASE = process.env.CUSTOMERS_API_BASE || 'http://localhost:3001';
const ORDERS_API_BASE = process.env.ORDERS_API_BASE || 'http://localhost:3002';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'internal-service-token-2024';

// Helper: generate a JWT token for Orders API calls
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

function getOperatorToken() {
  return jwt.sign({ username: 'orchestrator', role: 'service' }, JWT_SECRET, { expiresIn: '5m' });
}

// Health check
app.get('/orchestrator/health', (req, res) => {
  res.json({ status: 'ok', service: 'lambda-orchestrator', timestamp: new Date().toISOString() });
});

// POST /orchestrator/create-and-confirm-order
app.post('/orchestrator/create-and-confirm-order', async (req, res) => {
  const { customer_id, items, idempotency_key, correlation_id } = req.body;
  const correlationId = correlation_id || `cor-${Date.now()}`;

  // Validate input
  if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      correlationId,
      error: 'customer_id and items (non-empty array) are required',
    });
  }

  if (!idempotency_key) {
    return res.status(400).json({
      success: false,
      correlationId,
      error: 'idempotency_key is required',
    });
  }

  try {
    const operatorToken = getOperatorToken();

    // Step 1: Validate customer via Customers API /internal endpoint
    const customerResponse = await fetch(`${CUSTOMERS_API_BASE}/internal/customers/${customer_id}`, {
      headers: { 'Authorization': `Bearer ${SERVICE_TOKEN}` },
    });

    if (!customerResponse.ok) {
      const errorBody = await customerResponse.json().catch(() => ({}));
      return res.status(customerResponse.status === 404 ? 404 : 502).json({
        success: false,
        correlationId,
        error: customerResponse.status === 404
          ? `Customer ${customer_id} not found`
          : 'Failed to validate customer',
        details: errorBody,
      });
    }

    const customer = await customerResponse.json();

    // Step 2: Create order via Orders API
    const createOrderResponse = await fetch(`${ORDERS_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({ customer_id, items }),
    });

    if (!createOrderResponse.ok) {
      const errorBody = await createOrderResponse.json().catch(() => ({}));
      return res.status(createOrderResponse.status >= 400 && createOrderResponse.status < 500 ? createOrderResponse.status : 502).json({
        success: false,
        correlationId,
        error: 'Failed to create order',
        details: errorBody,
      });
    }

    const createdOrder = await createOrderResponse.json();

    // Step 3: Confirm order via Orders API with idempotency key
    const confirmResponse = await fetch(`${ORDERS_API_BASE}/orders/${createdOrder.id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${operatorToken}`,
        'X-Idempotency-Key': idempotency_key,
      },
    });

    if (!confirmResponse.ok) {
      const errorBody = await confirmResponse.json().catch(() => ({}));
      return res.status(502).json({
        success: false,
        correlationId,
        error: 'Failed to confirm order',
        details: errorBody,
      });
    }

    const confirmedOrder = await confirmResponse.json();

    // Step 4: Return consolidated response
    res.status(201).json({
      success: true,
      correlationId,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        order: {
          id: confirmedOrder.id,
          status: confirmedOrder.status,
          total_cents: confirmedOrder.total_cents,
          items: (confirmedOrder.items || []).map(item => ({
            product_id: item.product_id,
            qty: item.qty,
            unit_price_cents: item.unit_price_cents,
            subtotal_cents: item.subtotal_cents,
          })),
        },
      },
    });
  } catch (err) {
    console.error('Orchestrator error:', err);
    res.status(500).json({
      success: false,
      correlationId,
      error: 'Internal orchestrator error',
      message: err.message,
    });
  }
});

module.exports.handler = serverless(app);
