const crypto = require('node:crypto');

const COOKIE_NAME = 'school_life_google_calendar';
const STATE_COOKIE_NAME = 'school_life_google_state';
const REDIRECT_URI = 'https://school-life-info.vercel.app/api/google-calendar/callback';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function readCookies(req) {
  return Object.fromEntries(String(req.headers.cookie ?? '').split(';').map((part) => {
    const separator = part.indexOf('=');
    return separator < 0 ? [] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
  }).filter((entry) => entry.length === 2));
}

function cookie(name, value, maxAge = 60 * 60 * 24 * 30) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function key() {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return secret ? crypto.createHash('sha256').update(secret).digest() : null;
}

function sign(value) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return secret ? crypto.createHmac('sha256', secret).update(value).digest('base64url') : null;
}

function verifyState(value) {
  const [state, signature] = String(value ?? '').split('.');
  const expected = state ? sign(state) : null;
  if (!state || !signature || !expected) return false;
  const received = Buffer.from(signature);
  const anticipated = Buffer.from(expected);
  return received.length === anticipated.length && crypto.timingSafeEqual(received, anticipated);
}

function encrypt(value) {
  const encryptionKey = key();
  if (!encryptionKey) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decrypt(value) {
  const encryptionKey = key();
  const [iv, authTag, encrypted] = String(value ?? '').split('.');
  if (!encryptionKey || !iv || !authTag || !encrypted) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

function configured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function respondJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function exchangeToken(params) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      ...params
    })
  });
  if (!response.ok) throw new Error('Google token exchange failed');
  return response.json();
}

async function usableToken(session) {
  if (!session?.access_token) return null;
  if (Number(session.expires_at) > Date.now() + 60_000) return session;
  if (!session.refresh_token) return null;
  try {
    const refreshed = await exchangeToken({ grant_type: 'refresh_token', refresh_token: session.refresh_token });
    return {
      ...session,
      access_token: refreshed.access_token,
      expires_at: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000
    };
  } catch {
    return null;
  }
}

function requestedRange(req) {
  const today = new Date();
  const from = /^\d{8}$/.test(req.query.from) ? req.query.from : today.toISOString().slice(0, 10).replaceAll('-', '');
  const to = /^\d{8}$/.test(req.query.to) ? req.query.to : from;
  const toDate = new Date(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T23:59:59.999Z`);
  return {
    timeMin: `${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T00:00:00Z`,
    timeMax: toDate.toISOString()
  };
}

async function eventsFor(session, req) {
  const range = requestedRange(req);
  const query = new URLSearchParams({ ...range, singleEvents: 'true', orderBy: 'startTime', maxResults: '20' });
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (response.status === 401) return { unauthorized: true, events: [] };
  if (!response.ok) throw new Error('Google Calendar request failed');
  const body = await response.json();
  return {
    events: (body.items ?? []).map((item) => {
      const start = item.start?.dateTime ?? item.start?.date;
      return {
        start,
        title: item.summary || '제목 없는 개인 일정',
        timeLabel: item.start?.dateTime ? String(item.start.dateTime).slice(11, 16) : '종일'
      };
    }).filter((item) => item.start)
  };
}

module.exports = async function handler(req, res) {
  const action = req.query.action;
  if (!configured()) return respondJson(res, 503, { error: 'Google Calendar is not configured.' });

  if (action === 'status' && req.method === 'GET') {
    return respondJson(res, 200, { connected: Boolean(decrypt(readCookies(req)[COOKIE_NAME])) });
  }

  if (action === 'authorize' && req.method === 'GET') {
    const state = crypto.randomBytes(24).toString('base64url');
    res.setHeader('Set-Cookie', cookie(STATE_COOKIE_NAME, `${state}.${sign(state)}`, 600));
    const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizeUrl.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: CALENDAR_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state
    }).toString();
    return res.redirect(302, authorizeUrl.toString());
  }

  if (action === 'callback' && req.method === 'GET') {
    const cookies = readCookies(req);
    if (req.query.error || !verifyState(cookies[STATE_COOKIE_NAME]) || req.query.state !== String(cookies[STATE_COOKIE_NAME]).split('.')[0]) {
      res.setHeader('Set-Cookie', cookie(STATE_COOKIE_NAME, '', 0));
      return res.redirect(302, '/?calendar=error');
    }
    try {
      const token = await exchangeToken({ grant_type: 'authorization_code', code: req.query.code });
      const session = encrypt({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: Date.now() + Number(token.expires_in ?? 3600) * 1000
      });
      res.setHeader('Set-Cookie', [cookie(COOKIE_NAME, session), cookie(STATE_COOKIE_NAME, '', 0)]);
      return res.redirect(302, '/?calendar=connected');
    } catch {
      return res.redirect(302, '/?calendar=error');
    }
  }

  if (action === 'disconnect' && req.method === 'POST') {
    res.setHeader('Set-Cookie', cookie(COOKIE_NAME, '', 0));
    return respondJson(res, 200, { disconnected: true });
  }

  if (action === 'events' && req.method === 'GET') {
    const session = await usableToken(decrypt(readCookies(req)[COOKIE_NAME]));
    if (!session) return respondJson(res, 401, { error: 'Google Calendar is not connected.' });
    try {
      const result = await eventsFor(session, req);
      if (result.unauthorized) return respondJson(res, 401, { error: 'Google Calendar connection expired.' });
      if (Number(session.expires_at) > 0) res.setHeader('Set-Cookie', cookie(COOKIE_NAME, encrypt(session)));
      return respondJson(res, 200, { events: result.events });
    } catch {
      return respondJson(res, 502, { error: 'Google Calendar could not be reached.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return respondJson(res, 405, { error: 'Method not allowed.' });
};

module.exports.decrypt = decrypt;
module.exports.encrypt = encrypt;
module.exports.verifyState = verifyState;
