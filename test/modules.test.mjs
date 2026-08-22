import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  renderMealsModule,
  renderScheduleModule,
  renderTimetableModule
} from '../src/views/modules.mjs';

const PROFILE = {
  role: 'student',
  school: {
    name: '가람중학교',
    kind: '중학교',
    ATPT_OFCDC_SC_CODE: 'B10',
    SD_SCHUL_CODE: '7010001'
  },
  classSetting: { grade: '2', classNm: '3' },
  allergies: ['1']
};

function createContainer() {
  const listeners = new Map();
  return {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    fire(type, target, extra = {}) { listeners.get(type)?.({ target, preventDefault() {}, ...extra }); }
  };
}

function target(dataset = {}) {
  const element = {
    dataset,
    focus() {},
    closest(selector) {
      const selectors = {
        '[data-date-action]': 'dateAction',
        '[data-mode]': 'mode',
        '[data-date]': 'date',
        '[data-action="retry-module"]': 'action'
      };
      const key = selectors[selector];
      return key && dataset[key] ? element : null;
    }
  };
  return element;
}

function createDeferred() {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
}

const emptyServices = {
  fetchSchedule: async () => ({ status: 'no-data', rows: [] }),
  fetchTimetable: async () => ({ status: 'no-data', rows: [] }),
  fetchMeals: async () => ({ status: 'no-data', rows: [] })
};

test('all school-information modules render the same ordered date toolbar', async () => {
  const renderers = [renderScheduleModule, renderTimetableModule, renderMealsModule];

  for (const renderModule of renderers) {
    const container = createContainer();
    const view = renderModule(container, {
      profile: PROFILE,
      services: emptyServices,
      now: new Date(2026, 7, 3)
    });
    await view.ready;

    const actions = [...container.innerHTML.matchAll(/data-date-action="([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(actions, renderModule === renderMealsModule
      ? ['previous', 'today', 'next']
      : ['previous', 'next', 'today']);
    if (renderModule === renderMealsModule) {
      assert.match(container.innerHTML, /data-date-action="previous">\uC774\uC804 \uC8FC/);
      assert.match(container.innerHTML, /data-date-action="today"[^>]*>[\s\S]*2026/);
      continue;
    }
    assert.match(container.innerHTML, /data-date-action="previous"[^>]*>이전 (?:날짜|주|달)<\/button>[\s\S]*<time[^>]*>2026년 8월 3일 \(월\)<\/time>[\s\S]*data-date-action="next"[^>]*>다음 (?:날짜|주|달)<\/button>[\s\S]*data-date-action="today"[^>]*>오늘<\/button>/);
  }
});

test('today requests fresh data even when today is already selected', async () => {
  const container = createContainer();
  let requests = 0;
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      async fetchSchedule() {
        requests += 1;
        return { status: 'no-data', rows: [] };
      }
    }
  });
  await view.ready;

  container.fire('click', target({ dateAction: 'today' }));
  await view.ready;

  assert.equal(requests, 2);
});

test('today reads the current clock when activated instead of reusing the mount date', async () => {
  const container = createContainer();
  let clock = new Date(2026, 7, 31);
  const requestedMonths = [];
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: () => new Date(clock),
    services: {
      ...emptyServices,
      async fetchSchedule(_school, month) {
        requestedMonths.push(month);
        return { status: 'no-data', rows: [] };
      }
    }
  });
  await view.ready;

  clock = new Date(2026, 8, 1);
  container.fire('click', target({ dateAction: 'today' }));
  await view.ready;

  assert.deepEqual(requestedMonths, ['202608', '202609']);
  assert.match(container.innerHTML, /datetime="2026-09-01"/);
});

test('schedule switches semantic list and calendar tabs and shows selected-day details', async () => {
  const container = createContainer();
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      async fetchSchedule() {
        return {
          status: 'ok',
          rows: [
            { AA_YMD: '20260803', EVENT_NM: '시업식', ONE_GRADE_EVENT_YN: 'Y' },
            { AA_YMD: '20260804', EVENT_NM: '진로 체험', TW_GRADE_EVENT_YN: 'Y' }
          ]
        };
      }
    }
  });
  await view.ready;

  assert.match(container.innerHTML, /role="tablist"[^>]*aria-label="일정 보기"/);
  assert.match(container.innerHTML, /role="tab"[^>]*data-mode="list"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /role="tab"[^>]*data-mode="calendar"[^>]*aria-selected="false"/);
  assert.match(container.innerHTML, /2026년 8월 4일/);
  assert.match(container.innerHTML, /진로 체험/);
  assert.match(container.innerHTML, /2학년/);

  container.fire('click', target({ mode: 'calendar' }));
  assert.match(container.innerHTML, /role="tabpanel"[^>]*id="schedule-calendar-panel"/);
  assert.match(container.innerHTML, /data-date="20260803"[^>]*aria-pressed="true"/);
  assert.match(container.innerHTML, /선택한 날의 일정[\s\S]*시업식/);

  container.fire('click', target({ date: '20260804' }));
  assert.match(container.innerHTML, /data-date="20260804"[^>]*aria-pressed="true"/);
  assert.match(container.innerHTML, /선택한 날의 일정[\s\S]*진로 체험/);
});

