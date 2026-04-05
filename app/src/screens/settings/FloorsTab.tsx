import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { floorsApi } from '../../api/floors';
import { useApp } from '../../store/app-store-context';
import type { Floor } from '../../types';

type FloorForm = {
  name: string;
  sortOrder: string;
  width: string;
  height: string;
};

const emptyForm: FloorForm = {
  name: '',
  sortOrder: '0',
  width: '1200',
  height: '800',
};

export default function FloorsTab() {
  const { floors, tables, refreshFloors, showToast } = useApp();
  const [form, setForm] = useState<FloorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<FloorForm>(emptyForm);

  const tableCountByFloorId = useMemo(() => {
    const map = new Map<string, number>();
    tables.filter((table) => table.isActive && table.floorId).forEach((table) => {
      const floorId = table.floorId as string;
      map.set(floorId, (map.get(floorId) ?? 0) + 1);
    });
    return map;
  }, [tables]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast('Floor name is required');
      return;
    }

    setSaving(true);
    try {
      await floorsApi.create({
        name: form.name.trim(),
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        width: parseInt(form.width, 10) || 1200,
        height: parseInt(form.height, 10) || 800,
      });
      await refreshFloors();
      setForm(emptyForm);
      showToast('Floor created');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to create floor');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (floor: Floor) => {
    setEditingId(floor.id);
    setEditingForm({
      name: floor.name,
      sortOrder: String(floor.sortOrder),
      width: String(floor.width),
      height: String(floor.height),
    });
  };

  const handleUpdate = async (floorId: string) => {
    if (!editingForm.name.trim()) {
      showToast('Floor name is required');
      return;
    }

    try {
      await floorsApi.update(floorId, {
        name: editingForm.name.trim(),
        sortOrder: parseInt(editingForm.sortOrder, 10) || 0,
        width: parseInt(editingForm.width, 10) || 1200,
        height: parseInt(editingForm.height, 10) || 800,
      });
      await refreshFloors();
      setEditingId(null);
      showToast('Floor updated');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to update floor');
    }
  };

  const handleDelete = async (floorId: string) => {
    if (!window.confirm('Delete this floor? Tables must be moved off it first.')) return;

    try {
      await floorsApi.delete(floorId);
      await refreshFloors();
      showToast('Floor removed');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to remove floor');
    }
  };

  return (
    <div style={{ maxWidth: 880 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>
          Add Floor
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Name
            </label>
            <input className="input" placeholder="Main Hall, Patio, Terrace…"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Order
            </label>
            <input className="input" type="number" value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Width
            </label>
            <input className="input" type="number" value={form.width}
              onChange={(e) => setForm({ ...form, width: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Height
            </label>
            <input className="input" type="number" value={form.height}
              onChange={(e) => setForm({ ...form, height: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Floor</th><th>Canvas</th><th>Tables</th><th></th></tr>
          </thead>
          <tbody>
            {floors.map((floor) => {
              const isEditing = editingId === floor.id;
              return (
                <tr key={floor.id}>
                  <td>
                    {isEditing ? (
                      <input className="input" value={editingForm.name}
                        onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                      />
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600 }}>{floor.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Sort order {floor.sortOrder}</div>
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input" type="number" value={editingForm.width}
                          onChange={(e) => setEditingForm({ ...editingForm, width: e.target.value })}
                          style={{ width: 90 }}
                        />
                        <input className="input" type="number" value={editingForm.height}
                          onChange={(e) => setEditingForm({ ...editingForm, height: e.target.value })}
                          style={{ width: 90 }}
                        />
                      </div>
                    ) : (
                      `${floor.width} × ${floor.height}`
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {tableCountByFloorId.get(floor.id) ?? 0}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {isEditing ? (
                        <>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => handleUpdate(floor.id)}>
                            <Check size={12} />
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setEditingId(null)}>
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => startEditing(floor)}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(floor.id)}>
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {floors.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                No floors yet. Add one above to organize the dining area.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
