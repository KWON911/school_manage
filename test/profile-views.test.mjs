import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfileCandidate,
  renderGradeOptions,
  renderSchoolResults,
  renderSetup,
  renderSetupMarkup,
  selectSchool
} from '../src/views/setup.mjs';
import {
  hasSchoolChanged,
  persistSettingsProfile,
  renderSettings,
  renderSettingsMarkup
} from '../src/views/settings.mjs';

const middleSchool = {
  name: '가람중학교',
  kind: '중학교',
  area: '서울특별시교육청',
  address: '서울특별시 강남구 가람로 1',
  ATPT_OFCDC_SC_CODE: 'B10',
  SD_SCHUL_CODE: '7010001'
};

const completeDraft = {
  role: 'student',
  school: middleSchool,
  classSetting: { grade: '2', classNm: '3' },
  allergies: ['1', '6']
};

function createDeferred() {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
}

function createInteractiveContainer() {
  const listeners = new Map();
  const selectorMarkers = {
    '#setup-school-query': 'id="setup-school-query"',
    '#settings-school-query': 'id="settings-school-query"',
    'input[name="role"]': 'name="role"',
    'select[name="grade"]': 'name="grade"',
    'input[name="classNm"]': 'name="classNm"',
    'input[name="settingsRole"]': 'name="settingsRole"',
    'select[name="settingsGrade"]': 'name="settingsGrade"',
    'input[name="settingsClassNm"]': 'name="settingsClassNm"'
  };
  let html = '';
  let focusedSelector = null;

  const container = {
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; },
    addEventListener(type, listener) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
    },
    querySelector(selector) {
      if (!html.includes(selectorMarkers[selector])) return null;
      return {
        focus() { focusedSelector = selector; }
      };
    }
  };

  return {
    container,
    fire(type, event) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
    get focusedSelector() { return focusedSelector; },
    clearFocus() { focusedSelector = null; }
  };
}

test('creates a profile only for a supported role, school grade, and positive class', () => {
  assert.deepEqual(createProfileCandidate(completeDraft), completeDraft);
  assert.equal(createProfileCandidate({ ...completeDraft, role: 'admin' }), null);
  assert.equal(createProfileCandidate({
    ...completeDraft,
    classSetting: { grade: '6', classNm: '3' }
  }), null);
  assert.equal(createProfileCandidate({
    ...completeDraft,
    classSetting: { grade: '2', classNm: '0' }
  }), null);
});

test('skipping allergies creates a complete profile with an empty allergy list', () => {
  assert.deepEqual(createProfileCandidate(completeDraft, { skipAllergies: true }), {
    ...completeDraft,
    allergies: []
  });
});

test('selecting a different school clears the previous grade and class', () => {
  const nextSchool = {
    ...middleSchool,
    name: '한빛초등학교',
    kind: '초등학교',
    SD_SCHUL_CODE: '7010002'
  };

  assert.deepEqual(selectSchool(completeDraft, nextSchool), {
    ...completeDraft,
    school: nextSchool,
    classSetting: null
  });
});

test('grade options follow the selected school kind without choosing a default', () => {
  const elementary = renderGradeOptions('초등학교');
  const high = renderGradeOptions('고등학교', '2');

  assert.match(elementary, /^<option value="">학년 선택<\/option>/);
  assert.equal((elementary.match(/학년<\/option>/g) ?? []).length, 6);
  assert.doesNotMatch(elementary, /selected/);
  assert.equal((high.match(/학년<\/option>/g) ?? []).length, 3);
  assert.match(high, /value="2" selected>2학년/);
});

test('school results are buttons that identify same-name schools safely', () => {
  const markup = renderSchoolResults([
    middleSchool,
    {
      ...middleSchool,
      name: '<가람중학교>',
      area: '경기도교육청',
      address: '경기도 성남시 가람로 2',
      SD_SCHUL_CODE: '7010003'
    }
  ], middleSchool);

  assert.equal((markup.match(/<button/g) ?? []).length, 2);
  assert.doesNotMatch(markup, /<button[^>]*role="listitem"/);
  assert.equal((markup.match(/role="listitem"/g) ?? []).length, 2);
  assert.match(markup, /가람중학교/);
  assert.match(markup, /중학교/);
  assert.match(markup, /서울특별시교육청/);
  assert.match(markup, /서울특별시 강남구 가람로 1/);
  assert.match(markup, /&lt;가람중학교&gt;/);
  assert.doesNotMatch(markup, /<가람중학교>/);
});

test('setup markup uses semantic controls and shows the inline empty-query message', () => {
  const markup = renderSetupMarkup({
    draft: { role: null, school: null, classSetting: null, allergies: [] },
    query: '',
    searchStatus: 'idle',
    searchMessage: '학교명을 입력해 주세요.',
    results: []
  });

  assert.equal((markup.match(/type="radio"/g) ?? []).length, 3);
  assert.match(markup, /<label[^>]*for="setup-school-query"/);
  assert.match(markup, /id="setup-school-query"/);
  assert.match(markup, /type="button"[^>]*data-action="search-school"/);
  assert.match(markup, /학교명을 입력해 주세요\./);
  assert.match(markup, />나중에 설정</);
});

test('school identity changes only when the saved school codes change', () => {
  assert.equal(hasSchoolChanged(middleSchool, { ...middleSchool }), false);
  assert.equal(hasSchoolChanged(middleSchool, {
    ...middleSchool,
    SD_SCHUL_CODE: '7010009'
  }), true);
  assert.equal(hasSchoolChanged(null, middleSchool), true);
});

