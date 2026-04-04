import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../store/app-store-context';
import { tablesApi } from '../../api/tables';

export default function TablesTab() {
  const { tables, refreshTables, showToast } = useApp();
  const [newNumber, setNewNumber] = useState('');
  const [newSeats, setNewSeats] = useState('4');
  const [adding, setAdding] = useState(false);

  const activeTables = tables.filter((t) => t.isActive);

  const handleAdd = async () => {
    if (!newNumber.trim()) { showToast('Enter a table number'); return; }
    setAdding(true);
    try {
      await tablesApi.create({ number: newNumber.trim(), seats: parseInt(newSeats) || 4 });
      await refreshTables();
      setNewNumber(''); setNewSeats('4');
      showToast('Table added');
    } catch { showToast('Failed to add table'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    try { await tablesApi.delete(id); await refreshTables(); showToast('Table removed'); }
    catch { showToast('Failed to remove table'); }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Add Table</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Number / Name</label>
            <input className="input" placeholder="T1, Bar 2, Patio 3…" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Seats</label>
            <input className="input" type="number" min="1" value={newSeats} onChange={(e) => setNewSeats(e.target.value)} />
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
          <thead><tr><th>Table</th><th>Seats</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {activeTables.map((table) => (
              <tr key={table.id}>
                <td style={{ fontWeight: 600 }}>{table.number}</td>
                <td>{table.seats}</td>
                <td><span className={`badge ${table.status === 'Available' ? 'badge-green' : table.status === 'Occupied' ? 'badge-red' : 'badge-amber'}`}>{table.status}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-danger" style={{ padding: '4px 10px' }}
                    onClick={() => handleDelete(table.id)} disabled={table.status !== 'Available'}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {activeTables.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No tables yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
