const NAVIGATION_ITEMS = [
  { id: 'home', label: '홈' },
  { id: 'schedule', label: '일정' },
  { id: 'timetable', label: '시간표' },
  { id: 'meals', label: '급식' },
  { id: 'settings', label: '내 설정' }
];

const VIEW_IDS = new Set(NAVIGATION_ITEMS.map(({ id }) => id));

export function resolveView(view) {
  return VIEW_IDS.has(view) ? view : 'home';
}

export function getNavigationItems(activeView) {
  const resolvedView = resolveView(activeView);
  return NAVIGATION_ITEMS.map((item) => ({
    ...item,
    isCurrent: item.id === resolvedView
  }));
}

export function createAppState(initialView = 'home') {
  let state = Object.freeze({ activeView: resolveView(initialView) });
  const subscribers = new Set();

  return {
    getState() {
      return state;
    },
    setView(view) {
      const activeView = resolveView(view);
      if (activeView === state.activeView) return;

      state = Object.freeze({ activeView });
      subscribers.forEach((subscriber) => subscriber(state));
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    }
  };
}
