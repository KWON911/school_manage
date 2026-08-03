import { getGradeOptions, isSupportedSchoolKind } from '../lib/school.mjs';
import { isProfileComplete, saveProfile } from '../lib/storage.mjs';
import { searchSchools as requestSchoolSearch } from '../services/neis.mjs';

export const ROLE_OPTIONS = [
  { value: 'student', label: '학생' },
  { value: 'parent', label: '학부모' },
  { value: 'teacher', label: '교사' }
];

export const ALLERGY_OPTIONS = [
  ['1', '난류'], ['2', '우유'], ['3', '메밀'], ['4', '땅콩'], ['5', '대두'],
  ['6', '밀'], ['7', '고등어'], ['8', '게'], ['9', '새우'], ['10', '돼지고기'],
  ['11', '복숭아'], ['12', '토마토'], ['13', '아황산류'], ['14', '호두'],
  ['15', '닭고기'], ['16', '쇠고기'], ['17', '오징어'], ['18', '조개류']
];

const VALID_ROLES = new Set(ROLE_OPTIONS.map(({ value }) => value));

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isPositiveInteger(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value.trim());
}

export function schoolIdentity(school) {
  const officeCode = nonEmptyString(school?.ATPT_OFCDC_SC_CODE);
  const schoolCode = nonEmptyString(school?.SD_SCHUL_CODE);
  if (officeCode && schoolCode) return `${officeCode}:${schoolCode}`;
  return [school?.name, school?.kind, school?.address].map(nonEmptyString).join(':');
}

export function createDraft(profile = {}) {
  return {
    role: VALID_ROLES.has(profile?.role) ? profile.role : null,
    school: profile?.school ?? null,
    classSetting: profile?.classSetting
      ? { grade: profile.classSetting.grade ?? '', classNm: profile.classSetting.classNm ?? '' }
      : null,
    allergies: Array.isArray(profile?.allergies) ? [...profile.allergies] : []
  };
}

export function createProfileCandidate(draft, { skipAllergies = false } = {}) {
  const role = VALID_ROLES.has(draft?.role) ? draft.role : null;
  const school = draft?.school;
  const grade = nonEmptyString(draft?.classSetting?.grade);
  const classNm = nonEmptyString(draft?.classSetting?.classNm);
  const allowedGrades = getGradeOptions(school?.kind);

  if (!role || !school || !isSupportedSchoolKind(school.kind)) return null;
  if (!grade || !allowedGrades.includes(grade) || !isPositiveInteger(classNm ?? '')) return null;

  const allergies = skipAllergies
    ? []
    : [...new Set((Array.isArray(draft?.allergies) ? draft.allergies : [])
      .filter((value) => ALLERGY_OPTIONS.some(([id]) => id === value)))];
  const profile = { role, school, classSetting: { grade, classNm }, allergies };
  return isProfileComplete(profile) ? profile : null;
}

export function selectSchool(draft, school) {
  if (schoolIdentity(draft?.school) === schoolIdentity(school)) {
    return { ...draft, school };
  }
  return { ...draft, school, classSetting: null };
}

export function renderRoleOptions(selectedRole, name = 'role') {
  return ROLE_OPTIONS.map(({ value, label }) => `
    <label class="choice-card">
      <input type="radio" name="${escapeHtml(name)}" value="${value}"${selectedRole === value ? ' checked' : ''}>
      <span>${label}</span>
    </label>
  `).join('');
}

export function renderGradeOptions(kind, selectedGrade = '') {
  return [
    '<option value="">학년 선택</option>',
    ...getGradeOptions(kind).map((grade) => (
      `<option value="${grade}"${selectedGrade === grade ? ' selected' : ''}>${grade}학년</option>`
    ))
  ].join('');
}

export function renderSchoolResults(schools = [], selectedSchool = null) {
  if (!schools.length) return '';
  const selectedIdentity = schoolIdentity(selectedSchool);

  return `<div class="school-results" role="list" aria-label="학교 검색 결과">
    ${schools.map((school, index) => {
      const isSelected = selectedIdentity === schoolIdentity(school);
      return `<div class="school-result-item" role="listitem">
        <button class="school-result${isSelected ? ' is-selected' : ''}" type="button" data-school-index="${index}" aria-pressed="${isSelected}">
          <span class="school-result__name">${escapeHtml(school.name)}</span>
          <span class="school-result__meta">${escapeHtml(school.kind)} · ${escapeHtml(school.area)}</span>
          <span class="school-result__address">${escapeHtml(school.address)}</span>
        </button>
      </div>`;
    }).join('')}
  </div>`;
}

