import { getNavigationItems, resolveView } from './state/app-state.mjs';

const VIEW_CONTENT = {
  home: {
    eyebrow: '오늘의 학교생활',
    title: '홈',
    description: '오늘 필요한 시간표와 급식, 가까운 일정이 이곳에 정리됩니다.'
  },
  schedule: {
    eyebrow: '학사 일정',
    title: '일정',
    description: '선택한 학교의 학사 일정을 목록과 달력으로 확인할 수 있도록 준비 중입니다.'
  },
  timetable: {
    eyebrow: '수업 흐름',
    title: '시간표',
    description: '학년·반에 맞는 오늘과 이번 주 시간표가 이곳에 표시됩니다.'
  },
  meals: {
    eyebrow: '오늘의 식단',
    title: '급식',
    description: '날짜별 메뉴와 설정한 알레르기 참고 정보가 이곳에 표시됩니다.'
  },
  settings: {
    eyebrow: '내 정보',
    title: '내 설정',
    description: '역할, 학교, 학년·반과 알레르기 정보를 한곳에서 바꿀 수 있도록 준비 중입니다.'
  }
};

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M9 21v-7h6v7"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  timetable: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M14 6a3 3 0 0 1 3-3h3v18h-6M8 8h2M8 12h2"/>',
  meals: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.36.7.64 1 .3.27.7.42 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/>'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderNavigation(activeView) {
  return getNavigationItems(activeView).map((item) => `
    <button class="nav-item${item.isCurrent ? ' is-current' : ''}" type="button" data-view="${item.id}"${item.isCurrent ? ' aria-current="page"' : ''}>
      <svg class="nav-item__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[item.id]}</svg>
      <span>${item.label}</span>
    </button>
  `).join('');
}

export function renderStatusMessage(state) {
  return `
    <article class="status-card">
      <p class="eyebrow">${escapeHtml(state?.eyebrow)}</p>
      <h1 id="view-title">${escapeHtml(state?.title)}</h1>
      <p class="status-card__description">${escapeHtml(state?.description)}</p>
      <p class="status-card__note">
        <span class="status-dot" aria-hidden="true"></span>
        학교 정보를 연결하면 내용이 표시됩니다.
      </p>
    </article>
  `;
}

export function renderAppShell(container, activeView = 'home', options = {}) {
  const view = resolveView(activeView);
  const content = VIEW_CONTENT[view];
  const navigation = renderNavigation(view);
  const schoolName = options.schoolName ?? '학교 미설정';
  const mainContent = options.mainContent ?? `
    <div class="content-heading">
      <p>학교생활 대시보드</p>
      <span>${escapeHtml(schoolName)}</span>
    </div>
    ${renderStatusMessage(content)}
  `;

  container.innerHTML = `
    <div class="app-frame">
      <a class="skip-link" href="#main-content">본문으로 바로가기</a>

      <header class="compact-header">
        <div class="compact-brand">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span></span>
          <span>학교생활</span>
        </div>
        <button class="compact-header__settings" type="button" data-view="settings">내 설정</button>
      </header>

      <div class="app-shell">
        <aside class="sidebar" aria-label="학교생활 탐색">
          <div class="brand-lockup">
            <span class="brand-mark" aria-hidden="true"><span></span><span></span></span>
            <div>
              <strong>학교생활</strong>
              <span>오늘을 한눈에</span>
            </div>
          </div>
          <nav class="sidebar-navigation" aria-label="주요 메뉴">${navigation}</nav>
          <p class="sidebar-note">학교를 설정하면<br>오늘의 정보를 알려드려요.</p>
        </aside>

        <nav class="tablet-navigation" aria-label="주요 메뉴">${navigation}</nav>

        <main class="primary-content" id="main-content" tabindex="-1" aria-labelledby="view-title">
          ${mainContent}
        </main>

      </div>

      <nav class="bottom-navigation" aria-label="모바일 주요 메뉴">${navigation}</nav>
    </div>
  `;
}
