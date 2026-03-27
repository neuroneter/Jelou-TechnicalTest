const { Router } = require('express');
const { generateToken } = require('../middleware/auth');

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const token = generateToken({ username, role: 'operator' });
  res.json({ token, expiresIn: '24h' });
});

module.exports = router;
