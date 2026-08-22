# 홈 대시보드 카드 액션 재배치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 대시보드의 세 개 전체 보기 액션을 카드 하단의 전체 너비 버튼에서 카드 헤더 오른쪽의 컴팩트 액션으로 이동한다.

**Architecture:** 기존 `action(view, label)`이 만드는 버튼의 동작은 유지하고, 정상 데이터 카드의 헤더 안으로 렌더링 위치만 옮긴다. 로딩 상태에는 액션을 넣지 않고 오류 상태의 다시 시도 버튼은 기존 본문 위치에 남긴다. CSS는 헤더를 양끝 정렬하는 레이아웃과 모바일 줄바꿈을 담당한다.

**Tech Stack:** Vanilla ES modules, template-string HTML rendering, CSS, Node.js built-in test runner.

## Global Constraints

- 액션의 `data-view` 값과 라벨은 유지한다.
- 기존 버튼 요소, 키보드 포커스, 최소 44px 터치 높이를 유지한다.
- 상세 모듈과 전역 내비게이션은 변경하지 않는다.
- 외부 의존성과 네트워크 요청은 추가하지 않는다.

---

### Task 1: 카드 헤더 액션 위치 변경

**Files:**
- Modify: `src/views/dashboard.mjs` — 정상 시간표·급식·일정 카드의 액션 마크업 위치
- Modify: `src/styles/app.css` — 헤더 정렬, 컴팩트 액션, 모바일 줄바꿈
- Test: `test/dashboard.test.mjs` — 액션 위치와 상태별 렌더링 계약

**Interfaces:**
- Consumes: 기존 `action(view, label)` 및 카드별 정상/로딩/오류 렌더링 상태
- Produces: `.dashboard-card__heading-row`와 `.dashboard-card__heading-action` DOM 훅

- [ ] **Step 1: Write the failing test**

정상 데이터 대시보드 테스트에서 각 카드의 `.dashboard-card__heading-action` 존재와 카드 본문 직계 하단의 기존 액션 부재를 검증한다. 로딩 상태 테스트에서는 헤더 액션이 없고, 오류 상태 테스트에서는 `data-action="retry-dashboard"`가 계속 존재하는지 확인한다.

```js
const timetable = sectionMarkup(container.innerHTML, 'timetable');
const meals = sectionMarkup(container.innerHTML, 'meals');
const upcoming = sectionMarkup(container.innerHTML, 'upcoming');
assert.match(timetable, /dashboard-card__heading-action[\s\S]*시간표 전체 보기/);
assert.match(meals, /dashboard-card__heading-action[\s\S]*급식 자세히 보기/);
assert.match(upcoming, /dashboard-card__heading-action[\s\S]*일정 전체 보기/);
assert.doesNotMatch(timetable, /<button class="dashboard-card__action"[^>]*>시간표 전체 보기/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="dashboard"`

Expected: FAIL because normal cards currently render full-width actions after their content and have no heading-action hook.

- [ ] **Step 3: Write minimal implementation**

`dashboard.mjs`에서 정상 시간표 카드의 heading을 다음 구조로 감싼다.

```html
<div class="dashboard-card__heading-row">
  <div class="dashboard-card__heading-copy">기존 eyebrow와 h2</div>
  <button class="dashboard-card__action dashboard-card__heading-action" ...>시간표 전체 보기</button>
</div>
```

급식 정상 카드와 일정 정상 카드에도 같은 구조를 사용한다. 로딩·오류 카드의 heading은 그대로 두고, 정상 카드 본문에서 기존 `${action(...)}` 출력을 제거한다. 오류 카드의 `${retryAction(...)}`은 유지한다.

`app.css`에 `.dashboard-card__heading-row`를 `display: flex`, `align-items: flex-start`, `justify-content: space-between`, `gap`과 `flex-wrap`으로 정의한다. `.dashboard-card__heading-action`은 `width: auto`, `min-height: 44px`, `margin-top: -6px`, `padding-inline`을 사용해 텍스트 액션처럼 보이게 한다. 모바일에서는 `align-items: baseline`과 `margin-top: 4px`를 적용해 제목 아래 오른쪽으로 자연스럽게 내려가도록 한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="dashboard"`

Expected: PASS, including normal, loading, error, retry, and touch-target tests.

- [ ] **Step 5: Run the full test suite and diff checks**

Run: `npm test; git diff --check`

Expected: all tests pass with zero failures and no whitespace errors.

- [ ] **Step 6: Commit**

```bash
git add -- src/views/dashboard.mjs src/styles/app.css test/dashboard.test.mjs docs/superpowers/plans/2026-08-22-dashboard-card-actions.md
git commit -m "feat: move dashboard card actions into headers"
```
