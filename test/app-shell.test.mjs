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
  const appState = mountApp(container);

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
