// src/app/components/SubscriptionModal.tsx
// Updated: real Payme payment flow replacing mock OTP "1111"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Check, ShieldCheck, CreditCard, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authFetch } from '../auth/authFetch';
import { useAuth } from '../auth/AuthProvider';
import { toast } from 'sonner';
import { cn } from './ui/utils';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS = [
  {
    key: 'weekly' as const,
    label: 'Weekly',
    price: '15,000',
    oldPrice: null,
    features: ['Access all Pro recipes', 'Smart Pantry access'],
  },
  {
    key: 'monthly' as const,
    label: 'Monthly',
    price: '50,000',
    oldPrice: '60,000',
    badge: 'Popular',
    features: ['All Weekly features', 'Save 17%'],
  },
  {
    key: 'yearly' as const,
    label: 'Yearly',
    price: '500,000',
    oldPrice: '600,000',
    features: ['All Pro features', 'Best value – save 17%'],
  },
];

export function SubscriptionModal({ open, onOpenChange }: SubscriptionModalProps) {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<'plan' | 'payment' | 'otp'>('plan');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  // Payment fields
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');

  // OTP step
  const [sessionId, setSessionId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('plan');
      setCardNumber('');
      setExpiry('');
      setOtp('');
      setSessionId('');
      setMaskedPhone('');
    }
  }, [open]);

  // ── Step 1: Select plan ───────────────────────────────────────────────────
  const handlePlanSelect = () => setStep('payment');

  // ── Step 2a: Verify card → Payme sends OTP ────────────────────────────────
  const handleVerifyCard = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/payment/verify-card', {
        method: 'POST',
        body: JSON.stringify({ cardNumber, expiry, plan: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Card verification failed');

      setSessionId(data.sessionId);
      setMaskedPhone(data.phone);
      setStep('otp');
      toast.success(data.message);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: One-click with saved card ────────────────────────────────────
  const handleUseSavedCard = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/payment/use-saved-card', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      await refresh();
      toast.success(data.message);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Confirm OTP → charge card → activate Pro ─────────────────────
  const handleConfirmOtp = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/payment/confirm-otp', {
        method: 'POST',
        body: JSON.stringify({ sessionId, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');
      await refresh();
      toast.success(data.message);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 16);
    return v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) return `${v.slice(0, 2)}/${v.slice(2)}`;
    return v;
  };

  const selectedPlanData = PLANS.find(p => p.key === selectedPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-4">
            {step === 'plan' && 'Upgrade to Pro'}
            {step === 'payment' && 'Payment Method'}
            {step === 'otp' && 'Enter SMS Code'}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Plan selection ─────────────────────────────────────── */}
        {step === 'plan' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map(plan => (
                <div
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className={cn(
                    'cursor-pointer border rounded-xl p-6 transition-all duration-200 flex flex-col gap-4 relative',
                    selectedPlan === plan.key
                      ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary ring-offset-2'
                      : 'hover:border-primary/50'
                  )}
                >
                  {plan.badge && (
                    <div className="absolute top-0 right-0 bg-primary text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-xl">
                      {plan.badge}
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <h3 className={cn('font-semibold text-lg', selectedPlan === plan.key && 'text-primary')}>
                      {plan.label}
                    </h3>
                    {selectedPlan === plan.key && <Check className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    {plan.oldPrice && (
                      <div className="text-sm text-gray-400 line-through">{plan.oldPrice} UZS</div>
                    )}
                    <div className="text-2xl font-bold">{plan.price} UZS</div>
                  </div>
                  <ul className="text-sm space-y-2 text-gray-600 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Button onClick={handlePlanSelect} className="w-full py-6 text-lg font-semibold shadow-lg shadow-primary/20">
              Continue with {selectedPlanData?.price} UZS
            </Button>
          </div>
        )}

        {/* ── STEP 2: Payment ───────────────────────────────────────────────── */}
        {step === 'payment' && (
          <div className="max-w-md mx-auto w-full space-y-6">

            {/* Saved card shortcut */}
            {user?.cardLast4 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Saved Card</h3>
                <div className="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-500" />
                    <span className="font-mono text-gray-900">•••• •••• •••• {user.cardLast4}</span>
                  </div>
                  <Button onClick={handleUseSavedCard} disabled={loading} size="sm">
                    {loading ? 'Processing...' : 'Use this card'}
                  </Button>
                </div>
                <div className="relative my-6 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <span className="relative bg-white px-2 text-xs text-gray-500">OR PAY WITH NEW CARD</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <input
                  type="text"
                  placeholder="8600 0000 0000 0000"
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary/50 outline-none font-mono text-lg"
                  maxLength={19}
                />
                <p className="text-xs text-gray-500 mt-1">Uzum, Humo, or Visa</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={e => setExpiry(formatExpiry(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary/50 outline-none font-mono text-lg"
                  maxLength={5}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                Secured by Payme. No CVV required for local cards.
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('plan')} className="flex-1">Back</Button>
              <Button
                onClick={handleVerifyCard}
                disabled={loading || cardNumber.replace(/\s/g, '').length !== 16 || expiry.length < 5}
                className="flex-1"
              >
                {loading ? 'Processing...' : 'Send OTP'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: OTP ───────────────────────────────────────────────────── */}
        {step === 'otp' && (
          <div className="max-w-md mx-auto w-full space-y-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(74,124,126,0.1)' }}>
                <Smartphone className="w-8 h-8" style={{ color: '#4A7C7E' }} />
              </div>
              <div>
                <p className="text-gray-800 font-medium">Check your phone</p>
                <p className="text-sm text-gray-500 mt-1">
                  We sent a 6-digit code to <span className="font-mono font-semibold">{maskedPhone}</span>
                </p>
              </div>
            </div>

            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-48 mx-auto block px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] border-2 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
              style={{ borderColor: otp.length === 6 ? '#4A7C7E' : '#E5E7EB' }}
              maxLength={6}
              placeholder="······"
            />

            <Button
              onClick={handleConfirmOtp}
              disabled={loading || otp.length !== 6}
              className="w-full py-6 text-lg"
            >
              {loading ? 'Verifying...' : `Confirm & Pay ${selectedPlanData?.price} UZS`}
            </Button>

            <button
              onClick={() => { setStep('payment'); setOtp(''); }}
              className="text-sm text-gray-500 hover:text-gray-900 underline"
            >
              Change payment method
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