test('full schedule combines personal calendar events with school events in list and calendar views', async () => {
  const container = createContainer();
  const view = renderScheduleModule(container, {
    profile: { ...PROFILE, calendarIds: ['primary'] },
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      fetchSchedule: async () => ({
        status: 'ok',
        rows: [{ AA_YMD: '20260803', EVENT_NM: '개학', ONE_GRADE_EVENT_YN: 'Y' }]
      }),
      fetchCalendarEvents: async () => ({
        status: 'ok',
        rows: [{ start: '2026-08-04T16:00:00+09:00', title: '치과 검진', timeLabel: '16:00' }]
      })
    }
  });
  await view.ready;

  assert.match(container.innerHTML, /개학/);
  assert.match(container.innerHTML, /치과 검진/);
  assert.match(container.innerHTML, /neis/);
  assert.match(container.innerHTML, /Google/);

  container.fire('click', target({ mode: 'calendar' }));
  container.fire('click', target({ date: '20260804' }));
  assert.match(container.innerHTML, /data-date="20260804"[^>]*class="has-event has-personal-event"/);
  assert.match(container.innerHTML, /선택한 날의 일정[\s\S]*치과 검진/);
});

test('full schedule does not request or show personal events with no calendar selected', async () => {
  const container = createContainer();
  let calendarRequests = 0;
  const view = renderScheduleModule(container, {
    profile: { ...PROFILE, calendarIds: [] },
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      fetchSchedule: async () => ({ status: 'ok', rows: [] }),
      fetchCalendarEvents: async () => {
        calendarRequests += 1;
        return { status: 'ok', rows: [{ start: '2026-08-04T16:00:00+09:00', title: '남아 있으면 안 되는 개인 일정' }] };
      }
    }
  });
  await view.ready;

  assert.equal(calendarRequests, 0);
  assert.doesNotMatch(container.innerHTML, /남아 있으면 안 되는 개인 일정/);
});

test('schedule navigates by month and highlights only today in the list without changing text color', async () => {
  const container = createContainer();
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 4),
    services: {
      ...emptyServices,
      fetchSchedule: async () => ({
        status: 'ok',
        rows: [
          { AA_YMD: '20260803', EVENT_NM: '어제 일정' },
          { AA_YMD: '20260804', EVENT_NM: '오늘 일정' }
        ]
      })
    }
  });
  await view.ready;

  assert.match(container.innerHTML, /data-date-action="previous">이전 달/);
  assert.match(container.innerHTML, /data-date-action="next">다음 달/);
  assert.match(container.innerHTML, /class="schedule-item is-today"[\s\S]*오늘 일정/);
  assert.doesNotMatch(container.innerHTML, /class="schedule-item is-today"[\s\S]*color:/);
});

test.skip('replaced by the always-weekly timetable', async () => {
  const container = createContainer();
  const ranges = [];
  const view = renderTimetableModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      async fetchTimetable(_school, _classSetting, range) {
        ranges.push(range);
        return {
          status: 'ok',
          rows: [
            { ALL_TI_YMD: '20260803', PERIO: '1', ITRT_CNTNT: '국어' },
            { ALL_TI_YMD: '20260804', PERIO: '2', ITRT_CNTNT: '수학' }
          ]
        };
      }
    }
  });
  await view.ready;

  assert.deepEqual(ranges[0], { from: '20260803', to: '20260803' });
  assert.match(container.innerHTML, /role="tab"[^>]*data-mode="day"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /role="tabpanel"[^>]*id="timetable-day-panel"[\s\S]*1교시[\s\S]*국어/);

  container.fire('click', target({ mode: 'week' }));
  await view.ready;

  assert.deepEqual(ranges[1], { from: '20260803', to: '20260807' });
  assert.match(container.innerHTML, /role="tab"[^>]*data-mode="week"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /class="timetable-week-table"/);
  assert.match(container.innerHTML, /class="timetable-week-cards"/);
  assert.match(container.innerHTML, /data-weekday="20260803"[\s\S]*국어/);
  assert.match(container.innerHTML, /data-weekday="20260804"[\s\S]*수학/);
});

