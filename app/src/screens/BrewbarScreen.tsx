import { useState, useEffect, useCallback } from 'react';
import { Coffee, LogOut, Clock, RefreshCw } from 'lucide-react';
import { kdsApi, getKDSSocket } from '../api/kds';
import { useApp } from '../store/app-store-context';
import type { KDSTicket } from '../types';

function minutesSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function LiveTimer({ receivedAt }: { receivedAt: string }) {
  const [mins, setMins] = useState(minutesSince(receivedAt));
  useEffect(() => {
    const id = setInterval(() => setMins(minutesSince(receivedAt)), 15000);
    return () => clearInterval(id);
  }, [receivedAt]);
  const color = mins < 3 ? 'var(--green)' : mins < 7 ? 'var(--amber)' : 'var(--red)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color }}>
      <Clock size={13} /> {mins}m
    </span>
  );
}

function TicketCard({ ticket, onAdvance, loading }: {
  ticket: KDSTicket; onAdvance: () => void; loading: boolean;
}) {
  const mins = minutesSince(ticket.receivedAt);
  const urgentBorder = mins >= 7 ? 'var(--red)' : mins >= 3 ? 'var(--amber)' : 'var(--green)';
  const urgentBg    = mins >= 7 ? 'rgba(184,50,50,0.04)' : mins >= 3 ? 'rgba(146,88,10,0.04)' : 'rgba(39,103,73,0.04)';

  return (
    <div style={{
      background: urgentBg,
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${urgentBorder}`,
      borderRadius: 12,
      padding: 18,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
            #{ticket.orderNumber}
          </span>
          {ticket.tableNumber && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
              T{ticket.tableNumber}
            </span>
          )}
          {!ticket.tableNumber && (
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 100, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
              Takeaway
            </span>
          )}
          {ticket.type === 'ADDON' && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'var(--amber-bg)', color: 'var(--amber)', fontWeight: 700 }}>
              +ADD
            </span>
          )}
        </div>
        <LiveTimer receivedAt={ticket.receivedAt} />
      </div>

      {/* Items */}
      <div style={{ marginBottom: 14 }}>
        {ticket.items.map((item, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: item.is86d ? 'var(--red)' : 'var(--text)', lineHeight: 1.2, textDecoration: item.is86d ? 'line-through' : 'none' }}>
              {item.quantity > 1 && (
                <span style={{ color: 'var(--accent)', marginRight: 6, fontVariantNumeric: 'tabular-nums' }}>
                  {item.quantity}×
                </span>
              )}
              {item.name}
              {item.is86d && <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700 }}>86</span>}
            </div>
            {item.modifiers?.length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                {item.modifiers.map((m, mi) => (
                  <span key={mi} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 100,
                    background: 'var(--accent-bg)', border: '1px solid var(--accent-mid)',
                    color: 'var(--accent)', fontWeight: 500,
                  }}>{m.name}</span>
                ))}
              </div>
            )}
            {item.note && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 3 }}>
                "{item.note}"
              </div>
            )}
          </div>
        ))}
      </div>

      {ticket.stage !== 'DONE' && (
        <button className="btn btn-primary" style={{ width: '100%' }}
          onClick={onAdvance} disabled={loading}>
          {ticket.stage === 'TO_COOK' ? '▶ Start Brewing' : '✓ Ready'}
        </button>
      )}
    </div>
  );
}

export default function BrewbarScreen() {
  const { logout, user } = useApp();
  const [toCook, setToCook] = useState<KDSTicket[]>([]);
  const [preparing, setPreparing] = useState<KDSTicket[]>([]);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await kdsApi.getActive('BREWBAR');
      setToCook(r.data.TO_COOK);
      setPreparing(r.data.PREPARING);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const socket = getKDSSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const isBrewbar = (t: KDSTicket) => t.station === 'BREWBAR';

    const handleNew = (t: KDSTicket) => {
      if (!isBrewbar(t)) return;
      setToCook((p) => [t, ...p.filter((x) => x.id !== t.id)]);
    };
    const handleStage = (t: KDSTicket) => {
      if (!isBrewbar(t)) return;
      setToCook((p) => p.filter((x) => x.id !== t.id));
      setPreparing((p) => p.filter((x) => x.id !== t.id));
      if (t.stage === 'PREPARING') setPreparing((p) => [t, ...p]);
    };
    const handleCancel = ({ orderId }: { orderId: string }) => {
      setToCook((p) => p.filter((x) => x.orderId !== orderId));
      setPreparing((p) => p.filter((x) => x.orderId !== orderId));
    };
    const handle86 = ({ id: prodId }: { id: string }) => {
      const mark86 = (arr: KDSTicket[]) => arr.map((t) => ({
        ...t, items: t.items.map((item) => item.itemId === prodId ? { ...item, is86d: true } : item),
      }));
      setToCook(mark86); setPreparing(mark86);
    };
    socket.on('order:new',   handleNew);
    socket.on('order:addon', handleNew);
    socket.on('ticket:stage', handleStage);
    socket.on('order:cancel', handleCancel);
    socket.on('item:86', handle86);
    return () => {
      socket.off('order:new',    handleNew);
      socket.off('order:addon',  handleNew);
      socket.off('ticket:stage', handleStage);
      socket.off('order:cancel', handleCancel);
      socket.off('item:86', handle86);
    };
  }, [load]);

  const advance = async (id: string) => {
    setAdvancingId(id);
    try { await kdsApi.advanceStage(id); setTimeout(load, 300); }
    catch { /* silent */ }
    finally { setAdvancingId(null); }
  };

  const allActive = [...toCook, ...preparing];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Coffee size={20} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Brewbar
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 700, letterSpacing: '0.06em',
            background: connected ? 'var(--green-bg)' : 'var(--red-bg)',
            color: connected ? 'var(--green)' : 'var(--red)',
          }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--accent)' }}>
            {allActive.length} active
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{user?.name}</span>
          <button className="btn btn-ghost" style={{ fontSize: 12 }}
            onClick={() => { load(); }} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={logout}>
            <LogOut size={13} /> Exit
          </button>
        </div>
      </div>

      {/* Two-column layout: To Brew | Preparing */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
        {[
          { title: 'To Brew',   tickets: toCook,    color: 'var(--green)' },
          { title: 'Preparing', tickets: preparing, color: 'var(--amber)' },
        ].map((col, i) => (
          <div key={col.title} style={{
            flex: 1, padding: '18px 20px', overflowY: 'auto',
            borderRight: i === 0 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {col.title}
              </h2>
              {col.tickets.length > 0 && (
                <span style={{
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
                  border: '1px solid var(--accent-mid)',
                }}>{col.tickets.length}</span>
              )}
            </div>
            {col.tickets.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0', fontSize: 13 }}>
                {col.title === 'To Brew' ? 'All caught up ☕' : '—'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.tickets.map((t) => (
                  <TicketCard key={t.id} ticket={t}
                    onAdvance={() => advance(t.id)} loading={advancingId === t.id} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
