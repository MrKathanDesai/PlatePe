import { useState } from 'react';
import { authApi } from '../api/auth';
import { useApp } from '../store/app-store-context';
import { Sun, Moon } from 'lucide-react';

export default function LoginScreen() {
  const { login, theme, toggleTheme } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      await login(res.data.user, res.data.accessToken);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'grid',
      gridTemplateColumns: '1fr 420px',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        style={{
          position: 'fixed', top: 20, right: 20, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px',
          borderRadius: 'var(--radius)',
          border: '1.5px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-2)',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          boxShadow: 'var(--shadow-hard-sm)',
        }}
      >
        {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        {theme === 'dark' ? 'LIGHT' : 'DARK'}
      </button>

      {/* Left panel */}
      <div style={{
        background: 'var(--surface)',
        borderRight: '1.5px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 56px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative grid lines */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(0deg, var(--text) 0, var(--text) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, var(--text) 0, var(--text) 1px, transparent 1px, transparent 40px)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.05em',
            lineHeight: 1,
          }}>
            plate<span style={{ color: 'var(--accent)' }}>pe</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-3)',
              letterSpacing: '0.08em',
              marginLeft: 8,
              verticalAlign: 'middle',
            }}>POS</span>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 36,
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            marginBottom: 32,
          }}>
            Restaurant<br />
            operations,<br />
            <span style={{ color: 'var(--accent)' }}>simplified.</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Admin', 'Server', 'Cashier', 'Brewbar', 'Kitchen'].map((role) => (
              <span key={role} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                padding: '3px 8px',
                background: 'var(--surface-2)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-2)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                boxShadow: 'var(--shadow-hard-sm)',
              }}>{role}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '52px 48px',
        background: 'var(--bg)',
        borderLeft: 'none',
      }}>
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: 20,
          }}>
            — Sign in to your workspace
          </div>

          <h1 style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 32px',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}>
            Welcome back.
          </h1>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-3)',
                marginBottom: 7,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Email address
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@platepe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-3)',
                marginBottom: 7,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Password
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1.5px solid var(--red)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                fontSize: 13,
                color: 'var(--red)',
                marginBottom: 16,
                fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-3)',
            textAlign: 'center',
            marginTop: 28,
            letterSpacing: '0.04em',
          }}>
            Access is role-restricted. Contact your admin.
          </p>
        </div>
      </div>
    </div>
  );
}
