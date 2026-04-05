import { useState, useEffect } from 'react';
import { Plus, Monitor } from 'lucide-react';
import { sessionsApi } from '../../api/sessions';
import { useApp } from '../../store/app-store-context';
import type { Terminal } from '../../types';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—';
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function TerminalsTab() {
  const { showToast } = useApp();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', location: '' });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { const r = await sessionsApi.getTerminals(); setTerminals(r.data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) { showToast('Terminal name is required'); return; }
    setAdding(true);
    try {
      await sessionsApi.createTerminal({ name: form.name.trim(), location: form.location.trim() || undefined });
      await load();
      setForm({ name: '', location: '' });
      showToast('Terminal created');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to create terminal');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: '100%' }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>
          Add Terminal
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
          Terminals represent physical POS stations. You need at least one to open a session.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Name</label>
            <input className="input" placeholder="Main Counter, Bar, Patio…"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Location</label>
            <input className="input" placeholder="Optional"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Terminal</th><th>Location</th><th>Status</th><th>Last Open Session</th><th>Last Close</th></tr></thead>
          <tbody>
            {terminals.map((t) => (
              <tr key={t.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={14} color="var(--text-3)" />
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
                        Added {formatDateTime(t.createdAt)}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{t.location ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className={`badge ${t.isLocked ? 'badge-amber' : 'badge-green'}`}>
                      {t.isLocked
                        ? `In Use${t.lockedByUserName ? ` · ${t.lockedByUserName}` : ''}`
                        : 'Available'}
                    </span>
                    {t.activeSession && (
                      <div style={{ color: 'var(--text-3)', fontSize: 11 }}>
                        Opened {formatDateTime(t.activeSession.openedAt)}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  {t.lastOpenedSession ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>
                        {t.lastOpenedSession.userName ?? 'Unknown user'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {formatDateTime(t.lastOpenedSession.openedAt)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Float {formatCurrency(t.lastOpenedSession.openingBalance)}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>No sessions yet</span>
                  )}
                </td>
                <td>
                  {t.lastClosedSession ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                        {formatCurrency(t.lastClosedSession.salesTotal)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {t.lastClosedSession.orderCount} paid {t.lastClosedSession.orderCount === 1 ? 'order' : 'orders'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Closed {formatDateTime(t.lastClosedSession.closedAt)}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>No close yet</span>
                  )}
                </td>
              </tr>
            ))}
            {terminals.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                No terminals yet. Add one above to open sessions.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
