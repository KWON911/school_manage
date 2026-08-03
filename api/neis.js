const ALLOWED_ENDPOINTS = {
  schoolInfo: { allowed: ['SCHUL_NM', 'SCHUL_KND_SC_NM'], pageSize: 20 },
  SchoolSchedule: { allowed: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AA_FROM_YMD', 'AA_TO_YMD'], pageSize: 100 },
  elsTimetable: { allowed: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'SEM', 'GRADE', 'CLASS_NM', 'TI_FROM_YMD', 'TI_TO_YMD'], pageSize: 1000 },
  misTimetable: { allowed: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'SEM', 'GRADE', 'CLASS_NM', 'TI_FROM_YMD', 'TI_TO_YMD'], pageSize: 1000 },
  hisTimetable: { allowed: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'SEM', 'GRADE', 'CLASS_NM', 'TI_FROM_YMD', 'TI_TO_YMD'], pageSize: 1000 },
  mealServiceDietInfo: { allowed: ['ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'MLSV_FROM_YMD', 'MLSV_TO_YMD'], pageSize: 100 }
};

function isAllowedEndpoint(endpoint) {
  return typeof endpoint === 'string' && Object.hasOwn(ALLOWED_ENDPOINTS, endpoint);
}

function getAllowedParams(endpoint) {
  return isAllowedEndpoint(endpoint) ? [...ALLOWED_ENDPOINTS[endpoint].allowed] : [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'NEIS_API_KEY is not configured on the server.' });
  }

  const endpoint = req.query.endpoint;
  if (!isAllowedEndpoint(endpoint)) {
    return res.status(400).json({ error: 'Unsupported NEIS endpoint.' });
  }
  const config = ALLOWED_ENDPOINTS[endpoint];

  const params = new URLSearchParams({
    KEY: apiKey,
    Type: 'json',
    pIndex: '1',
    pSize: String(config.pageSize)
  });

  for (const name of getAllowedParams(endpoint)) {
    const value = req.query[name];
    if (typeof value === 'string' && value.length > 0) params.set(name, value);
  }

  try {
    const upstream = await fetch(`https://open.neis.go.kr/hub/${endpoint}?${params}`);
    const body = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(upstream.status).send(body);
  } catch (error) {
    console.error('NEIS request failed:', error);
    return res.status(502).json({ error: 'NEIS service could not be reached.' });
  }
};

module.exports.isAllowedEndpoint = isAllowedEndpoint;
module.exports.getAllowedParams = getAllowedParams;
