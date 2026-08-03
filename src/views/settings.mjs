import { saveProfile } from '../lib/storage.mjs';
import { getGradeOptions } from '../lib/school.mjs';
import { searchSchools as requestSchoolSearch } from '../services/neis.mjs';
import {
  createDraft,
  createProfileCandidate,
  escapeHtml,
  renderAllergyOptions,
  renderGradeOptions,
  renderRoleOptions,
  renderSchoolResults,
  schoolIdentity,
  selectSchool
} from './setup.mjs';

export function hasSchoolChanged(previousSchool, nextSchool) {
  return schoolIdentity(previousSchool) !== schoolIdentity(nextSchool);
}

export function persistSettingsProfile({ storage, previousProfile, draft, clearViewData }) {
  const profile = createProfileCandidate(draft);
  if (!profile) return null;

  const schoolChanged = hasSchoolChanged(previousProfile?.school, profile.school);
  saveProfile(storage, profile);
  if (schoolChanged) clearViewData?.();
  return { profile, schoolChanged };
}

function searchMessage(state) {
  if (!state.searchMessage) return '';
  return `<p class="form-message${state.searchStatus === 'error' ? ' is-error' : ''}" id="settings-school-message" role="${state.searchStatus === 'error' ? 'alert' : 'status'}">${escapeHtml(state.searchMessage)}</p>`;
}

export function renderSettingsMarkup(state = {}) {
  const draft = createDraft(state.draft);
  const classSetting = draft.classSetting ?? { grade: '', classNm: '' };
  const errors = state.errors ?? {};

  return `<div class="content-heading">
    <p>학교생활 대시보드</p>
    <span>${escapeHtml(draft.school?.name ?? '학교 미설정')}</span>
  </div>
  <div class="settings-view">
    <header class="view-header">
      <p class="eyebrow">기기에 저장되는 정보</p>
      <h1 id="view-title">내 설정</h1>
      <p>역할과 학교생활 기준을 한곳에서 관리해요.</p>
    </header>

    <form class="settings-form" data-settings-form novalidate>
      <section class="settings-section" aria-labelledby="settings-role-title">
        <div class="settings-section__heading">
          <h2 id="settings-role-title">역할</h2>
          <p>홈에서 먼저 보여 드릴 정보를 정해요.</p>
        </div>
        <div class="choice-grid">${renderRoleOptions(draft.role, 'settingsRole')}</div>
        ${errors.role ? `<p class="form-message is-error" role="alert">${escapeHtml(errors.role)}</p>` : ''}
      </section>

      <section class="settings-section" aria-labelledby="settings-school-title">
        <div class="settings-section__heading">
          <h2 id="settings-school-title">학교</h2>
          <p>학교를 바꾸면 학년·반도 다시 선택해 주세요.</p>
        </div>
        <label for="settings-school-query">학교명</label>
        <div class="search-row">
          <input id="settings-school-query" name="settingsSchoolQuery" type="search" value="${escapeHtml(state.query)}" placeholder="학교명 검색" aria-describedby="settings-school-message">
          <button class="button button--secondary" type="button" data-action="settings-search-school"${state.searchStatus === 'loading' ? ' disabled' : ''}>${state.searchStatus === 'loading' ? '찾는 중…' : '학교 검색'}</button>
        </div>
        ${searchMessage(state)}
        ${draft.school ? `<div class="selected-school"><strong>${escapeHtml(draft.school.name)}</strong><span>${escapeHtml(draft.school.kind)} · ${escapeHtml(draft.school.area)}</span></div>` : ''}
        ${renderSchoolResults(state.results, draft.school)}
        ${errors.school ? `<p class="form-message is-error" role="alert">${escapeHtml(errors.school)}</p>` : ''}
      </section>

      <section class="settings-section" aria-labelledby="settings-class-title">
        <div class="settings-section__heading">
          <h2 id="settings-class-title">학년·반</h2>
          <p>학생·학부모는 소속 학급, 교사는 조회할 학급을 입력해요.</p>
        </div>
        <div class="class-fields">
          <label>학년
            <select name="settingsGrade"${draft.school ? '' : ' disabled'}>${renderGradeOptions(draft.school?.kind, classSetting.grade)}</select>
          </label>
          <label>반
            <input name="settingsClassNm" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(classSetting.classNm)}"${draft.school ? '' : ' disabled'}>
          </label>
        </div>
        ${errors.classSetting ? `<p class="form-message is-error" role="alert">${escapeHtml(errors.classSetting)}</p>` : ''}
      </section>

      <section class="settings-section" aria-labelledby="settings-allergy-title">
        <div class="settings-section__heading">
          <h2 id="settings-allergy-title">급식 알레르기</h2>
          <p>선택하지 않아도 저장할 수 있어요.</p>
        </div>
        <div class="allergy-grid">${renderAllergyOptions(draft.allergies, 'settingsAllergies')}</div>
      </section>

      ${errors.profile ? `<p class="form-message is-error form-message--summary" role="alert">${escapeHtml(errors.profile)}</p>` : ''}
      ${state.feedback ? `<p class="save-feedback" role="status">${escapeHtml(state.feedback)}</p>` : ''}
      <div class="form-actions form-actions--settings">
        <button class="button button--primary" type="submit">설정 저장</button>
      </div>
    </form>
  </div>`;
}

