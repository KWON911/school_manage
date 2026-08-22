# 시간표·급식 탭 시각 표현 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시간표·급식 탭에도 홈과 같은 과목명 가운데 정렬 및 급식 메뉴 일러스트를 적용한다.

**Architecture:** 음식 유형별 SVG 마크업을 `src/lib/meal-illustrations.mjs`로 분리해 홈 대시보드와 급식 탭이 같은 함수를 사용한다. 시간표 탭은 데스크톱 표의 셀과 모바일 `period-list` 과목명에 전용 클래스를 부여하고 CSS에서 가운데 정렬한다.

**Tech Stack:** Vanilla ES modules, template-string HTML rendering, CSS, Node.js built-in test runner.

## Global Constraints

- 외부 이미지, 네트워크 요청, 런타임 의존성을 추가하지 않는다.
- SVG는 `aria-hidden="true"`로 장식 처리한다.
- 메뉴 텍스트 escape와 알레르기 경고/날짜 전환 동작을 유지한다.
- 홈 대시보드와 급식 탭은 같은 메뉴에 같은 일러스트를 사용한다.

---

### Task 1: 공용 음식 일러스트와 탭 렌더링

**Files:**
- Create: `src/lib/meal-illustrations.mjs` — 메뉴명 키워드에 맞는 SVG 래퍼 마크업
- Modify: `src/views/dashboard.mjs` — 공용 일러스트 함수 import
- Modify: `src/views/modules.mjs` — 탭 급식 일러스트와 시간표 과목명 훅
- Modify: `src/styles/app.css` — 탭 시간표 과목명 가운데 정렬
- Test: `test/dashboard.test.mjs`, `test/modules.test.mjs` — 홈/탭 렌더링 계약

**Interfaces:**
- Produces: `mealIllustrationMarkup(dish: unknown): string`
- Consumes: NEIS `DDISH_NM` 메뉴 문자열
- Produces: `.meal-item__illustration`, `.timetable-module__subject` DOM 훅

- [ ] **Step 1: Write failing tests**

시간표 모듈 테스트는 데스크톱 표와 모바일 `period-list` 모두 `.timetable-module__subject`를 포함하는지 검증한다. 급식 모듈 테스트는 일반 메뉴와 알레르기 메뉴가 `.meal-item__illustration` 및 `aria-hidden="true"`를 포함하면서 메뉴명과 경고를 계속 표시하는지 검증한다.

```js
assert.match(container.innerHTML, /class="timetable-module__subject"[^>]*>국어/);
assert.match(container.innerHTML, /class="meal-item__illustration"[^>]*aria-hidden="true"/);
assert.match(container.innerHTML, /계란찜\(1\.\)[\s\S]*알레르기 1번 포함/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="timetable is always weekly|meal calendar"`

Expected: FAIL because tab markup currently lacks the two DOM hooks.

- [ ] **Step 3: Implement the shared renderer and hooks**

Create `mealIllustrationMarkup` in `src/lib/meal-illustrations.mjs` using the existing home keyword order and SVG paths. Replace the local home function with an import. Import the same function in `modules.mjs` and add it before the escaped menu-name span in both normal and allergy menu items.

Wrap desktop timetable cell text in `<span class="timetable-module__subject">` and add the same class to the `periodList` subject `<strong>`. Add CSS to center these subjects without changing period labels.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- --test-name-pattern="timetable is always weekly|meal calendar|student dashboard"`

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `npm test; git diff --check`

Expected: zero failures and no whitespace errors.

- [ ] **Step 6: Commit and push**

```bash
git add -- src/lib/meal-illustrations.mjs src/views/dashboard.mjs src/views/modules.mjs src/styles/app.css test/dashboard.test.mjs test/modules.test.mjs docs/superpowers/plans/2026-08-22-module-timetable-meal-visuals.md
git commit -m "feat: unify timetable and meal visuals"
git push origin main
```
