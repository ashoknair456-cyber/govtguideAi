/**
 * GovtGuide AI — Low-Internet Mode & Offline Cache Helper (F18)
 */

const SCHEMES_CACHE_KEY = 'govguide_offline_schemes';
const CACHE_TIME_KEY = 'govguide_offline_timestamp';

export function saveSchemesToOfflineCache(schemes) {
  try {
    if (schemes && schemes.length > 0) {
      localStorage.setItem(SCHEMES_CACHE_KEY, JSON.stringify(schemes));
      localStorage.setItem(CACHE_TIME_KEY, new Date().toISOString());
    }
  } catch (e) {
    console.warn('Could not save to localStorage offline cache', e);
  }
}

export function getOfflineCachedSchemes() {
  try {
    const raw = localStorage.getItem(SCHEMES_CACHE_KEY);
    const time = localStorage.getItem(CACHE_TIME_KEY);
    if (raw) {
      return {
        schemes: JSON.parse(raw),
        cachedAt: time ? new Date(time) : null
      };
    }
  } catch (e) {
    console.warn('Could not read from offline cache', e);
  }
  return { schemes: [], cachedAt: null };
}

export function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}
