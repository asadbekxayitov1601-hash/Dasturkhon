import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ChefHat, Mail, Lock, User, AlertCircle, KeyRound } from 'lucide-react';
import { config } from '../config';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { TelegramLoginButton } from '../components/TelegramLoginButton';
import { authErrorMessage } from '../lib/authError';

export function SignupPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  const finish = async (token: string) => {
    await auth.login(token);
    let redirectTo = '/';
    try {
      redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/';
      sessionStorage.removeItem('redirectAfterLogin');
    } catch { /* ignore */ }
    navigate(redirectTo, { replace: true });
  };

  // Step 1: send a verification code to the email.
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/signup-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrorMessage(data, t));
      setStep('code');
    } catch (err: any) {
      setError(err.message || t('auth.signup_error'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify the code and create the account.
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/signup-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrorMessage(data, t));
      await finish(data.token);
    } catch (err: any) {
      setError(err.message || t('auth.verification_error'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/signup-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(authErrorMessage(data, t));
      setError(t('auth.code_resent'));
    } catch (err: any) {
      setError(err.message || t('auth.resend_failed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary/10 flex items-center justify-center rounded-xl mb-6">
            <ChefHat className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {step === 'form' ? t('auth.create_account') : t('auth.verify_email')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 mb-8">
            {step === 'form'
              ? t('auth.signup_subtitle')
              : t('auth.code_sent_to', { email })}
          </p>
        </div>

        {step === 'form' ? (
          <>
            <form className="space-y-6" onSubmit={handleFormSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.full_name')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      type="text"
                      required
                      className="block w-full pl-10 h-12 rounded-xl border-gray-300 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border outline-none transition-all"
                      placeholder={t('auth.name_ph')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      required
                      className="block w-full pl-10 h-12 rounded-xl border-gray-300 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border outline-none transition-all"
                      placeholder={t('auth.email_ph')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      required
                      className="block w-full pl-10 h-12 rounded-xl border-gray-300 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border outline-none transition-all"
                      placeholder={t('auth.password_ph_min')}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-center">
                <span className="text-sm text-gray-600 mr-2">{t('auth.have_account')}</span>
                <Link to="/login" className="text-sm font-medium text-primary hover:text-primary/80">
                  {t('auth.sign_in')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center h-12 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 font-medium disabled:opacity-60"
              >
                {loading ? t('auth.sending_code') : t('auth.continue')}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">{t('auth.or')}</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            {config.googleClientId && (
              <div className="mb-3">
                <GoogleSignInButton onError={setError} />
              </div>
            )}
            <TelegramLoginButton onError={setError} />
          </>
        ) : (
          <form className="space-y-6" onSubmit={handleCodeSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.verification_code')}</label>
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
                  className="block w-full pl-10 h-12 rounded-xl border-gray-300 shadow-sm focus:ring-primary focus:border-primary border outline-none transition-all tracking-[0.4em] text-lg"
                  placeholder={t('auth.code_ph')}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full flex justify-center items-center h-12 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 font-medium disabled:opacity-60"
            >
              {loading ? t('auth.creating_account') : t('auth.verify_create')}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setStep('form'); setCode(''); setError(null); }} className="text-gray-600 hover:text-gray-900">
                {t('auth.back')}
              </button>
              <button type="button" onClick={resend} className="font-medium text-primary hover:text-primary/80">
                {t('auth.resend_code')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
