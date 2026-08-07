const DEFAULT_SCHOOLINFO_API_URL = 'https://www.schoolinfo.go.kr/openApi.do';
const DEFAULT_UPSTREAM_TIMEOUT_MS = 3000;

const REGION_CODES = [
  ['11', ['서울특별시', '서울']],
  ['26', ['부산광역시', '부산']],
  ['27', ['대구광역시', '대구']],
  ['28', ['인천광역시', '인천']],
  ['29', ['광주광역시', '광주']],
  ['30', ['대전광역시', '대전']],
  ['31', ['울산광역시', '울산']],
  ['36', ['세종특별자치시', '세종']],
  ['41', ['경기도', '경기']],
  ['51', ['강원특별자치도', '강원도', '강원']],
  ['43', ['충청북도', '충북']],
  ['44', ['충청남도', '충남']],
  ['52', ['전북특별자치도', '전라북도', '전북']],
  ['46', ['전라남도', '전남']],
  ['47', ['경상북도', '경북']],
  ['48', ['경상남도', '경남']],
  ['50', ['제주특별자치도', '제주도', '제주']]
];
const VALID_REGION_CODES = new Set(REGION_CODES.map(([code]) => code));
const VALID_SCHOOL_KIND_CODES = new Set(['02', '03', '04', '05', '06', '07']);

function nonEmptyString(value) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function comparable(value) {
  const text = nonEmptyString(value);
  return text
    ? text.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s.,()\[\]{}\-_/]/g, '')
    : null;
}

function isOfficialHost(hostname) {
  return hostname === 'schoolinfo.go.kr' || hostname.endsWith('.schoolinfo.go.kr');
}

function verifiedUpstreamUrl(value) {
  const candidate = nonEmptyString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:'
      && isOfficialHost(url.hostname)
      && !url.username
      && !url.password
      && (!url.port || url.port === '443')
      ? url
      : null;
  } catch {
    return null;
  }
}

function verifiedDetail(value) {
  const candidate = nonEmptyString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const schoolInfoId = nonEmptyString(url.searchParams.get('SHL_IDF_CD'));
    if (url.protocol !== 'https:'
      || !isOfficialHost(url.hostname)
      || url.pathname !== '/ei/ss/Pneiss_b01_s0.do'
      || !schoolInfoId) return null;
    return { schoolInfoUrl: url.toString(), schoolInfoId };
  } catch {
    return null;
  }
}

function regionCodeFrom(value) {
  const direct = nonEmptyString(value);
  if (direct && VALID_REGION_CODES.has(direct)) return direct;
  const normalized = comparable(value);
  if (!normalized) return null;
  for (const [code, aliases] of REGION_CODES) {
    if (aliases.some((alias) => normalized.includes(comparable(alias)))) return code;
  }
  return null;
}

function schoolKindCodeFrom(value) {
  const direct = nonEmptyString(value);
  if (direct && VALID_SCHOOL_KIND_CODES.has(direct)) return direct;
  const kind = comparable(value);
  if (!kind) return null;
  if (kind.includes('특수')) return '05';
  if (kind.includes('각종')) return '07';
  if (kind.includes('초등')) return '02';
  if (kind.includes('중학교')) return '03';
  if (kind.includes('고등')) return '04';
  if (kind.includes('기타') || kind.includes('그외')) return '06';
  return null;
}

function officialParamsFrom(query) {
  const params = { apiType: '0' };
  const sidoCode = regionCodeFrom(query?.sidoCode) ?? regionCodeFrom(query?.area) ?? regionCodeFrom(query?.address);
  const directSggCode = nonEmptyString(query?.sggCode);
  const sggCode = /^\d{5}$/.test(directSggCode ?? '')
    && (!sidoCode || directSggCode.startsWith(sidoCode))
    ? directSggCode
    : null;
  const schulKndCode = schoolKindCodeFrom(query?.schulKndCode) ?? schoolKindCodeFrom(query?.kind);

  if (sidoCode) params.sidoCode = sidoCode;
  if (sggCode) params.sggCode = sggCode;
  if (schulKndCode) params.schulKndCode = schulKndCode;
  return params;
}

function recordsFrom(body) {
  return Array.isArray(body?.list) ? body.list : [];
}

function recordName(record) {
  return nonEmptyString(record?.SCHUL_NM ?? record?.schoolName ?? record?.name);
}