export function renderAllergyOptions(selected = [], name = 'allergies') {
  const selectedValues = new Set(selected);
  return ALLERGY_OPTIONS.map(([value, label]) => `
    <label class="allergy-choice">
      <input type="checkbox" name="${escapeHtml(name)}" value="${value}"${selectedValues.has(value) ? ' checked' : ''}>
      <span>${value}. ${label}</span>
    </label>
  `).join('');
}

function renderSelectedSchool(school) {
  if (!school) return '<p class="selection-empty">아직 선택한 학교가 없어요.</p>';
  return `<div class="selected-school">
    <strong>${escapeHtml(school.name)}</strong>
    <span>${escapeHtml(school.kind)} · ${escapeHtml(school.area)}</span>
  </div>`;
}

function renderSearchMessage(state) {
  if (!state.searchMessage) return '';
  const isError = state.searchStatus === 'error';
  return `<p class="form-message${isError ? ' is-error' : ''}" id="setup-school-message" role="${isError ? 'alert' : 'status'}">${escapeHtml(state.searchMessage)}</p>`;
}

export function renderSetupMarkup(state = {}) {
  const draft = createDraft(state.draft);
  const classSetting = draft.classSetting ?? { grade: '', classNm: '' };
  const errors = state.errors ?? {};

  return `<div class="setup-page">
    <main class="setup-card" aria-labelledby="setup-title">
      <header class="setup-card__header">
        <span class="brand-mark setup-brand" aria-hidden="true"><span></span><span></span></span>
        <p class="eyebrow">처음 한 번만 설정해요</p>
        <h1 id="setup-title">내 학교생활을 연결해 볼까요?</h1>
        <p>역할과 학교, 학년·반을 알려주면 필요한 정보를 한눈에 정리해 드려요.</p>
      </header>

      <form class="profile-form" data-setup-form novalidate>
        <fieldset class="form-section">
          <legend>나는 누구인가요?</legend>
          <p class="form-section__hint">대시보드에서 먼저 보여 드릴 정보를 정하는 데 사용해요.</p>
          <div class="choice-grid">${renderRoleOptions(draft.role)}</div>
          ${errors.role ? `<p class="form-message is-error" role="alert">${escapeHtml(errors.role)}</p>` : ''}
        </fieldset>

        <section class="form-section" aria-labelledby="setup-school-title">
          <h2 id="setup-school-title">학교를 찾아 주세요</h2>
          <label for="setup-school-query">학교명</label>
          <div class="search-row">
            <input id="setup-school-query" name="schoolQuery" type="search" value="${escapeHtml(state.query)}" placeholder="예: 가람중학교" aria-describedby="setup-school-message">
            <button class="button button--secondary" type="button" data-action="search-school"${state.searchStatus === 'loading' ? ' disabled' : ''}>${state.searchStatus === 'loading' ? '찾는 중…' : '학교 검색'}</button>
          </div>
          ${renderSearchMessage(state)}
          ${renderSelectedSchool(draft.school)}
          ${renderSchoolResults(state.results, draft.school)}
          ${errors.school ? `<p class="form-message is-error" role="alert">${escapeHtml(errors.school)}</p>` : ''}
        </section>

        <section class="form-section" aria-labelledby="setup-class-title">
          <h2 id="setup-class-title">학년·반을 알려 주세요</h2>
          <div class="class-fields">
            <label>학년
              <select name="grade"${draft.school ? '' : ' disabled'}>${renderGradeOptions(draft.school?.kind, classSetting.grade)}</select>
            </label>
            <label>반
              <input name="classNm" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(classSetting.classNm)}" placeholder="예: 3"${draft.school ? '' : ' disabled'}>
            </label>
          </div>
          ${errors.classSetting ? `<p class="form-message is-error" role="alert">${escapeHtml(errors.classSetting)}</p>` : ''}
        </section>

        <fieldset class="form-section">
          <legend>급식 알레르기가 있나요?</legend>
          <p class="form-section__hint">선택 사항이에요. 나중에 내 설정에서 바꿀 수 있어요.</p>
          <div class="allergy-grid">${renderAllergyOptions(draft.allergies)}</div>
        </fieldset>

        ${errors.profile ? `<p class="form-message is-error form-message--summary" role="alert">${escapeHtml(errors.profile)}</p>` : ''}
        <div class="form-actions">
          <button class="button button--ghost" type="submit" data-action="skip-allergies">나중에 설정</button>
          <button class="button button--primary" type="submit" data-action="complete-profile">설정 완료</button>
        </div>
      </form>
    </main>
  </div>`;
}

