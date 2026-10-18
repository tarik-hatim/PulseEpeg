/**
 * Logique de détection géographique et présélection automatique des satellites
 * Importée et adaptée depuis satellite-stream-buddy.
 */

export type GeographicRegion = 'MENA' | 'LATAM' | 'EUROPE' | 'TURKEY' | 'UNKNOWN';

const MENA_COUNTRIES = new Set(
  'MA DZ TN LY EG SD MR EH SA AE QA KW BH OM YE IQ SY JO LB PS IL IR'.split(' ')
);
const LATAM_COUNTRIES = new Set(
  'MX GT HN SV NI CR PA CU DO PR CO VE EC PE BO CL AR UY PY BR'.split(' ')
);
const EUROPE_COUNTRIES = new Set(
  'FR DE AT CH BE NL LU GB IE IT ES PT PL CZ SK HU RO BG GR DK SE NO FI'.split(' ')
);

const MENA_TZ_REGEX =
  /^(Africa\/(Casablanca|Algiers|Tunis|Tripoli|Cairo|Khartoum|Nouakchott|El_Aaiun)|Asia\/(Riyadh|Dubai|Qatar|Kuwait|Bahrain|Muscat|Aden|Baghdad|Damascus|Amman|Beirut|Gaza|Hebron|Tehran))$/;

const LATAM_TZ_REGEX =
  /^America\/(?!New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Detroit)/;

export function detectGeographicRegion(locale?: string, timeZone?: string): GeographicRegion {
  const country = locale?.split(/[-_]/)[1]?.toUpperCase();
  if (country) {
    if (MENA_COUNTRIES.has(country)) return 'MENA';
    if (LATAM_COUNTRIES.has(country)) return 'LATAM';
    if (country === 'TR') return 'TURKEY';
    if (EUROPE_COUNTRIES.has(country)) return 'EUROPE';
  }

  if (timeZone) {
    if (MENA_TZ_REGEX.test(timeZone)) return 'MENA';
    if (LATAM_TZ_REGEX.test(timeZone)) return 'LATAM';
    if (timeZone === 'Europe/Istanbul') return 'TURKEY';
    if (timeZone.startsWith('Europe/')) return 'EUROPE';
  }

  return 'UNKNOWN';
}

export const REGION_DEFAULT_SATELLITES: Record<GeographicRegion, string[]> = {
  MENA: ['Nilesat 7°W', "Badr / Es'hailSat 26°E", 'Hotbird 13°E', 'Astra 19.2°E'],
  LATAM: ['Hispasat 30°W', 'Star One D2 70°W', 'Amazonas 61°W', 'Intelsat 43.1°W / SES-6 40.5°W'],
  EUROPE: ['Astra 19.2°E', 'Hotbird 13°E', 'Astra 28.2°E', 'Hispasat 30°W'],
  TURKEY: ['Türksat 42°E', 'Hotbird 13°E'],
  UNKNOWN: ['Astra 19.2°E', 'Hotbird 13°E'],
};
