import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { useApp } from '../../store/AppContext';
import type { InventoryItem } from '../../types';

export default function InventoryTab() {
  const { showToast } = useApp();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<Record<string, string>>({});

  const load = async () => {
    try { const r = await inventoryApi.getAll(); setItems(r.data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdjust = async (item: InventoryItem) => {
    const val = parseFloat(adjustment[item.id] ?? '0');
    if (isNaN(val)) { showToast('Enter a valid number'); return; }
    setAdjusting(item.id);
    try {
      await inventoryApi.adjust({ productId: item.productId, adjustment: val });
      await load();
      setAdjustment((prev) => ({ ...prev, [item.id]: '' }));
      showToast('Inventory updated');
    } catch { showToast('Failed to adjust'); }
    finally { setAdjusting(null); }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Product</th><th>Stock</th><th>Unit</th><th>Threshold</th><th>Adjust</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => {
              const low = item.quantity <= item.lowStockThreshold;
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {low && <AlertTriangle size={13} color="var(--amber)" />}
                      <span style={{ fontWeight: low ? 600 : 400 }}>{item.productName}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>{item.quantity}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.unit}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.lowStockThreshold}</td>
                  <td>
                    <input className="input" type="number" placeholder="+5 or −2"
                      value={adjustment[item.id] ?? ''} onChange={(e) => setAdjustment((p) => ({ ...p, [item.id]: e.target.value }))}
                      style={{ width: 100, padding: '5px 9px' }}
                    />
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }}
                      onClick={() => handleAdjust(item)} disabled={adjusting === item.id}>
                      {adjusting === item.id ? '…' : 'Apply'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>
                No inventory items. Add products first.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
