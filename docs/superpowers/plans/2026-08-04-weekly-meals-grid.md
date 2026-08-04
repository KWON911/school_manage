# 주별 급식 5열 레이아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱의 주별 급식을 월~금 5열로 표시하고 기간 버튼의 대비를 개선한다.

**Architecture:** `src/styles/app.css`에서 주별 급식 컨테이너의 그리드와 반응형 전환만 변경한다. 급식 렌더링·조회·이동 로직은 그대로 두며, `test/modules.test.mjs`가 스타일 규칙을 회귀 검증한다.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js 내장 테스트 러너.

## Global Constraints

- 데스크톱은 월~금 5열, 모바일은 1열 요일 카드다.
- 현재 기간 버튼은 초록 배경과 흰색 글자를 사용한다.
- 기존 급식 데이터, 알레르기 강조, 주/월 이동 로직은 변경하지 않는다.

---

### Task 1: 주별 급식의 반응형 그리드와 기간 버튼 대비

**Files:**
- Modify: `test/modules.test.mjs`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `.meal-week-list`, `.module-date-toolbar--compact`, `@media (max-width: 767px)` CSS 선택자
- Produces: 데스크톱 5열/모바일 1열 주별 급식 레이아웃과 흰색 현재 기간 텍스트

- [ ] **Step 1: Write the failing test**

```js
assert.match(css, /\.meal-week-list\s*\{[^}]*grid-template-columns:\s*repeat\(5,/);
assert.match(mobileRules, /\.meal-week-list\s*\{[^}]*grid-template-columns:\s*1fr/);
assert.match(css, /\.module-date-toolbar--compact \[data-date-action="today"\] time\s*\{[^}]*color:\s*var\(--surface\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/modules.test.mjs`

Expected: FAIL because the desktop 5열과 현재 기간 글자색 규칙이 아직 없다.

- [ ] **Step 3: Write minimal implementation**

```css
.meal-week-list { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.module-date-toolbar--compact [data-date-action="today"] time { color: var(--surface); }
@media (max-width: 767px) { .meal-week-list { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/modules.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css test/modules.test.mjs docs/superpowers/specs/2026-08-04-weekly-meals-grid-design.md docs/superpowers/plans/2026-08-04-weekly-meals-grid.md
git commit -m "style: arrange weekly meals by weekday"
```
