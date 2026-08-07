const DETAIL_URL = 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_b01_s0.do';
const SEARCH_URL = 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_f01_l0.do';

const normalizeNonEmptyString = (value) => (
  typeof value === 'string' ? value.trim() || null : null
);

export const buildSchoolInfoDetailUrl = (id) => {
  const normalizedId = normalizeNonEmptyString(id);
  return normalizedId ? `${DETAIL_URL}?SHL_IDF_CD=${encodeURIComponent(normalizedId)}` : null;
};

export const buildSchoolInfoSearchUrl = (name) => {
  const normalizedName = normalizeNonEmptyString(name) ?? '';
  const query = new URLSearchParams({
    SEARCH_KEYWORD: normalizedName,
    SEARCH_SCHUL_NM: normalizedName
  });
  return `${SEARCH_URL}?${query}`;
};

const verifiedSchoolInfoUrl = (value) => {
  const normalizedUrl = normalizeNonEmptyString(value);
  if (!normalizedUrl) return null;

  try {
    const parsed = new URL(normalizedUrl);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'schoolinfo.go.kr' || parsed.hostname.endsWith('.schoolinfo.go.kr'))
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
};

export const resolveSchoolInfoUrl = (school) => {
  if (!school || typeof school !== 'object') return null;

  const schoolInfoUrl = verifiedSchoolInfoUrl(school.schoolInfoUrl);
  if (schoolInfoUrl) return schoolInfoUrl;

  const detailUrl = buildSchoolInfoDetailUrl(school.schoolInfoId);
  if (detailUrl) return detailUrl;

  const name = normalizeNonEmptyString(school.name);
  return name ? buildSchoolInfoSearchUrl(name) : null;
};
