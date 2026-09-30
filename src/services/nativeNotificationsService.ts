import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ProgrammeReminder } from '../types/epg';
import { cleanOfficialChannelName } from '../utils/xmltvParser';

export const EPG_REMINDERS_CHANNEL_ID = 'epg_reminders';
export const EPG_REMINDER_LEAD_TIME_MS = 5 * 60 * 1000; // 5 minutes avant le début

let channelInitialized = false;
let permissionRequestedOnce = false;

/**
 * Convertit l'identifiant texte d'un programme en un identifiant numérique 32-bit
 * strictement positif requis par Android AlarmManager / NotificationManager.
 */
export function getUniqueProgramNotificationId(programId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < programId.length; i++) {
    hash ^= programId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positiveInt = (hash >>> 0) % 2147480000;
  return positiveInt + 1000;
}

/**
 * Joue le son d'alerte en mode In-App / Web en complément de la notification système.
 */
export function playInAppNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio('/pulse_alert.wav');
    audio.volume = 0.85;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        playWebAudioFallbackChime();
      });
    }
  } catch {
    playWebAudioFallbackChime();
  }
}

function playWebAudioFallbackChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [880, 1174.66, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.4);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

/**
 * Crée le canal de notification prioritaire avec son pour Android :
 * id: 'epg_reminders' (Importance 5 = High Importance, Visibilité 1 = Public, Son = notification_sound.wav).
 */
export async function ensureEpgNotificationChannel(): Promise<void> {
  if (channelInitialized) return;
  try {
    await LocalNotifications.createChannel({
      id: 'epg_reminders',
      name: 'Rappels PulseEPG',
      description: 'Alertes pour vos programmes TV',
      importance: 5,
      visibility: 1,
      sound: 'pulse_alert',
      vibration: true,
      lights: true,
      lightColor: '#E11D48',
    });
    channelInitialized = true;
  } catch {
    // Sur navigateur Web standard, createChannel n'est pas supporté (uniquement Android natif)
  }
}

/**
 * Demande la permission système LocalNotifications lors du clic sur "Ajouter un rappel"
 * ou "Tester l'alerte".
 */
export async function requestSystemNotificationPermissions(): Promise<boolean> {
  try {
    await ensureEpgNotificationChannel();
    const currentPerm = await LocalNotifications.checkPermissions();
    if (currentPerm.display === 'granted') {
      permissionRequestedOnce = true;
      return true;
    }
    const requested = await LocalNotifications.requestPermissions();
    permissionRequestedOnce = true;
    return requested.display === 'granted';
  } catch {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      typeof Notification.requestPermission === 'function'
    ) {
      try {
        if (Notification.permission === 'granted') return true;
        if (!permissionRequestedOnce || Notification.permission === 'default') {
          permissionRequestedOnce = true;
          const res = await Notification.requestPermission();
          return res === 'granted';
        }
      } catch {
        // Ignore
      }
    }
    return false;
  }
}

/**
 * Programme une vraie notification locale système (avec son) fonctionnant même lorsque
 * l'application est fermée (via Android AlarmManager + canal 'epg_reminders').
 */