function profileErrors(draft) {
  const grade = draft.classSetting?.grade;
  const classNm = draft.classSetting?.classNm ?? '';
  const hasValidClass = getGradeOptions(draft.school?.kind).includes(grade) && isPositiveInteger(classNm);
  return {
    ...(!VALID_ROLES.has(draft.role) ? { role: '역할을 선택해 주세요.' } : {}),
    ...(!draft.school ? { school: '학교 검색 결과에서 학교를 선택해 주세요.' } : {}),
    ...(!hasValidClass
      ? { classSetting: '학년을 선택하고 반은 1 이상의 정수로 입력해 주세요.' }
      : {}),
    profile: '필수 설정을 모두 확인해 주세요.'
  };
}

function setupErrorSelector(errors, draft) {
  if (errors.role) return 'input[name="role"]';
  if (errors.school) return '#setup-school-query';
  if (!getGradeOptions(draft.school?.kind).includes(draft.classSetting?.grade)) {
    return 'select[name="grade"]';
  }
  return 'input[name="classNm"]';
}

function focusControl(container, selector) {
  container.querySelector?.(selector)?.focus();
}

function emitProfile(container, eventName, profile) {
  if (typeof CustomEvent === 'function' && typeof container.dispatchEvent === 'function') {
    container.dispatchEvent(new CustomEvent(eventName, { detail: { profile }, bubbles: true }));
  }
}

export function renderSetup(container, context = {}) {
  let destroyed = false;
  let searchRequest = 0;
  const state = {
    draft: createDraft(context.profile),
    query: '',
    searchStatus: 'idle',
    searchMessage: '',
    results: [],
    errors: {}
  };
  const render = () => { container.innerHTML = renderSetupMarkup(state); };
  const storage = context.storage ?? globalThis.localStorage;
  const searchSchools = context.searchSchools ?? requestSchoolSearch;

  function onInput(event) {
    if (event.target.name === 'schoolQuery') state.query = event.target.value;
    if (event.target.name === 'classNm') {
      state.draft.classSetting = {
        grade: state.draft.classSetting?.grade ?? '',
        classNm: event.target.value
      };
    }
  }

  function onChange(event) {
    if (event.target.name === 'role') state.draft.role = event.target.value;
    if (event.target.name === 'grade') {
      state.draft.classSetting = {
        grade: event.target.value,
        classNm: state.draft.classSetting?.classNm ?? ''
      };
    }
    if (event.target.name === 'allergies') {
      const selected = new Set(state.draft.allergies);
      event.target.checked ? selected.add(event.target.value) : selected.delete(event.target.value);
      state.draft.allergies = [...selected];
    }
  }

  function onClick(event) {
    const result = event.target.closest?.('[data-school-index]');
    if (result) {
      const school = state.results[Number(result.dataset.schoolIndex)];
      if (school) {
        state.draft = selectSchool(state.draft, school);
        state.errors = {};
        render();
        focusControl(container, 'select[name="grade"]');
      }
      return;
    }

    const searchButton = event.target.closest?.('[data-action="search-school"]');
    if (!searchButton) return;
    void search();
  }

  function onSubmit(event) {
    if (!event.target.matches?.('[data-setup-form]')) return;
    event.preventDefault();
    const skipAllergies = event.submitter?.dataset.action === 'skip-allergies';
    const profile = createProfileCandidate(state.draft, { skipAllergies });
    if (!profile) {
      state.errors = profileErrors(state.draft);
      render();
      focusControl(container, setupErrorSelector(state.errors, state.draft));
      return;
    }

    saveProfile(storage, profile);
    context.onComplete?.(profile);
    emitProfile(container, 'profile-complete', profile);
  }

  async function search() {
    const requestId = ++searchRequest;
    const query = state.query.trim();
    if (!query) {
      state.searchStatus = 'error';
      state.searchMessage = '학교명을 입력해 주세요.';
      state.results = [];
      render();
      focusControl(container, '#setup-school-query');
      return;
    }

    state.searchStatus = 'loading';
    state.searchMessage = '';
    render();
    const result = await searchSchools(query);
    if (destroyed || requestId !== searchRequest) return;
    state.results = result.rows ?? [];
    if (result.status === 'ok') {
      state.searchStatus = 'success';
      state.searchMessage = `${state.results.length}개의 학교를 찾았어요.`;
    } else if (result.status === 'no-data') {
      state.searchStatus = 'idle';
      state.searchMessage = '검색 결과가 없어요. 학교명을 다시 확인해 주세요.';
    } else {
      state.searchStatus = 'error';
      state.searchMessage = '학교를 찾지 못했어요. 잠시 후 다시 시도해 주세요.';
    }
    render();
  }

  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  render();
  return {
    getState: () => state,
    destroy() {
      destroyed = true;
      searchRequest += 1;
      container.removeEventListener?.('input', onInput);
      container.removeEventListener?.('change', onChange);
      container.removeEventListener?.('click', onClick);
      container.removeEventListener?.('submit', onSubmit);
    }
  };
}
