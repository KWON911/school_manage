import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDashboardSections, renderDashboard } from '../src/views/dashboard.mjs';

const SCHOOL = {
  name: '가온중학교',
  kind: '중학교',
  ATPT_OFCDC_SC_CODE: 'B10',
  SD_SCHUL_CODE: '7010001'
};

function profile(role, overrides = {}) {
  return {
    role,
    school: SCHOOL,
    classSetting: { grade: '2', classNm: '3' },
    allergies: [],
    ...overrides
  };
}

function successfulServices() {
  return {
    async fetchTimetable() {
      return {
        status: 'ok',
        rows: [
          { ALL_TI_YMD: '20260803', PERIO: '2', ITRT_CNTNT: '수학' },
          { ALL_TI_YMD: '20260803', PERIO: '1', ITRT_CNTNT: '국어' }
        ]
      };
    },
    async fetchMeals() {
      return {
        status: 'ok',
        rows: [{ MLSV_YMD: '20260803', MMEAL_SC_NM: '중식', DDISH_NM: '현미밥(1.5.6)<br/>된장국(5.6)' }]
      };
    },
    async fetchSchedule() {
      return {
        status: 'ok',
        rows: [
          { AA_YMD: '20260803', EVENT_NM: '학급 자치회' },
          { AA_YMD: '20260805', EVENT_NM: '학교 스포츠클럽' },
          { EVENT_NM: '날짜 없는 잘못된 일정' }
        ]
      };
    }
  };
}

function createContainer() {
  const listeners = new Map();
  const nodes = new Map();
  return {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    fire(type, event) { listeners.get(type)?.(event); },
    querySelector(selector) { return nodes.get(selector) ?? null; },
    setNode(selector, node) { nodes.set(selector, node); }
  };
}

function sectionMarkup(html, section) {
  const pattern = new RegExp(`<(?:article|section)[^>]*data-dashboard-section="${section}"[\\s\\S]*?<\\/(?:article|section)>`);
  return html.match(pattern)?.[0] ?? '';
}

test('dashboard home puts upcoming schedules beside timetable and meals', () => {
  assert.deepEqual(getDashboardSections('student'), ['timetable', 'meals', 'upcoming']);
  assert.deepEqual(getDashboardSections('parent'), ['child-class', 'meals', 'upcoming']);
  assert.deepEqual(getDashboardSections('teacher'), ['timetable', 'meals', 'upcoming']);
});

test('dashboard sections use timetable, meals, and schedule for every role', () => {
  assert.deepEqual(getDashboardSections('student'), ['timetable', 'meals', 'upcoming']);
  assert.deepEqual(getDashboardSections('parent'), ['child-class', 'meals', 'upcoming']);
  assert.deepEqual(getDashboardSections('teacher'), ['timetable', 'meals', 'upcoming']);
});

