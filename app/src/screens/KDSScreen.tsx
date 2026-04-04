import { useState, useEffect, useCallback } from 'react';
import { ChefHat, LogOut, Clock } from 'lucide-react';
import { kdsApi, getKDSSocket } from '../api/kds';
import { useApp } from '../store/AppContext';
import type { KDSTicket } from '../types';

function minutesSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function getUrgency(mins: number): { border: string; bg: string; time: string } {
  if (mins < 8)  return { border: 'var(--green)',  bg: 'var(--green-bg)', time: 'var(--green)' };
  if (mins < 15) return { border: 'var(--amber)',  bg: 'var(--amber-bg)', time: 'var(--amber)' };
  return           { border: 'var(--red)',    bg: 'var(--red-bg)',   time: 'var(--red)' };
}

function LiveTimer({ receivedAt }: { receivedAt: string }) {
  const [mins, setMins] = useState(minutesSince(receivedAt));
  useEffect(() => {
    const id = setInterval(() => setMins(minutesSince(receivedAt)), 30000);
    return () => clearInterval(id);
  }, [receivedAt]);
  const u = getUrgency(mins);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: u.time }}>
      <Clock size={12} /> {mins}m
    </span>
  );
}

function TicketCard({ ticket, onAdvance, loading, compact }: {
  ticket: KDSTicket; onAdvance: () => void; loading: boolean; compact?: boolean;
}) {
  const mins = minutesSince(ticket.receivedAt);
  const u = getUrgency(mins);
  const isDone = ticket.stage === 'DONE';

  return (
    <div style={{
      background: isDone ? 'var(--surface-2)' : 'var(--surface)',
      border: `1px solid ${isDone ? 'var(--border)' : u.border}`,
      borderLeft: `4px solid ${isDone ? 'var(--border-mid)' : u.border}`,
      borderRadius: 10,
      padding: compact ? 14 : 18,
      opacity: isDone ? 0.55 : 1,
      marginBottom: 12,
      boxShadow: isDone ? 'none' : 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: compact ? 14 : 16, fontWeight: 700, color: 'var(--accent)' }}>
            #{ticket.orderNumber}
          </span>
          {ticket.tableNumber && (
            <span style={{ fontSize: compact ? 11 : 13, color: 'var(--text-3)', fontWeight: 500 }}>T{ticket.tableNumber}</span>
          )}
          {ticket.type === 'ADDON' && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'var(--amber-bg)', color: 'var(--amber)', fontWeight: 700 }}>+ADD</span>
          )}
        </div>
        {!isDone && <LiveTimer receivedAt={ticket.receivedAt} />}
      </div>

      <div style={{ marginBottom: isDone ? 0 : 12 }}>
        {ticket.items.map((item, i) => (
          <div key={i} style={{ marginBottom: compact ? 6 : 9 }}>
            <div style={{ fontSize: compact ? 14 : 17, fontWeight: 600, color: item.is86d ? 'var(--red)' : 'var(--text)', lineHeight: 1.2, textDecoration: item.is86d ? 'line-through' : 'none' }}>
              <span style={{ color: 'var(--accent)', marginRight: 5 }}>{item.quantity}×</span>
              {item.name}
              {item.is86d && <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700 }}>86</span>}
            </div>
            {item.modifiers?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {item.modifiers.map((m, mi) => (
                  <span key={mi} style={{
                    fontSize: 11, padding: '1px 7px', borderRadius: 100,
                    background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)',
                  }}>{m.name}</span>
                ))}
              </div>
            )}
            {item.note && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic', marginTop: 3 }}>{item.note}</div>
            )}
          </div>
        ))}
      </div>

      {!isDone && (
        <button className="btn btn-primary" style={{ width: '100%', fontSize: compact ? 12 : 14 }}
          onClick={onAdvance} disabled={loading}>
          {ticket.stage === 'TO_COOK' ? '▶ Start' : '✓ Done'}
        </button>
      )}
    </div>
  );
}

