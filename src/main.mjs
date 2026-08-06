import { renderAppShell } from './components.mjs';
import { isProfileComplete, readProfile } from './lib/storage.mjs';
import { createAppState } from './state/app-state.mjs';
import { renderDashboard, renderDashboardLoadingMarkup } from './views/dashboard.mjs';
import {
  renderMealsModule,
  renderScheduleModule,
  renderTimetableModule
} from './views/modules.mjs';
import { renderSetup } from './views/setup.mjs';
import { renderSettings, renderSettingsMarkup } from './views/settings.mjs';

export function mountApp(container, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  let profile = readProfile(storage);
  let settingsFeedback = '';
  let mountedView = null;
  const viewData = {
    schedule: new Map(),
    timetable: new Map(),
    meals: new Map()
  };
  const appState = createAppState();
  const clearViewData = () => Object.values(viewData).forEach((cache) => cache.clear());
  const render = (state) => {
    mountedView?.destroy?.();
    mountedView = null;

    if (!isProfileComplete(profile)) {
      mountedView = renderSetup(container, { profile, storage });
      return;
    }

    const activeView = state.activeView;
    const shellOptions = { schoolName: profile.school?.name };
    if (activeView === 'home') {
      shellOptions.mainContent = renderDashboardLoadingMarkup(profile);
    } else if (activeView === 'settings') {
      shellOptions.mainContent = renderSettingsMarkup({
        draft: profile,
        feedback: settingsFeedback,
        results: []
      });
    } else {
      const titles = { schedule: '일정', timetable: '시간표', meals: '급식' };
      shellOptions.mainContent = `<header class="module-header"><p class="eyebrow">학교 정보</p><h1 id="view-title">${titles[activeView]}</h1></header><div class="module-state" role="status" aria-busy="true">불러오는 중…</div>`;
    }
    renderAppShell(container, activeView, shellOptions);

    if (activeView === 'home') {
      const mainContent = container.querySelector?.('#main-content');
      if (mainContent) {
        mountedView = renderDashboard(mainContent, {
          profile,
          services: options.services,
          now: options.now,
          viewData
        });
      }
    } else if (activeView === 'settings') {
      const mainContent = container.querySelector?.('#main-content');
      if (mainContent) {
        mountedView = renderSettings(mainContent, {
          profile,
          storage,
          feedback: settingsFeedback,
          clearViewData
        });
      }
      settingsFeedback = '';
    } else {
      const mainContent = container.querySelector?.('#main-content');
      const renderModule = {
        schedule: renderScheduleModule,
        timetable: renderTimetableModule,
        meals: renderMealsModule
      }[activeView];
      if (mainContent && renderModule) {
        mountedView = renderModule(mainContent, {
          profile,
          services: options.services,
          now: options.now,
          viewData
        });
      }
    }
  };

  render(appState.getState());
  appState.subscribe(render);

  container.addEventListener('profile-complete', (event) => {
    if (!isProfileComplete(event.detail?.profile)) return;
    profile = event.detail.profile;
    settingsFeedback = '';
    appState.setView('home');
    if (appState.getState().activeView === 'home') render(appState.getState());
  });

  container.addEventListener('profile-updated', (event) => {
    if (!isProfileComplete(event.detail?.profile)) return;
    profile = event.detail.profile;
    settingsFeedback = '설정을 저장했어요.';
    render(appState.getState());
  });

  container.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-view]');
    if (!control) return;

    const previousView = appState.getState().activeView;
    const settingsTarget = control.dataset.settingsTarget;
    appState.setView(control.dataset.view);

    if (appState.getState().activeView !== previousView) {
      const selector = {
        school: '#settings-school-query',
        class: 'select[name="settingsGrade"]',
        allergy: 'input[name="settingsAllergies"]'
      }[settingsTarget];
      const focusTarget = selector ? container.querySelector?.(selector) : null;
      focusTarget?.focus?.();
      if (!focusTarget) {
        container.querySelector?.('#main-content')?.focus();
      }
    }
  });

  return appState;
}

if (typeof document !== 'undefined') {
  const appContainer = document.querySelector('#app');
  if (appContainer) mountApp(appContainer);
}
