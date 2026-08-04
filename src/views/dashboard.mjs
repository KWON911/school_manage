import {
  fetchMeals as requestMeals,
  fetchSchedule as requestSchedule,
  fetchTimetable as requestTimetable,
  dishMatchesAllergies,
  mealMatchesAllergies
} from '../services/neis.mjs';
import { fetchCalendarEvents as requestCalendarEvents } from '../services/google-calendar.mjs';
import { getPeriodStatus } from '../lib/period-times.mjs';

const ROLE_SECTIONS = {
  student: ['timetable', 'meals', 'upcoming'],
  parent: ['child-class', 'meals', 'upcoming'],
  teacher: ['timetable', 'meals', 'upcoming']
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

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

function clockDateTimeValue(date) {
  const { key } = dateParts(date);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6)}T${hour}:${minute}:${second}`;
}

function dashboardClockLabel(date) {
  const hour = date.getHours();
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]}) · ${period} ${displayHour}:${minute}:${second}`;
}

function dashboardTopMarkup(profile, currentTime) {
  return `<header class="dashboard-header">
    <div class="dashboard-header__topline">
      <h1 id="view-title">${greeting(profile.role)}</h1>
      <time class="dashboard-clock" data-dashboard-clock datetime="${clockDateTimeValue(currentTime)}">${dashboardClockLabel(currentTime)}</time>
    </div>
  </header>`;
}

function monthEndKey(date) {
  return dateParts(new Date(date.getFullYear(), date.getMonth() + 1, 0)).key;
}

function moveDate(date, direction) {
  const next = new Date(date);
  next.setDate(next.getDate() + (direction === 'previous' ? -1 : 1));
  return next;
}

