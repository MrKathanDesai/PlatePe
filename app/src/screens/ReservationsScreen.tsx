import { useCallback, useEffect, useMemo, useState } from 'react';
import { reservationsApi } from '../api/reservations';
import { useApp } from '../store/app-store-context';
import type { Reservation, ReservationChannel, ReservationStatus } from '../types';

type ReservationForm = {
  guestName: string;
  phone: string;
  email: string;
  partySize: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  channel: ReservationChannel;
  status: 'PENDING' | 'CONFIRMED';
  tableIds: string[];
  primaryTableId: string;
};

function toInputDateTime(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildDefaultForm(): ReservationForm {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    guestName: '',
    phone: '',
    email: '',
    partySize: '2',
    startsAt: toInputDateTime(start),
    endsAt: toInputDateTime(end),
    notes: '',
    channel: 'PHONE',
    status: 'CONFIRMED',
    tableIds: [],
    primaryTableId: '',
  };
}

export default function ReservationsScreen() {
  const { tables, floors, showToast, refreshTables } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | ''>('');
  const [form, setForm] = useState<ReservationForm>(() => buildDefaultForm());

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const response = await reservationsApi.getAll({
        from: from.toISOString(),
        to: to.toISOString(),
        status: filterStatus,
      });
      setReservations(response.data);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  const activeTables = useMemo(
    () => tables.filter((table) => table.isActive),
    [tables],
  );

  const tablesByFloor = useMemo(() => {
    const grouped = new Map<string, typeof activeTables>();
    activeTables.forEach((table) => {
      const key = table.floorId ?? '__unassigned__';
      grouped.set(key, [...(grouped.get(key) ?? []), table]);
    });
    return grouped;
  }, [activeTables]);

  const toggleTableSelection = (tableId: string) => {
    setForm((current) => {
      const tableIds = current.tableIds.includes(tableId)
        ? current.tableIds.filter((id) => id !== tableId)
        : [...current.tableIds, tableId];

      return {
        ...current,
        tableIds,
        primaryTableId: current.primaryTableId && tableIds.includes(current.primaryTableId)
          ? current.primaryTableId
          : (tableIds[0] ?? ''),
      };
    });
  };

  const handleCreate = async () => {
    if (!form.guestName.trim()) {
      showToast('Guest name is required');
      return;
    }

    setSaving(true);
    try {
      await reservationsApi.create({
        guestName: form.guestName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        partySize: parseInt(form.partySize, 10) || 1,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        notes: form.notes.trim() || null,
        channel: form.channel,
        status: form.status,
        tableIds: form.tableIds,
        primaryTableId: form.primaryTableId || undefined,
      });
      setForm(buildDefaultForm());
      await loadReservations();
      showToast('Reservation created');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to create reservation');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      await action();
      await Promise.all([loadReservations(), refreshTables()]);
      showToast(successMessage);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Reservation update failed');
    }
  };

  return (
    <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, height: '100%' }}>
      <div className="card" style={{ overflowY: 'auto' }}>
        <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 18px', letterSpacing: '-0.04em' }}>
          New Reservation
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Guest Name</label>
            <input className="input" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Party Size</label>
              <input className="input" type="number" min="1" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Start</label>
              <input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>End</label>
              <input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Channel</label>
              <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as ReservationChannel })}>
                <option value="PHONE">Phone</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'PENDING' | 'CONFIRMED' })}>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes</label>
            <textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ minHeight: 80, resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Assign Tables</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
              {floors.map((floor) => (
                <div key={floor.id}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{floor.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(tablesByFloor.get(floor.id) ?? []).map((table) => (
                      <button
                        key={table.id}
                        className={`btn ${form.tableIds.includes(table.id) ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 11 }}
                        onClick={() => toggleTableSelection(table.id)}
                      >
                        {table.number}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {(tablesByFloor.get('__unassigned__') ?? []).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Unassigned</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(tablesByFloor.get('__unassigned__') ?? []).map((table) => (
                      <button
                        key={table.id}
                        className={`btn ${form.tableIds.includes(table.id) ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 11 }}
                        onClick={() => toggleTableSelection(table.id)}
                      >
                        {table.number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {form.tableIds.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Primary Table</label>
              <select className="input" value={form.primaryTableId} onChange={(e) => setForm({ ...form, primaryTableId: e.target.value })}>
                {form.tableIds.map((tableId) => {
                  const table = activeTables.find((entry) => entry.id === tableId);
                  return <option key={tableId} value={tableId}>{table?.number ?? tableId}</option>;
                })}
              </select>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Saving…' : 'Create Reservation'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['', 'PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const).map((status) => (
            <button
              key={status || 'ALL'}
              className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12 }}
              onClick={() => setFilterStatus(status)}
            >
              {status || 'All'}
            </button>
          ))}
        </div>

        <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 18px', letterSpacing: '-0.04em' }}>
            Upcoming Reservations
          </h1>

          {loading ? (
            <div style={{ color: 'var(--text-3)' }}>Loading…</div>
          ) : reservations.length === 0 ? (
            <div style={{ color: 'var(--text-3)' }}>No reservations in the selected range.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reservations.map((reservation) => (
                <div key={reservation.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{reservation.guestName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                        {reservation.partySize} guests · {formatDateTime(reservation.startsAt)} to {formatDateTime(reservation.endsAt)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                        {(reservation.assignments ?? []).length > 0
                          ? `Tables: ${reservation.assignments.map((assignment) => assignment.table?.number ?? assignment.tableId).join(', ')}`
                          : 'No tables assigned yet'}
                      </div>
                      {reservation.notes && (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{reservation.notes}</div>
                      )}
                    </div>
                    <span className={`badge ${reservation.status === 'CONFIRMED' ? 'badge-green' : reservation.status === 'SEATED' ? 'badge-accent' : reservation.status === 'PENDING' ? 'badge-amber' : 'badge-muted'}`}>
                      {reservation.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {(reservation.status === 'PENDING' || reservation.status === 'CONFIRMED') && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => runAction(() => reservationsApi.seat(reservation.id), 'Reservation seated')}>
                        Seat
                      </button>
                    )}
                    {reservation.status === 'SEATED' && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => runAction(() => reservationsApi.complete(reservation.id), 'Reservation completed')}>
                        Complete
                      </button>
                    )}
                    {reservation.status !== 'CANCELLED' && reservation.status !== 'COMPLETED' && reservation.status !== 'NO_SHOW' && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => runAction(() => reservationsApi.cancel(reservation.id), 'Reservation cancelled')}>
                        Cancel
                      </button>
                    )}
                    {reservation.status === 'PENDING' || reservation.status === 'CONFIRMED' ? (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => runAction(() => reservationsApi.noShow(reservation.id), 'Marked as no-show')}>
                        No-show
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
