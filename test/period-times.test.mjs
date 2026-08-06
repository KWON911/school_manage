import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERIOD_TIMES, getPeriodStatus } from '../src/lib/period-times.mjs';

test('provides the agreed six default period times', () => {
  assert.deepEqual(DEFAULT_PERIOD_TIMES, [
    { period: '1', start: '09:00', end: '09:40' },
    { period: '2', start: '09:50', end: '10:30' },
    { period: '3', start: '10:40', end: '11:20' },
    { period: '4', start: '11:30', end: '12:10' },
    { period: '5', start: '12:20', end: '13:00' },
    { period: '6', start: '13:50', end: '14:30' }
  ]);
});

test('calculates completed, current, and upcoming classes from the current time', () => {
  assert.equal(getPeriodStatus('1', DEFAULT_PERIOD_TIMES, '08:59'), 'upcoming');
  assert.equal(getPeriodStatus('1', DEFAULT_PERIOD_TIMES, '09:00'), 'current');
  assert.equal(getPeriodStatus('1', DEFAULT_PERIOD_TIMES, '09:40'), 'completed');
  assert.equal(getPeriodStatus('2', DEFAULT_PERIOD_TIMES, '09:40'), 'upcoming');
});
