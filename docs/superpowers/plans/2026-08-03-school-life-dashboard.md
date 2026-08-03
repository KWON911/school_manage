# 학교생활 대시보드 구현 계획

> 작업자 안내: 이 계획을 구현할 때는 superpowers:subagent-driven-development 또는 superpowers:executing-plans를 사용한다. 단계는 체크박스로 추적한다.

**목표:** 초·중·고 학생·학부모·교사가 역할에 맞는 학교생활 정보를 PC와 모바일에서 직관적으로 조회하는 반응형 대시보드를 만든다.

**구조:** 기존 단일 index.html을 진입 HTML과 브라우저 ES 모듈로 나눈다. 학교급 규칙·저장소·NEIS URL 생성은 순수 모듈과 Node 내장 테스트로 검증한다. main.js가 상태와 설정·대시보드·상세 화면 모듈을 연결한다.

**기술:** HTML, CSS, 브라우저 ES modules, Node.js node:test, Vercel Serverless Function, NEIS Open API, Pretendard webfont.

## 전역 제약

- 지원 학교급은 초등학교, 중학교, 고등학교만이다. 판별되지 않거나 지원하지 않는 학교는 시간표를 요청하지 않는다.
- 역할·학교·학년반·알레르기는 localStorage에만 저장한다. 로그인·서버 프로필·다자녀 관리는 추가하지 않는다.
- 모든 학교 데이터 요청은 /api/neis만 사용하며 API 키는 브라우저 코드에 넣지 않는다.
- PC 기준은 1920×1080, 콘텐츠 최대 폭은 1440px, 바깥 여백은 48px이다.
- 모바일은 360~767px 한 열과 고정 하단 메뉴를 사용하고, 터치 대상은 최소 44px이다.
- Pretendard를 기본 글꼴로 쓴다. 카드 12px, 주요 버튼 48~50px 알약 형태, 설계서의 크림·녹색 토큰을 사용한다.
- 모든 조작 요소는 의미 있는 HTML 요소이며 키보드 포커스가 보여야 한다.

---

## 파일 구조

