import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppState,
  getNavigationItems,
  resolveView
} from '../src/state/app-state.mjs';
import {
  renderAppShell,
  renderNavigation,
  renderStatusMessage
} from '../src/components.mjs';
import { mountApp } from '../src/main.mjs';

const COMPLETE_PROFILE = {
  role: 'student',
  school: {
    name: '가람중학교',
    kind: '중학교',
    area: '서울특별시교육청',
    address: '서울특별시 강남구 가람로 1',
    ATPT_OFCDC_SC_CODE: 'B10',
    SD_SCHUL_CODE: '7010001'
  },
  classSetting: { grade: '2', classNm: '3' },
  allergies: []
};

function createProfileStorage(profile = COMPLETE_PROFILE) {
  const entries = new Map();
  if (profile) entries.set('eduHub_profile', JSON.stringify(profile));
  return {
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); }
  };
}

function createFocusTrackingDom() {
  const listeners = new Map();
  const ownerDocument = { activeElement: null };
  let html = '';
  let mainContent = null;

  const container = {
    ownerDocument,
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      if (ownerDocument.activeElement) ownerDocument.activeElement.isConnected = false;
      ownerDocument.activeElement = null;
      html = value;
      mainContent = {
        id: 'main-content',
        isConnected: true,
        focus() {
          ownerDocument.activeElement = mainContent;
        }
      };
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    querySelector(selector) {
      return selector === '#main-content' ? mainContent : null;
    }
  };

  return {
    container,
    ownerDocument,
    click(view) {
      const button = {
        dataset: { view },
        isConnected: true,
        closest(selector) {
          return selector === '[data-view]' ? button : null;
        },
        focus() {
          ownerDocument.activeElement = button;
        }
      };

      button.focus();
      listeners.get('click')({ target: button });
    }
  };
}

test('navigation identifies one active item for every supported view', () => {
  const expectedViews = ['home', 'schedule', 'timetable', 'meals', 'settings'];

  for (const view of expectedViews) {
    const items = getNavigationItems(view);

    assert.deepEqual(items.map((item) => item.id), expectedViews);
    assert.deepEqual(
      items.filter((item) => item.isCurrent).map((item) => item.id),
      [view]
    );
  }
});

test('unknown views resolve to home before navigation is rendered', () => {
  assert.equal(resolveView('not-a-view'), 'home');
  assert.equal(resolveView(null), 'home');
  assert.equal(resolveView('meals'), 'meals');
});

test('app state publishes resolved view changes and ignores duplicate updates', () => {
  const appState = createAppState('schedule');
  const published = [];
  const unsubscribe = appState.subscribe((state) => published.push(state.activeView));

  appState.setView('meals');
  appState.setView('meals');
  appState.setView('unknown');
  unsubscribe();
  appState.setView('timetable');

  assert.equal(appState.getState().activeView, 'timetable');
  assert.deepEqual(published, ['meals', 'home']);
});

