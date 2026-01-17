
import React, { useState } from 'react';
import { Check, X, Star, Zap, Shield, Database, CreditCard, Lock, Users, Activity } from './icons';
import Button from './Button';
import { UserTier } from '../types';
import { getCheckoutUrl } from '../utils/lemonSqueezy';
import { useAuth } from '../contexts/AuthContext';

interface PricingModalProps {
  onClose: () => void;
  onUpgrade: (tier: UserTier) => Promise<void>;
}

type PaidTier = 'hobby' | 'basic' | 'pro' | 'studio';

const plans: Record<PaidTier, { name: string; price: number; credits: string; desc: string; popular?: boolean }> = {
    hobby: { name: "Hobby", price: 19, credits: "50 Tracks", desc: "For bedroom producers." },
    basic: { name: "Basic", price: 35, credits: "120 Tracks", desc: "For active artists." },
    pro: { name: "Pro", price: 70, credits: "260 Tracks", desc: "For power users.", popular: true },
    studio: { name: "Studio", price: 100, credits: "Unlimited", desc: "For labels & agencies." }
};

const PricingModal: React.FC<PricingModalProps> = ({ onClose, onUpgrade }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaidTier, setSelectedPaidTier] = useState<PaidTier>('pro');
  const { user } = useAuth();

  const handleCheckout = async (tier: UserTier) => {
      setIsProcessing(true);
      
      if (!user) {
          alert("Please log in first to subscribe.");
          setIsProcessing(false);
          return;
      }

      try {
          // Generate Lemon Squeezy Checkout URL
          const url = getCheckoutUrl(tier, user.id, user.email);
          
          if (url && !url.includes('your-store')) {
              // Redirect to payment
              window.location.href = url;
          } else {
              // Simulating upgrade for demo/testing if links aren't set up
              console.warn("Lemon Squeezy links not configured. Simulating upgrade.");
              await new Promise(r => setTimeout(r, 1000));
              await onUpgrade(tier);
              onClose();
          }
      } catch (e) {
          console.error(e);
          setIsProcessing(false);
      }
  };

  const currentPlan = plans[selectedPaidTier];

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

        {/* --- LEFT: FREE STARTER --- */}
        <div className="lg:w-1/3 p-8 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center">
            <div className="mb-6 text-center lg:text-left">
                <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold uppercase tracking-wider">Demo</span>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-4 mb-2">Starter</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Experience the power of the engine.</p>
            </div>
            
            <div className="text-4xl font-black text-slate-800 dark:text-slate-200 mb-8 text-center lg:text-left">
                $0 <span className="text-lg font-medium text-slate-400">/ forever</span>
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
                <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-5 h-5 text-green-500 shrink-0" /> 
                    <span><strong>1 Full Analysis</strong> Credit</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-5 h-5 text-green-500 shrink-0" /> 
                    <span>Basic AI Metadata</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-600">
                    <X className="w-5 h-5 shrink-0" /> 
                    <span>No Batch Processing</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-600">
                    <X className="w-5 h-5 shrink-0" /> 
                    <span>Watermarked Assets</span>
                </li>
            </ul>
            <Button variant="secondary" className="w-full py-3 rounded-xl font-bold" onClick={onClose}>
                Continue with Starter
            </Button>
        </div>

        {/* --- RIGHT: PAID TIERS SELECTOR --- */}
        <div className="lg:w-2/3 p-8 lg:p-12 flex flex-col bg-white dark:bg-slate-900 relative">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Choose your Capacity</h2>
                <p className="text-slate-500 dark:text-slate-400">Unlock Batch Processing and advanced features.</p>
            </div>

            {/* Plan Selector Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                {(Object.keys(plans) as PaidTier[]).map((tier) => (
                    <button
                        key={tier}
                        onClick={() => setSelectedPaidTier(tier)}
                        className={`py-2 px-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                            selectedPaidTier === tier
                                ? 'bg-white dark:bg-slate-700 shadow-md text-accent-violet transform scale-105'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {plans[tier].name}
                    </button>
                ))}
            </div>

            {/* Selected Plan Details */}
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border-2 border-accent-violet/10 rounded-2xl bg-gradient-to-b from-accent-violet/5 to-transparent relative mb-8">
                {currentPlan.popular && (
                    <div className="absolute top-0 -translate-y-1/2 bg-accent-violet text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                        MOST POPULAR
                    </div>
                )}
                
                <div className="text-6xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                    ${currentPlan.price}
                </div>
                <p className="text-slate-500 font-medium mb-6">per month</p>
                
                <div className="text-2xl font-bold text-accent-violet mb-2">{currentPlan.credits}</div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-md">{currentPlan.desc}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left w-full max-w-lg mx-auto">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <div className="p-1 bg-green-500 rounded-full text-white"><Check className="w-3 h-3" /></div>
                        Full Batch Processing
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <div className="p-1 bg-accent-violet rounded-full text-white"><Zap className="w-3 h-3" /></div>
                        Advanced Workflow
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <div className="p-1 bg-blue-500 rounded-full text-white"><Shield className="w-3 h-3" /></div>
                        Copyright Certificates
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <div className="p-1 bg-orange-500 rounded-full text-white"><Activity className="w-3 h-3" /></div>
                        Advanced DSP Analysis
                    </div>
                </div>
            </div>

            <Button 
                variant="primary" 
                className="w-full py-4 text-lg rounded-xl shadow-xl shadow-accent-violet/20 hover:scale-[1.01] transition-transform" 
                onClick={() => handleCheckout(selectedPaidTier)}
                disabled={isProcessing}
            >
                {isProcessing ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                    </div>
                ) : (
                    <>
                        Subscribe to {currentPlan.name}
                    </>
                )}
            </Button>
            <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Secured payment via Lemon Squeezy. Cancel anytime.
            </p>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
