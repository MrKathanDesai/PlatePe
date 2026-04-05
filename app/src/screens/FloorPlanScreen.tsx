import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CreditCard,
  Layers3,
  Plus,
  Search,
  ShoppingBag,
  TimerReset,
  X,
} from 'lucide-react';
import { useApp } from '../store/app-store-context';
import { ordersApi } from '../api/orders';
import { tablesApi } from '../api/tables';
import type { Table, TableAttentionType, TableStatus } from '../types';

type StatusFilter = TableStatus | 'All';

const UNASSIGNED_FLOOR_ID = '__unassigned__';

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusStyle(status: TableStatus): { border: string; bg: string; dot: string; chipBg: string } {
  switch (status) {
    case 'Available': return { border: 'var(--green)', bg: 'var(--green-bg)', dot: 'var(--green)', chipBg: 'rgba(29, 107, 62, 0.12)' };
    case 'Occupied': return { border: 'var(--red)', bg: 'var(--red-bg)', dot: 'var(--red)', chipBg: 'rgba(176, 32, 32, 0.1)' };
    case 'Needs Attention': return { border: 'var(--amber)', bg: 'var(--amber-bg)', dot: 'var(--amber)', chipBg: 'rgba(138, 84, 0, 0.12)' };
    case 'Unpaid': return { border: 'var(--red)', bg: 'var(--red-bg)', dot: 'var(--red)', chipBg: 'rgba(176, 32, 32, 0.1)' };
    case 'Reserved': return { border: 'var(--blue)', bg: 'var(--blue-bg)', dot: 'var(--blue)', chipBg: 'rgba(37, 84, 168, 0.12)' };
    default: return { border: 'var(--border)', bg: 'var(--surface)', dot: 'var(--text-3)', chipBg: 'var(--surface-2)' };
  }
}

function attentionLabel(type: TableAttentionType | null) {
  switch (type) {
    case 'PAYMENT_CASH': return 'Cash requested';
    case 'PAYMENT_CARD': return 'Card requested';
    default: return null;
  }
}

function detailActionLabel(table: Table, isCashier: boolean) {
  if (isCashier) {
    if (table.currentOrderId) return 'Open checkout';
    return 'Select table';
  }
  if (table.status === 'Available') return 'Open new order';
  if (table.currentOrderId) return 'Resume order';
  return 'Refresh table';
}

function TableTile({
  table,
  selected,
  onSelect,
}: {
  table: Table;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = statusStyle(table.status);
  const attentionText = attentionLabel(table.attentionType);
  const showBill = (table.status === 'Occupied' || table.status === 'Needs Attention' || table.status === 'Unpaid') && table.currentBill != null;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        minHeight: 188,
        borderRadius: 18,
        border: `2px solid ${selected ? 'var(--accent)' : s.border}`,
        background: selected
          ? `linear-gradient(180deg, ${s.bg} 0%, var(--surface) 100%)`
          : `linear-gradient(180deg, var(--surface) 0%, ${s.bg} 100%)`,
        boxShadow: selected ? '0 16px 34px rgba(13,13,11,0.12)' : '0 10px 24px rgba(13,13,11,0.08)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.06em',
            color: 'var(--text)',
          }}>
            {table.number}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
            {table.seats} seats
          </div>
        </div>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: s.dot,
            flexShrink: 0,
            boxShadow: `0 0 0 6px ${s.chipBg}`,
            marginTop: 4,
          }}
        />
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 999,
          background: s.chipBg,
          color: s.dot,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {table.status}
      </div>

      {attentionText && (
        <div
          style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 11px',
            borderRadius: 999,
            background: 'rgba(138, 84, 0, 0.1)',
            color: 'var(--amber)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)' }} />
          {attentionText}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          {showBill && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              ₹{Number(table.currentBill).toFixed(0)}
            </div>
          )}
          {table.occupiedSince && (
            <div style={{ marginTop: showBill ? 4 : 0, fontSize: 12, color: 'var(--text-3)' }}>
              {timeSince(table.occupiedSince)}
            </div>
          )}
        </div>

        {attentionText && (
          <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
            Needs response
          </div>
        )}
      </div>
    </button>
  );
}

