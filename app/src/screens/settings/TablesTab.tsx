import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useApp } from '../../store/app-store-context';
import { tablesApi } from '../../api/tables';
import type { Table } from '../../types';

type TableForm = {
  number: string;
  seats: string;
  floorId: string;
  x: string;
  y: string;
  width: string;
  height: string;
};

const emptyForm: TableForm = {
  number: '',
  seats: '4',
  floorId: '',
  x: '',
  y: '',
  width: '140',
  height: '110',
};

function normalizeTableNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function toPayload(form: TableForm) {
  const parseMaybeNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    number: normalizeTableNumber(form.number),
    seats: parseInt(form.seats, 10) || 4,
    floorId: form.floorId || undefined,
    x: parseMaybeNumber(form.x),
    y: parseMaybeNumber(form.y),
    width: parseMaybeNumber(form.width),
    height: parseMaybeNumber(form.height),
    shape: 'rectangle',
    rotation: 0,
  };
}

function formFromTable(table: Table): TableForm {
  return {
    number: table.number,
    seats: String(table.seats),
    floorId: table.floorId ?? '',
    x: table.x != null ? String(table.x) : '',
    y: table.y != null ? String(table.y) : '',
    width: table.width != null ? String(table.width) : '140',
    height: table.height != null ? String(table.height) : '110',
  };
}

export default function TablesTab() {
  const { tables, floors, refreshTables, showToast } = useApp();
  const [form, setForm] = useState<TableForm>(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<TableForm>(emptyForm);

  const activeTables = useMemo(() => tables.filter((t) => t.isActive), [tables]);

  const handleAdd = async () => {
    const normalizedNumber = normalizeTableNumber(form.number);
    if (!normalizedNumber) {
      showToast('Enter a table number');
      return;
    }

    setAdding(true);
    try {
      await tablesApi.create(toPayload(form));
      await refreshTables();
      setForm(emptyForm);
      showToast('Table added');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to add table');
    } finally {
      setAdding(false);
    }
  };

  const startEditing = (table: Table) => {
    setEditingId(table.id);
    setEditingForm(formFromTable(table));
  };

  const handleSaveEdit = async (tableId: string) => {
    const normalizedNumber = normalizeTableNumber(editingForm.number);
    if (!normalizedNumber) {
      showToast('Enter a table number');
      return;
    }

    try {
      await tablesApi.update(tableId, {
        ...toPayload(editingForm),
        floorId: editingForm.floorId || null,
        x: editingForm.x.trim() ? parseInt(editingForm.x, 10) : null,
        y: editingForm.y.trim() ? parseInt(editingForm.y, 10) : null,
        width: editingForm.width.trim() ? parseInt(editingForm.width, 10) : null,
        height: editingForm.height.trim() ? parseInt(editingForm.height, 10) : null,
      });
      await refreshTables();
      setEditingId(null);
      showToast('Table updated');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to update table');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tablesApi.delete(id);
      await refreshTables();
      showToast('Table removed');
    } catch {
      showToast('Failed to remove table');
    }
  };

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Add Table</h2>
        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 14px' }}>
          Create tables, place them on a floor, and store layout coordinates for the live floor plan.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr auto', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Table</label>
            <input className="input" placeholder="T1, B12, Patio-4…" value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Seats</label>
            <input className="input" type="number" min="1" value={form.seats}
              onChange={(e) => setForm({ ...form, seats: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Floor</label>
            <select className="input" value={form.floorId} onChange={(e) => setForm({ ...form, floorId: e.target.value })}>
              <option value="">Unassigned</option>
              {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>X</label>
            <input className="input" type="number" value={form.x}
              onChange={(e) => setForm({ ...form, x: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Y</label>
            <input className="input" type="number" value={form.y}
              onChange={(e) => setForm({ ...form, y: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>W</label>
            <input className="input" type="number" min="40" value={form.width}
              onChange={(e) => setForm({ ...form, width: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>H</label>
            <input className="input" type="number" min="40" value={form.height}
              onChange={(e) => setForm({ ...form, height: e.target.value })}
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
          <thead><tr><th>Table</th><th>Seats</th><th>Floor</th><th>Layout</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {activeTables.map((table) => {
              const isEditing = editingId === table.id;
              return (
                <tr key={table.id}>
                  <td style={{ fontWeight: 600 }}>
                    {isEditing ? (
                      <input className="input" value={editingForm.number}
                        onChange={(e) => setEditingForm({ ...editingForm, number: e.target.value })}
                        style={{ width: 110 }}
                      />
                    ) : table.number}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="input" type="number" min="1" value={editingForm.seats}
                        onChange={(e) => setEditingForm({ ...editingForm, seats: e.target.value })}
                        style={{ width: 80 }}
                      />
                    ) : table.seats}
                  </td>
                  <td>
                    {isEditing ? (
                      <select className="input" value={editingForm.floorId}
                        onChange={(e) => setEditingForm({ ...editingForm, floorId: e.target.value })}
                        style={{ minWidth: 140 }}
                      >
                        <option value="">Unassigned</option>
                        {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{table.floor?.name ?? 'Unassigned'}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input" type="number" value={editingForm.x}
                          onChange={(e) => setEditingForm({ ...editingForm, x: e.target.value })}
                          style={{ width: 70 }}
                        />
                        <input className="input" type="number" value={editingForm.y}
                          onChange={(e) => setEditingForm({ ...editingForm, y: e.target.value })}
                          style={{ width: 70 }}
                        />
                        <input className="input" type="number" min="40" value={editingForm.width}
                          onChange={(e) => setEditingForm({ ...editingForm, width: e.target.value })}
                          style={{ width: 70 }}
                        />
                        <input className="input" type="number" min="40" value={editingForm.height}
                          onChange={(e) => setEditingForm({ ...editingForm, height: e.target.value })}
                          style={{ width: 70 }}
                        />
                      </div>
                    ) : (
                      `${table.x ?? 0}, ${table.y ?? 0} · ${table.width ?? 140}×${table.height ?? 110}`
                    )}
                  </td>
                  <td><span className={`badge ${table.status === 'Available' ? 'badge-green' : table.status === 'Occupied' ? 'badge-red' : 'badge-amber'}`}>{table.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      {isEditing ? (
                        <>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => handleSaveEdit(table.id)}>
                            <Check size={12} />
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setEditingId(null)}>
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => startEditing(table)}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '4px 10px' }}
                            onClick={() => handleDelete(table.id)} disabled={table.status !== 'Available'}>
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {activeTables.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No tables yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