function Column({ title, count, tickets, onAdvance, advancingId, collapseCompleted }: {
  title: string; count: number; tickets: KDSTicket[];
  onAdvance: (id: string) => void; advancingId: string | null; collapseCompleted?: boolean;
}) {
  const isDoneCol = collapseCompleted;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {title}
        </h2>
        {count > 0 && (
          <span style={{
            background: 'var(--accent-bg)', color: 'var(--accent)',
            fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
            border: '1px solid var(--accent-mid)',
          }}>{count}</span>
        )}
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '28px 0', fontSize: 13 }}>—</div>
        ) : (
          tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} compact={isDoneCol}
              onAdvance={() => onAdvance(t.id)} loading={advancingId === t.id} />
          ))
        )}
      </div>
    </div>
  );
}

export default function KDSScreen() {
  const { logout, user } = useApp();
  const [toCook, setToCook]     = useState<KDSTicket[]>([]);
  const [preparing, setPreparing] = useState<KDSTicket[]>([]);
  const [done, setDone]           = useState<KDSTicket[]>([]);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [connected, setConnected]     = useState(false);
  const isChef = user?.role === 'Chef';

  const load = useCallback(async () => {
    try {
      const r = await kdsApi.getActive('KITCHEN');
      setToCook(r.data.TO_COOK);
      setPreparing(r.data.PREPARING);
    } catch { /* silent */ }
    try {
      const all = await kdsApi.getAll('KITCHEN');
      setDone(all.data.filter((t) => t.stage === 'DONE').slice(0, 8));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const socket = getKDSSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    const isKitchen = (t: KDSTicket) => t.station === 'KITCHEN';
    const onNew = (t: KDSTicket) => { if (!isKitchen(t)) return; setToCook((p) => [t, ...p.filter((x) => x.id !== t.id)]); };
    const onStage = (t: KDSTicket) => {
      if (!isKitchen(t)) return;
      setToCook((p) => p.filter((x) => x.id !== t.id));
      setPreparing((p) => p.filter((x) => x.id !== t.id));
      if (t.stage === 'PREPARING') setPreparing((p) => [t, ...p]);
      if (t.stage === 'DONE')      setDone((p) => [t, ...p].slice(0, 8));
    };
    const onCancel = ({ orderId }: { orderId: string }) => {
      const removeForOrder = (arr: KDSTicket[]) => arr.filter((x) => x.orderId !== orderId);
      setToCook(removeForOrder); setPreparing(removeForOrder);
    };
    const on86 = ({ id: prodId }: { id: string }) => {
      const mark86 = (arr: KDSTicket[]) => arr.map((t) => ({
        ...t, items: t.items.map((item) => item.itemId === prodId ? { ...item, is86d: true } : item),
      }));
      setToCook(mark86); setPreparing(mark86);
    };
    socket.on('order:new', onNew);
    socket.on('order:addon', onNew);
    socket.on('ticket:stage', onStage);
    socket.on('order:cancel', onCancel);
    socket.on('item:86', on86);
    return () => {
      socket.off('order:new', onNew); socket.off('order:addon', onNew);
      socket.off('ticket:stage', onStage);
      socket.off('order:cancel', onCancel); socket.off('item:86', on86);
    };
  }, [load]);

  const advance = async (id: string) => {
    setAdvancingId(id);
    try { await kdsApi.advanceStage(id); setTimeout(load, 400); }
    catch { /* silent */ }
    finally { setAdvancingId(null); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ChefHat size={18} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Kitchen Display
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 700, letterSpacing: '0.06em',
            background: connected ? 'var(--green-bg)' : 'var(--red-bg)',
            color: connected ? 'var(--green)' : 'var(--red)',
          }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {toCook.length + preparing.length} active · {done.length} done
          </span>
          {isChef && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={logout}>
              <LogOut size={12} /> Exit
            </button>
          )}
        </div>
      </div>

      {/* 3-column kanban */}
      <div style={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden' }}>
        {[
          { title: 'To Cook',   tickets: toCook,    count: toCook.length },
          { title: 'Preparing', tickets: preparing, count: preparing.length },
          { title: 'Done',      tickets: done,      count: 0, collapse: true },
        ].map((col, i) => (
          <div key={col.title} style={{
            flex: 1, padding: '18px 16px',
            borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <Column
              title={col.title}
              count={col.count}
              tickets={col.tickets}
              onAdvance={advance}
              advancingId={advancingId}
              collapseCompleted={col.collapse}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
