# 홈 카드 순차 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 느린 일정 연동과 무관하게 시간표·식단 카드를 먼저 표시한다.

**Architecture:** `renderDashboard`가 공용 결과 상태를 먼저 카드별 로딩 상태로 그린다. 각 비동기 요청의 완료 콜백이 해당 결과 상태만 갱신하고 대시보드를 다시 렌더링하며, `ready`는 전체 요청이 끝날 때까지 유지한다.

**Tech Stack:** Vanilla JavaScript, Node.js 내장 테스트 러너.

## Global Constraints

- 시간표·식단·일정·개인 캘린더 요청은 동시에 시작한다.
- 먼저 끝난 카드의 실제 내용은 늦은 요청을 기다리지 않고 표시한다.
- 기존 API·캐시·날짜 이동·오류 화면은 유지한다.

---

### Task 1: 독립 요청 완료와 카드별 로딩 상태

**Files:**
- Modify: `test/dashboard.test.mjs`
- Modify: `src/views/dashboard.mjs`

**Interfaces:**
- Consumes: `renderDashboard(container, context)`, `fetchTimetable`, `fetchMeals`, `fetchSchedule`, `fetchCalendarEvents`
- Produces: 느린 일정 요청 중에도 완료된 시간표·식단을 렌더링하는 홈 대시보드

- [ ] **Step 1: Write the failing test**

```js
const schedule = createDeferred();
const view = renderDashboard(container, { services: { ...successfulServices(), fetchSchedule: () => schedule.promise } });
await new Promise((resolve) => setImmediate(resolve));
assert.match(sectionMarkup(container.innerHTML, 'timetable'), /국어/);
assert.match(sectionMarkup(container.innerHTML, 'meals'), /현미밥/);
schedule.resolve({ status: 'ok', rows: [] });
await view.ready;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/dashboard.test.mjs`

Expected: FAIL because the existing `Promise.all` waits for the delayed schedule before rendering any card result.

- [ ] **Step 3: Write minimal implementation**

```js
function settle(resource, request) {
  return Promise.resolve(request).then((result) => {
    results[resource] = result;
    renderCards();
    return result;
  });
}

await Promise.all([
  settle('timetable', timetableRequest),
  settle('meals', mealsRequest),
  settle('schedule', scheduleRequest),
  settle('calendar', calendarRequest)
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/dashboard.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/dashboard.mjs test/dashboard.test.mjs docs/superpowers/specs/2026-08-04-dashboard-progressive-loading-design.md docs/superpowers/plans/2026-08-04-dashboard-progressive-loading.md
git commit -m "feat: render dashboard cards as data arrives"
```
