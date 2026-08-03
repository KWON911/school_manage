import {
  fetchMeals as requestMeals,
  fetchSchedule as requestSchedule,
  fetchTimetable as requestTimetable
} from '../services/neis.mjs';
import { getPeriodStatus } from '../lib/period-times.mjs';

const ROLE_SECTIONS = {
  student: ['timetable', 'meals', 'upcoming'],
  parent: ['child-class', 'meals', 'upcoming'],
  teacher: ['timetable', 'meals', 'upcoming']
};

export function getDashboardSections(role) {
  return [...(ROLE_SECTIONS[role] ?? ROLE_SECTIONS.student)];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dateParts(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    key: `${year}${month}${day}`,
    month: `${year}${month}`,
    label: `${date.getMonth() + 1}월 ${date.getDate()}일`
  };
}

function cacheKey(profile, suffix) {
  const school = profile.school ?? {};
  const classSetting = profile.classSetting ?? {};
  return [
    school.ATPT_OFCDC_SC_CODE,
    school.SD_SCHUL_CODE,
    classSetting.grade,
    classSetting.classNm,
    suffix
  ].join(':');
}

async function cachedRequest(cache, key, request) {
  if (!cache?.has(key)) {
    const pending = Promise.resolve().then(request);
    cache?.set(key, pending);
    const result = await pending;
    if (result.status === 'network-error' || result.status === 'server-error') cache?.delete(key);
    else cache?.set(key, result);
    return result;
  }
  return cache.get(key);
}

function action(view, label) {
  return `<button class="dashboard-card__action" type="button" data-view="${view}">${label}</button>`;
}

function retryAction(resource) {
  return `<button class="dashboard-card__action" type="button" data-action="retry-dashboard" data-resource="${resource}">다시 시도</button>`;
}

function failureMessage(status, resource) {
  const messages = {
    meals: {
      'network-error': '네트워크 연결로 급식 정보를 불러오지 못했어요.',
      'server-error': '학교 정보 시스템 응답 문제로 급식 정보를 불러오지 못했어요.'
    },
  };
  return messages[resource]?.[status] ?? null;
}

function failureState(status, resource) {
  const message = failureMessage(status, resource);
  return message ? `<div class="dashboard-state" role="alert"><p>${message}</p></div>` : null;
}

function stateAction(status) {
  if (status === 'network-error' || status === 'server-error') {
    return retryAction('timetable');
  }
  if (status === 'no-data') return action('settings', '반 바꾸기');
  return action('settings', '학교 확인하기');
}

function stateMessage(status, dateLabel) {
  if (status === 'no-data') return `${dateLabel} 시간표가 아직 게시되지 않았어요.`;
  if (status === 'network-error') return '네트워크 연결로 시간표를 불러오지 못했어요.';
  if (status === 'unsupported-school-kind') {
    return '현재 초등학교·중학교·고등학교 시간표만 지원해요. 설정한 학교 유형을 확인해 주세요.';
  }
  return '시간표를 불러오는 중 문제가 생겼어요.';
}

function timetableRows(result, dateKey) {
  return (result.rows ?? [])
    .filter((row) => !row.ALL_TI_YMD || row.ALL_TI_YMD === dateKey)
    .sort((a, b) => Number(a.PERIO) - Number(b.PERIO));
}

function renderTimetableCard(section, profile, result, date, now) {
  const isParent = section === 'child-class';
  const classLabel = `${escapeHtml(profile.classSetting?.grade)}학년 ${escapeHtml(profile.classSetting?.classNm)}반`;
  const title = '오늘 시간표';
  if (result.status !== 'ok') {
    return `<article class="dashboard-card dashboard-card--timetable" data-dashboard-section="${section}">
      <div class="dashboard-card__heading">
        <p class="dashboard-card__eyebrow">오늘의 수업</p>
        <h2>${title}</h2>
      </div>
      <div class="dashboard-state" role="status">
        <p>${stateMessage(result.status, date.label)}</p>
      </div>
      ${stateAction(result.status)}
    </article>`;
  }

  const rows = timetableRows(result, date.key);
  if (rows.length === 0) return renderTimetableCard(section, profile, { status: 'no-data' }, date);
  return `<article class="dashboard-card dashboard-card--timetable" data-dashboard-section="${section}">
    <div class="dashboard-card__heading">
      <p class="dashboard-card__eyebrow">${isParent ? `${classLabel} 자녀 수업` : classLabel}</p>
      <h2>${title}</h2>
    </div>
    <ol class="timetable-preview timetable-preview--vertical" aria-label="오늘 시간표">
      ${rows.map((row) => {
        const status = getPeriodStatus(row.PERIO, profile.periodTimes, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        const label = { current: '진행중', completed: '종료', upcoming: '예정' }[status];
        return `<li><span>${escapeHtml(row.PERIO)}교시</span><strong>${escapeHtml(row.ITRT_CNTNT || '수업 정보 없음')}</strong><em class="class-status${status === 'current' ? ' is-current' : ''}">${label}</em></li>`;
      }).join('')}
    </ol>
    ${action('timetable', '시간표 전체 보기')}
  </article>`;
}

