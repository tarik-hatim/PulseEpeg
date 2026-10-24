import React, { useState } from 'react';
import {
  Crown,
  Check,
  Zap,
  ShieldCheck,
  Calendar,
  Trophy,
  Tv,
  X,
  Lock,
  Layers,
  Cloud,
} from 'lucide-react';
import { AppLanguage } from '../types/epg';
import { AuthSessionState } from '../services/supabaseService';

interface ProSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  authState: AuthSessionState;
  language: AppLanguage;
  proReason?: string | null;
  onProActivated?: () => void;
}

export const ProSubscriptionModal: React.FC<ProSubscriptionModalProps> = ({
  isOpen,
  onClose,
  authState,
  language,
  proReason,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2800] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-[#334155] bg-[#090d16] p-5 sm:p-6 shadow-2xl space-y-4 overflow-hidden relative max-h-[92vh] flex flex-col"
      >
        {/* Glow décoratif d'arrière-plan */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-gradient-to-br from-[#f59e0b]/20 to-[#ec4899]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-gradient-to-tr from-[#2563eb]/20 to-[#8b5cf6]/20 blur-3xl pointer-events-none" />

        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-3 shrink-0 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-[#f59e0b] to-[#ec4899] text-[#ffffff] shadow-[0_0_15px_rgba(245,158,11,0.5)]">
              <Crown className="w-5 h-5 text-[#ffffff]" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#ffffff] flex items-center gap-2">
                PulseEPG Pro
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#fde047] border border-[#f59e0b]/50">
                  VIP
                </span>
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Expérience TV & Sport ultime sans restrictions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#94a3b8] hover:text-[#ffffff] hover:bg-[#1e293b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps avec défilement fluide */}
        <div className="overflow-y-auto space-y-4 flex-1 pe-1 no-scrollbar relative z-10">
          {/* Bannière de contexte si l'utilisateur cliquait sur une fonction verrouillée */}
          {proReason && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#ec4899]/20 to-[#8b5cf6]/20 border border-[#ec4899]/50 text-xs text-[#f1f5f9] flex items-center gap-2.5 shadow-sm">
              <Zap className="w-4 h-4 text-[#ec4899] shrink-0" />
              <span className="font-semibold leading-relaxed">{proReason}</span>
            </div>
          )}

          {/* Si l'utilisateur est DÉJÀ abonné Pro */}
          {authState.isPremium ? (
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#f59e0b]/60 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b] flex items-center justify-center text-[#fde047] mx-auto">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#ffffff]">
                  Votre abonnement PulseEPG Pro est actif !
                </h3>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Connecté en tant que <strong className="text-[#f1f5f9]">{authState.user?.displayName || authState.user?.email || 'Utilisateur Pro'}</strong>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#070b13] border border-[#1e293b] text-xs text-[#cbd5e1] space-y-2 text-start">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#10b981]" />
                  <span>Guide TV 7 jours & Replay complet débloqués</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#10b981]" />
                  <span>13 satellites et bouquets illimités (sans limite de RAM)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#10b981]" />
                  <span>Résumés vidéo officiels et alertes de matchs en direct</span>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="w-full py-2.5 rounded-xl border border-[#475569] text-xs text-[#94a3b8] cursor-not-allowed font-medium opacity-70"
              >
                Gestion de l'abonnement bientôt disponible
              </button>
            </div>
          ) : (
            <>
              {/* Grille des avantages Pro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#0e1422] border border-[#1e293b] flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#ffffff]">Guide 7 Jours & Replay</h4>
                    <p className="text-[11px] text-[#94a3b8] leading-tight">
                      Consultez la grille jusqu'à J+7 et rattrapez les émissions passées.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0e1422] border border-[#1e293b] flex items-start gap-2.5">
                  <Layers className="w-4 h-4 text-[#ec4899] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#ffffff]">Bouquets Illimités</h4>
                    <p className="text-[11px] text-[#94a3b8] leading-tight">
                      Débloquez les 13 satellites sans restriction de 3 bouquets.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0e1422] border border-[#1e293b] flex items-start gap-2.5">
                  <Trophy className="w-4 h-4 text-[#facc15] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#ffffff]">Sport & Matchs VIP</h4>
                    <p className="text-[11px] text-[#94a3b8] leading-tight">
                      Résumés officiels in-app et alertes coups d'envoi de vos clubs.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0e1422] border border-[#1e293b] flex items-start gap-2.5">
                  <Cloud className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#ffffff]">Cloud Sync Multi-écrans</h4>
                    <p className="text-[11px] text-[#94a3b8] leading-tight">
                      Synchronisez vos favoris et équipes sur mobile, tablette et TV.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sélection du Plan tarifaire */}
              <div className="space-y-2.5 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] block">
                  Choisissez votre formule :
                </span>

                <div className="grid grid-cols-2 gap-3">
                  {/* Plan Annuel (Mis en avant) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPlan('yearly')}
                    className={`relative p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                      selectedPlan === 'yearly'
                        ? 'bg-gradient-to-b from-[#f59e0b]/20 to-[#ec4899]/15 border-[#f59e0b] shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                        : 'bg-[#0f1422] border-[#1e293b] hover:border-[#475569]'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-[#f59e0b] text-black font-extrabold text-[9px] uppercase tracking-wider shadow">
                      Économisez 45%
                    </span>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#ffffff]">Annuel VIP</span>
                      {selectedPlan === 'yearly' && (
                        <Check className="w-4 h-4 text-[#fde047]" />
                      )}
                    </div>
                    <div className="text-lg font-black text-[#ffffff]">
                      19,99 € <span className="text-xs font-normal text-[#94a3b8]">/ an</span>
                    </div>
                    <p className="text-[10px] text-[#fde047] font-medium mt-0.5">
                      Soit seulement 1,66 € / mois
                    </p>
                  </div>

                  {/* Plan Mensuel */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPlan('monthly')}
                    className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer ${
                      selectedPlan === 'monthly'
                        ? 'bg-[#141c2c] border-[#2563eb] shadow-[0_0_20px_rgba(37,99,235,0.25)]'
                        : 'bg-[#0f1422] border-[#1e293b] hover:border-[#475569]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#ffffff]">Mensuel</span>
                      {selectedPlan === 'monthly' && (
                        <Check className="w-4 h-4 text-[#38bdf8]" />
                      )}
                    </div>
                    <div className="text-lg font-black text-[#ffffff]">
                      2,99 € <span className="text-xs font-normal text-[#94a3b8]">/ mois</span>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">
                      Sans engagement, résiliable à tout moment
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#090d16] border border-[#1e293b] text-xs leading-relaxed text-[#cbd5e1]">
                <ShieldCheck className="w-4 h-4 text-[#38bdf8] inline-block me-2 align-middle" />
                Le paiement sécurisé n'est pas encore intégré. Aucun paiement ni activation Pro ne sera simulé.
              </div>

              {/* Activation Pro désactivée jusqu'à l'intégration du paiement */}
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-2xl bg-[#334155] text-[#cbd5e1] font-extrabold text-sm cursor-not-allowed opacity-80"
              >
                Paiement Pro indisponible pour le moment
              </button>

              <p className="text-[10px] text-center text-[#64748b]">
                L'activation Pro sera disponible après intégration et validation d'un prestataire de paiement.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
