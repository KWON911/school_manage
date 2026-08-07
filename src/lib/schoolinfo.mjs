const DETAIL_URL = 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do';

const normalizeNonEmptyString = (value) => (
  typeof value === 'string' ? value.trim() || null : null
);

export const buildSchoolInfoDetailUrl = (id) => {
  const normalizedId = normalizeNonEmptyString(id);
  return normalizedId ? `${DETAIL_URL}?SHL_IDF_CD=${encodeURIComponent(normalizedId)}` : null;
};

export const buildSchoolInfoSearchUrl = (name) => (
  `${DETAIL_URL}?SHL_NM=${encodeURIComponent(normalizeNonEmptyString(name) ?? '')}`
);

export const resolveSchoolInfoUrl = (school) => {
  if (!school || typeof school !== 'object') return null;

  const schoolInfoUrl = normalizeNonEmptyString(school.schoolInfoUrl);
  if (schoolInfoUrl) return schoolInfoUrl;

  const detailUrl = buildSchoolInfoDetailUrl(school.schoolInfoId);
  if (detailUrl) return detailUrl;

  const name = normalizeNonEmptyString(school.name);
  return name ? buildSchoolInfoSearchUrl(name) : null;
};
