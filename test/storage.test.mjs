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

test('preserves Schoolinfo link fields when saving and reading a profile', () => {
  const storage = createStorage();
  const profile = {
    role: 'student',
    school: {
      name: '가나다고등학교',
      kind: '고등학교',
      schoolInfoId: 'SCH-123',
      schoolInfoUrl: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
    },
    classSetting: { grade: '2', classNm: '3' },
    allergies: []
  };

  saveProfile(storage, profile);

  assert.deepEqual(readProfile(storage).school, profile.school);
});

test('treats malformed saved profiles as empty and clears a school without kind', () => {
  const malformed = createStorage({ eduHub_profile: '{not json' });
  const jsonNull = createStorage({ eduHub_profile: 'null' });
  const missingKind = createStorage({
    eduHub_profile: JSON.stringify({
      role: 'parent',
      school: { name: '학교' },
      classSetting: { grade: '1', classNm: '1' },
      allergies: []
    })
  });

  assert.deepEqual(readProfile(malformed), createEmptyProfile());
  assert.deepEqual(readProfile(jsonNull), createEmptyProfile());
  assert.deepEqual(readProfile(missingKind), {
    role: 'parent',
    school: null,
    classSetting: { grade: '1', classNm: '1' },
    allergies: []
  });
});

test('does not migrate legacy keys when a malformed consolidated profile exists', () => {
  const storage = createStorage({
    eduHub_profile: '{not json',
    eduHub_school: JSON.stringify({ name: '가나다중학교', kind: '중학교' }),
    eduHub_classSetting: JSON.stringify({ grade: '1', classNm: '2' }),
    eduHub_myAllergies: JSON.stringify(['1'])
  });

  assert.deepEqual(readProfile(storage), createEmptyProfile());
});

test('requires positive integer grade and class values', () => {
  const base = {
    role: 'student',
    school: { name: '가나다중학교', kind: '중학교' },
    classSetting: { grade: '1', classNm: '1' },
    allergies: []
  };

  assert.equal(isProfileComplete({ ...base, classSetting: { grade: '0', classNm: '1' } }), false);
  assert.equal(isProfileComplete({ ...base, classSetting: { grade: '-1', classNm: '1' } }), false);
  assert.equal(isProfileComplete({ ...base, classSetting: { grade: '1', classNm: '0' } }), false);
  assert.equal(isProfileComplete({ ...base, classSetting: { grade: '1', classNm: '-1' } }), false);
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

test('preserves Schoolinfo link fields when migrating a legacy school profile', () => {
  const storage = createStorage({
    eduHub_school: JSON.stringify({
      name: '가나다중학교',
      kind: '중학교',
      schoolInfoId: 'SCH-123',
      schoolInfoUrl: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
    }),
    eduHub_classSetting: JSON.stringify({ grade: '1', classNm: '2' }),
    eduHub_myAllergies: JSON.stringify([])
  });

  const profile = readProfile(storage);

  assert.deepEqual(profile.school, {
    name: '가나다중학교',
    kind: '중학교',
    schoolInfoId: 'SCH-123',
    schoolInfoUrl: 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
  });
  assert.deepEqual(JSON.parse(storage.getItem('eduHub_profile')).school, profile.school);
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