function recordAddress(record) {
  return nonEmptyString(
    record?.SCHUL_RDNDA
      ?? record?.ADRCD
      ?? record?.ADRCD_NM
      ?? record?.SCHUL_ADRES
      ?? record?.ORG_RDNMA
      ?? record?.address
  );
}

function classifyMatch(record, query) {
  if (comparable(recordName(record)) !== comparable(query?.name)) return 'different-name';

  const evidence = [];
  const requestedAddress = comparable(query?.address);
  const upstreamAddress = comparable(recordAddress(record));
  if (requestedAddress && upstreamAddress) evidence.push(requestedAddress === upstreamAddress);

  const requestedRegion = regionCodeFrom(query?.area) ?? regionCodeFrom(query?.address);
  const upstreamRegion = regionCodeFrom(recordAddress(record) ?? record?.SIDO_NM ?? record?.LCTN_SC_NM);
  if (requestedRegion && upstreamRegion) evidence.push(requestedRegion === upstreamRegion);

  const requestedNeisCode = comparable(query?.neisCode);
  const upstreamSchoolCode = comparable(
    record?.SD_SCHUL_CODE ?? record?.NEIS_SCHUL_CODE ?? record?.SCHUL_CODE
  );
  if (requestedNeisCode && upstreamSchoolCode) evidence.push(requestedNeisCode === upstreamSchoolCode);

  if (evidence.includes(false)) return 'conflict';
  return evidence.includes(true) ? 'match' : 'unknown';
}

function normalizeUpstreamResponse(body, query = {}) {
  const sameNameRecords = recordsFrom(body).filter((record) => (
    record && typeof record === 'object' && comparable(recordName(record)) === comparable(query?.name)
  ));
  if (sameNameRecords.length !== 1 || classifyMatch(sameNameRecords[0], query) !== 'match') {
    return { status: 'no-match' };
  }

  const record = sameNameRecords[0];
  const explicitId = nonEmptyString(record.schoolInfoId ?? record.SHL_IDF_CD ?? record.shlIdfCd);
  const detail = verifiedDetail(record.schoolInfoUrl ?? record.detailUrl ?? record.url);
  if (explicitId && detail && explicitId !== detail.schoolInfoId) return { status: 'no-match' };
  const schoolInfoId = explicitId ?? detail?.schoolInfoId;
  if (!schoolInfoId && !detail) return { status: 'no-match' };
  return {
    status: 'ok',
    ...(schoolInfoId ? { schoolInfoId } : {}),
    ...(detail ? { schoolInfoUrl: detail.schoolInfoUrl } : {})
  };
}

function buildUpstreamUrl(baseUrl, apiKey, query) {
  const url = verifiedUpstreamUrl(baseUrl);
  if (!url) throw new TypeError('Invalid SchoolInfo upstream URL');
  url.searchParams.set('apiKey', apiKey);
  for (const [name, value] of Object.entries(officialParamsFrom(query))) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}

function createSchoolInfoHandler({
  env = process.env,
  fetch: fetchImpl = globalThis.fetch,
  upstreamTimeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = nonEmptyString(env.SCHOOLINFO_API_KEY);
    if (!apiKey) {
      return res.status(500).json({ error: 'SCHOOLINFO_API_KEY is not configured on the server.' });
    }

    const baseUrl = nonEmptyString(env.SCHOOLINFO_API_URL) ?? DEFAULT_SCHOOLINFO_API_URL;
    let upstreamUrl;
    try {
      upstreamUrl = buildUpstreamUrl(baseUrl, apiKey, req.query);
    } catch {
      return res.status(500).json({ error: 'SCHOOLINFO_API_URL is invalid on the server.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);
    try {
      const upstream = await fetchImpl(upstreamUrl, { signal: controller.signal });
      if (!upstream.ok) return res.status(200).json({ status: 'no-match' });
      let body;
      try {
        body = await upstream.json();
      } catch {
        return res.status(200).json({ status: 'no-match' });
      }
      return res.status(200).json(normalizeUpstreamResponse(body, req.query));
    } catch {
      return res.status(502).json({ status: 'unavailable' });
    } finally {
      clearTimeout(timeout);
    }
  };
}

const handler = createSchoolInfoHandler();

module.exports = handler;
module.exports.DEFAULT_SCHOOLINFO_API_URL = DEFAULT_SCHOOLINFO_API_URL;
module.exports.buildUpstreamUrl = buildUpstreamUrl;
module.exports.createSchoolInfoHandler = createSchoolInfoHandler;
module.exports.normalizeUpstreamResponse = normalizeUpstreamResponse;
