const { Router } = require('express');
const { generateToken } = require('../middleware/auth');

const router = Router();

// POST /auth/login - simple login for testing
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Simple auth for demo purposes
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const token = generateToken({ username, role: 'operator' });
  res.json({ token, expiresIn: '24h' });
});

module.exports = router;
