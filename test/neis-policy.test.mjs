import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { isAllowedEndpoint, getAllowedParams } = require('../api/neis.js');

test('Google OAuth uses the registered callback route instead of an action query', async () => {
  const source = await readFile(new URL('../api/google-calendar.js', import.meta.url), 'utf8');
  assert.match(source, /https:\/\/school-life-info\.vercel\.app\/api\/google-calendar\/callback/);
});

test('dish allergy matching returns only the selected complete codes', async () => {
  const { dishMatchesAllergies } = await import('../src/services/neis.mjs');

  assert.deepEqual(dishMatchesAllergies('Steamed egg(1.6.)', ['1', '6', '16']), ['1', '6']);
  assert.deepEqual(dishMatchesAllergies('Sausage(11.)', ['1']), []);
});

test('Google Calendar server exposes calendar-list and selected calendar event requests', async () => {
  const source = await readFile(new URL('../api/google-calendar.js', import.meta.url), 'utf8');
  assert.match(source, /action === 'calendar-list'/);
  assert.match(source, /calendarList/);
  assert.match(source, /calendarIds/);
  assert.doesNotMatch(source, /calendarIds\.length > 0 \? calendarIds : \['primary'\]/);
});

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

test('enriches normalized NEIS school rows with a SchoolInfo identifier', async () => {
  const { searchSchools } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  let resolverUrl;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('/api/neis?')) {
      return new Response(JSON.stringify({
        schoolInfo: [{ head: [] }, { row: [{
          SCHUL_NM: '\uAC00\uB78C\uC911\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50',
          LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
          ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2'
        }] }]
      }), { status: 200 });
    }
    resolverUrl = new URL(String(url), 'https://app.example');
    return new Response(JSON.stringify({ status: 'ok', schoolInfoId: 'SCH-2' }), { status: 200 });
  };

  try {
    assert.deepEqual(await searchSchools('\uAC00\uB78C'), {
      status: 'ok',
      rows: [{
        name: '\uAC00\uB78C\uC911\uD559\uAD50', kind: '\uC911\uD559\uAD50', area: '\uC11C\uC6B8', address: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
        ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2', schoolInfoId: 'SCH-2',
        schoolInfoUrl: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-2'
      }]
    });
    assert.equal(resolverUrl.searchParams.get('kind'), '\uC911\uD559\uAD50');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps the normalized NEIS school row when SchoolInfo enrichment fails', async () => {
  const { searchSchools } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('/api/neis?')) {
      return new Response(JSON.stringify({
        schoolInfo: [{ head: [] }, { row: [{
          SCHUL_NM: '\uAC00\uB78C\uC911\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50',
          LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
          ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2'
        }] }]
      }), { status: 200 });
    }
    throw new Error('SchoolInfo unavailable');
  };

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

test('returns the NEIS row after aborting a stalled SchoolInfo lookup', async () => {
  const { searchSchools } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  let lookupWasAborted = false;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('/api/neis?')) {
      return new Response(JSON.stringify({
        schoolInfo: [{ head: [] }, { row: [{
          SCHUL_NM: '\uAC00\uB78C\uC911\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50',
          LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
          ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2'
        }] }]
      }), { status: 200 });
    }
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        lookupWasAborted = true;
        reject(new DOMException('Timed out', 'AbortError'));
      }, { once: true });
    });
  };

  try {
    const startedAt = Date.now();
    const result = await Promise.race([
      searchSchools('\uAC00\uB78C'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SchoolInfo lookup did not time out')), 2200))
    ]);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(lookupWasAborted, true);
    assert.ok(elapsedMs >= 1200, `lookup aborted too aggressively after ${elapsedMs} ms`);
    assert.ok(elapsedMs < 2100, `lookup exceeded its deadline after ${elapsedMs} ms`);
    assert.deepEqual(result.rows[0], {
      name: '\uAC00\uB78C\uC911\uD559\uAD50', kind: '\uC911\uD559\uAD50', area: '\uC11C\uC6B8', address: '\uC11C\uC6B8\uC2DC \uAC00\uB78C\uB85C 1',
      ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('limits SchoolInfo enrichment to four concurrent lookups', async () => {
  const { searchSchools } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  const pendingLookups = [];
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('/api/neis?')) {
      return new Response(JSON.stringify({
        schoolInfo: [{ head: [] }, { row: [
          { SCHUL_NM: '1\uBC88\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50', LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: 'A', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '1' },
          { SCHUL_NM: '2\uBC88\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50', LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: 'B', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' },
          { SCHUL_NM: '3\uBC88\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50', LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: 'C', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '3' },
          { SCHUL_NM: '4\uBC88\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50', LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: 'D', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '4' },
          { SCHUL_NM: '5\uBC88\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50', LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: 'E', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '5' },
          { SCHUL_NM: '6\uBC88\uD559\uAD50', SCHUL_KND_SC_NM: '\uC911\uD559\uAD50', LCTN_SC_NM: '\uC11C\uC6B8', ORG_RDNMA: 'F', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '6' }
        ] }]
      }), { status: 200 });
    }
    return new Promise((resolve) => pendingLookups.push(resolve));
  };

  try {
    const search = searchSchools('\uD559\uAD50');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(pendingLookups.length, 4);
    pendingLookups[0](new Response(JSON.stringify({ status: 'ok', schoolInfoId: 'SCH-1' }), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(pendingLookups.length, 5);
    pendingLookups[1](new Response(JSON.stringify({ status: 'ok', schoolInfoId: 'SCH-2' }), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(pendingLookups.length, 6);
    for (let index = 2; index < 6; index += 1) {
      pendingLookups[index](new Response(JSON.stringify({
        status: 'ok', schoolInfoId: `SCH-${index + 1}`
      }), { status: 200 }));
    }
    const result = await search;
    assert.deepEqual(result.rows.map((school) => school.schoolInfoId), [
      'SCH-1', 'SCH-2', 'SCH-3', 'SCH-4', 'SCH-5', 'SCH-6'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not attempt school search when the app is opened as a local file', async () => {
  const { searchSchools } = await import('../src/services/neis.mjs');
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  let calls = 0;
  globalThis.location = { protocol: 'file:' };
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('a local file cannot reach the server proxy');
  };

  try {
    assert.deepEqual(await searchSchools('\uAC00\uB78C'), {
      status: 'local-preview', rows: []
    });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
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

test('dish allergy matching compares complete NEIS numbers instead of substrings', async () => {
  const { getMealAllergyCodes, mealMatchesAllergies, dishMatchesAllergies } = await import('../src/services/neis.mjs');
  const meal = { DDISH_NM: '콩나물국(5.6.)<br/>소시지볶음(11.13.)<br/>계란찜(1.)' };

  assert.deepEqual(getMealAllergyCodes(meal), ['5', '6', '11', '13', '1']);
  assert.deepEqual(mealMatchesAllergies(meal, ['1', '6', '16']), ['1', '6']);
  assert.deepEqual(mealMatchesAllergies({ DDISH_NM: '소시지(11.)' }, ['1']), []);
});