export default function FloorPlanScreen() {
  const {
    tables,
    floors,
    session,
    refreshTables,
    refreshFloors,
    navigate,
    setActiveOrder,
    setActiveTable,
    showToast,
    user,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [loading, setLoading] = useState(false);
  const [takeawayLoading, setTakeawayLoading] = useState(false);
  const [transferFrom, setTransferFrom] = useState<Table | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [freeingTableId, setFreeingTableId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string>(UNASSIGNED_FLOOR_ID);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const isCashier = user?.role === 'Cashier';

  useEffect(() => {
    void Promise.all([refreshTables(), refreshFloors()]);
  }, [refreshTables, refreshFloors]);

  useEffect(() => {
    const floorIds = new Set(floors.map((floor) => floor.id));
    if (selectedFloorId === UNASSIGNED_FLOOR_ID) {
      if (floors.length > 0 && tables.some((table) => table.floorId === floors[0].id)) {
        setSelectedFloorId(floors[0].id);
      }
      return;
    }

    if (!floorIds.has(selectedFloorId)) {
      setSelectedFloorId(floors[0]?.id ?? UNASSIGNED_FLOOR_ID);
    }
  }, [floors, selectedFloorId, tables]);

  const floorOptions = useMemo(() => {
    const options = floors.map((floor) => ({ id: floor.id, label: floor.name }));
    if (tables.some((table) => table.isActive && !table.floorId)) {
      options.unshift({ id: UNASSIGNED_FLOOR_ID, label: 'Unassigned' });
    }
    if (options.length === 0) {
      options.push({ id: UNASSIGNED_FLOOR_ID, label: 'Unassigned' });
    }
    return options;
  }, [floors, tables]);

  const filtered = useMemo(() => (
    tables
      .filter((t) => t.isActive)
      .filter((t) => (selectedFloorId === UNASSIGNED_FLOOR_ID ? !t.floorId : t.floorId === selectedFloorId))
      .filter((t) => filter === 'All' || t.status === filter)
      .filter((t) => t.number.toLowerCase().includes(search.toLowerCase()))
  ), [filter, search, selectedFloorId, tables]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedTableId(null);
      return;
    }
    if (!selectedTableId || !filtered.some((table) => table.id === selectedTableId)) {
      setSelectedTableId(filtered[0].id);
    }
  }, [filtered, selectedTableId]);

  const selectedTable = filtered.find((table) => table.id === selectedTableId) ?? null;
  const attentionTables = filtered.filter((table) => table.attentionType);

  const counts = {
    Available: tables.filter((t) => t.status === 'Available').length,
    Occupied: tables.filter((t) => t.status === 'Occupied').length,
    Attention: tables.filter((t) => t.status === 'Needs Attention' || t.status === 'Unpaid').length,
  };

  const openTableWorkflow = async (table: Table) => {
    if (!session) {
      showToast('Open a session first');
      return;
    }

    setLoading(true);
    setActiveTable(table.id);

    try {
      if (isCashier) {
        if (!table.currentOrderId) {
          showToast('No active order on this table');
          return;
        }
        const res = await ordersApi.getById(table.currentOrderId);
        setActiveOrder(res.data);
        navigate('Payment');
        return;
      }

      if (table.status === 'Available') {
        const res = await ordersApi.create({ tableId: table.id, sessionId: session.id });
        setActiveOrder(res.data);
        navigate('Order');
        return;
      }

      if (table.currentOrderId) {
        const res = await ordersApi.getById(table.currentOrderId);
        if (res.data.status === 'Voided') {
          await refreshTables();
          showToast('Table is now available');
          return;
        }

        if (res.data.status === 'Paid') {
          const hasOutstandingItems = res.data.items.some(
            (item) => item.status !== 'Done' && item.status !== 'Voided',
          );
          await refreshTables();
          showToast(
            hasOutstandingItems
              ? 'Order is already paid and still being prepared'
              : 'Table is now available',
          );
          return;
        }

        setActiveOrder(res.data);
        navigate('Order');
        return;
      }

      await refreshTables();
    } catch {
      showToast(isCashier ? 'Failed to open checkout' : 'Failed to open order');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeaway = async () => {
    if (!session) {
      showToast('Open a session first');
      return;
    }
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
      setSelectedTableId(toTable.id);
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
  const selectedAttention = selectedTable ? attentionLabel(selectedTable.attentionType) : null;

  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.05em' }}>
            Floor service board
          </h1>
          <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(counts).map(([label, count]) => (
              <span key={label} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{count}</span> {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isCashier && (
            <button
              className="btn btn-primary"
              style={{ fontSize: 12 }}
              onClick={handleTakeaway}
              disabled={takeawayLoading}
            >
              <ShoppingBag size={13} /> {takeawayLoading ? 'Opening…' : 'Takeaway'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              className="input"
              placeholder="Search table"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, width: 160 }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {floorOptions.map((floor) => (
          <button
            key={floor.id}
            className={`btn ${selectedFloorId === floor.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12 }}
            onClick={() => setSelectedFloorId(floor.id)}
          >
            <Layers3 size={12} /> {floor.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((item) => (
          <button
            key={item}
            className={`btn ${filter === item ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {attentionTables.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            padding: '14px 16px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(138, 84, 0, 0.06) 0%, rgba(138, 84, 0, 0.03) 100%)',
            border: '1px solid rgba(138, 84, 0, 0.18)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginRight: 4 }}>
            Payment requests
          </div>
          {attentionTables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelectedTableId(table.id)}
              style={{
                border: table.id === selectedTableId ? '1px solid var(--accent)' : '1px solid rgba(138, 84, 0, 0.22)',
                background: '#fff',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '7px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {table.number} · {attentionLabel(table.attentionType)}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="modal-overlay" style={{ background: 'rgba(248,246,242,0.5)' }}>
          <div style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>
            {isCashier ? 'Opening checkout…' : 'Opening order…'}
          </div>
        </div>
      )}

      {transferFrom && (
        <div className="modal-overlay">
          <div className="card" style={{ width: 460, padding: 24, position: 'relative' }}>
            <button
              onClick={() => setTransferFrom(null)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
            >
              <X size={16} />
            </button>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>
              Transfer {transferFrom.number}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 18px' }}>
              Pick an available table to move this order.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {tables.filter((t) => t.isActive && t.status === 'Available' && t.id !== transferFrom.id).map((table) => (
                <button
                  key={table.id}
                  onClick={() => handleTransfer(table)}
                  disabled={transferring}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 12,
                    border: '1.5px solid var(--green)',
                    background: 'var(--green-bg)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  {table.number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', minHeight: 0, flex: 1 }}>
        <section style={{ flex: '1 1 760px', minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div
              className="card"
              style={{
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-3)',
              }}
            >
              <Plus size={32} style={{ marginBottom: 10, opacity: 0.35 }} />
              No tables match this floor and filter.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 18,
                alignItems: 'stretch',
              }}
            >
              {filtered.map((table) => (
                <TableTile
                  key={table.id}
                  table={table}
                  selected={table.id === selectedTableId}
                  onSelect={() => setSelectedTableId(table.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside style={{ flex: '0 0 320px', width: 320, maxWidth: '100%' }}>
          <div
            className="card"
            style={{
              padding: 22,
              borderRadius: 18,
              position: 'sticky',
              top: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              minHeight: 320,
            }}
          >
            {selectedTable ? (
              <>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Selected table
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.06em' }}>
                        {selectedTable.number}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>
                        {selectedTable.seats} seats
                      </div>
                    </div>
                    <span style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: statusStyle(selectedTable.status).dot,
                      marginTop: 8,
                    }}
                    />
                  </div>
                </div>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  alignSelf: 'flex-start',
                  background: statusStyle(selectedTable.status).chipBg,
                  color: statusStyle(selectedTable.status).dot,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {selectedTable.status}
                </div>

                {selectedAttention && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'rgba(138, 84, 0, 0.08)',
                    border: '1px solid rgba(138, 84, 0, 0.2)',
                    color: 'var(--amber)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Pending request</div>
                    <div style={{ marginTop: 4, fontSize: 14 }}>{selectedAttention}</div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                      Bill
                    </div>
                    <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                      {selectedTable.currentBill != null ? `₹${Number(selectedTable.currentBill).toFixed(0)}` : '--'}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                      Open time
                    </div>
                    <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                      {selectedTable.occupiedSince ? timeSince(selectedTable.occupiedSince) : '--'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => void openTableWorkflow(selectedTable)}
                    disabled={loading || freeingTableId === selectedTable.id}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {isCashier ? <CreditCard size={14} /> : <ShoppingBag size={14} />}
                    {detailActionLabel(selectedTable, isCashier)}
                  </button>

                  {!isCashier && selectedTable.status === 'Occupied' && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setTransferFrom(selectedTable)}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <ArrowRightLeft size={14} /> Transfer table
                    </button>
                  )}

                  {!isCashier && selectedTable.status !== 'Available' && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => void handleFreeTable(selectedTable)}
                      disabled={freeingTableId === selectedTable.id}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <TimerReset size={14} /> {freeingTableId === selectedTable.id ? 'Freeing…' : 'Free table'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', textAlign: 'center' }}>
                Select a table to view its details and actions.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
