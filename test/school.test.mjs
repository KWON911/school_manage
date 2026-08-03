import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGradeOptions,
  getTimetableEndpoint,
  isSupportedSchoolKind
} from '../src/lib/school.mjs';

test('school kinds choose the correct timetable API and grade range', () => {
  assert.deepEqual(getGradeOptions('초등학교'), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(getGradeOptions('중학교'), ['1', '2', '3']);
  assert.equal(getTimetableEndpoint('고등학교'), 'hisTimetable');
  assert.equal(isSupportedSchoolKind('특수학교'), false);
});

test('normalizes school-kind whitespace before applying rules', async () => {
  const { normalizeSchoolKind } = await import('../src/lib/school.mjs');

  assert.equal(normalizeSchoolKind(' 초등학교 '), '초등학교');
  assert.equal(normalizeSchoolKind(null), null);
});
