# Meal Allergy Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Highlight each meal that matches an allergy saved in the user's profile on both the dashboard and meal detail views.

**Architecture:** Add one shared, exact-number matcher for an individual dish in the NEIS service layer. The dashboard and meals module will render a semantic warning modifier only for dishes whose numbers intersect the saved profile allergies, while keeping the existing summary warning.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node.js built-in test runner.

## Global Constraints

- Match only complete NEIS allergy numbers in a dish's parenthesized notation.
- Do not change non-matching menu content or existing data-fetch behavior.
- Provide icon and text alongside color-based emphasis.
- Apply identical meaning in dashboard and full meal views.

---

### Task 1: Expose exact per-dish allergy matching

**Files:**
- Modify: `src/services/neis.mjs`
- Test: `test/neis-policy.test.mjs`

**Interfaces:**
- Produces: `dishMatchesAllergies(dish, allergies)`, returning matched allergy ids as strings in numeric order.
- Consumes: `allergies` from the saved profile and NEIS dish text such as `계란찜(1.)`.

- [ ] **Step 1: Write the failing test**

```js
assert.deepEqual(dishMatchesAllergies('계란찜(1.)', ['1', '6']), ['1']);
assert.deepEqual(dishMatchesAllergies('소시지(11.)', ['1']), []);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/neis-policy.test.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
export function dishMatchesAllergies(dish, allergies = []) {
  const labels = String(dish ?? '').match(/\(([^)]*)\)/g) ?? [];
  const available = new Set(labels.flatMap((label) => label.match(/\d+/g) ?? []));
  return [...new Set(allergies.map(String))].filter((id) => available.has(id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/neis-policy.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/services/neis.mjs test/neis.test.mjs
git commit -m "feat: match allergy numbers per meal dish"
```

### Task 2: Render and style warning dishes in home and meal detail views

**Files:**
- Modify: `src/views/dashboard.mjs`
- Modify: `src/views/modules.mjs`
- Modify: `src/styles/app.css`
- Test: `test/dashboard.test.mjs`
- Test: `test/modules.test.mjs`

**Interfaces:**
- Consumes: `dishMatchesAllergies(dish, allergies)`.
- Produces: `.meal-item--allergy` menu markup with a warning icon and matched-number text.

- [ ] **Step 1: Write the failing tests**

```js
assert.match(container.innerHTML, /meal-item--allergy[\s\S]*계란찜\(1\.\)[\s\S]*알레르기 1번 포함/);
assert.doesNotMatch(container.innerHTML, /meal-item--allergy[\s\S]*소시지\(11\.\)/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/dashboard.test.mjs test/modules.test.mjs`

- [ ] **Step 3: Write minimal rendering and CSS**

```js
const matched = dishMatchesAllergies(dish, allergies);
return `<li class="meal-item${matched.length ? ' meal-item--allergy' : ''}">${escapeHtml(dish)}${matched.length ? `<span>알레르기 ${matched.join(', ')}번 포함</span>` : ''}</li>`;
```

```css
.meal-item--allergy { border-color: var(--warning); background: var(--warning-soft); }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/dashboard.test.mjs test/modules.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add src/views/dashboard.mjs src/views/modules.mjs src/styles/app.css test/dashboard.test.mjs test/modules.test.mjs
git commit -m "feat: highlight allergy-matched meal dishes"
```

### Task 3: Verify the complete feature

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-meal-allergy-highlight-design.md`
- Modify: `docs/superpowers/plans/2026-08-04-meal-allergy-highlight.md`

- [ ] **Step 1: Run the full test suite**

Run: `node --test`

- [ ] **Step 2: Check whitespace errors**

Run: `git diff --check`

- [ ] **Step 3: Commit the approved documentation and verification result**

```bash
git add docs/superpowers/specs/2026-08-04-meal-allergy-highlight-design.md docs/superpowers/plans/2026-08-04-meal-allergy-highlight.md
git commit -m "docs: define meal allergy highlighting"
```