| 경로 | 책임 |
| --- | --- |
| index.html | 앱 마운트 지점, Pretendard와 CSS/JS 진입점 |
| src/styles/tokens.css | 색상·글꼴·간격·그림자 토큰 |
| src/styles/app.css | 3열/태블릿/모바일 레이아웃과 공통 컴포넌트 |
| src/lib/school.js | 학교급 정규화, 학년 범위, 시간표 API 선택 |
| src/lib/storage.js | 사용자 설정 읽기·검증·저장·기존 키 마이그레이션 |
| src/lib/date.js | 날짜·월·주 이동과 오늘 비교 |
| src/services/neis.js | 프록시 요청과 NEIS 응답 정규화 |
| src/state/app-state.js | 상태 생성·변경·구독 |
| src/components.js | 탐색, 날짜 도구막대, 상태 안내 공통 마크업 |
| src/views/setup.js | 최초 역할·학교·학년반·알레르기 설정 |
| src/views/dashboard.js | 역할별 오늘 카드와 다가오는 일정 |
| src/views/modules.js | 일정·시간표·급식 상세 화면 |
| src/views/settings.js | 역할·학교·학년반·알레르기 통합 변경 |
| src/main.js | 초기화, 탐색 이벤트, 화면 렌더링 |
| api/neis.js | 허용 NEIS 엔드포인트 서버 프록시 |
| test/*.test.mjs | 순수 모듈과 프록시 정책 테스트 |
| package.json | node --test 실행 스크립트 |

## Task 1: 테스트 기반과 학교급 규칙

**Files:**
- Create: package.json
- Create: src/lib/school.js
- Create: test/school.test.mjs

**Interfaces:**
- Produces: normalizeSchoolKind(kind), getGradeOptions(kind), getTimetableEndpoint(kind), isSupportedSchoolKind(kind).
- Consumes: NEIS SCHUL_KND_SC_NM.

- [ ] **Step 1: 테스트 스크립트를 추가한다.**

    { "private": true, "scripts": { "test": "node --test" } }

- [ ] **Step 2: 먼저 실패 테스트를 작성한다.**

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import { getGradeOptions, getTimetableEndpoint, isSupportedSchoolKind } from '../src/lib/school.js';

    test('학교급별 시간표 API와 학년 범위를 선택한다', () => {
      assert.deepEqual(getGradeOptions('초등학교'), ['1', '2', '3', '4', '5', '6']);
      assert.deepEqual(getGradeOptions('중학교'), ['1', '2', '3']);
      assert.equal(getTimetableEndpoint('고등학교'), 'hisTimetable');
      assert.equal(isSupportedSchoolKind('특수학교'), false);
    });

- [ ] **Step 3: 실패를 확인한다.**

Run: npm test -- --test-name-pattern="학교급별"

Expected: ERR_MODULE_NOT_FOUND because src/lib/school.js does not exist.

- [ ] **Step 4: 최소 규칙을 구현한다.**

    const RULES = {
      초등학교: { endpoint: 'elsTimetable', grades: ['1', '2', '3', '4', '5', '6'] },
      중학교: { endpoint: 'misTimetable', grades: ['1', '2', '3'] },
      고등학교: { endpoint: 'hisTimetable', grades: ['1', '2', '3'] }
    };
    export const getGradeOptions = (kind) => RULES[kind]?.grades ?? [];
    export const getTimetableEndpoint = (kind) => RULES[kind]?.endpoint ?? null;
    export const isSupportedSchoolKind = (kind) => Boolean(RULES[kind]);

- [ ] **Step 5: 전체 테스트를 실행하고 커밋한다.**

Run: npm test

Expected: all tests pass.

    git add package.json src/lib/school.js test/school.test.mjs
    git commit -m "feat: add school-level timetable rules"

## Task 2: 설정 저장과 첫 방문 상태

**Files:**
- Create: src/lib/storage.js
- Create: test/storage.test.mjs

**Interfaces:**
- Produces: createEmptyProfile(), readProfile(storage), saveProfile(storage, profile), isProfileComplete(profile).
- Profile shape: { role, school, classSetting, allergies }.

- [ ] **Step 1: 설정 완료의 실패 테스트를 작성한다.**

    test('학교, 역할, 유효한 학년반이 모두 있어야 설정 완료다', () => {
      const profile = { role: 'parent', school: null, classSetting: { grade: '1', classNm: '1' }, allergies: [] };
      assert.equal(isProfileComplete(profile), false);
      profile.school = { name: '가람중학교', kind: '중학교', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '1' };
      assert.equal(isProfileComplete(profile), true);
    });

- [ ] **Step 2: 실패를 확인하고, 새 eduHub_profile 형식을 구현한다.**

Run: npm test -- --test-name-pattern="설정 완료"

Expected: ERR_MODULE_NOT_FOUND.

    export function createEmptyProfile() {
      return { role: null, school: null, classSetting: null, allergies: [] };
    }
    export function isProfileComplete(profile) {
      return Boolean(profile.role && profile.school?.kind && profile.classSetting?.grade && profile.classSetting?.classNm);
    }

기존 eduHub_school, eduHub_classSetting, eduHub_myAllergies는 한 번만 읽어 새 형식으로 옮긴다. 기존 학교에 학교급이 없으면 재선택을 요구한다. 기본 학교·기본 학년반은 만들지 않는다.

- [ ] **Step 3: 저장·마이그레이션·반 값 검증 테스트를 추가하고 통과시킨다.**

Run: npm test

Expected: 빈 문자열·0·음수 반은 불완전 상태이며, 구 키는 한 번만 마이그레이션된다.

- [ ] **Step 4: 커밋한다.**

    git add src/lib/storage.js test/storage.test.mjs
    git commit -m "feat: persist complete school profile"

## Task 3: NEIS 프록시와 데이터 서비스 확장

**Files:**
- Modify: api/neis.js:1-43
- Create: src/services/neis.js
- Create: test/neis-policy.test.mjs

**Interfaces:**
- Produces: searchSchools(query), fetchSchedule(school, yearMonth), fetchTimetable(school, classSetting, range), fetchMeals(school, yearMonth).
- Returns: { status: ok|no-data|network-error|server-error|unsupported-school-kind, rows }.

- [ ] **Step 1: 프록시 정책의 실패 테스트를 작성한다.**

    test('중·고등 시간표 엔드포인트만 추가로 허용한다', () => {
      assert.equal(isAllowedEndpoint('misTimetable'), true);
      assert.equal(isAllowedEndpoint('hisTimetable'), true);
      assert.equal(isAllowedEndpoint('unknownEndpoint'), false);
    });

- [ ] **Step 2: 실패를 확인한다.**

Run: npm test -- --test-name-pattern="중·고등"

Expected: policy helper import failure.

- [ ] **Step 3: api/neis.js 정책을 확장한다.**

ALLOWED_ENDPOINTS에 misTimetable, hisTimetable을 elsTimetable과 같은 파라미터 및 pSize 1000으로 추가한다. isAllowedEndpoint(endpoint), getAllowedParams(endpoint)를 내보내고 handler도 이를 사용한다. 임의 URL, 임의 파라미터, 브라우저 API 키 전달은 허용하지 않는다.

- [ ] **Step 4: 시간표 URL의 실패 테스트를 작성한다.**

    test('중학교는 misTimetable 프록시 URL을 만든다', () => {
      const url = buildTimetableUrl({ kind: '중학교', ATPT_OFCDC_SC_CODE: 'B10', SD_SCHUL_CODE: '2' }, { grade: '2', classNm: '3' }, '20260801', '20260831');
      assert.match(url, /endpoint=misTimetable/);
      assert.match(url, /GRADE=2/);
    });

- [ ] **Step 5: 브라우저 데이터 서비스를 구현한다.**

모든 요청은 fetch('/api/neis?...')로 만든다. 지원하지 않는 학교급은 네트워크 요청 없이 unsupported-school-kind를 반환한다. 검색 결과는 { name, kind, area, address, ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE }로 정규화하고, 검색·일정·시간표·급식을 원인별 상태로 변환한다.

- [ ] **Step 6: 테스트를 통과시키고 커밋한다.**

Run: npm test

Expected: all tests pass; generated URLs never contain KEY=.

    git add api/neis.js src/services/neis.js test/neis-policy.test.mjs
    git commit -m "feat: support middle and high school timetables"

## Task 4: 앱 셸과 반응형 디자인

**Files:**
- Modify: index.html:1-1060
- Create: src/styles/tokens.css
- Create: src/styles/app.css
- Create: src/components.js
- Create: src/state/app-state.js
- Create: src/main.js

**Interfaces:**
- Produces: mountApp(container), renderAppShell(container), renderNavigation(activeView), renderStatusMessage(state).
- Views: home, schedule, timetable, meals, settings.

- [ ] **Step 1: 인라인 앱을 ES 모듈 진입점으로 바꾼다.**

index.html에는 #app, Pretendard, 두 CSS 파일, type=module인 src/main.js만 남긴다. 기존 인라인 CSS·정적 화면·onclick·NEIS 요청 가로채기·NEIS_KEY 선언을 제거한다.

- [ ] **Step 2: 토큰과 보이는 포커스를 구현한다.**

    :root {
      --canvas: #F4F1EA; --green: #006241; --action: #00754A; --deep: #1E3932;
      --mint: #D4E9E2; --surface: #FFFFFF; --danger: #C82014; --notice: #CBA258;
      --radius-card: 12px; --control-height: 48px; --content-max: 1440px;
      font-family: Pretendard, system-ui, sans-serif;
    }
    :focus-visible { outline: 3px solid var(--action); outline-offset: 3px; }

- [ ] **Step 3: 세 가지 화면 폭의 셸을 구현한다.**

1920px에서 220px minmax(0, 1fr) 320px 3열과 1440px 최대 폭을 쓴다. 768~1199px에서는 탐색을 접고 2열 또는 1열로, 767px 이하에서는 한 열과 고정 하단 5개 메뉴로 바꾼다. 메뉴는 아이콘+텍스트 button과 갱신되는 aria-current="page"를 사용한다.

- [ ] **Step 4: 정적 셸을 화면 크기별로 확인한다.**

Run: python -m http.server 4173

Expected: 1920×1080은 1440px 3열, 390×844는 하단 메뉴가 있는 한 열이며 가로 스크롤이 없다.

- [ ] **Step 5: 커밋한다.**

    git add index.html src/styles src/components.js src/state/app-state.js src/main.js
    git commit -m "feat: build responsive school dashboard shell"

## Task 5: 최초 설정과 내 설정

**Files:**
- Create: src/views/setup.js
- Create: src/views/settings.js
- Modify: src/main.js
- Modify: src/components.js

**Interfaces:**
- Produces: renderSetup(container, context), renderSettings(container, context).
- Emits: profile-complete, profile-updated with a validated profile.

- [ ] **Step 1: 첫 설정을 의미 있는 폼으로 구현한다.**

역할은 라디오 버튼 세 개, 학교 검색은 연결된 label·입력·버튼, 검색 결과는 button 목록으로 만든다. 결과에는 이름·학교급·교육청 지역·주소를 표시한다. 빈 검색어는 “학교명을 입력해 주세요.”를 바로 아래에 표시한다.

- [ ] **Step 2: 학교급에 따라 학년 선택을 바꾼다.**

    gradeSelect.replaceChildren(...getGradeOptions(selectedSchool.kind).map((grade) => {
      const option = document.createElement('option');
      option.value = grade; option.textContent = grade + '학년';
      return option;
    }));

학교가 바뀌면 학년반을 비운다. 반은 1 이상 정수여야 하며, 잘못된 값은 인라인 오류로 설명하고 저장하지 않는다.

- [ ] **Step 3: 알레르기와 완료 동작을 구현한다.**

알레르기는 체크박스 또는 aria-pressed 버튼으로 선택한다. “나중에 설정”은 빈 배열을 저장한다. 설정 저장은 isProfileComplete일 때만 홈으로 이동한다.

- [ ] **Step 4: 내 설정에서 네 항목을 모두 바꾸게 한다.**

역할·학교·학년반·알레르기를 같은 화면의 독립 섹션으로 제공한다. 저장 성공은 항상 “설정을 저장했어요.”라고 알리고, 학교 변경 시 캐시를 비운다.

- [ ] **Step 5: 검증하고 커밋한다.**

Expected: 초등은 1~6학년, 중·고등은 1~3학년만 선택된다. 미완료 상태에서는 데이터 대시보드가 열리지 않는다.

    git add src/views/setup.js src/views/settings.js src/main.js src/components.js
    git commit -m "feat: add guided profile setup and settings"

## Task 6: 역할별 홈 대시보드와 상태 안내

**Files:**
- Create: src/views/dashboard.js
- Create: test/dashboard.test.mjs
- Modify: src/main.js
- Modify: src/styles/app.css

**Interfaces:**
- Produces: getDashboardSections(role), renderDashboard(container, context).
- Consumes: profile와 상태가 정규화된 일정·시간표·급식 결과.

- [ ] **Step 1: 역할별 카드 순서의 실패 테스트를 작성한다.**

    test('교사는 시간표, 일정, 다가오는 일정을 우선한다', () => {
      assert.deepEqual(getDashboardSections('teacher'), ['timetable', 'schedule', 'upcoming']);
    });

- [ ] **Step 2: 실패를 확인하고 최소 함수를 구현한다.**

Run: npm test -- --test-name-pattern="교사는"

Expected: ERR_MODULE_NOT_FOUND.

학생은 ['timetable', 'meals', 'upcoming'], 학부모는 ['child-class', 'meals', 'upcoming'], 교사는 ['timetable', 'schedule', 'upcoming'] 순서를 반환하게 한다.

- [ ] **Step 3: 역할별 오늘 카드를 구현한다.**

학생은 다음 수업/오늘 시간표, 학부모는 자녀 학급과 알레르기 급식, 교사는 선택 학급 시간표와 오늘 일정을 먼저 보인다. 카드 하나에는 시간표·급식·일정 중 하나의 이동 버튼만 둔다.

- [ ] **Step 4: 원인별 상태를 구현한다.**

no-data는 “이 날짜의 시간표가 아직 등록되지 않았습니다.”와 학년·반 바꾸기, network-error는 재시도, unsupported-school-kind는 지원 범위 안내를 보인다. 알레르기 카드에는 NEIS 표기 참고 정보와 학교 확인 안내를 넣는다.

- [ ] **Step 5: 테스트·반응형 검증 후 커밋한다.**

Run: npm test

Expected: all tests pass; 390px에서 역할별 첫 두 카드가 다가오는 일정보다 먼저 보인다.

    git add src/views/dashboard.js test/dashboard.test.mjs src/main.js src/styles/app.css
    git commit -m "feat: add role-aware daily dashboard"

## Task 7: 일정·시간표·급식 상세 화면 일관화

**Files:**
- Create: src/views/modules.js
- Modify: src/services/neis.js
- Modify: src/main.js
- Modify: src/styles/app.css

**Interfaces:**
- Produces: renderScheduleModule, renderTimetableModule, renderMealsModule.
- Consumes: active date, selected view, normalized service result.

- [ ] **Step 1: 공통 날짜 도구막대를 구현한다.**

일정·시간표·급식에 이전, 선택 날짜, 다음, 오늘 버튼을 같은 순서와 문구로 넣는다. 오늘 버튼은 현재 날짜로 이동하고 데이터를 다시 요청한다.

- [ ] **Step 2: 일정을 구현한다.**

목록/달력은 button role="tab"으로 전환한다. 목록은 날짜·행사명·대상 학년을, 달력은 선택 날짜의 상세 목록을 표시한다. 금색은 중요 일정에만 쓴다.

- [ ] **Step 3: 시간표를 구현한다.**

날짜별/주간 보기 전환을 구현한다. 767px 이하의 주간표는 가로 표가 아닌 요일별 카드 묶음으로 바꾼다. 미설정·미지원 상태에는 해당 내 설정 섹션으로 이동하는 버튼을 제공한다.

- [ ] **Step 4: 급식을 구현한다.**

날짜별/달력 보기를 구현한다. 선택 알레르기와 NEIS 메뉴 번호를 비교해 경고하며, 색뿐 아니라 텍스트·아이콘으로도 전달한다.

- [ ] **Step 5: 키보드·반응형 검증 후 커밋한다.**

Expected: 날짜 이동, 오늘, 보기 전환, 달력 날짜 선택을 마우스·키보드 모두로 할 수 있고 390px 전체 페이지에는 가로 스크롤이 없다.

    git add src/views/modules.js src/services/neis.js src/main.js src/styles/app.css
    git commit -m "feat: unify school information modules"

## Task 8: 회귀·접근성·배포 검증

**Files:**
- Modify: README.md
- Modify: test/school.test.mjs
- Modify: test/storage.test.mjs
- Modify: test/neis-policy.test.mjs
- Modify: test/dashboard.test.mjs

- [ ] **Step 1: 자동 테스트를 모두 실행한다.**

Run: npm test

Expected: 학교급 규칙, 저장소 마이그레이션, 프록시 정책, 역할별 카드 순서 테스트가 통과한다.

- [ ] **Step 2: 접근성 수동 검증을 한다.**

첫 설정·홈·일정·시간표·급식·내 설정에서 Tab/Shift+Tab/Enter/Space를 사용한다. 포커스가 보여야 하며, 모달은 열릴 때 포커스를 받고 닫으면 여는 버튼으로 돌아가야 한다. 아이콘 전용 버튼에는 aria-label이 필요하다.

- [ ] **Step 3: 화면 크기별 시각 검증을 한다.**

1920×1080, 1024×768, 768×1024, 390×844에서 캡처한다. 1920px에는 1440px 3열, 390px에는 고정 하단 메뉴·한 열·가로 스크롤 없음이 확인돼야 한다.

- [ ] **Step 4: Vercel과 실제 NEIS 흐름을 검증한다.**

Production·Preview·Development에 NEIS_API_KEY가 설정되어 있는지 확인한다. 초·중·고에서 학교 검색, 일정, 급식, 시간표를 한 번씩 조회하고 브라우저 요청에 KEY가 없는지 확인한다.

- [ ] **Step 5: README를 한국어로 갱신하고 커밋한다.**

README에 지원 학교급, 기기 저장 기반 역할 설정, npm test, NEIS 키 설정, Vercel 배포 뒤 검증 항목을 추가한다.

    git add README.md test
    git commit -m "docs: document responsive school dashboard"

## 계획 자체 점검

- 역할별 홈, 초·중·고 시간표, 통합 설정, 반응형 구조, Pretendard·색상 토큰, 오류 안내, 접근성, 프록시 보안은 Task 1~8에 모두 매핑했다.
- 구현 미정 항목이나 모호한 오류 처리 문구를 남기지 않았다.
- getTimetableEndpoint, isProfileComplete, fetchTimetable, renderDashboard는 같은 이름과 책임으로 전 작업에서 사용한다.
