import { useState } from 'react';
import { authApi } from '../api/auth';
import { useApp } from '../store/AppContext';

export default function LoginScreen() {
  const { login } = useApp();
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
      gridTemplateColumns: '1fr 480px',
    }}>
      {/* Left decorative panel */}
      <div style={{
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 400,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
          }}>
            Plate<span style={{ color: 'var(--accent)' }}>Pe</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>
            Point of Sale
          </div>
        </div>

        <div>
          <blockquote style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 300,
            fontStyle: 'italic',
            color: 'var(--text)',
            lineHeight: 1.35,
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            "Great hospitality starts<br />with a great system."
          </blockquote>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            {['Admin', 'Server', 'Cashier', 'Coffee Bar', 'Kitchen'].map((role) => (
              <span key={role} style={{
                fontSize: 11, padding: '3px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 100,
                color: 'var(--text-2)',
                fontWeight: 500,
              }}>{role}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 52px',
        background: 'var(--surface)',
      }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 400,
            color: 'var(--text)',
            margin: '0 0 6px',
            letterSpacing: '-0.02em',
          }}>
            Sign in
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 32px' }}>
            Enter your credentials to access your workspace
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.04em' }}>
                EMAIL ADDRESS
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
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.04em' }}>
                PASSWORD
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
                border: '1px solid rgba(184,50,50,0.18)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--red)',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading}
              style={{ width: '100%', fontSize: 14, padding: '12px' }}
            >
              {loading ? 'Signing in…' : 'Continue'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 28 }}>
            Each role gives access to its own workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