test('timetable is always weekly with a left period column and week navigation labels', async () => {
  const container = createContainer();
  const view = renderTimetableModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      fetchTimetable: async () => ({ status: 'ok', rows: [{ ALL_TI_YMD: '20260803', PERIO: '1', ITRT_CNTNT: '국어' }] })
    }
  });
  await view.ready;

  assert.doesNotMatch(container.innerHTML, /data-mode="day"|data-mode="week"/);
  assert.match(container.innerHTML, /data-date-action="previous"[^>]*>이전 주<\/button>/);
  assert.match(container.innerHTML, /data-date-action="next"[^>]*>다음 주<\/button>/);
  assert.match(container.innerHTML, /<th scope="col" class="period-column">교시<\/th>/);
  assert.ok((container.innerHTML.match(/class="timetable-module__subject"/g) ?? []).length >= 2);
});

test('timetable setup problems point to the relevant settings section without an invalid request', async () => {
  const missingContainer = createContainer();
  let requests = 0;
  const missingView = renderTimetableModule(missingContainer, {
    profile: { ...PROFILE, classSetting: null },
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      async fetchTimetable() {
        requests += 1;
        return { status: 'no-data', rows: [] };
      }
    }
  });
  await missingView.ready;

  assert.equal(requests, 0);
  assert.match(missingContainer.innerHTML, /data-view="settings"[^>]*data-settings-target="class"[^>]*>학년·반 설정으로 이동/);

  const unsupportedContainer = createContainer();
  const unsupportedView = renderTimetableModule(unsupportedContainer, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      async fetchTimetable() { return { status: 'unsupported-school-kind', rows: [] }; }
    }
  });
  await unsupportedView.ready;

  assert.match(unsupportedContainer.innerHTML, /data-view="settings"[^>]*data-settings-target="school"[^>]*>학교 설정으로 이동/);
});

test('meals default to weekdays and use week or month navigation labels', async () => {
  const container = createContainer();
  const view = renderMealsModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 4),
    services: {
      ...emptyServices,
      async fetchMeals() {
        return {
          status: 'ok',
          rows: [
            { MLSV_YMD: '20260803', MMEAL_SC_NM: 'Lunch', DDISH_NM: 'Rice' },
            { MLSV_YMD: '20260804', MMEAL_SC_NM: 'Lunch', DDISH_NM: 'Soup' }
          ]
        };
      }
    }
  });
  await view.ready;

  assert.match(container.innerHTML, /data-mode="week"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /data-mode="month"/);
  assert.match(container.innerHTML, /data-date-action="previous">\uC774\uC804 \uC8FC/);
  assert.match(container.innerHTML, /data-date-action="today"[^>]*aria-label="\uC774\uBC88 \uC8FC/);
  assert.match(container.innerHTML, /data-date-action="next">\uB2E4\uC74C \uC8FC/);
  assert.match(container.innerHTML, /2026[\s\S]*8[\s\S]*3[\s\S]*8[\s\S]*7/);

  container.fire('click', target({ mode: 'month' }));
  await view.ready;

  assert.match(container.innerHTML, /data-mode="month"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /data-date-action="previous">\uC774\uC804 \uB2EC/);
  assert.match(container.innerHTML, /data-date-action="today"[^>]*aria-label="\uC774\uBC88 \uB2EC/);
  assert.match(container.innerHTML, /data-date-action="next">\uB2E4\uC74C \uB2EC/);
});

test('meal navigation moves by the active period and resets to the current period', async () => {
  const container = createContainer();
  const view = renderMealsModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 4),
    services: { ...emptyServices, fetchMeals: async () => ({ status: 'no-data', rows: [] }) }
  });
  await view.ready;

  container.fire('click', target({ dateAction: 'previous' }));
  await view.ready;
  assert.match(container.innerHTML, /datetime="2026-07-28"/);
  assert.match(container.innerHTML, /2026[\s\S]*7[\s\S]*27[\s\S]*7[\s\S]*31/);

  container.fire('click', target({ dateAction: 'today' }));
  await view.ready;
  assert.match(container.innerHTML, /datetime="2026-08-04"/);

  container.fire('click', target({ mode: 'month' }));
  await view.ready;
  container.fire('click', target({ dateAction: 'previous' }));
  await view.ready;
  assert.match(container.innerHTML, /datetime="2026-07-04"/);
  assert.match(container.innerHTML, /2026[\s\S]*7\uC6D4/);
});