test('settings markup keeps role, school, class, and allergy controls in one form', () => {
  const markup = renderSettingsMarkup({ draft: completeDraft, results: [] });

  assert.match(markup, /<form[^>]*data-settings-form/);
  assert.match(markup, /<section[^>]*aria-labelledby="settings-role-title"/);
  assert.match(markup, /<section[^>]*aria-labelledby="settings-school-title"/);
  assert.match(markup, /<section[^>]*aria-labelledby="settings-class-title"/);
  assert.match(markup, /<section[^>]*aria-labelledby="settings-allergy-title"/);
  assert.equal((markup.match(/type="time"/g) ?? []).length, 12);
  assert.doesNotMatch(markup, /학교생활 대시보드/);
  assert.doesNotMatch(markup, /class="content-heading"/);
});

test('settings provides a Google Calendar connection control', () => {
  const markup = renderSettingsMarkup({ draft: completeDraft, results: [] });

  assert.match(markup, /Google Calendar/);
  assert.match(markup, /data-action="connect-google-calendar"/);
});

test('settings presents a mobile-friendly checkbox calendar dropdown and preserves selected calendar ids', () => {
  const draft = { ...completeDraft, calendarIds: ['family-calendar'] };
  const markup = renderSettingsMarkup({
    draft,
    results: [],
    calendarStatus: 'connected',
    calendarOptions: [
      { id: 'primary', summary: '내 캘린더', primary: true },
      { id: 'family-calendar', summary: '가족 일정' }
    ]
  });

  assert.match(markup, /<details class="calendar-picker"/);
  assert.match(markup, /type="checkbox" name="settingsCalendarNone" value=""/);
  assert.match(markup, /type="checkbox" name="settingsCalendarIds" value="family-calendar" checked/);
  assert.match(markup, /가족 일정/);
  assert.deepEqual(createProfileCandidate(draft), draft);
});

test('saving a changed school clears cached view data and persists only the complete profile', () => {
  const entries = new Map();
  const storage = {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); }
  };
  let clearCount = 0;
  const previousProfile = completeDraft;
  const nextProfile = {
    ...completeDraft,
    school: {
      ...middleSchool,
      name: '한빛중학교',
      SD_SCHUL_CODE: '7010009'
    },
    classSetting: { grade: '1', classNm: '4' }
  };

  assert.deepEqual(persistSettingsProfile({
    storage,
    previousProfile,
    draft: nextProfile,
    clearViewData() { clearCount += 1; }
  }), { profile: nextProfile, schoolChanged: true });
  assert.equal(clearCount, 1);
  assert.deepEqual(JSON.parse(entries.get('eduHub_profile')), nextProfile);

  assert.equal(persistSettingsProfile({
    storage,
    previousProfile: nextProfile,
    draft: { ...nextProfile, classSetting: { grade: '1', classNm: '0' } },
    clearViewData() { clearCount += 1; }
  }), null);
  assert.equal(clearCount, 1);
});

test('settings success feedback always uses the shared confirmation message', () => {
  const markup = renderSettingsMarkup({
    draft: completeDraft,
    results: [],
    feedback: '설정을 저장했어요.'
  });

  assert.match(markup, /role="status">설정을 저장했어요\.<\/p>/);
});

test('a destroyed setup ignores a late school search response instead of replacing the dashboard', async () => {
  const dom = createInteractiveContainer();
  const request = createDeferred();
  const view = renderSetup(dom.container, {
    searchSchools() { return request.promise; }
  });

  dom.fire('input', { target: { name: 'schoolQuery', value: '가람중학교' } });
  dom.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-action="search-school"]' ? {} : null;
      }
    }
  });
  view.destroy();
  dom.container.innerHTML = '<div class="app-shell">dashboard</div>';

  request.resolve({ status: 'ok', rows: [middleSchool] });
  await request.promise;
  await Promise.resolve();

  assert.equal(dom.container.innerHTML, '<div class="app-shell">dashboard</div>');
});

test('setup rerenders focus the next school control or first invalid field', () => {
  const selectionDom = createInteractiveContainer();
  const selectionView = renderSetup(selectionDom.container);
  selectionView.getState().results = [middleSchool];

  selectionDom.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-school-index]'
          ? { dataset: { schoolIndex: '0' } }
          : null;
      }
    }
  });
  assert.equal(selectionDom.focusedSelector, 'select[name="grade"]');

  const validationDom = createInteractiveContainer();
  renderSetup(validationDom.container);
  validationDom.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-action="search-school"]' ? {} : null;
      }
    }
  });
  assert.equal(validationDom.focusedSelector, '#setup-school-query');

  validationDom.clearFocus();
  validationDom.fire('submit', {
    target: { matches: (selector) => selector === '[data-setup-form]' },
    submitter: { dataset: { action: 'complete-profile' } },
    preventDefault() {}
  });
  assert.equal(validationDom.focusedSelector, 'input[name="role"]');
});

test('settings rerenders focus the cleared grade control and first invalid field', () => {
  const dom = createInteractiveContainer();
  const view = renderSettings(dom.container, { profile: completeDraft });
  dom.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-action="settings-search-school"]' ? {} : null;
      }
    }
  });
  assert.equal(dom.focusedSelector, '#settings-school-query');

  dom.clearFocus();
  view.getState().results = [{
    ...middleSchool,
    name: '한빛중학교',
    SD_SCHUL_CODE: '7010009'
  }];

  dom.fire('click', {
    target: {
      closest(selector) {
        return selector === '[data-school-index]'
          ? { dataset: { schoolIndex: '0' } }
          : null;
      }
    }
  });
  assert.equal(dom.focusedSelector, 'select[name="settingsGrade"]');

  dom.clearFocus();
  dom.fire('submit', {
    target: { matches: (selector) => selector === '[data-settings-form]' },
    preventDefault() {}
  });
  assert.equal(dom.focusedSelector, 'select[name="settingsGrade"]');
});
