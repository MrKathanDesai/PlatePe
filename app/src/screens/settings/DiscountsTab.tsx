import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { discountsApi } from '../../api/discounts';
import { useApp } from '../../store/app-store-context';
import type { Discount } from '../../types';

export default function DiscountsTab() {
  const { showToast } = useApp();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', type: 'Percentage' as 'Percentage' | 'Fixed', value: '', approvalThreshold: '' });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { const r = await discountsApi.getAll(); setDiscounts(r.data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.value) { showToast('Fill all fields'); return; }
    setAdding(true);
    try {
      await discountsApi.create({
        name: form.name, type: form.type, value: parseFloat(form.value),
        approvalThreshold: form.approvalThreshold ? parseFloat(form.approvalThreshold) : undefined,
      });
      await load(); setForm({ name: '', type: 'Percentage', value: '', approvalThreshold: '' }); showToast('Discount created');
    } catch { showToast('Failed to create'); }
    finally { setAdding(false); }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>New Discount</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Name</label>
            <input className="input" placeholder="Staff Discount" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'Percentage' | 'Fixed' })}>
              <option>Percentage</option><option>Fixed</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Value {form.type === 'Percentage' ? '(%)' : '(₹)'}
            </label>
            <input className="input" type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Min Order (₹) <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>optional</span>
            </label>
            <input className="input" type="number" min="0" placeholder="No limit"
              value={form.approvalThreshold} onChange={(e) => setForm({ ...form, approvalThreshold: e.target.value })} />
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
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Min Order</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{d.type}</td>
                <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{d.type === 'Percentage' ? `${d.value}%` : `₹${d.value}`}</td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{d.approvalThreshold ? `₹${d.approvalThreshold}` : '—'}</td>
                <td>
                  <button onClick={async () => { await discountsApi.update(d.id, { isActive: !d.isActive }); load(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <span className={`badge ${d.isActive ? 'badge-green' : 'badge-muted'}`}>{d.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={async () => { await discountsApi.delete(d.id); load(); }}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {discounts.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No discounts yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
