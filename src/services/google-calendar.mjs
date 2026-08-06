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

export async function fetchCalendarList() {
  try {
    const response = await fetch(`${CALENDAR_PATH}?action=calendar-list`, { credentials: 'same-origin' });
    if (response.status === 401) return { status: 'not-connected', rows: [] };
    if (!response.ok) return { status: 'server-error', rows: [] };
    const body = await response.json();
    return { status: 'ok', rows: Array.isArray(body?.calendars) ? body.calendars : [] };
  } catch {
    return { status: 'network-error', rows: [] };
  }
}

export async function fetchCalendarEvents(from, to, calendarIds = []) {
  const selectedIds = [...new Set((Array.isArray(calendarIds) ? calendarIds : [])
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim()))];
  if (selectedIds.length === 0) return { status: 'ok', rows: [] };
  try {
    const query = new URLSearchParams({ action: 'events', from, to });
    query.set('calendarIds', selectedIds.join(','));
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
