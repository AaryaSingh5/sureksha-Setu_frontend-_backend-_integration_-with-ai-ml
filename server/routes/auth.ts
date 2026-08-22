import { Router } from 'express';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Supports demo credentials or any officer login
  const mockToken = `mock-jwt-token-${Date.now()}`;
  const authId = 'eee6684b-dee5-4471-bfd0-00b9a7ee9b66';

  res.json({
    access_token: mockToken,
    token_type: 'bearer',
    auth_id: authId,
    username: username || 'officer',
    role: 'authority',
    message: 'MFA Verification Successful'
  });
});

export default router;
