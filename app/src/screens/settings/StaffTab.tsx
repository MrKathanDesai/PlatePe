import { useState, useEffect } from 'react';
import { Plus, UserX, UserCheck } from 'lucide-react';
import { authApi } from '../../api/auth';
import { useApp } from '../../store/app-store-context';
import type { User } from '../../types';

const ROLES = ['Admin', 'Manager', 'Cashier', 'Server', 'Barista', 'Chef'] as const;
const ROLE_LABELS: Record<string, string> = {
  Admin: 'Admin', Manager: 'Manager', Cashier: 'Cashier',
  Server: 'Server', Barista: 'Barista', Chef: 'Chef',
};
const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin:   'Full system access',
  Manager: 'Operations & reports',
  Cashier: 'POS terminal & payments',
  Server:  'Floor plan & orders',
  Barista: 'Brewbar KDS only',
  Chef:    'Kitchen KDS only',
};

export default function StaffTab() {
  const { showToast } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Server' });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { const r = await authApi.findAll(); setUsers(r.data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) { showToast('Fill all fields'); return; }
    setAdding(true);
    try {
      await authApi.register(form);
      await load();
      setForm({ name: '', email: '', password: '', role: 'Server' });
      setShowAdd(false);
      showToast('Staff member added');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to add staff');
    } finally { setAdding(false); }
  };

  const handleDeactivate = async (id: string) => {
    try { await authApi.deactivate(id); await load(); showToast('User deactivated'); }
    catch { showToast('Failed to deactivate'); }
  };

  const handleReactivate = async (id: string) => {
    try { await authApi.reactivate(id); await load(); showToast('User reactivated'); }
    catch { showToast('Failed to reactivate'); }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={13} /> Add Staff
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>New Staff Member</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text' },
              { label: 'Email',    key: 'email', type: 'email' },
              { label: 'Password', key: 'password', type: 'password' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                <input className="input" type={type} value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? 'Adding…' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={{ fontWeight: 600 }}>{user.name}</td>
                <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{user.email}</td>
                <td><span className="badge badge-accent">{ROLE_LABELS[user.role] ?? user.role}</span></td>
                <td><span className={`badge ${user.isActive ? 'badge-green' : 'badge-muted'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                <td style={{ textAlign: 'right' }}>
                  {user.isActive ? (
                    <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={() => handleDeactivate(user.id)}
                      title="Deactivate user">
                      <UserX size={12} />
                    </button>
                  ) : (
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', color: 'var(--green)' }}
                      onClick={() => handleReactivate(user.id)} title="Reactivate user">
                      <UserCheck size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
