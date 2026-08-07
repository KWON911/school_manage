# 학교알리미 링크 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학교 선택 정보에 학교알리미 식별자를 연결하고 사이드바 학교명 버튼에서 해당 학교알리미 페이지를 새 탭으로 연다.

**Architecture:** NEIS 학교 검색 결과를 서버 프록시를 통해 학교알리미 식별자로 보강한다. 프로필에는 선택적 `schoolInfoId`와 `schoolInfoUrl`을 저장하고, 앱 셸은 상세 URL 또는 학교명 검색 fallback을 외부 링크로 렌더링한다. 학교 변경은 기존 설정 화면 흐름을 유지한다.

**Tech Stack:** 브라우저 ES modules, Vercel serverless API(CommonJS), Node built-in test runner, localStorage.

## Global Constraints

- 학교알리미 API 키는 서버 환경 변수로만 사용한다.
- 기존 NEIS 검색과 프로필 데이터는 하위 호환해야 한다.
- API 실패가 학교 선택 자체를 막아서는 안 된다.
- 외부 링크는 `target="_blank"`와 `rel="noopener noreferrer"`를 사용한다.
- 프로덕션 코드 작성 전 해당 동작의 실패 테스트를 먼저 실행한다.

---

### Task 1: 학교알리미 URL 및 학교 데이터 정규화 유틸리티

**Files:**
- Create: `src/lib/schoolinfo.mjs`
- Test: `test/schoolinfo.test.mjs`

**Interfaces:**
- `buildSchoolInfoDetailUrl(id)` → `string|null`
- `buildSchoolInfoSearchUrl(name)` → `string`
- `resolveSchoolInfoUrl(school)` → `string|null`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchoolInfoDetailUrl, buildSchoolInfoSearchUrl, resolveSchoolInfoUrl } from '../src/lib/schoolinfo.mjs';

