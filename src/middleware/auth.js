import jwt from 'jsonwebtoken';

// Middleware to verify JWT token from Authorization header
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if Authorization header is provided and has Bearer format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  const secret = process.env.JWTSECRET;

  try {
    // Verify token using secret key
    const decoded = jwt.verify(token, secret);
    // Attach decoded user data (id, email, etc.) to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
