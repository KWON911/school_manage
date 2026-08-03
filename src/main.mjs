import { renderAppShell } from './components.mjs';
import { createAppState } from './state/app-state.mjs';

export function mountApp(container) {
  const appState = createAppState();
  const render = (state) => renderAppShell(container, state.activeView);

  render(appState.getState());
  appState.subscribe(render);

  container.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-view]');
    if (control) appState.setView(control.dataset.view);
  });

  return appState;
}

if (typeof document !== 'undefined') {
  const appContainer = document.querySelector('#app');
  if (appContainer) mountApp(appContainer);
}
