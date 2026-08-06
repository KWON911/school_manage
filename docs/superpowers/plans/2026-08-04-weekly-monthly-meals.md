# Weekly and Monthly Meals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace date-based meal browsing with a weekly default view and a monthly calendar view.

**Architecture:** Keep one anchor `selectedDate` in the meals module. The active mode determines whether navigation changes the anchor by a week or a month, and renders either five weekday meal cards or the existing monthly calendar and selected-day detail.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node.js built-in test runner.

## Global Constraints

- The weekly view contains Monday through Friday only.
- Weekly navigation reads `이전 주`, `다음 주`, and returns with `이번 주`.
- Monthly navigation reads `이전 달`, `다음 달`, and returns with `이번 달`.
- Preserve exact-number allergy highlighting in both modes.

---

### Task 1: Add weekly meal rendering and mode-specific navigation

**Files:**
- Modify: `src/views/modules.mjs`
- Test: `test/modules.test.mjs`

**Interfaces:**
- Produces: the `week` and `month` meal modes, `weeklyMealCards(days, rows, allergies)`, and a mode-aware `dateToolbar(date, kind, mode)`.

- [ ] **Step 1: Write failing tests**

```js
assert.match(container.innerHTML, /data-mode="week"[^>]*aria-selected="true"/);
assert.match(container.innerHTML, /이전 주[\s\S]*이번 주[\s\S]*다음 주/);
assert.match(container.innerHTML, /2026년 8월 3일[\s\S]*2026년 8월 7일/);
```

- [ ] **Step 2: Verify the new tests fail**

Run: `node --test test/modules.test.mjs`

- [ ] **Step 3: Implement the minimum behavior**

```js
const weeklyDays = schoolWeek(selectedDate);
const weeklyRows = weeklyDays.map((day) => rows.filter((row) => row.MLSV_YMD === dateKey(day)));
```

Render every `weeklyDays` item as a date heading and either `mealCards(weeklyRows[index], allergies)` or its existing empty state. Use `moveMonth` only in `month` mode and add/subtract seven days in `week` mode.

- [ ] **Step 4: Verify the meal module tests pass**

Run: `node --test test/modules.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/views/modules.mjs test/modules.test.mjs
git commit -m "feat: browse meals by week and month"
```

### Task 2: Make weekly and monthly meal layouts responsive

**Files:**
- Modify: `src/styles/app.css`
- Test: `test/modules.test.mjs`

**Interfaces:**
- Consumes: `.meal-week-list`, `.meal-week-day`, and the existing `.module-date-toolbar`.

- [ ] **Step 1: Write a failing CSS behavior test**

```js
assert.match(css, /\.meal-week-list\s*\{[\s\S]*display:\s*grid/);
assert.match(css, /\.module-date-toolbar--compact/);
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test test/modules.test.mjs`

- [ ] **Step 3: Add the responsive layout**

```css
.meal-week-list { display: grid; gap: 12px; }
.meal-week-day { padding: 18px; border: 1px solid var(--line); border-radius: 12px; }
```

Keep the three navigation controls on one row where possible and allow the center period button to shrink without overlapping at mobile widths.

- [ ] **Step 4: Verify the meal module tests pass**

Run: `node --test test/modules.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css test/modules.test.mjs
git commit -m "style: support responsive weekly meal browsing"
```

### Task 3: Verify the feature

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-weekly-monthly-meals-design.md`
- Modify: `docs/superpowers/plans/2026-08-04-weekly-monthly-meals.md`

- [ ] **Step 1: Run all tests**

Run: `node --test`

- [ ] **Step 2: Check whitespace**

Run: `git diff --check`

- [ ] **Step 3: Commit documentation and final implementation**

```bash
git add docs/superpowers/specs/2026-08-04-weekly-monthly-meals-design.md docs/superpowers/plans/2026-08-04-weekly-monthly-meals.md
git commit -m "docs: define weekly and monthly meal browsing"
```