test('meal calendar updates selected-day details and warns with icon and text only for exact allergy numbers', async () => {
  const container = createContainer();
  const view = renderMealsModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      async fetchMeals() {
        return {
          status: 'ok',
          rows: [
            { MLSV_YMD: '20260803', MMEAL_SC_NM: '중식', DDISH_NM: '소시지(11.)' },
            { MLSV_YMD: '20260804', MMEAL_SC_NM: '중식', DDISH_NM: '계란찜(1.)<br/>쏴라기' }
          ]
        };
      }
    }
  });
  await view.ready;

  assert.match(container.innerHTML, /role="tab"[^>]*data-mode="week"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /소시지\(11\.\)/);
  assert.match(container.innerHTML, /class="meal-item__illustration" aria-hidden="true"/);

  container.fire('click', target({ mode: 'month' }));
  await view.ready;
  container.fire('click', target({ date: '20260804' }));

  assert.match(container.innerHTML, /class="meal-item meal-item--allergy"[\s\S]*\uC54C\uB808\uB974\uAE30 1\uBC88 \uD3EC\uD568/);
  assert.match(container.innerHTML, /class="meal-item__illustration" aria-hidden="true"/);

  assert.match(container.innerHTML, /role="tabpanel"[^>]*id="meals-month-panel"/);
  assert.match(container.innerHTML, /data-date="20260804"[^>]*aria-pressed="true"/);
  assert.match(container.innerHTML, /계란찜\(1\.\)/);
  assert.match(container.innerHTML, /class="allergy-warning"[^>]*role="status"[\s\S]*<svg[^>]*aria-hidden="true"[\s\S]*알레르기 1번/);
});

test('schedule and meals do not request data before a school is configured', async () => {
  for (const renderModule of [renderScheduleModule, renderMealsModule]) {
    const container = createContainer();
    let requests = 0;
    const services = {
      ...emptyServices,
      async fetchSchedule() { requests += 1; return { status: 'no-data', rows: [] }; },
      async fetchMeals() { requests += 1; return { status: 'no-data', rows: [] }; }
    };
    const view = renderModule(container, {
      profile: { ...PROFILE, school: null },
      now: new Date(2026, 7, 3),
      services
    });
    await view.ready;

    assert.equal(requests, 0);
    assert.match(container.innerHTML, /data-view="settings"[^>]*data-settings-target="school"[^>]*>학교 설정으로 이동/);
  }
});

test('right arrow activates the next tab while retaining native tab semantics', async () => {
  const container = createContainer();
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: emptyServices
  });
  await view.ready;

  container.fire('keydown', target({ mode: 'list' }), { key: 'ArrowRight' });

  assert.match(container.innerHTML, /role="tab"[^>]*data-mode="calendar"[^>]*aria-selected="true"/);
  assert.match(container.innerHTML, /data-mode="list"[^>]*tabindex="-1"/);
});

test('activating a tab restores focus to the selected tab after rerendering', async () => {
  const listeners = new Map();
  let focusedMode = null;
  const container = {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelector(selector) {
      const mode = selector.match(/data-mode="([^"]+)"/)?.[1];
      return mode ? { focus() { focusedMode = mode; } } : null;
    },
    fire(type, eventTarget) { listeners.get(type)?.({ target: eventTarget, preventDefault() {} }); }
  };
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: emptyServices
  });
  await view.ready;

  container.fire('click', target({ mode: 'calendar' }));

  assert.equal(focusedMode, 'calendar');
});

test('date toolbar and calendar selections restore focus to the matching replacement control', async () => {
  const listeners = new Map();
  const ownerDocument = { activeElement: null };
  let focusedSelector = null;
  const container = {
    ownerDocument,
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelector(selector) {
      return { focus() { focusedSelector = selector; } };
    },
    fire(type, eventTarget) { listeners.get(type)?.({ target: eventTarget, preventDefault() {} }); }
  };
  const view = renderScheduleModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: emptyServices
  });
  await view.ready;

  const nextControl = target({ dateAction: 'next' });
  ownerDocument.activeElement = nextControl;
  container.fire('click', nextControl);
  await view.ready;
  assert.equal(focusedSelector, '[data-date-action="next"]');

  container.fire('click', target({ mode: 'calendar' }));
  const dateControl = target({ date: '20260805' });
  ownerDocument.activeElement = dateControl;
  container.fire('click', dateControl);
  assert.equal(focusedSelector, '[data-date="20260805"]');
});