test('builds a detail URL from SHL_IDF_CD', () => {
  assert.equal(buildSchoolInfoDetailUrl('420ae2c2-cdbb-469b-9c32-4f03ba15c8e0'), 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=420ae2c2-cdbb-469b-9c32-4f03ba15c8e0');
});

test('falls back to an encoded school search URL', () => {
  assert.match(buildSchoolInfoSearchUrl('인천예송초등학교'), /schoolinfo\.go\.kr/);
  assert.match(buildSchoolInfoSearchUrl('인천예송초등학교'), /%EC%9D%B8/);
});

test('prefers an existing verified URL then detail id then search fallback', () => {
  assert.equal(resolveSchoolInfoUrl({ schoolInfoUrl: 'https://example.com' }), 'https://example.com');
  assert.match(resolveSchoolInfoUrl({ schoolInfoId: 'school-id', name: '학교' }), /SHL_IDF_CD=school-id/);
  assert.match(resolveSchoolInfoUrl({ name: '학교' }), /schoolinfo\.go\.kr/);
  assert.equal(resolveSchoolInfoUrl(null), null);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test test/schoolinfo.test.mjs`

Expected: FAIL because `src/lib/schoolinfo.mjs` does not exist.

- [ ] **Step 3: Implement the minimal URL helpers**

Create pure functions that validate non-empty IDs/URLs, construct the fixed SchoolInfo detail path, and encode the school name in a SchoolInfo search URL. `resolveSchoolInfoUrl` must return `null` when the school has no name.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test test/schoolinfo.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schoolinfo.mjs test/schoolinfo.test.mjs
git commit -m "feat: add schoolinfo URL helpers"
```

### Task 2: 학교알리미 API 프록시와 검색 보강

**Files:**
- Create: `api/schoolinfo.js`
- Modify: `src/services/neis.mjs`
- Test: `test/schoolinfo-api.test.mjs`, `test/neis-policy.test.mjs`

**Interfaces:**
- `api/schoolinfo.js` accepts `GET ?name=&area=&address=&neisCode=` and returns `{status:'ok', schoolInfoId}` or a non-fatal no-match response.
- `searchSchools(query)` keeps its existing return shape and adds optional `schoolInfoId`/`schoolInfoUrl` to each row.

- [ ] **Step 1: Write failing tests**

Add tests asserting the API rejects non-GET requests, does not expose the key, and forwards only approved search parameters. Add a service test where a NEIS result is returned and the schoolinfo resolver attaches `schoolInfoId` when the resolver succeeds, while preserving the NEIS row on resolver failure.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test test/schoolinfo-api.test.mjs test/neis-policy.test.mjs`

Expected: FAIL for missing API handler/service enrichment.

- [ ] **Step 3: Implement the server proxy and service enrichment**

Add an allowlisted proxy using `SCHOOLINFO_API_KEY`, parse upstream JSON defensively, and return no-match/network errors without exposing credentials. In `searchSchools`, normalize NEIS fields first, then request the resolver for each result (with a small bounded concurrency or sequential requests) and merge optional SchoolInfo fields; if the resolver fails, return the original row unchanged.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test test/schoolinfo-api.test.mjs test/neis-policy.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: all existing and new tests pass.

```bash
git add api/schoolinfo.js src/services/neis.mjs test/schoolinfo-api.test.mjs test/neis-policy.test.mjs
git commit -m "feat: enrich schools with schoolinfo ids"
```

### Task 3: 프로필과 앱 셸의 외부 학교알리미 링크

**Files:**
- Modify: `src/lib/storage.mjs`
- Modify: `src/main.mjs`
- Modify: `src/components.mjs`
- Test: `test/storage.test.mjs`, `test/app-shell.test.mjs`

**Interfaces:**
- `renderAppShell(..., { schoolName, schoolInfoUrl })` renders an external anchor for the school label.
- Existing settings navigation continues to use `data-view="settings"` from settings controls; the sidebar label no longer changes school directly.

- [ ] **Step 1: Write failing tests**

Add a storage test proving optional SchoolInfo fields survive save/read, and shell tests asserting the school label renders an external anchor with the exact URL, `target="_blank"`, and `rel="noopener noreferrer"`; assert the fallback URL is used when no ID exists.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test test/storage.test.mjs test/app-shell.test.mjs`

Expected: FAIL because the current shell renders a settings button and `main.mjs` passes only `schoolName`.

- [ ] **Step 3: Implement profile preservation and shell wiring**

Preserve optional `schoolInfoId`/`schoolInfoUrl` in normalized school objects. Use `resolveSchoolInfoUrl(profile.school)` in `main.mjs` and pass it to `renderAppShell`. Replace the school switcher markup with an external link while keeping a clear `aria-label`.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test test/storage.test.mjs test/app-shell.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run all tests and commit**

Run: `npm test`

Expected: all tests pass.

```bash
git add src/lib/storage.mjs src/main.mjs src/components.mjs test/storage.test.mjs test/app-shell.test.mjs
git commit -m "feat: open schoolinfo from school label"
```

### Task 4: 설정 화면 저장 흐름과 배포 검증

**Files:**
- Modify: `src/views/setup.mjs`
- Modify: `src/views/settings.mjs`
- Test: `test/profile-views.test.mjs`

**Interfaces:**
- Selecting a school stores the enriched row without changing existing grade/class validation.
- Saving settings preserves SchoolInfo fields when changing unrelated profile settings.

- [ ] **Step 1: Write failing regression tests**

Add setup/settings tests that select a school row containing `schoolInfoId` and verify the emitted/saved profile keeps the field after submission.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test test/profile-views.test.mjs`

Expected: FAIL only if either view drops the enriched fields during draft/candidate creation.

- [ ] **Step 3: Implement the minimal view changes**

Ensure draft creation, school selection, candidate creation, and settings persistence pass the enriched school object through unchanged. Keep the current “학교 변경” settings search as the only school-edit workflow.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: all tests pass with no warnings.

- [ ] **Step 5: Inspect the final diff and commit**

```bash
git diff --check
git status --short
git add src/views/setup.mjs src/views/settings.mjs test/profile-views.test.mjs
git commit -m "test: preserve schoolinfo data in profile flows"
```

