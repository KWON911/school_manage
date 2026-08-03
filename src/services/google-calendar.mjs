const CALENDAR_PATH = '/api/google-calendar';

export async function fetchCalendarStatus() {
  try {
    const response = await fetch(`${CALENDAR_PATH}?action=status`, { credentials: 'same-origin' });
    if (!response.ok) return { connected: false, status: 'server-error' };
    const body = await response.json();
    return { connected: body?.connected === true, status: 'ok' };
  } catch {
    return { connected: false, status: 'network-error' };
  }
}

export async function fetchCalendarEvents(from, to) {
  try {
    const query = new URLSearchParams({ action: 'events', from, to });
    const response = await fetch(`${CALENDAR_PATH}?${query}`, { credentials: 'same-origin' });
    if (response.status === 401) return { status: 'not-connected', rows: [] };
    if (!response.ok) return { status: 'server-error', rows: [] };
    const body = await response.json();
    return { status: 'ok', rows: Array.isArray(body?.events) ? body.events : [] };
  } catch {
    return { status: 'network-error', rows: [] };
  }
}

export function beginGoogleCalendarConnection() {
  globalThis.location.assign(`${CALENDAR_PATH}?action=authorize`);
}

export async function disconnectGoogleCalendar() {
  try {
    const response = await fetch(`${CALENDAR_PATH}?action=disconnect`, {
      method: 'POST',
      credentials: 'same-origin'
    });
    return response.ok;
  } catch {
    return false;
  }
}