export async function scheduleProgrammeNotification(
  reminder: ProgrammeReminder,
  options?: { isImmediateTest?: boolean }
): Promise<void> {
  try {
    await requestSystemNotificationPermissions();
    await ensureEpgNotificationChannel();

    const now = Date.now();
    const programTitle = reminder.title || 'Programme TV';
    const channelName =
      cleanOfficialChannelName(reminder.channelName) || reminder.channelName;
    const uniqueProgramId = getUniqueProgramNotificationId(reminder.id);

    // Calcul de la date/heure d'alerte : 5 minutes avant le début du programme
    // (ou dans 2 secondes s'il s'agit d'un test d'alerte ou d'un programme imminent <= 5 min)
    const fiveMinBeforeMs = reminder.startMs - EPG_REMINDER_LEAD_TIME_MS;
    const startTime = options?.isImmediateTest
      ? now + 1500
      : fiveMinBeforeMs > now + 2000
        ? fiveMinBeforeMs
        : reminder.startMs > now + 2000
          ? now + 2000
          : now + 1500;

    // Annule toute éventuelle alarme précédente portant le même ID avant de reprogrammer
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: uniqueProgramId }],
      });
    } catch {
      // Ignore
    }

    const notificationPayload = {
      title: '⏰ ' + programTitle,
      body: 'Votre programme commence sur ' + channelName,
      id: uniqueProgramId,
      schedule: {
        at: new Date(startTime),
        allowWhileIdle: true,
      },
      // Compatibilité stricte : utilise 'pulse_alert' (résolu dans res/raw/pulse_alert.wav sur Android)
      // tout en activant le son système
      sound: 'pulse_alert',
      channelId: EPG_REMINDERS_CHANNEL_ID,
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#E11D48',
      autoCancel: true,
      extra: {
        reminderId: reminder.id,
        channelId: reminder.channelId,
        channelName,
        startMs: reminder.startMs,
        sound: true,
      },
    };

    try {
      await LocalNotifications.schedule({
        notifications: [notificationPayload],
      });
    } catch {
      // Fallback sur Android TV si les alarmes exactes sont restreintes par l'OS
      await LocalNotifications.schedule({
        notifications: [
          {
            ...notificationPayload,
            isExactNotification: false,
          },
        ],
      });
    }

    // Si le programme commence dans plus de 5 minutes, on programme également un rappel au coup d'envoi exact
    if (!options?.isImmediateTest && fiveMinBeforeMs > now + 15000 && reminder.startMs > now + 60000) {
      const kickoffNotificationId = getUniqueProgramNotificationId(
        `${reminder.id}_kickoff`
      );
      const kickoffPayload = {
        title: '⏰ ' + programTitle,
        body: 'Votre programme commence sur ' + channelName,
        id: kickoffNotificationId,
        schedule: {
          at: new Date(reminder.startMs),
          allowWhileIdle: true,
        },
        sound: 'pulse_alert',
        channelId: EPG_REMINDERS_CHANNEL_ID,
        smallIcon: 'ic_launcher_foreground',
        iconColor: '#E11D48',
        autoCancel: true,
        extra: {
          reminderId: reminder.id,
          channelId: reminder.channelId,
          channelName,
          startMs: reminder.startMs,
          sound: true,
        },
      };

      try {
        await LocalNotifications.schedule({
          notifications: [kickoffPayload],
        });
      } catch {
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                ...kickoffPayload,
                isExactNotification: false,
              },
            ],
          });
        } catch {
          // Ignore
        }
      }
    }
  } catch (err) {
    console.warn('LocalNotifications.schedule fallback:', err);
  }
}

/**
 * Annule la notification système associée à un rappel supprimé.
 */
export async function cancelProgrammeNotification(
  reminderId: string
): Promise<void> {
  try {
    const primaryId = getUniqueProgramNotificationId(reminderId);
    const kickoffId = getUniqueProgramNotificationId(`${reminderId}_kickoff`);
    await LocalNotifications.cancel({
      notifications: [{ id: primaryId }, { id: kickoffId }],
    });
  } catch {
    // Ignore
  }
}

/**
 * Synchronise les rappels sauvegardés avec le planificateur natif Android au démarrage.
 */
export async function syncSavedRemindersWithSystemNotifications(
  reminders: ProgrammeReminder[]
): Promise<void> {
  try {
    await ensureEpgNotificationChannel();
    if (!reminders || reminders.length === 0) return;

    const now = Date.now();
    const upcoming = reminders.filter((r) => r.startMs > now);
    if (upcoming.length === 0) return;

    // Sur plateforme native Android, vérifie si la permission est déjà accordée avant de synchroniser en tâche de fond
    if (Capacitor.isNativePlatform()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') return;
    }

    for (const rem of upcoming) {
      await scheduleProgrammeNotification(rem);
    }
  } catch {
    // Ignore
  }
}