test('student dashboard shows a vertical full timetable beside today meals', async () => {
  const container = createContainer();
  const supportContainer = createContainer();
  const view = renderDashboard(container, {
    profile: profile('student'),
    services: successfulServices(),
    supportContainer,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;

  assert.ok(container.innerHTML.indexOf('data-dashboard-section="timetable"')
    < container.innerHTML.indexOf('data-dashboard-section="meals"'));
  assert.match(container.innerHTML, /1교시/);
  assert.match(container.innerHTML, /현미밥/);
  assert.equal((container.innerHTML.match(/data-view=/g) ?? []).length, 3);
  assert.match(container.innerHTML, /dashboard-overview/);
  assert.match(container.innerHTML, /timetable-preview--vertical/);
  assert.match(container.innerHTML, /data-dashboard-section="upcoming"/);
  assert.match(container.innerHTML, /다가오는 일정/);
});

test('dashboard displays a live Korean date clock and clears its timer on destroy', async () => {
  const container = createContainer();
  const clockNode = { textContent: '', dateTime: '' };
  container.setNode('[data-dashboard-clock]', clockNode);
  let currentTime = new Date(2026, 7, 4, 12, 34, 56);
  let tick;
  let clearedTimer;
  const view = renderDashboard(container, {
    profile: profile('teacher'),
    services: successfulServices(),
    now: currentTime,
    getCurrentTime: () => currentTime,
    setInterval(callback) {
      tick = callback;
      return 'dashboard-clock';
    },
    clearInterval(timer) { clearedTimer = timer; }
  });

  await view.ready;

  assert.match(container.innerHTML, /data-dashboard-clock/);
  assert.match(container.innerHTML, /class="dashboard-header__topline"/);
  assert.doesNotMatch(container.innerHTML, /오늘의 학교생활/);
  assert.match(container.innerHTML, /2026년 8월 4일 \(화\) · 오후 12:34:56/);
  currentTime = new Date(2026, 7, 4, 12, 34, 57);
  tick();
  assert.equal(clockNode.textContent, '2026년 8월 4일 (화) · 오후 12:34:57');
  assert.equal(clockNode.dateTime, '2026-08-04T12:34:57');

  view.destroy();
  assert.equal(clearedTimer, 'dashboard-clock');
});

test('dashboard card date controls move timetable and meals independently', async () => {
  const container = createContainer();
  const timetableRequests = [];
  const services = successfulServices();
  services.fetchTimetable = async (school, classSetting, range) => {
    timetableRequests.push(range);
    return { status: 'ok', rows: [] };
  };
  const view = renderDashboard(container, {
    profile: profile('student'),
    services,
    now: new Date('2026-08-03T09:00:00+09:00'),
    getCurrentTime: () => new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;

  assert.match(sectionMarkup(container.innerHTML, 'timetable'), /data-dashboard-date="timetable"/);
  assert.match(sectionMarkup(container.innerHTML, 'meals'), /data-dashboard-date="meals"/);

  container.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-dashboard-date]'
          ? { dataset: { dashboardDate: 'timetable', direction: 'previous' } }
          : null;
      }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(timetableRequests.map((range) => range.from), ['20260803', '20260802']);
  assert.match(sectionMarkup(container.innerHTML, 'timetable'), /datetime="2026-08-02"/);
  assert.match(sectionMarkup(container.innerHTML, 'meals'), /datetime="2026-08-03"/);

  container.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-dashboard-date]'
          ? { dataset: { dashboardDate: 'timetable', direction: 'today' } }
          : null;
      }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(timetableRequests.map((range) => range.from), ['20260803', '20260802', '20260803']);
  assert.match(sectionMarkup(container.innerHTML, 'timetable'), /data-direction="today"/);
  assert.match(sectionMarkup(container.innerHTML, 'timetable'), /datetime="2026-08-03"/);
});

test('dashboard never shows a different date meal when today has no meal service', async () => {
  const container = createContainer();
  const services = successfulServices();
  services.fetchMeals = async () => ({
    status: 'ok',
    rows: [{ MLSV_YMD: '20260801', MMEAL_SC_NM: '중식', DDISH_NM: '지난 급식' }]
  });
  const view = renderDashboard(container, {
    profile: profile('student'),
    services,
    now: new Date('2026-08-04T09:00:00+09:00')
  });

  await view.ready;

  const meals = sectionMarkup(container.innerHTML, 'meals');
  assert.match(meals, /오늘 등록된 급식 정보가 없어요/);
  assert.doesNotMatch(meals, /지난 급식/);
});

