import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isAllowedEndpoint, getAllowedParams } = require('../api/neis.js');

test('allows middle and high school timetable endpoints with the elementary timetable parameters', () => {
  assert.equal(isAllowedEndpoint('misTimetable'), true);
  assert.equal(isAllowedEndpoint('hisTimetable'), true);
  assert.equal(isAllowedEndpoint('unknownEndpoint'), false);
  assert.deepEqual(getAllowedParams('misTimetable'), [
    'ATPT_OFCDC_SC_CODE', 'SD_SCHUL_CODE', 'AY', 'SEM', 'GRADE', 'CLASS_NM', 'TI_FROM_YMD', 'TI_TO_YMD'
  ]);
  assert.deepEqual(getAllowedParams('hisTimetable'), getAllowedParams('elsTimetable'));
});

test('builds a middle-school timetable URL with the selected endpoint and grade, without an API key', async () => {
  const { buildTimetableUrl } = await import('../src/services/neis.mjs');
  const url = buildTimetableUrl(
    { kind: '\uC911\uD559\uAD50', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' },
    { grade: '2', classNm: '3' },
    '20260801',
    '20260831'
  );

  assert.match(url, /endpoint=misTimetable/);
  assert.match(url, /GRADE=2/);
  assert.doesNotMatch(url, /(?:^|[?&])KEY=/);
});

test('normalizes school search rows into the profile school shape', async () => {
  const { searchSchools } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    schoolInfo: [{ head: [] }, { row: [{
      SCHUL_NM: '\uAC00\uB78C\uC911\uD559\uAD50',
      SCHUL_KND_SC_NM: '\uC911\uD559\uAD50',
      LCTN_SC_NM: '\uC11C\uC6B8',
      ORG_RDNMA: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
      ATPT_OFCDC_SC_CODE: 'B10',
      SD_SCHUL_CODE: '2'
    }] }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    assert.deepEqual(await searchSchools('\uAC00\uB78C'), {
      status: 'ok',
      rows: [{
        name: '\uAC00\uB78C\uC911\uD559\uAD50', kind: '\uC911\uD559\uAD50', area: '\uC11C\uC6B8', address: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
        ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2'
      }]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not make a request for an unsupported school kind', async () => {
  const { fetchTimetable } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('should not run');
  };

  try {
    assert.deepEqual(await fetchTimetable(
      { kind: '\uD2B9\uC218\uD559\uAD50', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' },
      { grade: '1', classNm: '1' },
      { from: '20260801', to: '20260831' }
    ), { status: 'unsupported-school-kind', rows: [] });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('turns a valid successful empty row list and failed proxy responses into displayable statuses', async () => {
  const { fetchMeals } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  const responses = [
    new Response(JSON.stringify({ mealServiceDietInfo: [{ head: [] }] }), { status: 200 }),
    new Response('upstream unavailable', { status: 503 })
  ];
  globalThis.fetch = async () => responses.shift();
  const school = { ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' };

  try {
    assert.deepEqual(await fetchMeals(school, '202608'), { status: 'no-data', rows: [] });
    assert.deepEqual(await fetchMeals(school, '202608'), { status: 'server-error', rows: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('treats malformed JSON from a successful proxy response as a server error', async () => {
  const { fetchMeals } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{not json', { status: 200 });

  try {
    assert.deepEqual(await fetchMeals({ ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' }, '202608'), {
      status: 'server-error', rows: []
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('treats a NEIS RESULT error payload without rows as a server error', async () => {
  const { fetchMeals } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    RESULT: { CODE: 'ERROR-300', MESSAGE: 'invalid request' }
  }), { status: 200 });

  try {
    assert.deepEqual(await fetchMeals({ ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' }, '202608'), {
      status: 'server-error', rows: []
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