function dashboardDateControls(kind, date, now) {
  const label = kind === 'timetable' ? '시간표' : '급식';
  const selected = date instanceof Date ? dateParts(date) : date;
  const isToday = selected.key === dateParts(now).key;
  return `<div class="dashboard-card__date-controls" aria-label="${label} 날짜 이동">
    <button type="button" data-dashboard-date="${kind}" data-direction="previous">이전 날짜</button>
    <button class="dashboard-card__date-today" type="button" data-dashboard-date="${kind}" data-direction="today" aria-label="${label} 오늘로 돌아가기"><time datetime="${selected.key.slice(0, 4)}-${selected.key.slice(4, 6)}-${selected.key.slice(6)}">${isToday ? '오늘' : selected.label}</time></button>
    <button type="button" data-dashboard-date="${kind}" data-direction="next">다음 날짜</button>
  </div>`;
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

function selectedCalendarIds(profile) {
  return [...new Set((Array.isArray(profile?.calendarIds) ? profile.calendarIds : [])
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim()))];
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

function loadingState(message) {
  return `<div class="dashboard-state" role="status" aria-busy="true"><p>${message}</p></div>`;
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
  const dateControls = dashboardDateControls('timetable', date, now);
  if (result.status === 'loading') {
    return `<article class="dashboard-card dashboard-card--timetable" data-dashboard-section="${section}">
      <div class="dashboard-card__heading">
        <p class="dashboard-card__eyebrow">오늘의 수업</p>
        <h2>${title}</h2>
        ${dateControls}
      </div>
      ${loadingState('시간표를 불러오는 중이에요.')}
    </article>`;
  }
  if (result.status !== 'ok') {
    return `<article class="dashboard-card dashboard-card--timetable" data-dashboard-section="${section}">
      <div class="dashboard-card__heading">
        <p class="dashboard-card__eyebrow">오늘의 수업</p>
        <h2>${title}</h2>
        ${dateControls}
      </div>
      <div class="dashboard-state" role="status">
        <p>${stateMessage(result.status, date.label)}</p>
      </div>
      ${stateAction(result.status)}
    </article>`;
  }

  const rows = timetableRows(result, date.key);
  if (rows.length === 0) return renderTimetableCard(section, profile, { status: 'no-data' }, date, now);
  return `<article class="dashboard-card dashboard-card--timetable" data-dashboard-section="${section}">
    <div class="dashboard-card__heading">
      <p class="dashboard-card__eyebrow">${isParent ? `${classLabel} 자녀 수업` : classLabel}</p>
      <h2>${title}</h2>
      ${dateControls}
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

function mealItemMarkup(item, allergies) {
  const matched = dishMatchesAllergies(item, allergies);
  if (matched.length === 0) return `<li class="meal-item">${escapeHtml(item)}</li>`;
  return `<li class="meal-item meal-item--allergy">
    <span>${escapeHtml(item)}</span>
    <span class="meal-item__warning"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 2.5 20h19z"/><path d="M12 9v5m0 3h.01"/></svg><span>\uC54C\uB808\uB974\uAE30 ${matched.map(escapeHtml).join(', ')}\uBC88 \uD3EC\uD568</span></span>
  </li>`;
}

function renderMealsCard(profile, result, date, now) {
  if (result.status === 'loading') {
    return `<article class="dashboard-card dashboard-card--meals" data-dashboard-section="meals">
      <div class="dashboard-card__heading">
        <p class="dashboard-card__eyebrow">오늘의 급식</p>
        <h2>급식 식단</h2>
        ${dashboardDateControls('meals', date, now)}
      </div>
      ${loadingState('급식 정보를 불러오는 중이에요.')}
    </article>`;
  }
  const row = (result.rows ?? []).find((item) => item.MLSV_YMD === date.key);
  const items = result.status === 'ok' ? mealItems(row) : [];
  const matched = mealMatchesAllergies(row, profile.allergies ?? []);
  const failure = failureState(result.status, 'meals');
  return `<article class="dashboard-card dashboard-card--meals" data-dashboard-section="meals">
    <div class="dashboard-card__heading">
      <p class="dashboard-card__eyebrow">오늘의 급식</p>
      <h2>${escapeHtml(row?.MMEAL_SC_NM ?? '점심 식단')}</h2>
      ${dashboardDateControls('meals', date, now)}
    </div>
    ${failure ?? (items.length > 0
      ? `<ul class="meal-preview">${items.map((item) => mealItemMarkup(item, profile.allergies ?? [])).join('')}</ul>`
      : '<div class="dashboard-state" role="status"><p>오늘 등록된 급식 정보가 없어요.</p></div>')}
    ${matched.length > 0 ? `<p class="allergy-match">설정한 알레르기 번호 ${matched.map(escapeHtml).join(', ')}가 표기된 메뉴가 있어요.</p>` : ''}
    <p class="allergy-note">알레르기 안내는 NEIS 급식 알레르기 표기를 기준으로 하며, 실제 제공 식단은 학교에 다시 확인해 주세요.</p>
    ${failure ? retryAction('meals') : action('meals', '급식 자세히 보기')}
  </article>`;
}

function calendarDateKey(value) {
  return /^\d{8}$/.test(String(value ?? '')) ? String(value) : String(value ?? '').replaceAll('-', '').slice(0, 8);
}

function upcomingRows(schedule, calendar, date) {
  const school = schedule.status === 'ok' ? (schedule.rows ?? []).map((row) => ({
    date: row.AA_YMD,
    title: row.EVENT_NM || '학교 일정',
    source: '학교 일정'
  })) : [];
  const personal = calendar.status === 'ok' ? (calendar.rows ?? []).map((row) => ({
    date: calendarDateKey(row.start),
    title: row.title || '개인 일정',
    timeLabel: row.timeLabel,
    source: '개인 일정'
  })) : [];
  return [...school, ...personal]
    .filter((row) => /^\d{8}$/.test(row.date) && row.date >= date.key)
    .sort((a, b) => `${a.date}${a.timeLabel ?? ''}`.localeCompare(`${b.date}${b.timeLabel ?? ''}`))
    .slice(0, 4);
}

function renderUpcomingCard(schedule, calendar, date) {
  const rows = upcomingRows(schedule, calendar, date);
  if (rows.length === 0 && (schedule.status === 'loading' || calendar.status === 'loading')) {
    return `<article class="dashboard-card dashboard-card--upcoming" data-dashboard-section="upcoming">
      <div class="dashboard-card__heading"><p class="dashboard-card__eyebrow">일정 모아보기</p><h2>다가오는 일정</h2></div>
      ${loadingState('일정을 불러오는 중이에요.')}
      ${action('schedule', '일정 전체 보기')}
    </article>`;
  }
  const content = rows.length > 0
    ? `<ol class="upcoming-list">${rows.map((row) => `<li class="upcoming-list__item upcoming-list__item--${row.source === '개인 일정' ? 'personal' : 'school'}"><time><strong>${escapeHtml(String(row.date).slice(4, 6))}.${escapeHtml(String(row.date).slice(6, 8))}</strong><span>${escapeHtml(row.date === date.key ? '오늘' : row.timeLabel || '예정')}</span></time><div><strong>${escapeHtml(row.title)}</strong><span class="schedule-source">${escapeHtml(row.source)}</span></div></li>`).join('')}</ol>`
    : '<div class="dashboard-state" role="status"><p>다가오는 일정이 아직 없어요.</p></div>';
  return `<article class="dashboard-card dashboard-card--upcoming" data-dashboard-section="upcoming">
    <div class="dashboard-card__heading"><p class="dashboard-card__eyebrow">일정 모아보기</p><h2>다가오는 일정</h2></div>
    ${content}
    ${action('schedule', '일정 전체 보기')}
  </article>`;
}

function greeting(role) {
  return { student: '안녕하세요, 학생님', parent: '안녕하세요, 보호자님', teacher: '안녕하세요, 선생님' }[role] ?? '안녕하세요';
}

export function renderDashboardLoadingMarkup(profile = {}, currentTime = new Date()) {
  return `${dashboardTopMarkup(profile, currentTime)}
    <div class="dashboard-overview" aria-busy="true"><div class="dashboard-stack"><div class="dashboard-card dashboard-card--loading"></div><div class="dashboard-card dashboard-card--loading"></div></div><div class="dashboard-card dashboard-card--loading"></div></div>`;
}

function renderLoading(container, profile, currentTime) {
  container.innerHTML = renderDashboardLoadingMarkup(profile, currentTime);
}

export function renderDashboard(container, context = {}) {
  const profile = context.profile ?? {};
  const services = {
    fetchTimetable: requestTimetable,
    fetchMeals: requestMeals,
    fetchSchedule: requestSchedule,
    fetchCalendarEvents: requestCalendarEvents,
    ...(context.services ?? {})
  };
  const getCurrentTime = typeof context.getCurrentTime === 'function' ? context.getCurrentTime : () => new Date();
  const now = context.now instanceof Date ? context.now : getCurrentTime();
  const date = dateParts(now);
  let timetableDate = new Date(now);
  let mealsDate = new Date(now);
  const caches = context.viewData ?? {};
  let destroyed = false;
  let loadVersion = 0;
  const scheduleClock = context.setInterval ?? (typeof window !== 'undefined' ? window.setInterval.bind(window) : null);
  const clearClock = context.clearInterval ?? (typeof window !== 'undefined' ? window.clearInterval.bind(window) : null);
  let clockTimer = null;

  function updateClock() {
    const currentTime = getCurrentTime();
    const clock = container.querySelector?.('[data-dashboard-clock]');
    if (!clock) return;
    clock.textContent = dashboardClockLabel(currentTime);
    clock.dateTime = clockDateTimeValue(currentTime);
  }

  renderLoading(container, profile, getCurrentTime());
  if (scheduleClock) clockTimer = scheduleClock(updateClock, 1000);

  async function load() {
    const version = ++loadVersion;
    const timetableDay = dateParts(timetableDate);
    const mealsDay = dateParts(mealsDate);
    const calendarIds = selectedCalendarIds(profile);
    const timetableKey = cacheKey(profile, timetableDay.key);
    const mealKey = cacheKey(profile, mealsDay.month);
    const needsMeals = getDashboardSections(profile.role).includes('meals');
    const results = {
      timetable: { status: 'loading', rows: [] },
      meals: needsMeals ? { status: 'loading', rows: [] } : { status: 'no-data', rows: [] },
      schedule: { status: 'loading', rows: [] },
      calendar: calendarIds.length > 0 ? { status: 'loading', rows: [] } : { status: 'ok', rows: [] }
    };
    const renderResults = () => {
      if (destroyed || version !== loadVersion) return;
      const sections = getDashboardSections(profile.role).filter((section) => section !== 'upcoming').map((section) => {
        if (section === 'timetable' || section === 'child-class') {
          return renderTimetableCard(section, profile, results.timetable, timetableDay, now);
        }
        return renderMealsCard(profile, results.meals, mealsDay, now);
      });
      container.innerHTML = `${dashboardTopMarkup(profile, getCurrentTime())}
        <div class="dashboard-overview"><div class="dashboard-stack">${sections.join('')}</div>${renderUpcomingCard(results.schedule, results.calendar, date)}</div>`;
    };
    const settle = (resource, request) => Promise.resolve(request)
      .catch(() => ({ status: 'network-error', rows: [] }))
      .then((result) => {
        if (destroyed || version !== loadVersion) return result;
        results[resource] = result;
        renderResults();
        return result;
      });
    const timetableRequest = cachedRequest(caches.timetable, timetableKey, () => services.fetchTimetable(
      profile.school,
      profile.classSetting,
      { from: timetableDay.key, to: timetableDay.key }
    ));
    const mealsRequest = needsMeals
      ? cachedRequest(caches.meals, mealKey, () => services.fetchMeals(profile.school, mealsDay.month))
      : Promise.resolve(results.meals);
    const scheduleRequest = cachedRequest(caches.schedule, cacheKey(profile, date.month), () => services.fetchSchedule(profile.school, date.month));
    const calendarRequest = calendarIds.length > 0
      ? services.fetchCalendarEvents(date.key, monthEndKey(now), calendarIds)
      : Promise.resolve(results.calendar);

    renderResults();
    await Promise.all([
      settle('timetable', timetableRequest),
      settle('meals', mealsRequest),
      settle('schedule', scheduleRequest),
      settle('calendar', calendarRequest)
    ]);
  }

  function onClick(event) {
    const dateButton = event.target.closest?.('[data-dashboard-date]');
    if (dateButton) {
      if (dateButton.dataset.dashboardDate === 'timetable') {
        timetableDate = dateButton.dataset.direction === 'today'
          ? new Date(getCurrentTime())
          : moveDate(timetableDate, dateButton.dataset.direction);
      }
      if (dateButton.dataset.dashboardDate === 'meals') {
        mealsDate = dateButton.dataset.direction === 'today'
          ? new Date(getCurrentTime())
          : moveDate(mealsDate, dateButton.dataset.direction);
      }
      renderLoading(container, profile, getCurrentTime());
      void load();
      return;
    }
    if (!event.target.closest?.('[data-action="retry-dashboard"]')) return;
    Object.values(caches).forEach((cache) => cache?.clear?.());
    renderLoading(container, profile, getCurrentTime());
    void load();
  }

  container.addEventListener?.('click', onClick);
  const ready = load();
  return {
    ready,
    destroy() {
      destroyed = true;
      if (clockTimer !== null) clearClock?.(clockTimer);
      container.removeEventListener?.('click', onClick);
    }
  };
}
