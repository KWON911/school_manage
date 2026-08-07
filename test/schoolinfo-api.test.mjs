import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSchoolInfoHandler } = require('../api/schoolinfo.js');

function createResponse() {
  const headers = new Map();
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function request(handler, query = {}) {
  const response = createResponse();
  await handler({ method: 'GET', query }, response);
  return response;
}

test('SchoolInfo proxy rejects non-GET requests and declares GET as allowed', async () => {
  const response = createResponse();
  const handler = createSchoolInfoHandler({ env: {} });

  await handler({ method: 'POST', query: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(response.body, { error: 'Method not allowed' });
});

test('SchoolInfo proxy reports a missing server key without exposing it', async () => {
  const response = await request(createSchoolInfoHandler({ env: {} }), { name: '가람중학교' });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    error: 'SCHOOLINFO_API_KEY is not configured on the server.'
  });
});

test('uses the official endpoint and parameters and normalizes an exact top-level list match', async () => {
  let upstreamUrl;
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async (url) => {
      upstreamUrl = new URL(url);
      return new Response(JSON.stringify({
        resultCode: 'success',
        resultMsg: '정상',
        list: [{
          SCHUL_NM: '가람중학교',
          SCHUL_RDNDA: '서울특별시 가람로 1',
          SCHUL_CODE: 'B100000002',
          SHL_IDF_CD: ' SCH-2 '
        }]
      }), { status: 200 });
    }
  });

  const response = await request(handler, {
    name: ' 가람중학교 ',
    kind: '중학교',
    area: '서울특별시',
    address: '서울특별시 가람로 1',
    neisCode: 'B100000002',
    ignored: 'nope'
  });

  assert.equal(upstreamUrl.toString().startsWith('https://www.schoolinfo.go.kr/openApi.do?'), true);
  assert.equal(upstreamUrl.searchParams.get('apiKey'), 'server-secret');
  assert.equal(upstreamUrl.searchParams.get('apiType'), '0');
  assert.equal(upstreamUrl.searchParams.get('sidoCode'), '11');
  assert.equal(upstreamUrl.searchParams.get('schulKndCode'), '03');
  assert.equal(upstreamUrl.searchParams.has('name'), false);
  assert.equal(upstreamUrl.searchParams.has('area'), false);
  assert.equal(upstreamUrl.searchParams.has('address'), false);
  assert.equal(upstreamUrl.searchParams.has('neisCode'), false);
  assert.equal(upstreamUrl.searchParams.has('ignored'), false);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'ok', schoolInfoId: 'SCH-2' });
  assert.equal(JSON.stringify(response.body).includes('server-secret'), false);
});

test('accepts direct official codes and an official HTTPS override only', async () => {
  let upstreamUrl;
  const handler = createSchoolInfoHandler({
    env: {
      SCHOOLINFO_API_KEY: 'server-secret',
      SCHOOLINFO_API_URL: 'https://api.schoolinfo.go.kr/custom?source=app'
    },
    fetch: async (url) => {
      upstreamUrl = new URL(url);
      return new Response(JSON.stringify({ list: [] }), { status: 200 });
    }
  });

  const response = await request(handler, {
    name: '없는고등학교', sidoCode: '26', sggCode: '26110', schulKndCode: '04'
  });

  assert.equal(upstreamUrl.origin, 'https://api.schoolinfo.go.kr');
  assert.equal(upstreamUrl.searchParams.get('source'), 'app');
  assert.equal(upstreamUrl.searchParams.get('sidoCode'), '26');
  assert.equal(upstreamUrl.searchParams.get('sggCode'), '26110');
  assert.equal(upstreamUrl.searchParams.get('schulKndCode'), '04');
  assert.deepEqual(response.body, { status: 'no-match' });
});

test('rejects a foreign or non-HTTPS upstream URL before attaching the API key', async () => {
  for (const override of ['https://schoolinfo.go.kr.evil.example/openApi.do', 'http://www.schoolinfo.go.kr/openApi.do']) {
    let fetched = false;
    const response = await request(createSchoolInfoHandler({
      env: { SCHOOLINFO_API_KEY: 'server-secret', SCHOOLINFO_API_URL: override },
      fetch: async () => {
        fetched = true;
        throw new Error('must not fetch');
      }
    }), { name: '가람중학교', kind: '중학교' });

    assert.equal(fetched, false);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'SCHOOLINFO_API_URL is invalid on the server.' });
  }
});

