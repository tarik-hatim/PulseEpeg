import { EpgProgramme } from '../types/epg';

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateHeaderFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const fullDateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatLocalTime(ms: number): string {
  if (!ms) return '--:--';
  return timeFormatter.format(new Date(ms));
}

export function formatLocalTimeRange(startMs: number, stopMs: number): string {
  return `${formatLocalTime(startMs)} – ${formatLocalTime(stopMs)}`;
}

export function formatShortDate(ms: number): string {
  if (!ms) return '';
  return dateHeaderFormatter.format(new Date(ms));
}

export function formatFullDateTime(ms: number): string {
  if (!ms) return '';
  return fullDateTimeFormatter.format(new Date(ms));
}

export function getDurationMinutes(startMs: number, stopMs: number): number {
  return Math.max(1, Math.round((stopMs - startMs) / 60000));
}

export function getProgrammeProgress(
  startMs: number,
  stopMs: number,
  refMs: number
): number {
  if (refMs <= startMs) return 0;
  if (refMs >= stopMs) return 100;
  const total = stopMs - startMs;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((refMs - startMs) / total) * 100)));
}

export function getRemainingMinutes(stopMs: number, refMs: number): number {
  return Math.max(0, Math.ceil((stopMs - refMs) / 60000));
}

export function getLocalTimezoneLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Locale';
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const h = String(Math.floor(absMin / 60)).padStart(2, '0');
    const m = String(absMin % 60).padStart(2, '0');
    return `${tz} (UTC${sign}${h}:${m})`;
  } catch {
    return 'Heure locale';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  const kb = bytes / 1024;
  return `${Math.round(kb)} Ko`;
}

/**
 * Recherche dichotomique O(log N) du programme en cours et des programmes à venir pour une chaîne
 */
export function findCurrentAndUpcoming(
  schedule: EpgProgramme[] | undefined,
  refMs: number
): {
  current: EpgProgramme | null;
  next: EpgProgramme | null;
  later: EpgProgramme | null;
} {
  if (!schedule || schedule.length === 0) {
    return { current: null, next: null, later: null };
  }

  let low = 0;
  let high = schedule.length - 1;
  let candidateIdx = -1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const item = schedule[mid];

    if (item.startMs <= refMs && item.stopMs > refMs) {
      candidateIdx = mid;
      break;
    } else if (item.startMs > refMs) {
      candidateIdx = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (candidateIdx === -1) {
    return { current: null, next: null, later: null };
  }

  const first = schedule[candidateIdx];
  if (first.startMs <= refMs && first.stopMs > refMs) {
    return {
      current: first,
      next: schedule[candidateIdx + 1] || null,
      later: schedule[candidateIdx + 2] || null,
    };
  }

  // Aucun programme pile en cours, mais `first` est le prochain à démarrer
  return {
    current: null,
    next: first,
    later: schedule[candidateIdx + 1] || null,
  };
}

/**
 * Génère les créneaux de jours disponibles dans l'EPG
 */
export function getAvailableDays(minMs: number, maxMs: number): { label: string; subLabel: string; startOfDayMs: number }[] {
  const days: { label: string; subLabel: string; startOfDayMs: number }[] = [];
  const startDay = new Date(minMs);
  startDay.setHours(0, 0, 0, 0);

  const endDay = new Date(maxMs);
  endDay.setHours(23, 59, 59, 999);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);

  let cursor = startDay.getTime();
  let count = 0;

  while (cursor <= endDay.getTime() && count < 8) {
    const d = new Date(cursor);
    let label = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    label = label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');

    if (cursor === todayStart.getTime()) {
      label = "Aujourd'hui";
    } else if (cursor === tomorrowStart.getTime()) {
      label = 'Demain';
    }

    const subLabel = d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });

    days.push({
      label,
      subLabel,
      startOfDayMs: cursor,
    });

    cursor += 86400000;
    count++;
  }

  return days;
}
