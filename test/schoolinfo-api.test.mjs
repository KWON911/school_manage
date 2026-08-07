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

test('SchoolInfo proxy rejects non-GET requests and declares GET as allowed', async () => {
  const response = createResponse();
  const handler = createSchoolInfoHandler({ env: {} });

  await handler({ method: 'POST', query: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(response.body, { error: 'Method not allowed' });
});

test('SchoolInfo proxy reports a missing server key without exposing it', async () => {
  const response = createResponse();
  const handler = createSchoolInfoHandler({
    env: { SCHOOLINFO_API_URL: 'https://schoolinfo.example.test/search' }
  });

  await handler({ method: 'GET', query: { name: 'Seoul School' } }, response);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    error: 'SCHOOLINFO_API_KEY is not configured on the server.'
  });
});

test('SchoolInfo proxy forwards only approved fields and returns normalized data without the key', async () => {
  let upstreamUrl;
  const handler = createSchoolInfoHandler({
    env: {
      SCHOOLINFO_API_KEY: 'server-secret',
      SCHOOLINFO_API_URL: 'https://schoolinfo.example.test/search?source=app'
    },
    fetch: async (url) => {
      upstreamUrl = new URL(url);
      return new Response(JSON.stringify({
        results: [{
          SHL_IDF_CD: ' SCH-123 ',
          schoolInfoUrl: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  const response = createResponse();

  await handler({
    method: 'GET',
    query: {
      name: 'Seoul School', area: 'Seoul', address: '1 School Road', neisCode: 'B100000001', ignored: 'nope'
    }
  }, response);

  assert.equal(upstreamUrl.searchParams.get('source'), 'app');
  assert.equal(upstreamUrl.searchParams.get('apiKey'), 'server-secret');
  assert.equal(upstreamUrl.searchParams.get('name'), 'Seoul School');
  assert.equal(upstreamUrl.searchParams.get('area'), 'Seoul');
  assert.equal(upstreamUrl.searchParams.get('address'), '1 School Road');
  assert.equal(upstreamUrl.searchParams.get('neisCode'), 'B100000001');
  assert.equal(upstreamUrl.searchParams.has('ignored'), false);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    schoolInfoId: 'SCH-123',
    schoolInfoUrl: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
  });
  assert.equal(JSON.stringify(response.body).includes('server-secret'), false);
});

test('SchoolInfo proxy converts malformed upstream data into a stable no-match response', async () => {
  const handler = createSchoolInfoHandler({
    env: {
      SCHOOLINFO_API_KEY: 'server-secret',
      SCHOOLINFO_API_URL: 'https://schoolinfo.example.test/search'
    },
    fetch: async () => new Response('{not json', { status: 200 })
  });
  const response = createResponse();

  await handler({ method: 'GET', query: { name: 'Seoul School' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'no-match' });
});