test('returns no-match when the requested school evidence conflicts with the list record', async () => {
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async () => new Response(JSON.stringify({
      list: [{
        SCHUL_NM: '가람중학교',
        ADRCD: '서울특별시 가람로 1',
        SCHUL_CODE: 'WRONG-CODE',
        SHL_IDF_CD: 'WRONG-ID'
      }]
    }), { status: 200 })
  });

  const response = await request(handler, {
    name: '가람중학교', area: '서울', address: '서울특별시 가람로 1', neisCode: 'B100000002', kind: '중학교'
  });

  assert.deepEqual(response.body, { status: 'no-match' });
});

test('returns no-match when same-name list results remain ambiguous', async () => {
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async () => new Response(JSON.stringify({
      list: [
        { SCHUL_NM: '한빛초등학교', SCHUL_RDNDA: '서울특별시 강남구 한빛로 1', SHL_IDF_CD: 'ONE' },
        { SCHUL_NM: '한빛초등학교', SCHUL_RDNDA: '서울특별시 강동구 한빛로 2', SHL_IDF_CD: 'TWO' }
      ]
    }), { status: 200 })
  });

  const response = await request(handler, { name: '한빛초등학교', area: '서울', kind: '초등학교' });

  assert.deepEqual(response.body, { status: 'no-match' });
});

test('returns no-match for multiple same-name records even when one evidence set matches', async () => {
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async () => new Response(JSON.stringify({
      list: [
        {
          SCHUL_NM: '한빛초등학교', SCHUL_RDNDA: '서울특별시 강남구 한빛로 1',
          SCHUL_CODE: 'B100000001', SHL_IDF_CD: 'ONE'
        },
        {
          SCHUL_NM: '한빛초등학교', SCHUL_RDNDA: '부산광역시 강서구 한빛로 2',
          SCHUL_CODE: 'C100000002', SHL_IDF_CD: 'TWO'
        }
      ]
    }), { status: 200 })
  });

  const response = await request(handler, {
    name: '한빛초등학교', area: '서울', address: '서울특별시 강남구 한빛로 1',
    neisCode: 'B100000001', kind: '초등학교'
  });

  assert.deepEqual(response.body, { status: 'no-match' });
});

test('does not guess a SchoolInfo ID from SCHUL_CODE', async () => {
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async () => new Response(JSON.stringify({
      list: [{ SCHUL_NM: '가람중학교', SCHUL_RDNDA: '서울특별시 가람로 1', SCHUL_CODE: 'B100000002' }]
    }), { status: 200 })
  });

  const response = await request(handler, {
    name: '가람중학교', address: '서울특별시 가람로 1', neisCode: 'B100000002', kind: '중학교'
  });

  assert.deepEqual(response.body, { status: 'no-match' });
});

test('accepts an identifier carried by a verified SchoolInfo detail URL', async () => {
  const detailUrl = 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=DETAIL-ID';
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async () => new Response(JSON.stringify({
      list: [{
        SCHUL_NM: '가람중학교',
        SCHUL_RDNDA: '서울특별시 가람로 1',
        SCHUL_CODE: 'B100000002',
        detailUrl
      }]
    }), { status: 200 })
  });

  const response = await request(handler, {
    name: '가람중학교', address: '서울특별시 가람로 1', neisCode: 'B100000002', kind: '중학교'
  });

  assert.deepEqual(response.body, { status: 'ok', schoolInfoId: 'DETAIL-ID', schoolInfoUrl: detailUrl });
});

test('converts malformed upstream data into a stable no-match response', async () => {
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    fetch: async () => new Response('{not json', { status: 200 })
  });

  const response = await request(handler, { name: '가람중학교', kind: '중학교' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'no-match' });
});

test('aborts a stalled upstream request and returns unavailable', async () => {
  let aborted = false;
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_KEY: 'server-secret' },
    upstreamTimeoutMs: 20,
    fetch: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('Timed out', 'AbortError'));
      }, { once: true });
    })
  });

  const response = await request(handler, { name: '가람중학교', kind: '중학교' });

  assert.equal(aborted, true);
  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { status: 'unavailable' });
});
