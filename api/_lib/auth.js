import jwt from 'jsonwebtoken';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);

export function signToken(userId = 'owner') {
  return jwt.sign({ scope: 'shiftly' }, process.env.JWT_SECRET, {
    subject: userId, expiresIn: '60d', algorithm: 'HS256'
  });
}
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return payload.scope === 'shiftly' && typeof payload.sub === 'string' && payload.sub ? payload : null;
  } catch { return null; }
}
export function isAuthed(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
}
export function requireAuth(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  const payload = isAuthed(req);
  if (!payload) {
    res.status(401).json({ error: 'Сесія завершилася. Увійди ще раз.' });
    return null;
  }
  return payload.sub;
}
export function equalPasswords(a, b) {
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function checkPassword(password, stored) {
  const [salt, expected] = (stored || '').split(':');
  const actual = await scrypt(password, salt || 'unknown-account', 64);
  const expectedBytes = Buffer.from(expected || '', 'hex');
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
}
