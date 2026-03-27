require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'orders-api', timestamp: new Date().toISOString() });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orders API running on port ${PORT}`);
});

module.exports = app;
