import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Satellite,
  Server,
} from 'lucide-react';
import {
  AppLanguage,
  EpgLoadingProgress,
  WorkerProgressMessage,
} from '../types/epg';
import { getActiveLanguage, getTranslations } from '../utils/i18n';

interface LoadingStatusBannerProps {
  progress: EpgLoadingProgress | WorkerProgressMessage | null;
  isSyncing?: boolean;
  errorMessage?: string | null;
  hasExistingData?: boolean;
  onRetry?: () => void;
  onLoadOfflineFallback?: () => void;
  isLight?: boolean;
  language?: AppLanguage;
}

export const LoadingStatusBanner: React.FC<LoadingStatusBannerProps> = ({
  progress,
  isSyncing,
  errorMessage,
  onRetry,
  onLoadOfflineFallback,
  language,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);

  if (errorMessage && !isSyncing) {
    return (
      <div
        role="alert"
        className="mb-4 rounded-lg bg-[#121824] border border-red-500/40 p-3.5 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                  {activeLang === 'fr'
                    ? 'Avertissement Synchronisation EPG HTTPS'
                    : 'EPG HTTPS Synchronization Warning'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#cbd5e1] font-medium mt-0.5">
                {errorMessage}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#60a5fa] text-xs font-bold text-[#ffffff] shadow-[0_0_12px_rgba(37,99,235,0.45)] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#ffffff]" />
                <span>{tr.refreshBtn}</span>
              </button>
            )}
            {onLoadOfflineFallback && (
              <button
                type="button"
                onClick={onLoadOfflineFallback}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090d14] hover:bg-[#172033] border border-[#1f293d] text-xs font-semibold text-[#cbd5e1] hover:text-[#ffffff] transition-colors cursor-pointer"
              >
                <Satellite className="w-3.5 h-3.5 text-[#cbd5e1]" />
                <span>
                  {activeLang === 'fr'
                    ? 'Charger la grille locale de secours'
                    : 'Load local fallback schedule'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!progress) return null;
  const p: EpgLoadingProgress =
    'type' in progress && progress.type === 'EPG_PROGRESS'
      ? progress.payload
      : (progress as EpgLoadingProgress);

  const active = isSyncing !== undefined ? isSyncing : p.active;
  if (!active) return null;

  const completed = p.completedSources ?? p.currentSourceIndex ?? 0;
  const total = p.totalSources ?? 0;

  return (
    <div className="mb-4 rounded-lg bg-[#121824] border border-[#1f293d] p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#090d14] border border-[#1f293d] flex items-center justify-center text-[#3b82f6] shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#ffffff]">
                {tr.workerTitle}
              </span>
              {total > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                  {completed} / {total} {tr.workerStreams}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#cbd5e1] font-medium mt-0.5">
              {p.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-[#090d14] border border-[#1f293d] text-[#cbd5e1]">
            <Radio className="w-3 h-3 inline me-1 text-[#3b82f6]" />
            {p.channelsParsed} {tr.workerChannelsCount}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[#090d14] border border-[#1f293d] text-[#cbd5e1]">
            <Server className="w-3 h-3 inline me-1 text-[#3b82f6]" />
            {p.programmesParsed.toLocaleString()} {tr.workerProgrammesCount}
          </div>
        </div>
      </div>

      {/* Détail par source */}
      {p.sourceStatuses && p.sourceStatuses.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#1f293d] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {p.sourceStatuses.map((src) => (
            <div
              key={src.id}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 ${
                src.status === 'done'
                  ? 'bg-[#090d14] border-[#1f293d] text-[#ffffff]'
                  : src.status === 'downloading' || src.status === 'parsing'
                  ? 'bg-[#2563eb] border-[#60a5fa] text-[#ffffff]'
                  : src.status === 'error'
                  ? 'bg-red-500/10 border-red-500/25 text-red-300'
                  : 'bg-[#090d14] border-[#1f293d] text-[#cbd5e1]'
              }`}
            >
              <span className="truncate font-medium">
                [{src.country}] {src.name}
              </span>
              {src.status === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : src.status === 'downloading' || src.status === 'parsing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ffffff] shrink-0" />
              ) : (
                <span className="text-[10px] font-mono">•••</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