test('a delayed timetable tab response does not steal focus after the user moves elsewhere', async () => {
  const listeners = new Map();
  const ownerDocument = { activeElement: null };
  let focusCount = 0;
  const weekResponse = createDeferred();
  let calls = 0;
  const container = {
    ownerDocument,
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelector() { return { focus() { focusCount += 1; } }; },
    fire(type, eventTarget) { listeners.get(type)?.({ target: eventTarget, preventDefault() {} }); }
  };
  const view = renderTimetableModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      fetchTimetable() {
        calls += 1;
        return calls === 1 ? Promise.resolve({ status: 'no-data', rows: [] }) : weekResponse.promise;
      }
    }
  });
  await view.ready;

  const weekTab = target({ mode: 'week' });
  ownerDocument.activeElement = weekTab;
  container.fire('click', weekTab);
  ownerDocument.activeElement = { id: 'later-control' };
  weekResponse.resolve({ status: 'no-data', rows: [] });
  await view.ready;

  assert.equal(focusCount, 0);
});

test('module failures keep no-data, network, and server states distinct', async () => {
  const cases = [
    ['no-data', /일정이 등록되지 않았어요\./, /role="status"/],
    ['network-error', /네트워크 연결/, /role="alert"/],
    ['server-error', /학교 정보 시스템 응답 문제/, /role="alert"/]
  ];
  for (const [status, message, role] of cases) {
    const container = createContainer();
    const view = renderScheduleModule(container, {
      profile: PROFILE,
      now: new Date(2026, 7, 3),
      services: { ...emptyServices, fetchSchedule: async () => ({ status, rows: [] }) }
    });
    await view.ready;
    assert.match(container.innerHTML, message);
    assert.match(container.innerHTML, role);
  }
});

test('module CSS keeps controls touch-sized and replaces the mobile week table with cards', async () => {
  const css = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.meal-week-list\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.module-date-toolbar--compact\s*\{/);
  const toolbarRule = css.match(/\.module-date-toolbar button\s*\{([^}]*)\}/)?.[1] ?? '';
  const minHeight = Number(toolbarRule.match(/min-height:\s*([\d.]+)px/)?.[1]);
  const calendarRule = css.match(/\.module-calendar__days button\s*\{([^}]*)\}/)?.[1] ?? '';
  const calendarMinWidth = Number(calendarRule.match(/min-width:\s*([\d.]+)px/)?.[1]);
  const mobileRules = css.slice(css.lastIndexOf('@media (max-width: 767px)'));

  assert.ok(minHeight >= 44, `expected at least 44px, received ${minHeight || 'no value'}`);
  assert.ok(calendarMinWidth >= 44, `expected a 44px calendar target, received ${calendarMinWidth || 'no value'}`);
  assert.match(mobileRules, /\.timetable-week-table\s*\{[^}]*display:\s*none/);
  assert.match(mobileRules, /\.timetable-week-cards\s*\{[^}]*display:\s*grid/);
  assert.match(css, /@media \(max-width: 359px\)[\s\S]*\.module-calendar__days\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
});

test('weekly meals use five weekday columns on desktop, a single column on mobile, and a high-contrast current period control', async () => {
  const css = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  const mobileRules = css.slice(css.lastIndexOf('@media (max-width: 767px)'));

  assert.match(css, /\.meal-week-list\s*\{[^}]*grid-template-columns:\s*repeat\(5,/);
  assert.match(mobileRules, /\.meal-week-list\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.module-date-toolbar--compact \[data-date-action="today"\] time\s*\{[^}]*color:\s*var\(--surface\)/);
});

test('a late date response cannot replace the newest timetable selection', async () => {
  const container = createContainer();
  const first = createDeferred();
  const second = createDeferred();
  const responses = [first.promise, second.promise];
  const view = renderTimetableModule(container, {
    profile: PROFILE,
    now: new Date(2026, 7, 3),
    services: {
      ...emptyServices,
      fetchTimetable() { return responses.shift(); }
    }
  });

  container.fire('click', target({ dateAction: 'next' }));
  second.resolve({
    status: 'ok',
    rows: [{ ALL_TI_YMD: '20260810', PERIO: '1', ITRT_CNTNT: '최신 수업' }]
  });
  await view.ready;
  assert.match(container.innerHTML, /최신 수업/);

  first.resolve({
    status: 'ok',
    rows: [{ ALL_TI_YMD: '20260803', PERIO: '1', ITRT_CNTNT: '지난 수업' }]
  });
  await first.promise;
  await Promise.resolve();

  assert.match(container.innerHTML, /최신 수업/);
  assert.doesNotMatch(container.innerHTML, /지난 수업/);
});
