import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProfile,
  readProfile,
  saveProfile,
  isProfileComplete
} from '../src/lib/storage.mjs';

function createStorage(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  return {
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); }
  };
}

test('creates the empty profile shape', () => {
  assert.deepEqual(createEmptyProfile(), {
    role: null,
    school: null,
    classSetting: null,
    allergies: []
  });
});

test('marks settings complete only when role, school kind, and class are present', () => {
  const profile = {
    role: 'parent',
    school: null,
    classSetting: { grade: '1', classNm: '1' },
    allergies: []
  };

  assert.equal(isProfileComplete(profile), false);
  profile.school = { name: '가나다중학교', kind: '중학교', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '1' };
  assert.equal(isProfileComplete(profile), true);
});

test('saves and reads the complete profile from eduHub_profile', () => {
  const storage = createStorage();
  const profile = {
    role: 'student',
    school: { name: '가나다고등학교', kind: '고등학교' },
    classSetting: { grade: '2', classNm: '3' },
    allergies: ['1', '2']
  };

  saveProfile(storage, profile);

  assert.deepEqual(JSON.parse(storage.getItem('eduHub_profile')), profile);
  assert.deepEqual(readProfile(storage), profile);
});

test('treats malformed saved profiles as empty and clears a school without kind', () => {
  const malformed = createStorage({ eduHub_profile: '{not json' });
  const missingKind = createStorage({
    eduHub_profile: JSON.stringify({
      role: 'parent',
      school: { name: '학교' },
      classSetting: { grade: '1', classNm: '1' },
      allergies: []
    })
  });

  assert.deepEqual(readProfile(malformed), createEmptyProfile());
  assert.deepEqual(readProfile(missingKind), {
    role: 'parent',
    school: null,
    classSetting: { grade: '1', classNm: '1' },
    allergies: []
  });
});

test('migrates legacy profile keys once when the school includes its kind', () => {
  const storage = createStorage({
    eduHub_school: JSON.stringify({ name: '가나다중학교', kind: '중학교' }),
    eduHub_classSetting: JSON.stringify({ grade: '1', classNm: '2' }),
    eduHub_myAllergies: JSON.stringify(['1', '6'])
  });

  assert.deepEqual(readProfile(storage), {
    role: null,
    school: { name: '가나다중학교', kind: '중학교' },
    classSetting: { grade: '1', classNm: '2' },
    allergies: ['1', '6']
  });
  assert.equal(storage.getItem('eduHub_profile'), JSON.stringify({
    role: null,
    school: { name: '가나다중학교', kind: '중학교' },
    classSetting: { grade: '1', classNm: '2' },
    allergies: ['1', '6']
  }));

  storage.setItem('eduHub_school', JSON.stringify({ name: '다른학교', kind: '고등학교' }));
  assert.equal(readProfile(storage).school.name, '가나다중학교');
});

test('migrates legacy data once but clears a school without kind for reselection', () => {
  const storage = createStorage({
    eduHub_school: JSON.stringify({ name: '예전학교' }),
    eduHub_classSetting: JSON.stringify({ grade: '1', classNm: '1' }),
    eduHub_myAllergies: JSON.stringify(['3'])
  });

  assert.deepEqual(readProfile(storage), {
    role: null,
    school: null,
    classSetting: { grade: '1', classNm: '1' },
    allergies: ['3']
  });
  assert.notEqual(storage.getItem('eduHub_profile'), null);
});
