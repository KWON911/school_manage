const APPROVED_QUERY_FIELDS = ['name', 'area', 'address', 'neisCode'];

function nonEmptyString(value) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function verifiedSchoolInfoUrl(value) {
  const url = nonEmptyString(value);
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'schoolinfo.go.kr' || parsed.hostname.endsWith('.schoolinfo.go.kr'))
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function recordsFrom(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];

  // SCHOOLINFO_API_URL is intentionally configurable because this project has
  // no verified official endpoint/schema. The configured endpoint is expected
  // to return a record (or a results/data/items/row array) with SHL_IDF_CD or
  // schoolInfoId; an optional detail URL is accepted only for schoolinfo.go.kr.
  const collections = [
    body.results, body.items, body.row, body.data,
    body.data?.results, body.data?.items, body.data?.row
  ];
  for (const collection of collections) {
    if (Array.isArray(collection)) return collection;
  }
  if (body.data && typeof body.data === 'object') return [body.data];
  return [body];
}

function normalizeUpstreamResponse(body) {
  for (const record of recordsFrom(body)) {
    if (!record || typeof record !== 'object') continue;
    const schoolInfoId = nonEmptyString(record.schoolInfoId ?? record.SHL_IDF_CD ?? record.shlIdfCd);
    const schoolInfoUrl = verifiedSchoolInfoUrl(record.schoolInfoUrl ?? record.detailUrl ?? record.url);
    if (!schoolInfoId && !schoolInfoUrl) continue;
    return {
      status: 'ok',
      ...(schoolInfoId ? { schoolInfoId } : {}),
      ...(schoolInfoUrl ? { schoolInfoUrl } : {})
    };
  }
  return { status: 'no-match' };
}

function buildUpstreamUrl(baseUrl, apiKey, query) {
  const url = new URL(baseUrl);
  url.searchParams.set('apiKey', apiKey);
  for (const name of APPROVED_QUERY_FIELDS) {
    const value = nonEmptyString(query?.[name]);
    if (value) url.searchParams.set(name, value);
  }
  return url.toString();
}

function createSchoolInfoHandler({ env = process.env, fetch: fetchImpl = globalThis.fetch } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = nonEmptyString(env.SCHOOLINFO_API_KEY);
    if (!apiKey) {
      return res.status(500).json({ error: 'SCHOOLINFO_API_KEY is not configured on the server.' });
    }

    const baseUrl = nonEmptyString(env.SCHOOLINFO_API_URL);
    if (!baseUrl) {
      return res.status(500).json({ error: 'SCHOOLINFO_API_URL is not configured on the server.' });
    }

    let upstreamUrl;
    try {
      upstreamUrl = buildUpstreamUrl(baseUrl, apiKey, req.query);
    } catch {
      return res.status(500).json({ error: 'SCHOOLINFO_API_URL is invalid on the server.' });
    }

    try {
      const upstream = await fetchImpl(upstreamUrl);
      if (!upstream.ok) return res.status(200).json({ status: 'no-match' });
      let body;
      try {
        body = await upstream.json();
      } catch {
        return res.status(200).json({ status: 'no-match' });
      }
      return res.status(200).json(normalizeUpstreamResponse(body));
    } catch (error) {
      console.error('SchoolInfo request failed:', error);
      return res.status(502).json({ status: 'unavailable' });
    }
  };
}

const handler = createSchoolInfoHandler();

module.exports = handler;
module.exports.APPROVED_QUERY_FIELDS = APPROVED_QUERY_FIELDS;
module.exports.buildUpstreamUrl = buildUpstreamUrl;
module.exports.createSchoolInfoHandler = createSchoolInfoHandler;
module.exports.normalizeUpstreamResponse = normalizeUpstreamResponse;
