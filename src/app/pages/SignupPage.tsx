import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ChefHat, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { config } from '../config';

export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Signup failed');
      await auth.login(data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Signup error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary/10 flex items-center justify-center rounded-xl mb-6">
            <ChefHat className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-sm text-gray-600 mb-8">
            Join Dasturkhon to start cooking
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
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
                  placeholder="••••••••"
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
            className="w-full flex justify-center items-center h-12 rounded-xl text-white bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 font-medium"
          >
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}
