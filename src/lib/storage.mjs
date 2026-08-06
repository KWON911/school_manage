const PROFILE_KEY = 'eduHub_profile';
const LEGACY_KEYS = {
  school: 'eduHub_school',
  classSetting: 'eduHub_classSetting',
  allergies: 'eduHub_myAllergies'
};

export function createEmptyProfile() {
  return { role: null, school: null, classSetting: null, allergies: [] };
}

function readJson(storage, key) {
  const value = storage?.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isPositiveInteger(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function normalizeSchool(school) {
  if (!school || typeof school !== 'object' || !nonEmptyString(school.kind)) return null;
  return school;
}

function normalizeClassSetting(classSetting) {
  if (!classSetting || typeof classSetting !== 'object') return null;
  if (!isPositiveInteger(classSetting.grade) || !isPositiveInteger(classSetting.classNm)) return null;
  return classSetting;
}

function normalizeCalendarIds(calendarIds) {
  return [...new Set((Array.isArray(calendarIds) ? calendarIds : [])
    .filter((id) => typeof id === 'string' && id.trim())
    .map((id) => id.trim()))];
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;

  return {
    role: nonEmptyString(profile.role),
    school: normalizeSchool(profile.school),
    classSetting: normalizeClassSetting(profile.classSetting),
    allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
    ...(Array.isArray(profile.calendarIds) ? { calendarIds: normalizeCalendarIds(profile.calendarIds) } : {})
  };
}

export function isProfileComplete(profile) {
  const normalized = normalizeProfile(profile);
  return Boolean(
    normalized?.role &&
    normalized.school?.kind &&
    normalized.classSetting?.grade &&
    normalized.classSetting?.classNm
  );
}

export function saveProfile(storage, profile) {
  const normalized = normalizeProfile(profile) ?? createEmptyProfile();
  storage?.setItem(PROFILE_KEY, JSON.stringify(normalized));
  return normalized;
}

function migrateLegacyProfile(storage) {
  const legacySchool = readJson(storage, LEGACY_KEYS.school);
  const legacyClassSetting = readJson(storage, LEGACY_KEYS.classSetting);
  const legacyAllergies = readJson(storage, LEGACY_KEYS.allergies);
  const hasLegacyProfile = Object.values(LEGACY_KEYS)
    .some((key) => storage?.getItem(key) !== null);
  if (!hasLegacyProfile) return createEmptyProfile();

  const profile = {
    role: null,
    school: normalizeSchool(legacySchool),
    classSetting: normalizeClassSetting(legacyClassSetting),
    allergies: legacyAllergies
  };
  return saveProfile(storage, profile);
}

export function readProfile(storage) {
  if (storage?.getItem(PROFILE_KEY) !== null) {
    return normalizeProfile(readJson(storage, PROFILE_KEY)) ?? createEmptyProfile();
  }
  return migrateLegacyProfile(storage);
}
