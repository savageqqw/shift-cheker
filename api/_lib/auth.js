import jwt from 'jsonwebtoken';

function secret() {
  return process.env.JWT_SECRET;
}

export function signToken() {
  return jwt.sign({ scope: 'shiftly' }, secret(), { expiresIn: '60d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

export function isAuthed(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return false;
  return !!verifyToken(token);
}

export function requireAuth(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Потрібна авторизація' });
    return false;
  }
  return true;
}
