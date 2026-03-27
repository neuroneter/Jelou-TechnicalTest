require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const pool = require('./config/db');
const { waitForDB } = require('./config/db');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check with DB validation
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'orders-api', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', service: 'orders-api', error: 'Database unavailable' });
  }
});

// Routes
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await waitForDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Orders API running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = app;
