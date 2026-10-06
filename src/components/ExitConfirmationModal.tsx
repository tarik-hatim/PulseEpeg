import React, { useEffect, useRef } from 'react';
import { Tv, LogOut, Heart } from 'lucide-react';
import { AppLanguage } from '../types/epg';

export interface ExitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  lang?: AppLanguage;
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  lang = 'fr',
}) => {
  const stayBtnRef = useRef<HTMLButtonElement | null>(null);
  const exitBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus automatique immédiat sur le bouton "Continuer à regarder" à l'ouverture de la modale
  useEffect(() => {
    if (!isOpen) return;

    const focusStayButton = () => {
      stayBtnRef.current?.focus({ preventScroll: true });
    };

    focusStayButton();
    const rafId = window.requestAnimationFrame(focusStayButton);
    const timerId = window.setTimeout(focusStayButton, 50);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isRtl = lang === 'ar';

  const title =
    lang === 'fr'
      ? 'Attendez ! Ne partez pas déjà !'
      : lang === 'es' || lang === 'es_latam'
      ? '¡Espere! ¡No se vaya todavía!'
      : lang === 'pt' || lang === 'pt_br'
      ? 'Espere! Não vá embora ainda!'
      : lang === 'ar'
      ? 'انتظر! لا تغادر الآن!'
      : lang === 'de'
      ? 'Warten Sie! Gehen Sie noch nicht!'
      : lang === 'it'
      ? 'Aspetta! Non andartene ancora!'
      : "Wait! Don't leave yet!";

  const subtitle =
    lang === 'fr'
      ? 'Vous aimez PulseEPG ? Restez pour découvrir la suite de vos programmes !'
      : lang === 'es' || lang === 'es_latam'
      ? '¿Le gusta PulseEPG? ¡Quédese para descubrir el resto de sus programas!'
      : lang === 'pt' || lang === 'pt_br'
      ? 'Gosta do PulseEPG? Fique para descobrir a programação dos seus canais!'
      : lang === 'ar'
      ? 'هل يعجبك PulseEPG؟ ابقَ لتكتشف بقية برامجك المفضلة!'
      : lang === 'de'
      ? 'Gefällt Ihnen PulseEPG? Bleiben Sie, um weitere Sendungen zu entdecken!'
      : lang === 'it'
      ? 'Ti piace PulseEPG? Resta per scoprire la continuazione dei tuoi programmi!'
      : 'Enjoying PulseEPG? Stay to explore the rest of your favorite shows!';

  const stayButtonLabel =
    lang === 'fr'
      ? 'Continuer à regarder'
      : lang === 'es' || lang === 'es_latam'
      ? 'Continuar viendo'
      : lang === 'pt' || lang === 'pt_br'
      ? 'Continuar assistindo'
      : lang === 'ar'
      ? 'متابعة المشاهدة'
      : lang === 'de'
      ? 'Weiter ansehen'
      : lang === 'it'
      ? 'Continua a guardare'
      : 'Keep watching';

  const exitButtonLabel =
    lang === 'fr'
      ? 'Quitter quand même'
      : lang === 'es' || lang === 'es_latam'
      ? 'Salir de todos modos'
      : lang === 'pt' || lang === 'pt_br'
      ? 'Sair mesmo assim'
      : lang === 'ar'
      ? 'الخروج على أي حال'
      : lang === 'de'
      ? 'Trotzdem beenden'
      : lang === 'it'
      ? 'Esci comunque'
      : 'Exit anyway';

  return (
    <div
      data-tv-modal-group="exit-modal"
      data-tv-modal-overlay="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      aria-describedby="exit-modal-subtitle"
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/80 animate-fadeIn"
      onClick={onClose}
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' ||
          e.key === 'Back' ||
          e.key === 'BrowserBack' ||
          e.key === 'GoBack' ||
          e.key === 'Backspace' ||
          e.keyCode === 27 ||
          e.keyCode === 4 ||
          e.keyCode === 10009
        ) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        data-tv-modal="true"
        data-tv-modal-group="exit-modal"
        className="w-full max-w-md rounded-2xl bg-[#141a26] border border-[#334155] p-6 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.85)] text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête avec icône animée PulseEPG */}
        <div className="relative mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#e11d48]/25 to-[#0055ff]/25 border border-[#e11d48]/50 flex items-center justify-center text-[#e11d48] shadow-[0_0_24px_rgba(225,29,72,0.35)]">
          <Tv className="w-7 h-7 text-[#ffffff]" />
          <Heart className="w-3.5 h-3.5 text-[#e11d48] absolute -top-1 -right-1 animate-pulse" />
        </div>

        {/* Titre & Sous-titre */}
        <div className="space-y-2">
          <h2
            id="exit-modal-title"
            className="text-base sm:text-xl font-extrabold text-[#ffffff] leading-snug tracking-tight"
          >
            {title}
          </h2>
          <p
            id="exit-modal-subtitle"
            className="text-xs sm:text-sm text-[#cbd5e1] leading-relaxed"
          >
            {subtitle}
          </p>
        </div>

        {/* Boutons d'action : Bouton 1 (Focus par défaut, accent rouge) & Bouton 2 (Neutre / outline) */}
        <div
          data-tv-modal-zone="footer"
          data-tv-row="exit-modal-actions"
          className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-1"
        >
          {/* Bouton 2 : Quitter quand même (style neutre / outline) */}
          <button
            ref={exitBtnRef}
            type="button"
            data-tv-focusable="true"
            data-tv-modal-group="exit-modal"
            onClick={onConfirmExit}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                stayBtnRef.current?.focus({ preventScroll: true });
              }
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer bg-[#1e293b]/70 border border-[#334155] text-[#94a3b8] hover:text-[#ffffff] hover:border-[#64748b] hover:bg-[#334155]/50 focus:outline-none focus:border-[#cbd5e1] focus:text-[#ffffff] focus:ring-2 focus:ring-[#94a3b8]/40 focus:scale-105"
          >
            <span className="flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4 opacity-75" />
              <span>{exitButtonLabel}</span>
            </span>
          </button>

          {/* Bouton 1 : Continuer à regarder (Focus D-Pad par défaut, style bouton rouge/accentué) */}
          <button
            ref={stayBtnRef}
            type="button"
            autoFocus
            data-tv-focusable="true"
            data-tv-modal-group="exit-modal"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                exitBtnRef.current?.focus({ preventScroll: true });
              }
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer bg-[#e11d48] border border-[#ff0033] text-[#ffffff] shadow-[0_0_18px_rgba(225,29,72,0.6)] hover:bg-[#be123c] focus:outline-none focus:border-[#ffffff] focus:ring-2 focus:ring-[#ff0033] focus:scale-105 active:scale-95"
          >
            <span className="flex items-center justify-center gap-2">
              <Tv className="w-4 h-4" />
              <span>{stayButtonLabel}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default ExitConfirmationModal;
