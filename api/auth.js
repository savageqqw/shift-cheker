import { signToken } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не підтримується' });
  }

  const { password } = req.body || {};

  if (!process.env.APP_PASSWORD) {
    return res.status(500).json({ error: 'APP_PASSWORD не налаштовано на сервері' });
  }

  if (!password || password !== process.env.APP_PASSWORD) {
    return res.status(401).json({ error: 'Невірний пароль' });
  }

  return res.status(200).json({ token: signToken() });
}