function mealItems(row) {
  return String(row?.DDISH_NM ?? '')
    .split(/<br\s*\/?\s*>/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchingAllergies(row, allergies) {
  const notation = String(row?.DDISH_NM ?? '');
  return allergies.filter((code) => new RegExp(`(^|[.(,\\s])${String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[.),\\s])`).test(notation));
}

function renderMealsCard(profile, result, date) {
  const row = (result.rows ?? []).find((item) => item.MLSV_YMD === date.key) ?? result.rows?.[0];
  const items = result.status === 'ok' ? mealItems(row) : [];
  const matched = matchingAllergies(row, profile.allergies ?? []);
  const failure = failureState(result.status, 'meals');
  return `<article class="dashboard-card dashboard-card--meals" data-dashboard-section="meals">
    <div class="dashboard-card__heading">
      <p class="dashboard-card__eyebrow">오늘의 급식</p>
      <h2>${escapeHtml(row?.MMEAL_SC_NM ?? '점심 식단')}</h2>
    </div>
    ${failure ?? (items.length > 0
      ? `<ul class="meal-preview">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<div class="dashboard-state" role="status"><p>오늘 등록된 급식 정보가 없어요.</p></div>')}
    ${matched.length > 0 ? `<p class="allergy-match">설정한 알레르기 번호 ${matched.map(escapeHtml).join(', ')}가 표기된 메뉴가 있어요.</p>` : ''}
    <p class="allergy-note">알레르기 안내는 NEIS 급식 알레르기 표기를 기준으로 하며, 실제 제공 식단은 학교에 다시 확인해 주세요.</p>
    ${failure ? retryAction('meals') : action('meals', '급식 자세히 보기')}
  </article>`;
}

function renderUpcomingCard(result, date) {
  const rows = result.status === 'ok'
    ? (result.rows ?? []).filter((row) => /^\d{8}$/.test(row.AA_YMD) && row.AA_YMD >= date.key)
      .sort((a, b) => String(a.AA_YMD).localeCompare(String(b.AA_YMD))).slice(0, 4)
    : [];
  const content = result.status === 'ok' && rows.length > 0
    ? `<ol class="upcoming-list">${rows.map((row) => `<li><time><strong>${escapeHtml(String(row.AA_YMD).slice(4, 6))}.${escapeHtml(String(row.AA_YMD).slice(6, 8))}</strong><span>${escapeHtml(row.AA_YMD === date.key ? '오늘' : '예정')}</span></time><div><strong>${escapeHtml(row.EVENT_NM || '학교 일정')}</strong></div></li>`).join('')}</ol>`
    : '<div class="dashboard-state" role="status"><p>다가오는 일정이 아직 없어요.</p></div>';
  return `<article class="dashboard-card dashboard-card--upcoming" data-dashboard-section="upcoming">
    <div class="dashboard-card__heading"><p class="dashboard-card__eyebrow">학교 일정</p><h2>다가오는 일정</h2></div>
    ${content}
    ${action('schedule', '일정 전체 보기')}
  </article>`;
}

function greeting(role) {
  return { student: '안녕하세요, 학생님', parent: '안녕하세요, 보호자님', teacher: '안녕하세요, 선생님' }[role] ?? '안녕하세요';
}

export function renderDashboardLoadingMarkup(profile = {}) {
  return `<div class="content-heading"><p>오늘의 학교생활</p><span>${escapeHtml(profile.school?.name)}</span></div>
    <header class="dashboard-header"><h1 id="view-title">${greeting(profile.role)}</h1></header>
    <div class="dashboard-overview" aria-busy="true"><div class="dashboard-stack"><div class="dashboard-card dashboard-card--loading"></div><div class="dashboard-card dashboard-card--loading"></div></div><div class="dashboard-card dashboard-card--loading"></div></div>`;
}

function renderLoading(container, profile) {
  container.innerHTML = renderDashboardLoadingMarkup(profile);
}

export function renderDashboard(container, context = {}) {
  const profile = context.profile ?? {};
  const services = context.services ?? {
    fetchTimetable: requestTimetable,
    fetchMeals: requestMeals,
    fetchSchedule: requestSchedule
  };
  const now = context.now instanceof Date ? context.now : new Date();
  const date = dateParts(now);
  const caches = context.viewData ?? {};
  let destroyed = false;

  renderLoading(container, profile);

  async function load() {
    const timetableKey = cacheKey(profile, date.key);
    const mealKey = cacheKey(profile, date.month);
    const needsMeals = getDashboardSections(profile.role).includes('meals');
    const [timetable, meals, schedule] = await Promise.all([
      cachedRequest(caches.timetable, timetableKey, () => services.fetchTimetable(
        profile.school,
        profile.classSetting,
        { from: date.key, to: date.key }
      )),
      needsMeals
        ? cachedRequest(caches.meals, mealKey, () => services.fetchMeals(profile.school, date.month))
        : Promise.resolve({ status: 'no-data', rows: [] }),
      cachedRequest(caches.schedule, cacheKey(profile, date.month), () => services.fetchSchedule(profile.school, date.month))
    ]);
    if (destroyed) return;

    const sections = getDashboardSections(profile.role).filter((section) => section !== 'upcoming').map((section) => {
      if (section === 'timetable' || section === 'child-class') {
        return renderTimetableCard(section, profile, timetable, date, now);
      }
      return renderMealsCard(profile, meals, date);
    });
    container.innerHTML = `<div class="content-heading"><p>오늘의 학교생활</p><span>${escapeHtml(profile.school?.name)}</span></div>
      <header class="dashboard-header"><h1 id="view-title">${greeting(profile.role)}</h1></header>
      <div class="dashboard-overview"><div class="dashboard-stack">${sections.join('')}</div>${renderUpcomingCard(schedule, date)}</div>`;
  }

  function onClick(event) {
    if (!event.target.closest?.('[data-action="retry-dashboard"]')) return;
    Object.values(caches).forEach((cache) => cache?.clear?.());
    renderLoading(container, profile);
    void load();
  }

  container.addEventListener?.('click', onClick);
  const ready = load();
  return {
    ready,
    destroy() {
      destroyed = true;
      container.removeEventListener?.('click', onClick);
    }
  };
}
