# 홈 대시보드 정렬 및 급식 일러스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 대시보드의 시간표 과목명을 가운데 정렬하고 급식 메뉴에 자동 선택되는 인라인 SVG 일러스트를 추가한다.

**Architecture:** `dashboard.mjs`에 메뉴 키워드→SVG 선택 로직과 전용 마크업을 추가하고, `app.css`에서 과목명과 급식 일러스트의 배치를 스타일링한다. 기존 상세 모듈과 API 데이터 구조는 변경하지 않는다.

**Tech Stack:** Vanilla ES modules, template-string HTML rendering, CSS, Node.js built-in test runner.

## Global Constraints

- 외부 이미지 URL, 네트워크 요청, 새 런타임 의존성을 추가하지 않는다.
- 메뉴 텍스트는 기존 `escapeHtml`을 거친다.
- SVG 일러스트는 `aria-hidden="true"`로 장식 처리한다.

---

### Task 1: 홈 대시보드 렌더링 및 스타일 수정

**Files:**
- Modify: `src/views/dashboard.mjs` — 메뉴 유형 선택과 홈 카드 마크업
- Modify: `src/styles/app.css` — 과목명 가운데 정렬 및 일러스트 레이아웃
- Test: `test/dashboard.test.mjs` — 렌더링 계약 검증

**Interfaces:**
- Consumes: NEIS `DDISH_NM` 메뉴 문자열과 기존 알레르기 매칭 결과
- Produces: `.timetable-preview__subject`, `.meal-item__illustration` DOM 훅

- [ ] **Step 1: Write the failing test**

`test/dashboard.test.mjs`의 홈 렌더링 테스트에 다음 계약을 추가한다.

```js
assert.match(sectionMarkup(container.innerHTML, 'timetable'), /class="timetable-preview__subject"/);
assert.match(sectionMarkup(container.innerHTML, 'meals'), /class="meal-item__illustration"/);
assert.match(sectionMarkup(container.innerHTML, 'meals'), /aria-hidden="true"/);
```

비빔밥·된장국 같은 메뉴를 사용해 유형별 SVG가 생성되는지도 확인한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="dashboard|meal"`

Expected: FAIL because the new DOM hooks do not exist.

- [ ] **Step 3: Write minimal implementation**

`dashboard.mjs`에 메뉴 유형을 판별하는 함수와 SVG 마크업 함수를 추가한다. `mealItemMarkup`은 기존 `<li>` 구조와 알레르기 경고를 유지하면서 메뉴 텍스트 앞에 일러스트를 삽입한다. 시간표 과목명 `<strong>`에는 `timetable-preview__subject` 클래스를 부여한다.

`app.css`에는 `.timetable-preview__subject`의 `text-align: center`와 `.meal-item`의 일러스트/텍스트 배치를 추가한다. 작은 화면에서도 메뉴 텍스트가 줄바꿈되고 SVG가 찌그러지지 않도록 `flex: 0 0 auto`와 `min-width: 0`을 사용한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="dashboard|meal"`

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-22-home-dashboard-alignment-meal-illustrations-design.md docs/superpowers/plans/2026-08-22-home-dashboard-alignment-meal-illustrations.md src/views/dashboard.mjs src/styles/app.css test/dashboard.test.mjs
git commit -m "feat: center timetable subjects and illustrate meals"
```
