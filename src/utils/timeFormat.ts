import { AppLanguage, EpgProgramme } from '../types/epg';
import { getActiveLanguage, getLanguageOption, getTranslations } from './i18n';

/**
 * Fuseau horaire de référence de l'application :
 * Heure actuelle = UTC+0 Casablanca (Africa/Casablanca)
 */
export const APP_TIMEZONE = 'Africa/Casablanca';
export const APP_TIMEZONE_LABEL = 'UTC+0 Casablanca';

let activeTimezone = APP_TIMEZONE;
let isAutoTimezone = true;

export function configureActiveTimezone(
  autoTimezone?: boolean,
  manualTimezone?: string
): void {
  isAutoTimezone = autoTimezone !== false;
  if (!isAutoTimezone && manualTimezone && manualTimezone.trim()) {
    activeTimezone = manualTimezone.trim();
  } else {
    activeTimezone = APP_TIMEZONE;
  }
}

export function getActiveTimezoneKey(): string {
  return `${isAutoTimezone ? 'auto' : 'manual'}:${activeTimezone}`;
}

export function getLocalTimezoneLabel(): string {
  if (activeTimezone === 'Africa/Casablanca') {
    return APP_TIMEZONE_LABEL;
  }
  return activeTimezone;
}

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const hourOnlyFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  hour12: false,
});

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatTimeShort(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '--:--';
  return timeFormatter.format(new Date(ms));
}

export function formatLocalTime(ms: number): string {
  return formatTimeShort(ms);
}

export function formatLocalTimeRange(startMs: number, stopMs: number): string {
  return `${formatTimeShort(startMs)} – ${formatTimeShort(stopMs)}`;
}

export function formatShortDate(ms: number, lang?: AppLanguage): string {
  return formatDayLabel(ms, lang || getActiveLanguage());
}

export function formatFullDateTime(ms: number, lang?: AppLanguage): string {
  if (!ms || Number.isNaN(ms)) return '--';
  const activeLang = lang || getActiveLanguage();
  const locale = getLanguageOption(activeLang).intlLocale;
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fullDateFormatter.format(new Date(ms));
}

export function formatDayLabel(ms: number, lang?: AppLanguage): string {
  if (!ms || Number.isNaN(ms)) return '--';
  const activeLang = lang || getActiveLanguage();
  const locale = getLanguageOption(activeLang).intlLocale;
  const dayLabelFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return dayLabelFormatter.format(new Date(ms));
}

/**
 * Retourne l'heure (0-23) et la minute (0-59) dans le fuseau UTC+0 Casablanca
 */
export function getCasablancaHourMinute(ms: number): {
  hour: number;
  minute: number;
} {
  const formatted = timeFormatter.format(new Date(ms));
  const [hStr, mStr] = formatted.split(':');
  return {
    hour: parseInt(hStr || '0', 10) % 24,
    minute: parseInt(mStr || '0', 10),
  };
}

/**
 * Retourne le timestamp correspondant à une heure:minute précise du même jour à Casablanca (UTC+0)
 */
export function getCasablancaTimestampForHour(
  referenceMs: number,
  targetHour: number,
  targetMinute = 0
): number {
  const dateKey = dateKeyFormatter.format(new Date(referenceMs));
  const [year, month, day] = dateKey.split('-').map((n) => parseInt(n, 10));

  const guessUtcMs = Date.UTC(year, month - 1, day, targetHour, targetMinute, 0, 0);
  const actualHm = getCasablancaHourMinute(guessUtcMs);
  const diffMinutes =
    (targetHour - actualHm.hour) * 60 + (targetMinute - actualHm.minute);

  return guessUtcMs + diffMinutes * 60_000;
}

export function getPrimeTimeMs(referenceMs: number): number {
  return getCasablancaTimestampForHour(referenceMs, 20, 45);
}

/**
 * Formate un timestamp (ms) au format YYYY-MM-DDTHH:mm (compatible <input type="datetime-local">)
 * dans le fuseau de référence UTC+0 Casablanca.
 */
export function formatDateTimeLocalValue(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  const dKey = dateKeyFormatter.format(new Date(ms));
  const tKey = timeFormatter.format(new Date(ms));
  return `${dKey}T${tKey}`;
}

