import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, KeyRound, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../config';
import { authErrorMessage } from '../lib/authError';

/** "Continue with phone number" — passwordless sign-in/up via an SMS code. */
export function PhoneAuth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [step, setStep] = useState<'idle' | 'phone' | 'code'>('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (token: string) => {
    await auth.login(token);
    let redirectTo = '/';
    try {
      redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
      sessionStorage.removeItem('redirectAfterLogin');
    } catch { /* ignore */ }
    navigate(redirectTo, { replace: true });
  };

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/phone-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrorMessage(data, t));
      setStep('code');
    } catch (err: any) {
      setError(err.message || t('auth.err.generic'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/phone-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrorMessage(data, t));
      await finish(data.token);
    } catch (err: any) {
      setError(err.message || t('auth.err.generic'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'idle') {
    return (
      <button
        type="button"
        onClick={() => { setStep('phone'); setError(null); }}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-full border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
      >
        <Phone className="w-5 h-5 text-primary" />
        {t('auth.phone.continue_with')}
      </button>
    );
  }

  const errorBox = error && (
    <div className="rounded-xl bg-red-50 p-3 flex items-center gap-2">
      <AlertCircle className="h-5 w-5 text-red-500" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );

  if (step === 'phone') {
    return (
      <form onSubmit={requestCode} className="space-y-3 rounded-2xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700">{t('auth.phone.label')}</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Phone className="h-5 w-5 text-gray-400" />
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            autoFocus
            required
            placeholder={t('auth.phone.ph')}
            className="block w-full pl-10 h-12 rounded-xl border-gray-300 border focus:ring-primary focus:border-primary outline-none transition-all"
          />
        </div>
        {errorBox}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 font-medium hover:shadow-lg transition-all disabled:opacity-60"
        >
          {loading ? t('auth.sending_code') : t('auth.phone.send_code')}
        </button>
        <button type="button" onClick={() => { setStep('idle'); setError(null); }} className="w-full text-sm text-gray-600 hover:text-gray-900">
          {t('auth.back')}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-3 rounded-2xl border border-gray-200 p-4">
      <p className="text-sm text-gray-600">{t('auth.code_sent_to', { email: phone })}</p>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <KeyRound className="h-5 w-5 text-gray-400" />
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoFocus
          required
          placeholder={t('auth.code_ph')}
          className="block w-full pl-10 h-12 rounded-xl border-gray-300 border focus:ring-primary focus:border-primary outline-none transition-all tracking-[0.3em] text-lg"
        />
      </div>
      {errorBox}
      <button
        type="submit"
        disabled={loading || code.length < 6}
        className="w-full h-11 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 font-medium hover:shadow-lg transition-all disabled:opacity-60"
      >
        {loading ? t('auth.verifying') : t('auth.phone.verify')}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(null); }} className="text-gray-600 hover:text-gray-900">
          {t('auth.back')}
        </button>
        <button type="button" onClick={() => requestCode()} className="font-medium text-primary hover:text-primary/80">
          {t('auth.resend_code')}
        </button>
      </div>
    </form>
  );
}
