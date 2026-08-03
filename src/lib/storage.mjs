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

function normalizeSchool(school) {
  if (!school || typeof school !== 'object' || !nonEmptyString(school.kind)) return null;
  return school;
}

function normalizeClassSetting(classSetting) {
  if (!classSetting || typeof classSetting !== 'object') return null;
  if (!nonEmptyString(classSetting.grade) || !nonEmptyString(classSetting.classNm)) return null;
  return classSetting;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;

  return {
    role: nonEmptyString(profile.role),
    school: normalizeSchool(profile.school),
    classSetting: normalizeClassSetting(profile.classSetting),
    allergies: Array.isArray(profile.allergies) ? profile.allergies : []
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
  const savedProfile = readJson(storage, PROFILE_KEY);
  if (savedProfile !== null) return normalizeProfile(savedProfile) ?? createEmptyProfile();
  return migrateLegacyProfile(storage);
}