test('parent dashboard names the child class and explains allergy information limits', async () => {
  const container = createContainer();
  const supportContainer = createContainer();
  const view = renderDashboard(container, {
    profile: profile('parent', { allergies: ['1', '6'] }),
    services: successfulServices(),
    supportContainer,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;

  assert.match(container.innerHTML, /2학년 3반 자녀 수업/);
  assert.match(container.innerHTML, /NEIS 급식 알레르기 표기/);
  assert.match(container.innerHTML, /학교에 다시 확인/);
  assert.ok(container.innerHTML.indexOf('data-dashboard-section="child-class"')
    < container.innerHTML.indexOf('data-dashboard-section="meals"'));
});

test('teacher dashboard shows the selected class timetable and meals', async () => {
  const container = createContainer();
  const supportContainer = createContainer();
  const services = successfulServices();
  let mealRequests = 0;
  services.fetchMeals = async () => {
    mealRequests += 1;
    return { status: 'ok', rows: [] };
  };
  const view = renderDashboard(container, {
    profile: profile('teacher'),
    services,
    supportContainer,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;

  assert.match(container.innerHTML, /2학년 3반/);
  assert.match(container.innerHTML, /오늘의 급식/);
  assert.ok(container.innerHTML.indexOf('data-dashboard-section="timetable"')
    < container.innerHTML.indexOf('data-dashboard-section="meals"'));
  assert.equal(mealRequests, 1);
});

test('home requests schedule data for the upcoming schedule card', async () => {
  const container = createContainer();
  const services = successfulServices();
  let scheduleRequests = 0;
  services.fetchSchedule = async () => {
    scheduleRequests += 1;
    return { status: 'ok', rows: [] };
  };

  const view = renderDashboard(container, {
    profile: profile('student'),
    services,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;
  assert.equal(scheduleRequests, 1);
});

test('dashboard combines personal calendar items with school events under a neutral schedule title', async () => {
  const container = createContainer();
  const services = successfulServices();
  services.fetchCalendarEvents = async () => ({
    status: 'ok',
    rows: [{ start: '20260804', title: '치과 검진', timeLabel: '16:00' }]
  });

  const view = renderDashboard(container, {
    profile: profile('parent', { calendarIds: ['primary'] }),
    services,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;

  const upcoming = sectionMarkup(container.innerHTML, 'upcoming');
  assert.match(upcoming, /일정 모아보기/);
  assert.match(upcoming, /치과 검진/);
  assert.match(upcoming, /개인 일정/);
  assert.match(upcoming, /학교 일정/);
});

test('dashboard clears personal events without a selected calendar', async () => {
  const container = createContainer();
  const services = successfulServices();
  let calendarRequests = 0;
  services.fetchCalendarEvents = async () => {
    calendarRequests += 1;
    return { status: 'ok', rows: [{ start: '20260804', title: '남아 있으면 안 되는 개인 일정' }] };
  };

  const view = renderDashboard(container, {
    profile: profile('student', { calendarIds: [] }),
    services,
    now: new Date('2026-08-03T09:00:00+09:00')
  });
  await view.ready;

  assert.equal(calendarRequests, 0);
  assert.doesNotMatch(container.innerHTML, /남아 있으면 안 되는 개인 일정/);
});

test('timetable states give a cause-specific explanation and next action', async () => {
  const cases = [
    {
      status: 'no-data',
      message: /8월 3일 시간표가 아직 게시되지 않았어요/,
      action: /data-view="settings"[^>]*>반 바꾸기/
    },
    {
      status: 'network-error',
      message: /네트워크 연결로 시간표를 불러오지 못했어요/,
      action: /data-action="retry-dashboard"[^>]*>다시 시도/
    },
    {
      status: 'unsupported-school-kind',
      message: /초등학교·중학교·고등학교 시간표만 지원/,
      action: /data-view="settings"[^>]*>학교 확인하기/
    }
  ];

  for (const scenario of cases) {
    const container = createContainer();
    const supportContainer = createContainer();
    const services = successfulServices();
    services.fetchTimetable = async () => ({ status: scenario.status, rows: [] });
    const view = renderDashboard(container, {
      profile: profile('student'),
      services,
      supportContainer,
      now: new Date('2026-08-03T09:00:00+09:00')
    });

    await view.ready;
    assert.match(container.innerHTML, scenario.message);
    assert.match(container.innerHTML, scenario.action);
  }
});

test('network retry requests dashboard data again and replaces the error state', async () => {
  const container = createContainer();
  const supportContainer = createContainer();
  const services = successfulServices();
  let timetableRequests = 0;
  services.fetchTimetable = async () => {
    timetableRequests += 1;
    if (timetableRequests === 1) return { status: 'network-error', rows: [] };
    return {
      status: 'ok',
      rows: [{ ALL_TI_YMD: '20260803', PERIO: '1', ITRT_CNTNT: '국어' }]
    };
  };
  const view = renderDashboard(container, {
    profile: profile('student'),
    services,
    supportContainer,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;
  assert.match(container.innerHTML, /다시 시도/);
  container.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-action="retry-dashboard"]' ? {} : null;
      }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(timetableRequests, 2);
  assert.match(container.innerHTML, /국어/);
  assert.doesNotMatch(container.innerHTML, /네트워크 연결/);
});

test.skip('removed home schedule and upcoming cards are no longer applicable', async () => {
  const cases = [
    {
      name: 'meal',
      role: 'student',
      section: 'meals',
      resultTarget: 'main',
      service: 'fetchMeals',
      emptyMessage: /오늘 등록된 급식 정보가 없어요/,
      resourceMessage: /급식 정보/
    },
    {
      name: 'teacher schedule',
      role: 'teacher',
      section: 'schedule',
      resultTarget: 'main',
      service: 'fetchSchedule',
      emptyMessage: /오늘 등록된 학교 일정이 없어요/,
      resourceMessage: /오늘 일정/
    },
    {
      name: 'upcoming events',
      role: 'student',
      section: 'upcoming',
      resultTarget: 'support',
      service: 'fetchSchedule',
      emptyMessage: /다가오는 일정이 아직 없어요/,
      resourceMessage: /다가오는 일정/
    }
  ];

  for (const scenario of cases) {
    for (const status of ['network-error', 'server-error']) {
      const container = createContainer();
      const supportContainer = createContainer();
      const services = successfulServices();
      services[scenario.service] = async () => ({ status, rows: [] });
      const view = renderDashboard(container, {
        profile: profile(scenario.role),
        services,
        supportContainer,
        now: new Date('2026-08-03T09:00:00+09:00')
      });

      await view.ready;
      const html = scenario.resultTarget === 'main' ? container.innerHTML : supportContainer.innerHTML;
      const card = sectionMarkup(html, scenario.section);
      assert.match(card, scenario.resourceMessage, `${scenario.name} should identify the failed resource`);
      assert.match(card, status === 'network-error' ? /네트워크 연결/ : /학교 정보 시스템/);
      assert.doesNotMatch(card, scenario.emptyMessage);
      assert.equal((card.match(/dashboard-card__action/g) ?? []).length, 1);
      assert.match(card, /data-action="retry-dashboard"[^>]*>다시 시도/);
    }
  }
});

test('meal retry refetches meal data and restores the normal meal action', async () => {
  const container = createContainer();
  const supportContainer = createContainer();
  const services = successfulServices();
  const viewData = { timetable: new Map(), meals: new Map(), schedule: new Map() };
  let mealRequests = 0;
  services.fetchMeals = async () => {
    mealRequests += 1;
    if (mealRequests === 1) return { status: 'network-error', rows: [] };
    return {
      status: 'ok',
      rows: [{ MLSV_YMD: '20260803', MMEAL_SC_NM: '중식', DDISH_NM: '비빔밥(5.6)' }]
    };
  };
  const view = renderDashboard(container, {
    profile: profile('student'),
    services,
    supportContainer,
    viewData,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;
  container.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-action="retry-dashboard"]'
          ? { dataset: { resource: 'meals' } }
          : null;
      }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  const card = sectionMarkup(container.innerHTML, 'meals');
  assert.equal(mealRequests, 2);
  assert.match(card, /비빔밥/);
  assert.match(card, /data-view="meals"[^>]*>급식 자세히 보기/);
  assert.doesNotMatch(card, /data-action="retry-dashboard"/);
});

test.skip('removed support rail retry is no longer applicable', async () => {
  const container = createContainer();
  const supportContainer = createContainer();
  const services = successfulServices();
  const viewData = { timetable: new Map(), meals: new Map(), schedule: new Map() };
  let scheduleRequests = 0;
  services.fetchSchedule = async () => {
    scheduleRequests += 1;
    if (scheduleRequests === 1) return { status: 'server-error', rows: [] };
    return {
      status: 'ok',
      rows: [{ AA_YMD: '20260805', EVENT_NM: '진로 체험' }]
    };
  };
  const view = renderDashboard(container, {
    profile: profile('student'),
    services,
    supportContainer,
    viewData,
    now: new Date('2026-08-03T09:00:00+09:00')
  });

  await view.ready;
  supportContainer.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-action="retry-dashboard"]'
          ? { dataset: { resource: 'schedule' } }
          : null;
      }
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(scheduleRequests, 2);
  assert.match(supportContainer.innerHTML, /진로 체험/);
  assert.doesNotMatch(supportContainer.innerHTML, /학교 정보 시스템/);
});

test('dashboard actions retain a 44px minimum touch target', async () => {
  const css = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8');
  const rule = css.match(/\.dashboard-card__action\s*\{([^}]*)\}/)?.[1] ?? '';
  const minHeight = Number(rule.match(/min-height:\s*([\d.]+)px/)?.[1]);

  assert.ok(minHeight >= 44, `expected at least 44px, received ${minHeight || 'no value'}`);
});
