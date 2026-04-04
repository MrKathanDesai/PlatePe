import { useState, useEffect } from 'react';
import { Search, Plus, ShoppingBag, ArrowRightLeft, X } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { ordersApi } from '../api/orders';
import { tablesApi } from '../api/tables';
import type { Table, TableStatus } from '../types';

type StatusFilter = TableStatus | 'All';

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusStyle(status: TableStatus): { border: string; bg: string; dot: string } {
  switch (status) {
    case 'Available':      return { border: 'var(--green)',  bg: 'var(--green-bg)',  dot: 'var(--green)' };
    case 'Occupied':       return { border: 'var(--red)',    bg: 'var(--red-bg)',    dot: 'var(--red)' };
    case 'Needs Attention':return { border: 'var(--amber)',  bg: 'var(--amber-bg)', dot: 'var(--amber)' };
    case 'Unpaid':         return { border: 'var(--red)',    bg: 'var(--red-bg)',    dot: 'var(--red)' };
    case 'Reserved':       return { border: 'var(--blue)',   bg: 'var(--blue-bg)',  dot: 'var(--blue)' };
    default:               return { border: 'var(--border)', bg: 'var(--surface)',   dot: 'var(--text-3)' };
  }
}

function TableCard({
  table,
  onClick,
  readonly,
  onTransfer,
  onFree,
  freeing,
}: {
  table: Table;
  onClick: () => void;
  readonly?: boolean;
  onTransfer?: () => void;
  onFree?: () => void;
  freeing?: boolean;
}) {
  const s = statusStyle(table.status);
  const cardDisabled = (readonly && table.status !== 'Available') || freeing;

  return (
    <div
      role="button"
      tabIndex={cardDisabled ? -1 : 0}
      onClick={() => { if (!cardDisabled) onClick(); }}
      onKeyDown={(e) => {
        if (cardDisabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        padding: '12px 14px', // Reduced padding
        cursor: cardDisabled ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
        color: 'var(--text)',
        transition: 'all 140ms',
        boxShadow: 'var(--shadow-xs)',
        outline: 'none',
      }}
      onMouseEnter={(e) => { if (!cardDisabled) (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-xs)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, // Slightly smaller font
          fontWeight: 300,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {table.number}
        </div>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, marginTop: 4, flexShrink: 0 }} />
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>
        {table.seats} seats
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: s.dot }}>
        {table.status}
      </div>

      {table.status === 'Occupied' && table.currentBill != null && (
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginTop: 4 }}>
          ₹{Number(table.currentBill).toFixed(0)}
        </div>
      )}
      {table.occupiedSince && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
          {timeSince(table.occupiedSince)}
        </div>
      )}
      {(onTransfer || onFree) && table.status !== 'Available' && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {onTransfer && table.status === 'Occupied' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTransfer(); }}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowRightLeft size={11} /> Transfer
              </button>
            )}
            {onFree && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFree(); }}
                disabled={freeing}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: freeing ? 'default' : 'pointer', fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={11} /> {freeing ? 'Freeing…' : 'Free Table'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FloorPlanScreen() {
  const { tables, session, refreshTables, navigate, setActiveOrder, setActiveTable, showToast, user } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [loading, setLoading] = useState(false);
  const [takeawayLoading, setTakeawayLoading] = useState(false);
  const [transferFrom, setTransferFrom] = useState<Table | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [freeingTableId, setFreeingTableId] = useState<string | null>(null);
  const isCashier = user?.role === 'Cashier';

  useEffect(() => { refreshTables(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tables
    .filter((t) => t.isActive)
    .filter((t) => filter === 'All' || t.status === filter)
    .filter((t) => t.number.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    Available: tables.filter((t) => t.status === 'Available').length,
    Occupied:  tables.filter((t) => t.status === 'Occupied').length,
    Attention: tables.filter((t) => t.status === 'Needs Attention' || t.status === 'Unpaid').length,
  };

  const handleTableClick = async (table: Table) => {
    if (isCashier) return; // Cashier uses floor plan as view only
    if (!session) { showToast('Open a session first'); return; }
    setLoading(true);
    setActiveTable(table.id);
    try {
      if (table.status === 'Available') {
        const res = await ordersApi.create({ tableId: table.id, sessionId: session.id });
        setActiveOrder(res.data);
        navigate('Order');
      } else if (table.currentOrderId) {
        const res = await ordersApi.getById(table.currentOrderId);
        // If the order was already paid, refresh tables and don't navigate
        if (res.data.status === 'Paid' || res.data.status === 'Voided') {
          await refreshTables();
          showToast('Table is now available');
        } else {
          setActiveOrder(res.data);
          navigate('Order');
        }
      } else {
        // Table is occupied but has no order — stale state, just refresh
        await refreshTables();
      }
    } catch {
      showToast('Failed to open order');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeaway = async () => {
    if (!session) { showToast('Open a session first'); return; }
    setTakeawayLoading(true);
    setActiveTable(null);
    try {
      const res = await ordersApi.create({ sessionId: session.id });
      setActiveOrder(res.data);
      navigate('Order');
    } catch {
      showToast('Failed to create takeaway order');
    } finally {
      setTakeawayLoading(false);
    }
  };

  const handleTransfer = async (toTable: Table) => {
    if (!transferFrom?.currentOrderId) return;
    setTransferring(true);
    try {
      await tablesApi.transfer(transferFrom.id, { toTableId: toTable.id, orderId: transferFrom.currentOrderId });
      await refreshTables();
      showToast(`Moved to Table ${toTable.number}`);
      setTransferFrom(null);
    } catch {
      showToast('Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleFreeTable = async (table: Table) => {
    const confirmationMessage = table.currentOrderId
      ? `Free up Table ${table.number}? The linked order will stay open, but it will no longer be attached to this table.`
      : `Free up Table ${table.number}?`;

    if (!window.confirm(confirmationMessage)) return;

    setFreeingTableId(table.id);
    try {
      await tablesApi.updateStatus(table.id, 'Available');
      await refreshTables();
      showToast(`Table ${table.number} is now available`);
    } catch {
      showToast('Failed to free table');
    } finally {
      setFreeingTableId(null);
    }
  };

  const FILTERS: StatusFilter[] = ['All', 'Available', 'Occupied', 'Needs Attention', 'Unpaid'];

  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Floor Plan
          </h1>
          <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
            {Object.entries(counts).map(([label, count]) => (
              <span key={label} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{count}</span> {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isCashier && (
            <button className="btn btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={handleTakeaway} disabled={takeawayLoading}>
              <ShoppingBag size={13} /> {takeawayLoading ? 'Opening…' : 'Takeaway'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input className="input" placeholder="Table…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, width: 140 }}
            />
          </div>
          {FILTERS.map((f) => (
            <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setFilter(f)}
            >{f}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="modal-overlay" style={{ background: 'rgba(248,246,242,0.5)' }}>
          <div style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>Opening order…</div>
        </div>
      )}

      {transferFrom && (
        <div className="modal-overlay">
          <div className="card" style={{ width: 460, padding: 24, position: 'relative' }}>
            <button onClick={() => setTransferFrom(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              <X size={16} />
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Transfer Table {transferFrom.number}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 18px' }}>Select an available table to move this order to</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {tables.filter((t) => t.isActive && t.status === 'Available' && t.id !== transferFrom.id).map((t) => (
                <button key={t.id} onClick={() => handleTransfer(t)} disabled={transferring}
                  style={{ padding: '12px 8px', borderRadius: 10, border: '1px solid var(--green)', background: 'var(--green-bg)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--text)', transition: 'all 130ms' }}>
                  {t.number}
                </button>
              ))}
              {tables.filter((t) => t.isActive && t.status === 'Available').length === 0 && (
                <p style={{ gridColumn: '1/-1', color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>No available tables</p>
              )}
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
          <Plus size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
          <p>No tables found. Add tables in Settings.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 14, 
          overflowY: 'auto', 
          flex: 1,
          alignContent: 'start', // Prevent rows from stretching to fill the flex container
        }}>
          {filtered.map((table) => (
            <TableCard key={table.id} table={table} onClick={() => handleTableClick(table)} readonly={isCashier}
              onTransfer={!isCashier && table.status === 'Occupied' ? () => setTransferFrom(table) : undefined}
              onFree={!isCashier && table.status !== 'Available' ? () => handleFreeTable(table) : undefined}
              freeing={freeingTableId === table.id} />
          ))}
        </div>
      )}
    </div>
  );
}
