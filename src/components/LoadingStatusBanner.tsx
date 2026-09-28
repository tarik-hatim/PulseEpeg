import React from 'react';
import { CheckCircle2, Loader2, Radio, Server } from 'lucide-react';
import {
  AppLanguage,
  EpgLoadingProgress,
  WorkerProgressMessage,
} from '../types/epg';
import { getActiveLanguage, getTranslations } from '../utils/i18n';

interface LoadingStatusBannerProps {
  progress: EpgLoadingProgress | WorkerProgressMessage | null;
  isSyncing?: boolean;
  hasExistingData?: boolean;
  onRetry?: () => void;
  isLight?: boolean;
  language?: AppLanguage;
}

export const LoadingStatusBanner: React.FC<LoadingStatusBannerProps> = ({
  progress,
  isSyncing,
  language,
}) => {
  if (!progress) return null;
  const p: EpgLoadingProgress =
    'type' in progress && progress.type === 'EPG_PROGRESS'
      ? progress.payload
      : (progress as EpgLoadingProgress);

  const active = isSyncing !== undefined ? isSyncing : p.active;
  if (!active) return null;

  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);

  const completed = p.completedSources ?? p.currentSourceIndex ?? 0;
  const total = p.totalSources ?? 0;

  return (
    <div className="mb-4 rounded-2xl bg-slate-900/95 border border-amber-500/30 p-3.5 sm:p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {tr.workerTitle}
              </span>
              {total > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {completed} / {total} {tr.workerStreams}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium mt-0.5">
              {p.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400">
            <Radio className="w-3 h-3 inline me-1" />
            {p.channelsParsed} {tr.workerChannelsCount}
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300">
            <Server className="w-3 h-3 inline me-1" />
            {p.programmesParsed.toLocaleString()} {tr.workerProgrammesCount}
          </div>
        </div>
      </div>

      {/* Détail par source */}
      {p.sourceStatuses && p.sourceStatuses.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {p.sourceStatuses.map((src) => (
            <div
              key={src.id}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center justify-between gap-1.5 ${
                src.status === 'done'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : src.status === 'downloading' || src.status === 'parsing'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : src.status === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <span className="truncate font-medium">
                [{src.country}] {src.name}
              </span>
              {src.status === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : src.status === 'downloading' || src.status === 'parsing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
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
