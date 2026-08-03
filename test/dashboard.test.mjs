import test from 'node:test';
import assert from 'node:assert/strict';
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
  return {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    fire(type, event) { listeners.get(type)?.(event); }
  };
}

test('dashboard sections follow the daily priorities for each role', () => {
  assert.deepEqual(getDashboardSections('student'), ['timetable', 'meals', 'upcoming']);
  assert.deepEqual(getDashboardSections('parent'), ['child-class', 'meals', 'upcoming']);
  assert.deepEqual(getDashboardSections('teacher'), ['timetable', 'schedule', 'upcoming']);
});

test('student dashboard puts today timetable and meals before upcoming events', async () => {
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
  assert.match(container.innerHTML, /오늘 첫 수업/);
  assert.match(container.innerHTML, /1교시/);
  assert.match(container.innerHTML, /현미밥/);
  assert.equal((container.innerHTML.match(/data-view=/g) ?? []).length, 2);
  assert.match(supportContainer.innerHTML, /data-dashboard-section="upcoming"/);
  assert.match(supportContainer.innerHTML, /학교 스포츠클럽/);
  assert.doesNotMatch(supportContainer.innerHTML, /NaN|날짜 없는 잘못된 일정/);
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

test('teacher dashboard prioritizes the selected class timetable and today schedule', async () => {
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

  assert.match(container.innerHTML, /2학년 3반 시간표/);
  assert.match(container.innerHTML, /오늘 일정/);
  assert.match(container.innerHTML, /학급 자치회/);
  assert.ok(container.innerHTML.indexOf('data-dashboard-section="timetable"')
    < container.innerHTML.indexOf('data-dashboard-section="schedule"'));
  assert.equal(mealRequests, 0);
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
