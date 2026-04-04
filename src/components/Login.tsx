import { useState, FormEvent } from 'react';
import { User } from '../types';
import { loginUser } from '../api';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('admin@platepe.com');
  const [password, setPassword] = useState('admin1234');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginUser(email, password);
      localStorage.setItem('platepe_token', result.accessToken);

      const mappedUser: User = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role as User['role'],
        active: result.user.isActive,
      };

      onLogin(mappedUser);
    } catch (_error) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex">
      <aside className="hidden md:flex md:w-1/2 bg-[#111111] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-[#006c49] flex items-center justify-center">
            <span className="text-white text-lg font-semibold leading-none">P</span>
          </div>
          <span className="text-white text-xl font-medium tracking-tight">PlatePe</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-white text-4xl font-light leading-tight tracking-tight">
            Every table. Every order. Every moment.
          </h1>
        </div>

        <p className="text-sm text-zinc-600">April Orign · Premium Hospitality POS</p>
      </aside>

      <main className="w-full md:w-1/2 bg-[#fafaf8] flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white rounded-2xl p-10 shadow-sm border border-zinc-100">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-1">Welcome back</h2>
          <p className="text-sm text-zinc-500 mb-8">Sign in to your terminal</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors"
                placeholder="staff@platepe.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-medium text-zinc-500 mb-1.5 block">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition-colors"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#111111] text-white py-3 rounded-xl text-sm font-semibold hover:bg-zinc-800 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4" />
                  <span>Signing in</span>
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
