
import React, { useEffect, useState } from 'react';
import { Check, X, Zap, Shield, Activity, Lock } from './icons';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession, fetchCreditPacks, CreditPackId, CreditPackInfo } from '../services/billingService';

interface PricingModalProps {
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPack, setSelectedPack] = useState<CreditPackId>('producer');
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<CreditPackInfo[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchCreditPacks()
      .then((loaded) => {
        setPacks(loaded);
        if (loaded.length && !loaded.some((p) => p.id === selectedPack)) {
          setSelectedPack(loaded[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Nie udało się załadować pakietów.'))
      .finally(() => setLoadingPacks(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = packs.find((p) => p.id === selectedPack);

  const handleCheckout = async () => {
    setError(null);
    setIsProcessing(true);

    if (!user) {
      setError('Zaloguj się, aby kupić kredyty.');
      setIsProcessing(false);
      return;
    }

    const token =
      localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token');
    if (!token) {
      setError('Brak tokenu sesji — zaloguj się ponownie.');
      setIsProcessing(false);
      return;
    }

    try {
      const url = await createCheckoutSession(selectedPack, token);
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Nie udało się otworzyć płatności.');
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col lg:flex-row relative border border-slate-200 dark:border-slate-800 h-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors z-30"
        >
          <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
        </button>

        <div className="lg:w-1/3 p-8 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center">
          <div className="mb-6 text-center lg:text-left">
            <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold uppercase tracking-wider">
              Free tier
            </span>
            <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-4 mb-2">Starter</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              3 darmowe kredyty po rejestracji.
            </p>
          </div>

          <div className="text-4xl font-black text-slate-800 dark:text-slate-200 mb-8 text-center lg:text-left">
            $0 <span className="text-lg font-medium text-slate-400">/ rejestracja</span>
          </div>

          <ul className="space-y-4 mb-8 flex-grow">
            <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span>
                <strong>3 kredyty</strong> na start
              </span>
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span>1 kredyt = 1 pełna analiza</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <Check className="w-5 h-5 text-green-500 shrink-0" />
              <span>Kredyty nie wygasają</span>
            </li>
          </ul>
          <Button variant="secondary" className="w-full py-3 rounded-xl font-bold" onClick={onClose}>
            Kontynuuj bez zakupu
          </Button>
        </div>

        <div className="lg:w-2/3 p-8 lg:p-12 flex flex-col bg-white dark:bg-slate-900 relative">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Doładuj kredyty</h2>
            <p className="text-slate-500 dark:text-slate-400">
              Jednorazowy zakup — bez subskrypcji. Płatność przez Stripe.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
            {packs.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack.id)}
                className={`py-2 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                  selectedPack === pack.id
                    ? 'bg-white dark:bg-slate-700 shadow-md text-accent-violet transform scale-105'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {pack.name.replace(' Pack', '')}
              </button>
            ))}
          </div>

          {loadingPacks && (
            <p className="text-center text-slate-400 text-sm mb-8">Ładowanie pakietów…</p>
          )}

          {!loadingPacks && current && (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border-2 border-accent-violet/10 rounded-2xl bg-gradient-to-b from-accent-violet/5 to-transparent relative mb-8">
            {current.popular && (
              <div className="absolute top-0 -translate-y-1/2 bg-accent-violet text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                NAJCZĘŚCIEJ WYBIERANY
              </div>
            )}

            <div className="text-6xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              ${current.price_usd}
            </div>
            <p className="text-slate-500 font-medium mb-6">jednorazowo</p>

            <div className="text-2xl font-bold text-accent-violet mb-2">{current.credits} kredytów</div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-md">{current.description}</p>
            {current.available === false && (
              <p className="text-sm text-amber-500 font-semibold mb-2">Ten pakiet nie jest jeszcze dostępny do zakupu.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left w-full max-w-lg mx-auto">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <div className="p-1 bg-green-500 rounded-full text-white">
                  <Check className="w-3 h-3" />
                </div>
                Pełna analiza AI
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <div className="p-1 bg-accent-violet rounded-full text-white">
                  <Zap className="w-3 h-3" />
                </div>
                Eksport metadanych
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <div className="p-1 bg-blue-500 rounded-full text-white">
                  <Shield className="w-3 h-3" />
                </div>
                Certyfikaty
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <div className="p-1 bg-orange-500 rounded-full text-white">
                  <Activity className="w-3 h-3" />
                </div>
                Analiza DSP
              </div>
            </div>
          </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center mb-4" role="alert">
              {error}
            </p>
          )}

          <Button
            variant="primary"
            className="w-full py-4 text-lg rounded-xl shadow-xl shadow-accent-violet/20 hover:scale-[1.01] transition-transform"
            onClick={handleCheckout}
            disabled={isProcessing || !current || current.available === false}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2 justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Przekierowanie do Stripe…
              </div>
            ) : current ? (
              <>Kup {current.credits} kredytów — ${current.price_usd}</>
            ) : (
              <>Ładowanie…</>
            )}
          </Button>
          <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" /> Bezpieczna płatność Stripe. Kredyty dodawane automatycznie po zapłacie.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
