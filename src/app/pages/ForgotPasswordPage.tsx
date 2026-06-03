import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChefHat, Mail, Lock, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../auth/authFetch';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch('/api/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed to send code');
      toast.success('If that email exists, a 6-digit code has been sent.');
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch('/api/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      toast.success('Password updated — please sign in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputWrap = 'relative';
  const inputCls =
    'block w-full pl-10 h-12 rounded-xl border-gray-300 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border outline-none transition-all';
  const iconCls = 'absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary/10 flex items-center justify-center rounded-xl mb-6">
            <ChefHat className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Reset password</h2>
          <p className="mt-2 text-sm text-gray-600 mb-8">
            {step === 'request'
              ? 'Enter your email and we’ll send you a code.'
              : `Enter the code sent to ${email} and your new password.`}
          </p>
        </div>

        {step === 'request' ? (
          <form className="space-y-6" onSubmit={requestCode}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className={inputWrap}>
                <div className={iconCls}><Mail className="h-5 w-5 text-gray-400" /></div>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center h-12 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all font-medium disabled:opacity-60">
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={resetPassword}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
              <div className={inputWrap}>
                <div className={iconCls}><KeyRound className="h-5 w-5 text-gray-400" /></div>
                <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" required placeholder="6-digit code" className={`${inputCls} tracking-widest`} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <div className={inputWrap}>
                <div className={iconCls}><Lock className="h-5 w-5 text-gray-400" /></div>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="At least 6 characters" className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center h-12 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all font-medium disabled:opacity-60">
              {loading ? 'Updating…' : 'Reset password'}
            </button>
            <button type="button" onClick={() => { setStep('request'); setError(null); }} className="w-full text-sm text-gray-500 hover:text-gray-700">
              Use a different email
            </button>
          </form>
        )}

        <div className="flex items-center justify-center mt-6">
          <Link to="/login" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
