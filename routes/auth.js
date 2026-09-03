import { Router } from 'express';
import { signToken } from '../middleware/auth.js';

const router = Router();

const DEMO_USER = process.env.DEMO_USERNAME || 'investigator';
const DEMO_PASS = process.env.DEMO_PASSWORD || 'investigator';

// Single-role demo login. Expand to a real user store + RBAC later.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== DEMO_USER || password !== DEMO_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ sub: username, role: 'investigator', name: username });
  return res.json({ token, user: { username, role: 'investigator' } });
});

export default router;
