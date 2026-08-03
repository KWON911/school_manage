import { getTimetableEndpoint } from '../lib/school.mjs';

const PROXY_PATH = '/api/neis';
const EMPTY_ROWS = [];

function createUrl(endpoint, params = {}) {
  const query = new URLSearchParams({ endpoint });
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) query.set(name, value);
  }
  return `${PROXY_PATH}?${query}`;
}

function rowsFrom(body, endpoint) {
  const sections = body?.[endpoint];
  if (!Array.isArray(sections)) return EMPTY_ROWS;
  const rowSection = sections.find((section) => Array.isArray(section?.row));
  return rowSection?.row ?? EMPTY_ROWS;
}

async function requestRows(endpoint, params) {
  try {
    const response = await fetch(createUrl(endpoint, params));
    if (!response.ok) return { status: 'server-error', rows: [] };

    const body = await response.json();
    const rows = rowsFrom(body, endpoint);
    return rows.length > 0 ? { status: 'ok', rows } : { status: 'no-data', rows: [] };
  } catch (error) {
    return { status: 'network-error', rows: [] };
  }
}

function monthRange(yearMonth) {
  if (typeof yearMonth !== 'string' || !/^\d{6}$/.test(yearMonth)) return null;
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(4, 6));
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${yearMonth}01`, to: `${yearMonth}${String(lastDay).padStart(2, '0')}` };
}

function timetableRange(range) {
  if (Array.isArray(range)) return { from: range[0], to: range[1] };
  return { from: range?.from ?? range?.TI_FROM_YMD, to: range?.to ?? range?.TI_TO_YMD };
}

function schoolParams(school) {
  return {
    ATPT_OFCDC_SC_CODE: school?.ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE: school?.SD_SCHUL_CODE
  };
}

export function buildSchoolSearchUrl(query) {
  return createUrl('schoolInfo', { SCHUL_NM: query });
}

export function buildScheduleUrl(school, yearMonth) {
  const range = monthRange(yearMonth);
  return createUrl('SchoolSchedule', {
    ...schoolParams(school),
    AA_FROM_YMD: range?.from,
    AA_TO_YMD: range?.to
  });
}

export function buildTimetableUrl(school, classSetting, from, to) {
  const endpoint = getTimetableEndpoint(school?.kind);
  if (!endpoint) return null;
  return createUrl(endpoint, {
    ...schoolParams(school),
    AY: typeof from === 'string' ? from.slice(0, 4) : undefined,
    GRADE: classSetting?.grade,
    CLASS_NM: classSetting?.classNm,
    TI_FROM_YMD: from,
    TI_TO_YMD: to
  });
}

export function buildMealsUrl(school, yearMonth) {
  const range = monthRange(yearMonth);
  return createUrl('mealServiceDietInfo', {
    ...schoolParams(school),
    MLSV_FROM_YMD: range?.from,
    MLSV_TO_YMD: range?.to
  });
}

export async function searchSchools(query) {
  const result = await requestRows('schoolInfo', { SCHUL_NM: query });
  if (result.status !== 'ok') return result;
  return {
    status: 'ok',
    rows: result.rows.map((school) => ({
      name: school.SCHUL_NM,
      kind: school.SCHUL_KND_SC_NM,
      area: school.LCTN_SC_NM,
      address: school.ORG_RDNMA,
      ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
      SD_SCHUL_CODE: school.SD_SCHUL_CODE
    }))
  };
}

export function fetchSchedule(school, yearMonth) {
  const range = monthRange(yearMonth);
  return requestRows('SchoolSchedule', {
    ...schoolParams(school), AA_FROM_YMD: range?.from, AA_TO_YMD: range?.to
  });
}

export function fetchTimetable(school, classSetting, range) {
  const endpoint = getTimetableEndpoint(school?.kind);
  if (!endpoint) return Promise.resolve({ status: 'unsupported-school-kind', rows: [] });
  const dates = timetableRange(range);
  return requestRows(endpoint, {
    ...schoolParams(school),
    AY: typeof dates.from === 'string' ? dates.from.slice(0, 4) : undefined,
    GRADE: classSetting?.grade,
    CLASS_NM: classSetting?.classNm,
    TI_FROM_YMD: dates.from,
    TI_TO_YMD: dates.to
  });
}

export function fetchMeals(school, yearMonth) {
  const range = monthRange(yearMonth);
  return requestRows('mealServiceDietInfo', {
    ...schoolParams(school), MLSV_FROM_YMD: range?.from, MLSV_TO_YMD: range?.to
  });
}
