import { useState, useEffect } from 'react';
import { Plus, Monitor } from 'lucide-react';
import { sessionsApi } from '../../api/sessions';
import { useApp } from '../../store/AppContext';
import type { Terminal } from '../../types';

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
    <div style={{ maxWidth: 600 }}>
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Terminal</th><th>Location</th><th>Status</th></tr></thead>
          <tbody>
            {terminals.map((t) => (
              <tr key={t.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={14} color="var(--text-3)" />
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{t.location ?? '—'}</td>
                <td>
                  <span className={`badge ${t.isLocked ? 'badge-amber' : 'badge-green'}`}>
                    {t.isLocked ? 'In Use' : 'Available'}
                  </span>
                </td>
              </tr>
            ))}
            {terminals.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                No terminals yet. Add one above to open sessions.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
