import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSchoolInfoDetailUrl,
  buildSchoolInfoSearchUrl,
  resolveSchoolInfoUrl
} from '../src/lib/schoolinfo.mjs';

test('builds a detail URL from a trimmed non-empty school-info ID', () => {
  assert.equal(
    buildSchoolInfoDetailUrl(' SCH-123 '),
    'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
  );
  assert.equal(buildSchoolInfoDetailUrl('   '), null);
  assert.equal(buildSchoolInfoDetailUrl(null), null);
});

test('builds a safely encoded Schoolinfo search URL from a trimmed school name', () => {
  assert.equal(
    buildSchoolInfoSearchUrl(' 서울 & 부산 초등학교 '),
    'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_NM=%EC%84%9C%EC%9A%B8%20%26%20%EB%B6%80%EC%82%B0%20%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90'
  );
});

test('resolves an existing school-info URL before ID and name fallbacks', () => {
  assert.equal(
    resolveSchoolInfoUrl({
      schoolInfoUrl: ' https://school.example/details ',
      schoolInfoId: 'SCH-123',
      name: '서울초등학교'
    }),
    'https://school.example/details'
  );
});

test('resolves a detail URL from an ID before falling back to a name search', () => {
  assert.equal(
    resolveSchoolInfoUrl({ schoolInfoUrl: ' ', schoolInfoId: ' SCH-123 ', name: '서울초등학교' }),
    'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_IDF_CD=SCH-123'
  );
  assert.equal(
    resolveSchoolInfoUrl({ schoolInfoId: ' ', name: ' 서울 초등학교 ' }),
    'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do?SHL_NM=%EC%84%9C%EC%9A%B8%20%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90'
  );
});

test('returns null when a school cannot provide a non-empty name', () => {
  assert.equal(resolveSchoolInfoUrl(null), null);
  assert.equal(resolveSchoolInfoUrl({}), null);
  assert.equal(resolveSchoolInfoUrl({ name: '   ' }), null);
});
