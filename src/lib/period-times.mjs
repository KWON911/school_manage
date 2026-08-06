export const DEFAULT_PERIOD_TIMES = [
  { period: '1', start: '09:00', end: '09:40' },
  { period: '2', start: '09:50', end: '10:30' },
  { period: '3', start: '10:40', end: '11:20' },
  { period: '4', start: '11:30', end: '12:10' },
  { period: '5', start: '12:20', end: '13:00' },
  { period: '6', start: '13:50', end: '14:30' }
];

export function getPeriodTimes(periodTimes) {
  return Array.isArray(periodTimes) && periodTimes.length > 0 ? periodTimes : DEFAULT_PERIOD_TIMES;
}

function minutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function getPeriodStatus(period, periodTimes, currentTime) {
  const item = getPeriodTimes(periodTimes).find((entry) => String(entry.period) === String(period));
  const now = minutes(currentTime);
  if (!item || now === null) return 'upcoming';
  const start = minutes(item.start);
  const end = minutes(item.end);
  if (start === null || end === null || now < start) return 'upcoming';
  if (now < end) return 'current';
  return 'completed';
}
