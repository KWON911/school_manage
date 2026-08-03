import {
  fetchMeals as requestMeals,
  fetchSchedule as requestSchedule,
  fetchTimetable as requestTimetable,
  mealMatchesAllergies
} from '../services/neis.mjs';
import { fetchCalendarEvents as requestCalendarEvents } from '../services/google-calendar.mjs';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
}

function monthKey(date) {
  return dateKey(date).slice(0, 6);
}

function dateLabel(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

function dateFromKey(key) {
  const value = String(key ?? '');
  if (!/^\d{8}$/.test(value)) return null;
  const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)));
  return dateKey(date) === value ? date : null;
}

function fullDateLabel(key) {
  const date = dateFromKey(key);
  return date ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일` : '';
}

function dateToolbar(date, kind) {
  const key = dateKey(date);
  const isTimetable = kind === 'timetable';
  return `<div class="module-date-toolbar" aria-label="날짜 이동">
    <button type="button" data-date-action="previous">${isTimetable ? '이전 주' : '이전 날짜'}</button>
    <time datetime="${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6)}">${dateLabel(date)}</time>
    <button type="button" data-date-action="next">${isTimetable ? '다음 주' : '다음 날짜'}</button>
    <button type="button" data-date-action="today">오늘</button>
  </div>`;
}

function tabs(kind, activeMode, choices) {
  const label = kind === 'schedule' ? '일정 보기' : kind === 'timetable' ? '시간표 보기' : '급식 보기';
  return `<div class="module-tabs" role="tablist" aria-label="${label}">
    ${choices.map(({ id, text }) => `<button type="button" role="tab" data-mode="${id}" aria-selected="${activeMode === id}" aria-controls="${kind}-${id}-panel" id="${kind}-${id}-tab" tabindex="${activeMode === id ? '0' : '-1'}">${text}</button>`).join('')}
  </div>`;
}

function scheduleGradeLabel(row) {
  const keys = [
    'ONE_GRADE_EVENT_YN', 'TW_GRADE_EVENT_YN', 'THREE_GRADE_EVENT_YN',
    'FR_GRADE_EVENT_YN', 'FIV_GRADE_EVENT_YN', 'SIX_GRADE_EVENT_YN'
  ];
  const grades = keys.flatMap((key, index) => row?.[key] === 'Y' ? [index + 1] : []);
  return grades.length > 0 ? `${grades.join(', ')}학년` : '전체';
}

function isImportantSchedule(row) {
  return /(시험|입학|졸업|개학|방학)/.test(String(row?.EVENT_NM ?? ''));
}

function calendarDateKey(value) {
  return /^\d{8}$/.test(String(value ?? '')) ? String(value) : String(value ?? '').replaceAll('-', '').slice(0, 8);
}

function combinedScheduleResult(schedule, calendar) {
  const schoolRows = schedule.status === 'ok' ? (schedule.rows ?? []).map((row) => ({ ...row, source: '학교 일정' })) : [];
  const personalRows = calendar.status === 'ok' ? (calendar.rows ?? []).map((row) => ({
    AA_YMD: calendarDateKey(row.start),
    EVENT_NM: row.title,
    TIME_LABEL: row.timeLabel,
    source: '개인 일정',
    isPersonal: true
  })) : [];
  const rows = [...schoolRows, ...personalRows].filter((row) => dateFromKey(row.AA_YMD));
  if (rows.length > 0) return { status: 'ok', rows };
  return schedule;
}

function scheduleItems(rows) {
  if (rows.length === 0) return '<p class="module-empty" role="status">일정이 등록되지 않았어요.</p>';
  return `<ol class="schedule-list">${rows.map((row) => `<li class="schedule-item${isImportantSchedule(row) ? ' is-important' : ''}">
    <time datetime="${String(row.AA_YMD).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}">${escapeHtml(fullDateLabel(row.AA_YMD))}</time>
    <strong>${escapeHtml(row.EVENT_NM || '학교 일정')}</strong>
    <span class="schedule-item__source" data-source="${row.isPersonal ? 'personal' : 'school'}">${escapeHtml(row.source ?? '학교 일정')}${row.TIME_LABEL ? ` · ${escapeHtml(row.TIME_LABEL)}` : row.isPersonal ? '' : ` · 대상 ${escapeHtml(scheduleGradeLabel(row))}`}</span>
  </li>`).join('')}</ol>`;
}

function lastDateKey(date) {
  return dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function calendarDays(date, rows, dateField = 'AA_YMD') {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const selected = dateKey(date);
  const eventDates = new Set(rows.map((row) => row[dateField]));
  return `<div class="module-calendar" aria-label="${year}년 ${month + 1}월">
    <div class="module-calendar__weekdays" aria-hidden="true">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
    <div class="module-calendar__days" style="--first-day: ${new Date(year, month, 1).getDay()}">${Array.from({ length: lastDay }, (_, index) => {
      const day = index + 1;
      const key = dateKey(new Date(year, month, day));
      return `<button type="button" data-date="${key}" aria-pressed="${key === selected}"${eventDates.has(key) ? ' class="has-event"' : ''}><span>${day}</span>${eventDates.has(key) ? '<span class="sr-only"> 일정 있음</span>' : ''}</button>`;
    }).join('')}</div>
  </div>`;
}

function resourceState(kind, result) {
  if (result.status === 'loading') {
    return `<div class="module-state" role="status" aria-busy="true"><p>${kind === 'schedule' ? '일정을 불러오는 중이에요.' : '정보를 불러오는 중이에요.'}</p></div>`;
  }
  if (result.status === 'missing-school') {
    return `<div class="module-state" role="status"><p>학교 설정이 필요해요. ${kind === 'schedule' ? '일정' : '급식'}을 불러올 학교를 선택해 주세요.</p>${settingsAction('school', '학교 설정으로 이동')}</div>`;
  }
  if (result.status === 'network-error') {
    return `<div class="module-state" role="alert"><p>네트워크 연결로 ${kind === 'schedule' ? '일정' : '급식'} 정보를 불러오지 못했어요.</p>${retryAction()}</div>`;
  }
  if (result.status === 'server-error') {
    return `<div class="module-state" role="alert"><p>학교 정보 시스템 응답 문제로 ${kind === 'schedule' ? '일정' : '급식'} 정보를 불러오지 못했어요.</p>${retryAction()}</div>`;
  }
  return null;
}

function renderSchedule(date, mode, result) {
  const rows = (result.rows ?? [])
    .filter((row) => dateFromKey(row.AA_YMD))
    .sort((a, b) => String(a.AA_YMD).localeCompare(String(b.AA_YMD)));
  const selectedRows = rows.filter((row) => row.AA_YMD === dateKey(date));
  const tabMarkup = tabs('schedule', mode, [
    { id: 'list', text: '목록' },
    { id: 'calendar', text: '달력' }
  ]);
  const failure = resourceState('schedule', result);
  if (failure) {
    const otherMode = mode === 'list' ? 'calendar' : 'list';
    return `${tabMarkup}<div role="tabpanel" id="schedule-${mode}-panel" aria-labelledby="schedule-${mode}-tab">${failure}</div><div role="tabpanel" id="schedule-${otherMode}-panel" aria-labelledby="schedule-${otherMode}-tab" hidden></div>`;
  }
  if (mode === 'calendar') {
    return `${tabMarkup}<div role="tabpanel" id="schedule-list-panel" aria-labelledby="schedule-list-tab" hidden></div><div role="tabpanel" id="schedule-calendar-panel" aria-labelledby="schedule-calendar-tab">
      ${calendarDays(date, rows)}
      <section class="selected-day-detail" aria-labelledby="schedule-selected-title">
        <h2 id="schedule-selected-title">선택한 날의 일정</h2>
        ${scheduleItems(selectedRows)}
      </section>
    </div>`;
  }
  return `${tabMarkup}<div role="tabpanel" id="schedule-list-panel" aria-labelledby="schedule-list-tab">${scheduleItems(rows)}</div><div role="tabpanel" id="schedule-calendar-panel" aria-labelledby="schedule-calendar-tab" hidden></div>`;
}

function startOfSchoolWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

function schoolWeek(date) {
  const start = startOfSchoolWeek(date);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function timetableRows(rows, key) {
  return rows
    .filter((row) => row.ALL_TI_YMD === key)
    .sort((a, b) => Number(a.PERIO) - Number(b.PERIO));
}

function periodList(rows) {
  if (rows.length === 0) return '<p class="module-empty">등록된 수업이 없어요.</p>';
  return `<ol class="period-list">${rows.map((row) => `<li><span>${escapeHtml(row.PERIO)}교시</span><strong>${escapeHtml(row.ITRT_CNTNT || '수업 정보 없음')}</strong></li>`).join('')}</ol>`;
}

function settingsAction(target, label) {
  return `<button class="module-settings-action" type="button" data-view="settings" data-settings-target="${target}">${label}</button>`;
}

function retryAction() {
  return '<button class="module-retry-action" type="button" data-action="retry-module">다시 시도</button>';
}

function timetableState(result) {
  const states = {
    'missing-school': ['학교 설정이 필요해요. 시간표를 불러올 학교를 선택해 주세요.', settingsAction('school', '학교 설정으로 이동')],
    'missing-class': ['학년·반 설정이 필요해요. 시간표를 불러올 학년과 반을 선택해 주세요.', settingsAction('class', '학년·반 설정으로 이동')],
    'unsupported-school-kind': ['선택한 학교 유형의 시간표는 지원하지 않아요. 초·중·고등학교를 선택해 주세요.', settingsAction('school', '학교 설정으로 이동')],
    'no-data': ['이 날짜의 시간표가 아직 등록되지 않았어요.', settingsAction('class', '학년·반 설정으로 이동')],
    'network-error': ['네트워크 연결로 시간표를 불러오지 못했어요.', retryAction()],
    'server-error': ['학교 정보 시스템 응답 문제로 시간표를 불러오지 못했어요.', retryAction()]
  };
  const [message, action] = states[result.status] ?? ['시간표를 불러오는 중 문제가 생겼어요.', retryAction()];
  const role = ['network-error', 'server-error'].includes(result.status) ? 'alert' : 'status';
  return `<div class="module-state" role="${role}"><p>${message}</p>${action}</div>`;
}

function renderTimetable(date, result, now) {
  if (result.status !== 'ok') {
    return `<div class="timetable-panel">${timetableState(result)}</div>`;
  }

  const days = schoolWeek(date);
  const dayRows = days.map((day) => ({ day, rows: timetableRows(result.rows ?? [], dateKey(day)) }));
  const periods = [...new Set(dayRows.flatMap(({ rows }) => rows.map((row) => String(row.PERIO))))].sort((a, b) => Number(a) - Number(b));
  return `<div class="timetable-panel">
    <table class="timetable-week-table">
      <caption>${dateLabel(days[0])}부터 5일간 시간표</caption>
      <thead><tr><th scope="col" class="period-column">교시</th>${dayRows.map(({ day }) => `<th scope="col" class="${dateKey(day) === dateKey(now) ? 'is-current-day' : ''}">${day.getMonth() + 1}/${day.getDate()} (${WEEKDAYS[day.getDay()]})</th>`).join('')}</tr></thead>
      <tbody>${periods.map((period) => `<tr><th scope="row" class="period-column">${escapeHtml(period)}교시</th>${dayRows.map(({ day, rows }) => { const row = rows.find((item) => String(item.PERIO) === period); return `<td class="${dateKey(day) === dateKey(now) ? 'is-current-day' : ''}">${escapeHtml(row?.ITRT_CNTNT || '수업 정보 없음')}</td>`; }).join('')}</tr>`).join('')}</tbody>
    </table>
    <div class="timetable-week-cards" aria-label="요일별 시간표">
      ${dayRows.map(({ day, rows }) => `<section class="weekday-card" data-weekday="${dateKey(day)}"><h2>${day.getMonth() + 1}월 ${day.getDate()}일 (${WEEKDAYS[day.getDay()]})</h2>${periodList(rows)}</section>`).join('')}
    </div>
  </div></div>`;
}

function mealDishes(row) {
  return String(row?.DDISH_NM ?? '')
    .split(/<br\s*\/?\s*>/i)
    .map((dish) => dish.trim())
    .filter(Boolean);
}

function allergyWarning(row, allergies) {
  const matched = mealMatchesAllergies(row, allergies);
  if (matched.length === 0) return '';
  return `<p class="allergy-warning" role="status">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 2.5 20h19z"/><path d="M12 9v5m0 3h.01"/></svg>
    <span>설정한 알레르기 ${matched.map(escapeHtml).join(', ')}번이 표기된 메뉴가 있어요.</span>
  </p>`;
}

function mealCards(rows, allergies) {
  if (rows.length === 0) return '<p class="module-empty" role="status">이 날짜에 등록된 급식 정보가 없어요.</p>';
  return `<div class="meal-detail-list">${rows.map((row) => `<article class="meal-detail-card">
    <h3>${escapeHtml(row.MMEAL_SC_NM || '급식')}</h3>
    <ul>${mealDishes(row).map((dish) => `<li>${escapeHtml(dish)}</li>`).join('')}</ul>
    ${allergyWarning(row, allergies)}
  </article>`).join('')}</div>`;
}

function renderMeals(date, mode, result, allergies) {
  const rows = (result.rows ?? [])
    .filter((row) => dateFromKey(row.MLSV_YMD))
    .sort((a, b) => String(a.MLSV_YMD).localeCompare(String(b.MLSV_YMD)));
  const selectedRows = rows.filter((row) => row.MLSV_YMD === dateKey(date));
  const tabMarkup = tabs('meals', mode, [
    { id: 'day', text: '날짜별' },
    { id: 'calendar', text: '달력' }
  ]);
  const failure = resourceState('meals', result);
  if (failure) {
    const otherMode = mode === 'day' ? 'calendar' : 'day';
    return `${tabMarkup}<div role="tabpanel" id="meals-${mode}-panel" aria-labelledby="meals-${mode}-tab">${failure}</div><div role="tabpanel" id="meals-${otherMode}-panel" aria-labelledby="meals-${otherMode}-tab" hidden></div>`;
  }
  const note = '<p class="allergy-reference">알레르기 안내는 NEIS 표기를 기준으로 한 참고 정보예요. 실제 제공 식단은 학교에도 확인해 주세요.</p>';
  if (mode === 'calendar') {
    return `${tabMarkup}<div role="tabpanel" id="meals-day-panel" aria-labelledby="meals-day-tab" hidden></div><div role="tabpanel" id="meals-calendar-panel" aria-labelledby="meals-calendar-tab">
      ${calendarDays(date, rows, 'MLSV_YMD')}
      <section class="selected-day-detail" aria-labelledby="meals-selected-title">
        <h2 id="meals-selected-title">선택한 날의 급식</h2>
        ${mealCards(selectedRows, allergies)}
      </section>
      ${note}
    </div>`;
  }
  return `${tabMarkup}<div role="tabpanel" id="meals-day-panel" aria-labelledby="meals-day-tab">${mealCards(selectedRows, allergies)}${note}</div><div role="tabpanel" id="meals-calendar-panel" aria-labelledby="meals-calendar-tab" hidden></div>`;
}

function createModule(container, context, kind) {
  const services = {
    fetchSchedule: requestSchedule,
    fetchTimetable: requestTimetable,
    fetchMeals: requestMeals,
    fetchCalendarEvents: requestCalendarEvents,
    ...(context.services ?? {})
  };
  if (context.services && typeof context.services.fetchCalendarEvents !== 'function') {
    services.fetchCalendarEvents = async () => ({ status: 'not-connected', rows: [] });
  }
  const readNow = () => {
    const value = typeof context.now === 'function' ? context.now() : context.now;
    return value instanceof Date ? new Date(value) : new Date();
  };
  let selectedDate = readNow();
  let mode = kind === 'schedule' ? 'list' : kind === 'timetable' ? 'week' : 'day';
  let result = { status: 'loading', rows: [] };
  let destroyed = false;
  let loadVersion = 0;
  let pending;

  function render() {
    const content = kind === 'schedule'
      ? renderSchedule(selectedDate, mode, result)
      : kind === 'timetable'
        ? renderTimetable(selectedDate, result, readNow())
        : renderMeals(selectedDate, mode, result, context.profile?.allergies ?? []);
    const titles = { schedule: '일정', timetable: '시간표', meals: '급식' };
    container.innerHTML = `<section class="module-view" data-module="${kind}">
      <header class="module-header">
        <div><p class="eyebrow">학교 정보</p><h1 id="view-title">${titles[kind]}</h1></div>
        <span>${escapeHtml(context.profile?.school?.name)}</span>
      </header>
      ${dateToolbar(selectedDate, kind)}
      ${content}
    </section>`;
  }

  function shouldRestoreFocus(origin) {
    if (!origin) return false;
    return !container.ownerDocument || container.ownerDocument.activeElement === origin;
  }

  function restoreFocus(selector) {
    container.querySelector?.(selector)?.focus?.();
  }

  function load(focusRequest = null) {
    const version = ++loadVersion;
    let request;
    if (kind === 'schedule') {
      request = context.profile?.school?.kind
        ? Promise.all([
          services.fetchSchedule(context.profile.school, monthKey(selectedDate)),
          services.fetchCalendarEvents(dateKey(selectedDate), lastDateKey(selectedDate))
        ]).then(([schedule, calendar]) => combinedScheduleResult(schedule, calendar))
        : Promise.resolve({ status: 'missing-school', rows: [] });
    } else if (kind === 'meals') {
      request = context.profile?.school?.kind
        ? services.fetchMeals(context.profile.school, monthKey(selectedDate))
        : Promise.resolve({ status: 'missing-school', rows: [] });
    }
    else {
      const school = context.profile?.school;
      const classSetting = context.profile?.classSetting;
      if (!school?.kind) request = Promise.resolve({ status: 'missing-school', rows: [] });
      else if (!classSetting?.grade || !classSetting?.classNm) request = Promise.resolve({ status: 'missing-class', rows: [] });
      else {
        const days = schoolWeek(selectedDate);
        request = services.fetchTimetable(school, classSetting, {
          from: dateKey(days[0]),
          to: dateKey(days.at(-1))
        });
      }
    }
    pending = Promise.resolve(request).then((nextResult) => {
      if (destroyed || version !== loadVersion) return nextResult;
      const restore = shouldRestoreFocus(focusRequest?.origin);
      result = nextResult;
      render();
      if (restore) restoreFocus(focusRequest.selector);
      return nextResult;
    });
    return pending;
  }

  function activateMode(nextMode, origin) {
    mode = nextMode;
    const selector = `[role="tab"][data-mode="${mode}"]`;
    if (kind === 'timetable') {
      load({ origin, selector });
    } else {
      const restore = shouldRestoreFocus(origin);
      render();
      if (restore) restoreFocus(selector);
    }
  }

  function onClick(event) {
    const control = event.target.closest?.('[data-date-action]');
    if (control) {
      const offset = kind === 'timetable' ? 7 : 1;
      if (control.dataset.dateAction === 'previous') selectedDate.setDate(selectedDate.getDate() - offset);
      if (control.dataset.dateAction === 'next') selectedDate.setDate(selectedDate.getDate() + offset);
      if (control.dataset.dateAction === 'today') selectedDate = readNow();
      load({
        origin: control,
        selector: `[data-date-action="${control.dataset.dateAction}"]`
      });
      return;
    }
    const modeControl = event.target.closest?.('[data-mode]');
    const validModes = kind === 'schedule' ? ['list', 'calendar'] : ['day', 'calendar'];
    if (modeControl && validModes.includes(modeControl.dataset.mode)) {
      activateMode(modeControl.dataset.mode, modeControl);
      return;
    }
    const dateControl = event.target.closest?.('[data-date]');
    const nextDate = dateFromKey(dateControl?.dataset.date);
    if (nextDate) {
      const restore = shouldRestoreFocus(dateControl);
      selectedDate = nextDate;
      if (kind === 'timetable') {
        load({ origin: dateControl, selector: `[data-date="${dateKey(nextDate)}"]` });
      } else {
        render();
        if (restore) restoreFocus(`[data-date="${dateKey(nextDate)}"]`);
      }
      return;
    }
    if (event.target.closest?.('[data-action="retry-module"]')) load();
  }

  function onKeyDown(event) {
    const tab = event.target.closest?.('[data-mode]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const validModes = kind === 'schedule' ? ['list', 'calendar'] : ['day', 'calendar'];
    const currentIndex = Math.max(0, validModes.indexOf(tab.dataset.mode));
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + validModes.length) % validModes.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % validModes.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = validModes.length - 1;
    event.preventDefault();
    activateMode(validModes[nextIndex], tab);
  }

  container.addEventListener?.('click', onClick);
  container.addEventListener?.('keydown', onKeyDown);
  render();
  load();
  return {
    get ready() { return pending; },
    destroy() {
      destroyed = true;
      container.removeEventListener?.('click', onClick);
      container.removeEventListener?.('keydown', onKeyDown);
    }
  };
}

export function renderScheduleModule(container, context = {}) {
  return createModule(container, context, 'schedule');
}

export function renderTimetableModule(container, context = {}) {
  return createModule(container, context, 'timetable');
}

export function renderMealsModule(container, context = {}) {
  return createModule(container, context, 'meals');
}
