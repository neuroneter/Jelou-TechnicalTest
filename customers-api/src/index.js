require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const customersRouter = require('./routes/customers');
const internalRouter = require('./routes/internal');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'customers-api', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRouter);
app.use('/customers', customersRouter);
app.use('/internal', internalRouter);

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
  console.log(`Customers API running on port ${PORT}`);
});

module.exports = app;
