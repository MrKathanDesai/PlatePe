import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Loader2, Coffee, UtensilsCrossed } from 'lucide-react';
import { getKDSAllTickets, advanceKDSTicket, ApiKDSTicket, getToken } from '../api';

type Station = 'ALL' | 'KITCHEN' | 'BREWBAR';

function getElapsed(receivedAt: string): string {
  const diffMs = Date.now() - new Date(receivedAt).getTime();
  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function urgencyBorder(receivedAt: string, stage: string): string {
  if (stage === 'DONE') return 'border-zinc-800/60';
  const mins = (Date.now() - new Date(receivedAt).getTime()) / 60000;
  if (mins > 10) return 'border-red-500/60';
  if (mins > 5) return 'border-amber-500/40';
  return 'border-zinc-800';
}

const STAGE_CONFIG = {
  TO_COOK: {
    label: 'New',
    dot: 'bg-amber-400',
    btnClass: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20',
    btnText: 'Start Preparing',
  },
  PREPARING: {
    label: 'In Progress',
    dot: 'bg-blue-400',
    btnClass: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20',
    btnText: 'Mark Ready',
  },
  DONE: {
    label: 'Done',
    dot: 'bg-green-500',
    btnClass: '',
    btnText: '',
  },
};

function TicketCard({
  ticket,
  onAdvance,
  advancing,
}: {
  ticket: ApiKDSTicket;
  onAdvance: (id: string) => void;
  advancing: boolean;
}) {
  const [, tick] = useState(0);
  const cfg = STAGE_CONFIG[ticket.stage];

  useEffect(() => {
    if (ticket.stage === 'DONE') return;
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [ticket.stage]);

  const isDone = ticket.stage === 'DONE';

  return (
    <article
      className={`rounded-xl border bg-zinc-900 p-4 transition-all ${urgencyBorder(ticket.receivedAt, ticket.stage)} ${isDone ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-bold ${isDone ? 'text-zinc-400' : 'text-white'}`}>
            #{(ticket.orderNumber || ticket.id).slice(-8)}
          </span>
          {ticket.tableNumber && (
            <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
              {ticket.tableNumber}
            </span>
          )}
          {ticket.type === 'ADDON' && (
            <span className="rounded-md bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">+Add-on</span>
          )}
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${ticket.station === 'BREWBAR' ? 'bg-amber-900/30 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
            {ticket.station === 'BREWBAR' ? '☕ Brewbar' : '🍳 Kitchen'}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-zinc-600">{getElapsed(ticket.receivedAt)}</span>
      </div>

      {/* Items */}
      <div className="space-y-1.5 border-t border-zinc-800/70 pt-3">
        {ticket.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-5 shrink-0 text-[11px] font-bold text-zinc-600">{item.quantity}×</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12px] font-medium leading-snug ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {item.name}
              </p>
              {item.modifiers.length > 0 && (
                <p className="text-[10px] text-zinc-600 mt-0.5">{item.modifiers.map((m) => m.name).join(' · ')}</p>
              )}
              {item.note && (
                <p className="text-[10px] text-amber-500 mt-0.5">⚠ {item.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action button — only for active stages */}
      {!isDone && (
        <button
          type="button"
          onClick={() => onAdvance(ticket.id)}
          disabled={advancing}
          className={`mt-4 w-full rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5 ${cfg.btnClass}`}
        >
          {advancing && <Loader2 size={12} className="animate-spin" />}
          {cfg.btnText}
        </button>
      )}
    </article>
  );
}

export default function KDS() {
  const [station, setStation] = useState<Station>('ALL');
  const [allTickets, setAllTickets] = useState<ApiKDSTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTickets = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    try {
      const stationParam = station === 'ALL' ? undefined : station;
      const data = await getKDSAllTickets(token, stationParam);
      setAllTickets(data);
    } catch {
      // keep existing on error
    } finally {
      setLoading(false);
    }
  }, [station]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchTickets, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTickets]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleAdvance = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setAdvancing(id);
    try {
      await advanceKDSTicket(id, token);
      await fetchTickets();
    } catch {
      // ticket may already be at final stage
    } finally {
      setAdvancing(null);
    }
  };

  // Group by stage
  const byStage = {
    TO_COOK: allTickets.filter((t) => t.stage === 'TO_COOK'),
    PREPARING: allTickets.filter((t) => t.stage === 'PREPARING'),
    DONE: allTickets.filter((t) => t.stage === 'DONE').slice(0, 8), // cap at 8 recent done
  };

  const activeCount = byStage.TO_COOK.length + byStage.PREPARING.length;

  const stationTabs: { key: Station; label: string; icon: React.ReactNode }[] = [
    { key: 'ALL', label: 'All Stations', icon: null },
    { key: 'KITCHEN', label: 'Kitchen', icon: <UtensilsCrossed size={13} /> },
    { key: 'BREWBAR', label: 'Brewbar', icon: <Coffee size={13} /> },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0e0e0e]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Kitchen Display</h1>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {activeCount} active
          </span>

          {/* Station tabs */}
          <div className="flex items-center gap-1 ml-3 bg-zinc-800/60 rounded-lg p-0.5">
            {stationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStation(tab.key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  station === tab.key
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-600">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
          <button
            onClick={fetchTickets}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-3">
          <Loader2 size={18} className="animate-spin text-zinc-700" />
          <p className="text-sm text-zinc-700">Loading tickets…</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-3 gap-px overflow-hidden bg-zinc-800/30">
          {(['TO_COOK', 'PREPARING', 'DONE'] as const).map((stage) => {
            const cfg = STAGE_CONFIG[stage];
            const stageTickets = byStage[stage];
            return (
              <section key={stage} className="flex flex-col overflow-hidden bg-[#0e0e0e]">
                <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    {cfg.label}
                  </h2>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                    {stageTickets.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {stageTickets.length === 0 ? (
                    <div className="flex h-full items-center justify-center py-16">
                      <p className="text-xs text-zinc-800">No tickets</p>
                    </div>
                  ) : (
                    stageTickets.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onAdvance={handleAdvance}
                        advancing={advancing === ticket.id}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