function invalidErrors(draft) {
  const grade = draft.classSetting?.grade;
  const classNm = draft.classSetting?.classNm ?? '';
  const hasValidClass = getGradeOptions(draft.school?.kind).includes(grade)
    && /^[1-9]\d*$/.test(classNm);
  return {
    ...(!draft.role ? { role: '역할을 선택해 주세요.' } : {}),
    ...(!draft.school ? { school: '학교 검색 결과에서 학교를 선택해 주세요.' } : {}),
    ...(!hasValidClass
      ? { classSetting: '학년을 선택하고 반은 1 이상의 정수로 입력해 주세요.' }
      : {}),
    profile: '필수 설정을 모두 확인해 주세요.'
  };
}

function settingsErrorSelector(errors, draft) {
  if (errors.role) return 'input[name="settingsRole"]';
  if (errors.school) return '#settings-school-query';
  if (!getGradeOptions(draft.school?.kind).includes(draft.classSetting?.grade)) {
    return 'select[name="settingsGrade"]';
  }
  return 'input[name="settingsClassNm"]';
}

function focusControl(container, selector) {
  container.querySelector?.(selector)?.focus();
}

function emitUpdated(container, profile, schoolChanged) {
  if (typeof CustomEvent === 'function' && typeof container.dispatchEvent === 'function') {
    container.dispatchEvent(new CustomEvent('profile-updated', {
      detail: { profile, schoolChanged },
      bubbles: true
    }));
  }
}

export function renderSettings(container, context = {}) {
  let savedProfile = createDraft(context.profile);
  const state = {
    draft: createDraft(context.profile),
    query: '',
    searchStatus: 'idle',
    searchMessage: '',
    results: [],
    errors: {},
    feedback: context.feedback ?? ''
  };
  const render = () => { container.innerHTML = renderSettingsMarkup(state); };
  const storage = context.storage ?? globalThis.localStorage;
  const searchSchools = context.searchSchools ?? requestSchoolSearch;

  function onInput(event) {
    if (event.target.name === 'settingsSchoolQuery') state.query = event.target.value;
    if (event.target.name === 'settingsClassNm') {
      state.draft.classSetting = {
        grade: state.draft.classSetting?.grade ?? '',
        classNm: event.target.value
      };
    }
  }

  function onChange(event) {
    if (event.target.name === 'settingsRole') state.draft.role = event.target.value;
    if (event.target.name === 'settingsGrade') {
      state.draft.classSetting = {
        grade: event.target.value,
        classNm: state.draft.classSetting?.classNm ?? ''
      };
    }
    if (event.target.name === 'settingsAllergies') {
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
        state.feedback = '';
        state.errors = {};
        render();
        focusControl(container, 'select[name="settingsGrade"]');
      }
      return;
    }

    if (event.target.closest?.('[data-action="settings-search-school"]')) void search();
  }

  function onSubmit(event) {
    if (!event.target.matches?.('[data-settings-form]')) return;
    event.preventDefault();
    const saved = persistSettingsProfile({
      storage,
      previousProfile: savedProfile,
      draft: state.draft,
      clearViewData: context.clearViewData
    });
    if (!saved) {
      state.feedback = '';
      state.errors = invalidErrors(state.draft);
      render();
      focusControl(container, settingsErrorSelector(state.errors, state.draft));
      return;
    }

    const { profile, schoolChanged } = saved;
    savedProfile = createDraft(profile);
    state.draft = createDraft(profile);
    state.errors = {};
    state.feedback = '설정을 저장했어요.';
    context.onUpdated?.(profile, { schoolChanged });
    emitUpdated(container, profile, schoolChanged);
    render();
  }

  async function search() {
    const query = state.query.trim();
    if (!query) {
      state.searchStatus = 'error';
      state.searchMessage = '학교명을 입력해 주세요.';
      state.results = [];
      render();
      focusControl(container, '#settings-school-query');
      return;
    }
    state.searchStatus = 'loading';
    state.searchMessage = '';
    render();
    const result = await searchSchools(query);
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
      container.removeEventListener?.('input', onInput);
      container.removeEventListener?.('change', onChange);
      container.removeEventListener?.('click', onClick);
      container.removeEventListener?.('submit', onSubmit);
    }
  };
}