export function formatDateInputValue(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  return dateKeyFormatter.format(new Date(ms));
}

export function formatTimeInputValue(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '';
  return timeFormatter.format(new Date(ms));
}

export function parseDateInputWithCurrentTime(
  dateValue: string,
  referenceMs: number
): number | null {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) return null;
  const hm = getCasablancaHourMinute(referenceMs || Date.now());
  const timeStr = `${String(hm.hour).padStart(2, '0')}:${String(hm.minute).padStart(2, '0')}`;
  return parseDateTimeLocalValue(`${dateValue.trim()}T${timeStr}`);
}

export function parseTimeInputWithCurrentDate(
  timeValue: string,
  referenceMs: number
): number | null {
  if (!timeValue || !timeValue.includes(':')) return null;
  const dKey = formatDateInputValue(referenceMs || Date.now());
  if (!dKey) return null;
  return parseDateTimeLocalValue(`${dKey}T${timeValue.trim()}`);
}

/**
 * Parse une chaîne YYYY-MM-DDTHH:mm issue d'un sélecteur date/heure vers un timestamp (ms)
 * dans le fuseau de référence UTC+0 Casablanca.
 */
export function parseDateTimeLocalValue(value: string): number | null {
  if (!value || !value.includes('T')) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map((n) => parseInt(n, 10));
  const [hour, minute] = timePart.split(':').map((n) => parseInt(n, 10));
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const actualHm = getCasablancaHourMinute(guessUtcMs);
  const diffMinutes =
    (hour - actualHm.hour) * 60 + (minute - actualHm.minute);
  return guessUtcMs + diffMinutes * 60_000;
}

/**
 * Aligne un timestamp sur le créneau de 30 minutes inférieur en heure de Casablanca
 */
export function floorToHalfHourCasablanca(ms: number): number {
  const d = new Date(ms);
  const minutes = d.getUTCMinutes();
  const flooredMin = minutes >= 30 ? 30 : 0;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    flooredMin,
    0,
    0
  );
}

export function getCasablancaHourNumber(ms: number): number {
  const h = parseInt(hourOnlyFormatter.format(new Date(ms)), 10);
  return Number.isNaN(h) ? new Date(ms).getUTCHours() : h % 24;
}

export function calculateProgress(
  startMs: number,
  stopMs: number,
  nowMs: number
): number {
  if (nowMs <= startMs) return 0;
  if (nowMs >= stopMs) return 100;
  const total = stopMs - startMs;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / total) * 100)));
}

export function formatDurationMinutes(startMs: number, stopMs: number): string {
  const mins = Math.max(1, Math.round((stopMs - startMs) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatRemainingTime(
  stopMs: number,
  nowMs: number,
  lang?: AppLanguage
): string {
  const activeLang = lang || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const diffMins = Math.max(0, Math.ceil((stopMs - nowMs) / 60000));
  if (diffMins === 0) return tr.ended;
  if (diffMins < 60) return `${tr.remainingPrefix} ${diffMins} ${tr.minUnit}`.trim();
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  const timeStr = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  return `${tr.remainingPrefix} ${timeStr}`.trim();
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function findCurrentAndUpcoming(
  schedule: EpgProgramme[] | undefined,
  referenceTimeMs: number
): { current: EpgProgramme | null; next: EpgProgramme | null } {
  if (!schedule || schedule.length === 0) {
    return { current: null, next: null };
  }

  let currentIdx = -1;
  for (let i = 0; i < schedule.length; i++) {
    const p = schedule[i];
    if (p.startMs <= referenceTimeMs && p.stopMs > referenceTimeMs) {
      currentIdx = i;
      break;
    }
  }

  if (currentIdx !== -1) {
    return {
      current: schedule[currentIdx],
      next: schedule[currentIdx + 1] || null,
    };
  }

  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i].startMs > referenceTimeMs) {
      return {
        current: schedule[i],
        next: schedule[i + 1] || null,
      };
    }
  }

  const lastIdx = schedule.length - 1;
  return {
    current: schedule[lastIdx] || null,
    next: null,
  };
}
