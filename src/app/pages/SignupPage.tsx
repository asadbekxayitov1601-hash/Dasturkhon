import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ChefHat, Mail, Lock, User, AlertCircle, KeyRound } from 'lucide-react';
import { config } from '../config';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export function SignupPage() {
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
      if (!res.ok) throw new Error(data.message || 'Signup failed');
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Signup error');
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
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      await finish(data.token);
    } catch (err: any) {
      setError(err.message || 'Verification error');
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
      if (!res.ok) throw new Error(data.message || 'Could not resend code');
      setError('A new code has been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Could not resend code');
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
            {step === 'form' ? 'Create Account' : 'Verify your email'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 mb-8">
            {step === 'form'
              ? 'Join Dasturkhon to start cooking'
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {step === 'form' ? (
          <>
            <form className="space-y-6" onSubmit={handleFormSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
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
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
                      placeholder="•••••••• (min 6 characters)"
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
                <span className="text-sm text-gray-600 mr-2">Already have an account?</span>
                <Link to="/login" className="text-sm font-medium text-primary hover:text-primary/80">
                  Sign in
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center h-12 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 font-medium disabled:opacity-60"
              >
                {loading ? 'Sending code…' : 'Continue'}
              </button>
            </form>

            {config.googleClientId && (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <GoogleSignInButton onError={setError} />
              </>
            )}
          </>
        ) : (
          <form className="space-y-6" onSubmit={handleCodeSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
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
                  placeholder="123456"
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
              {loading ? 'Creating account…' : 'Verify & Create Account'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setStep('form'); setCode(''); setError(null); }} className="text-gray-600 hover:text-gray-900">
                ← Back
              </button>
              <button type="button" onClick={resend} className="font-medium text-primary hover:text-primary/80">
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
