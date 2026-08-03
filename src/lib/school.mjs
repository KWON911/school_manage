const RULES = {
  초등학교: { endpoint: 'elsTimetable', grades: ['1', '2', '3', '4', '5', '6'] },
  중학교: { endpoint: 'misTimetable', grades: ['1', '2', '3'] },
  고등학교: { endpoint: 'hisTimetable', grades: ['1', '2', '3'] }
};

export const normalizeSchoolKind = (kind) => (
  typeof kind === 'string' ? kind.trim() || null : null
);

export const getGradeOptions = (kind) => RULES[normalizeSchoolKind(kind)]?.grades ?? [];
export const getTimetableEndpoint = (kind) => RULES[normalizeSchoolKind(kind)]?.endpoint ?? null;
export const isSupportedSchoolKind = (kind) => Boolean(RULES[normalizeSchoolKind(kind)]);