test('rendered navigation exposes five buttons and only one current page', () => {
  const navigation = renderNavigation('timetable');

  assert.equal((navigation.match(/<button/g) ?? []).length, 5);
  assert.equal((navigation.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(navigation, /data-view="timetable"[^>]*aria-current="page"/);
});

test('status messages escape content supplied by state', () => {
  const message = renderStatusMessage({
    eyebrow: '안내',
    title: '<img src=x onerror=alert(1)>',
    description: '준비 중 & 안전'
  });

  assert.doesNotMatch(message, /<img/);
  assert.match(message, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(message, /준비 중 &amp; 안전/);
});

test('app shell renders semantic content and supporting regions', () => {
  const container = { innerHTML: '' };

  renderAppShell(container, 'schedule');

  assert.match(container.innerHTML, /<main[^>]*id="main-content"/);
  assert.match(container.innerHTML, /<aside class="support-panel"/);
  assert.match(container.innerHTML, /data-view="schedule"[^>]*aria-current="page"/);
});

test('mounted shell changes view through delegated navigation clicks', () => {
  const listeners = new Map();
  const container = {
    innerHTML: '',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };
  const appState = mountApp(container, { storage: createProfileStorage() });

  listeners.get('click')({
    target: {
      closest(selector) {
        return selector === '[data-view]' ? { dataset: { view: 'meals' } } : null;
      }
    }
  });

  assert.equal(appState.getState().activeView, 'meals');
  assert.match(container.innerHTML, /data-view="meals"[^>]*aria-current="page"/);
});

test('navigation restores focus to main content after replacing the active button', () => {
  const dom = createFocusTrackingDom();

  mountApp(dom.container, { storage: createProfileStorage() });
  dom.click('timetable');

  assert.equal(dom.ownerDocument.activeElement, dom.container.querySelector('#main-content'));
});

test('first visit renders guided setup before the dashboard shell', () => {
  const container = {
    innerHTML: '',
    addEventListener() {}
  };

  mountApp(container, { storage: createProfileStorage(null) });

  assert.match(container.innerHTML, /data-setup-form/);
  assert.match(container.innerHTML, /내 학교생활을 연결해 볼까요\?/);
  assert.doesNotMatch(container.innerHTML, /class="app-shell"/);
});

test('a complete saved profile opens the dashboard shell', () => {
  const container = {
    innerHTML: '',
    addEventListener() {},
    querySelector() { return null; }
  };

  mountApp(container, { storage: createProfileStorage() });

  assert.match(container.innerHTML, /class="app-shell"/);
  assert.match(container.innerHTML, /class="dashboard-cards"/);
  assert.doesNotMatch(container.innerHTML, /data-setup-form/);
});

test('dashboard integration keeps the settings route available', () => {
  const listeners = new Map();
  const container = {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector() { return null; }
  };

  mountApp(container, { storage: createProfileStorage() });
  listeners.get('click')({
    target: {
      closest(selector) {
        return selector === '[data-view]' ? { dataset: { view: 'settings' } } : null;
      }
    }
  });

  assert.match(container.innerHTML, /data-settings-form/);
  assert.match(container.innerHTML, /data-view="settings"[^>]*aria-current="page"/);
});

test('schedule, timetable, and meals routes mount their interactive detail modules', async () => {
  const listeners = new Map();
  const main = {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {}
  };
  const support = { innerHTML: '', addEventListener() {}, removeEventListener() {} };
  const container = {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector(selector) {
      if (selector === '#main-content') return main;
      if (selector === '.support-panel') return support;
      return null;
    }
  };
  const services = {
    fetchSchedule: async () => ({ status: 'no-data', rows: [] }),
    fetchTimetable: async () => ({ status: 'no-data', rows: [] }),
    fetchMeals: async () => ({ status: 'no-data', rows: [] })
  };
  mountApp(container, {
    storage: createProfileStorage(),
    services,
    now: new Date(2026, 7, 3)
  });

  for (const view of ['schedule', 'timetable', 'meals']) {
    listeners.get('click')({
      target: {
        closest(selector) {
          return selector === '[data-view]' ? { dataset: { view } } : null;
        }
      }
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.match(main.innerHTML, new RegExp(`data-module="${view}"`));
  }
});

test('a module settings action focuses the relevant class control after navigation', () => {
  const listeners = new Map();
  const main = {
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    focus() { this.focused = true; }
  };
  const classControl = { focus() { this.focused = true; } };
  const container = {
    innerHTML: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector(selector) {
      if (selector === '#main-content') return main;
      if (selector === 'select[name="settingsGrade"]') return classControl;
      return null;
    }
  };
  mountApp(container, { storage: createProfileStorage() });

  listeners.get('click')({
    target: {
      closest(selector) {
        return selector === '[data-view]'
          ? { dataset: { view: 'settings', settingsTarget: 'class' } }
          : null;
      }
    }
  });

  assert.equal(classControl.focused, true);
  assert.notEqual(main.focused, true);
});
