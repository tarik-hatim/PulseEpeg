import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudDownload,
  Cpu,
  Database,
  FileArchive,
  RefreshCw,
} from 'lucide-react';
import { EpgLoadingProgress } from '../types/epg';
import { formatBytes } from '../utils/timeFormat';

interface LoadingStatusBannerProps {
  progress: EpgLoadingProgress;
  hasExistingData: boolean;
  onRetry: () => void;
  isLight: boolean;
}

export const LoadingStatusBanner: React.FC<LoadingStatusBannerProps> = ({
  progress,
  hasExistingData,
  onRetry,
  isLight,
}) => {
  if (!progress.active && progress.phase !== 'error') {
    return null;
  }

  const downloadPercent =
    progress.bytesTotal > 0
      ? Math.min(
          100,
          Math.round((progress.bytesLoaded / progress.bytesTotal) * 100)
        )
      : 0;

  if (progress.phase === 'error') {
    return (
      <div
        className={`mb-4 rounded-2xl p-5 border ${
          isLight
            ? 'bg-red-50/90 border-red-200 text-slate-900'
            : 'bg-red-950/30 border-red-900/60 text-slate-100'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">
              Échec de la synchronisation multi-sources EPG (.xml.gz)
            </h3>
            <p
              className={`text-xs mt-1 leading-relaxed ${
                isLight ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              {progress.error ||
                'Une erreur réseau est survenue lors de la récupération des flux EPG.'}
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer la fusion des sources
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact banner when refreshing in background with existing data already visible
  if (hasExistingData) {
    return (
      <div
        className={`mb-4 rounded-2xl p-4 border transition-opacity ${
          isLight
            ? 'bg-amber-50/90 border-amber-200 text-slate-900'
            : 'bg-[#131B2E] border-amber-500/30 text-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{progress.message}</p>
              <p
                className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {progress.currentSourceIndex && progress.totalSources
                  ? `Source ${progress.currentSourceIndex}/${progress.totalSources} · `
                  : ''}
                {formatBytes(progress.bytesLoaded)} téléchargés ·{' '}
                {progress.channelsParsed} chaînes fusionnées ·{' '}
                {progress.programmesParsed.toLocaleString('fr-FR')} programmes
              </p>
            </div>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-amber-400 shrink-0">
            {downloadPercent}%
          </span>
        </div>
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-800/60 overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-transform duration-150 origin-left"
            style={{
              transform: `scaleX(${Math.max(0.03, downloadPercent / 100)})`,
            }}
          />
        </div>
      </div>
    );
  }

  const steps = [
    {
      id: 'downloading',
      label: '1. Téléchargement successif des archives (.xml.gz)',
      detail: progress.currentSourceName
        ? `Flux actif : ${progress.currentSourceName} (${formatBytes(
            progress.bytesLoaded
          )})`
        : `${formatBytes(progress.bytesLoaded)} téléchargés`,
      icon: CloudDownload,
      done: progress.phase === 'caching' || progress.phase === 'ready',
      active:
        progress.phase === 'downloading' ||
        progress.phase === 'checking_cache' ||
        progress.phase === 'parsing',
    },
    {
      id: 'decompressing',
      label: '2. Décompression GZIP à la volée (Web Worker)',
      detail:
        'Traitement séquentiel par flux sans saturer la mémoire mobile',
      icon: FileArchive,
      done: progress.phase === 'caching' || progress.phase === 'ready',
      active:
        progress.phase === 'decompressing' || progress.phase === 'parsing',
    },
    {
      id: 'parsing',
      label:
        '3. Whitelist Cinéma/Séries (Astra, Hotbird, Hispasat, Nilesat) · Exclusion Lektor PL & FTA',
      detail: `${progress.channelsParsed} chaînes VO+Sub retenues · ${(
        progress.channelsFilteredOut || 0
      ).toLocaleString('fr-FR')} chaînes FTA/Sport/Lektor exclues · ${progress.programmesParsed.toLocaleString(
        'fr-FR'
      )} films & séries`,
      icon: Cpu,
      done: progress.phase === 'caching' || progress.phase === 'ready',
      active: progress.phase === 'parsing',
    },
    {
      id: 'caching',
      label: '4. Sauvegarde unifiée dans IndexedDB',
      detail: 'Mise en cache locale de la grille multi-sources',
      icon: Database,
      done: progress.phase === 'ready',
      active: progress.phase === 'caching',
    },
  ];

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div
        className={`rounded-3xl p-6 sm:p-8 border ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm text-slate-900'
            : 'bg-[#131B2E] border-slate-800/90 text-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-mono tabular-nums text-amber-400">
              Fusion EPG Multi-Sources en arrière-plan
              {progress.currentSourceIndex && progress.totalSources
                ? ` · Source ${progress.currentSourceIndex}/${progress.totalSources}`
                : ''}
            </p>
            <h2 className="text-xl font-bold tracking-tight mt-1 text-balance">
              Traitement successif des fichiers .xml.gz
            </h2>
          </div>
          <div className="text-right font-mono tabular-nums">
            <span className="text-2xl font-bold text-amber-400">
              {downloadPercent}%
            </span>
          </div>
        </div>

        <p
          className={`text-xs leading-relaxed mb-5 ${
            isLight ? 'text-slate-600' : 'text-slate-400'
          }`}
        >
          {progress.message}
        </p>

        {/* Progress Bar */}
        <div
          className={`h-2 w-full rounded-full overflow-hidden mb-6 ${
            isLight ? 'bg-slate-100' : 'bg-slate-900'
          }`}
        >
          <div
            className="h-full bg-amber-400 transition-transform duration-150 origin-left"
            style={{
              transform: `scaleX(${Math.max(0.04, downloadPercent / 100)})`,
            }}
          />
        </div>

        {/* Live Counters */}
        <div
          className={`grid grid-cols-3 gap-3 py-3.5 px-4 rounded-2xl mb-6 ${
            isLight ? 'bg-slate-50' : 'bg-[#0B0F17]/80'
          }`}
        >
          <div>
            <p
              className={`text-[11px] ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Archives GZ
            </p>
            <p className="text-sm font-mono tabular-nums font-semibold mt-0.5">
              {formatBytes(progress.bytesLoaded)}
            </p>
          </div>
          <div>
            <p
              className={`text-[11px] ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Chaînes fusionnées
            </p>
            <p className="text-sm font-mono tabular-nums font-semibold mt-0.5">
              {progress.channelsParsed}
            </p>
          </div>
          <div>
            <p
              className={`text-[11px] ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Programmes lus
            </p>
            <p className="text-sm font-mono tabular-nums font-semibold mt-0.5">
              {progress.programmesParsed.toLocaleString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Sequential Source Queue Status */}
        {progress.sourceStatuses && progress.sourceStatuses.length > 0 && (
          <div
            className={`rounded-2xl p-4 mb-6 space-y-2 border ${
              isLight
                ? 'bg-slate-50/80 border-slate-200/80'
                : 'bg-[#0B0F17]/60 border-slate-800/80'
            }`}
          >
            <p className="text-xs font-semibold mb-2">
              File de traitement séquentiel ({progress.sourceStatuses.length}{' '}
              sources)
            </p>
            {progress.sourceStatuses.map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between gap-2 text-xs py-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {src.status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : src.status === 'downloading' ||
                    src.status === 'parsing' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  ) : src.status === 'error' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span className="font-mono tabular-nums font-semibold text-amber-400 shrink-0">
                    {src.country}
                  </span>
                  <span className="truncate">{src.name}</span>
                </div>
                <span
                  className={`font-mono tabular-nums text-[11px] shrink-0 ${
                    src.status === 'done'
                      ? 'text-emerald-400'
                      : src.status === 'downloading' || src.status === 'parsing'
                      ? 'text-amber-400'
                      : src.status === 'error'
                      ? 'text-red-400'
                      : 'text-slate-500'
                  }`}
                >
                  {src.status === 'done'
                    ? `+${src.channelsAdded} ch.`
                    : src.status === 'downloading' || src.status === 'parsing'
                    ? `${src.channelsAdded} ch. ...`
                    : src.status === 'error'
                    ? 'Erreur'
                    : 'En attente'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline Steps */}
        <div className="space-y-3.5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    step.done
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : step.active
                      ? 'bg-amber-500/15 text-amber-400'
                      : isLight
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-slate-800/60 text-slate-500'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon
                      className={`w-4 h-4 ${
                        step.active ? 'animate-pulse' : ''
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-medium ${
                      step.done || step.active
                        ? isLight
                          ? 'text-slate-900'
                          : 'text-slate-100'
                        : isLight
                        ? 'text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
