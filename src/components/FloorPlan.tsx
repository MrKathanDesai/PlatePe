import { useEffect, useState } from 'react';
import { Table } from '../types';
import { ApiTable, getTables } from '../api';

interface FloorPlanProps {
  onTableSelect: (table: Table) => void;
}

function formatOccupiedTime(occupiedSince: string | null): string | undefined {
  if (!occupiedSince) {
    return undefined;
  }

  const occupiedDate = new Date(occupiedSince);

  if (Number.isNaN(occupiedDate.getTime())) {
    return undefined;
  }

  const diffMs = Date.now() - occupiedDate.getTime();

  if (diffMs <= 0) {
    return undefined;
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${totalMinutes}m`;
}

function mapApiTableToTable(table: ApiTable): Table {
  return {
    id: table.id,
    number: table.number,
    seats: table.seats,
    status: table.status as Table['status'],
    currentBill: table.currentBill ?? undefined,
    occupiedTime: formatOccupiedTime(table.occupiedSince),
  };
}

function getStatusBorderClass(status: Table['status']): string {
  if (status === 'Available') {
    return 'border-l-[#16a34a]';
  }

  if (status === 'Occupied') {
    return 'border-l-zinc-700';
  }

  if (status === 'Needs Attention') {
    return 'border-l-amber-400';
  }

  if (status === 'Unpaid') {
    return 'border-l-red-400';
  }

  if (status === 'Reserved') {
    return 'border-l-blue-400';
  }

  return 'border-l-zinc-300';
}

function getDisplayTableNumber(number: Table['number']): string {
  const tableNumber = String(number);

  if (tableNumber.toLowerCase().startsWith('t')) {
    return tableNumber;
  }

  return `T${tableNumber}`;
}

export default function FloorPlan({ onTableSelect }: FloorPlanProps) {
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState('Ground Floor');

  useEffect(() => {
    const fetchTables = async () => {
      const token = localStorage.getItem('platepe_token');

      if (!token) {
        setTables([]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await getTables(token);
        setTables(response);
      } catch (_error) {
        setTables([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTables();
  }, []);

  const mappedTables = tables.map(mapApiTableToTable);

  const availableCount = mappedTables.filter((table) => table.status === 'Available').length;
  const occupiedCount = mappedTables.filter((table) => table.status === 'Occupied').length;
  const attentionCount = mappedTables.filter((table) => table.status === 'Needs Attention' || table.status === 'Unpaid').length;

  const areas = ['Ground Floor', 'Terrace', 'Private Dining'];

  return (
    <div className="flex h-full flex-col bg-[#fafaf8]">
      <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-4">
        <div className="flex items-center gap-1">
          {areas.map((area) => {
            const isActive = selectedArea === area;

            return (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedArea(area)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {area}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            {availableCount} Available
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {occupiedCount} Occupied
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            {attentionCount} Attention
          </span>
          <button
            type="button"
            className="ml-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-800"
          >
            + Add Table
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#fafaf8] p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={`table-skeleton-${index}`}
                className="h-28 animate-pulse rounded-2xl bg-zinc-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {mappedTables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => onTableSelect(table)}
                className={`w-full cursor-pointer rounded-2xl border border-zinc-100 border-l-[3px] bg-white p-5 text-left transition-all duration-150 hover:border-zinc-200 hover:shadow-sm active:scale-[0.98] ${getStatusBorderClass(
                  table.status,
                )}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xl font-bold text-zinc-900">{getDisplayTableNumber(table.number)}</span>
                  {table.occupiedTime && (
                    <span className="rounded-md border border-zinc-100 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                      {table.occupiedTime}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-[10px] text-zinc-400">{table.seats} seats</p>

                <div className="mt-3">
                  {table.currentBill ? (
                    <>
                      <p className="text-sm font-semibold text-zinc-900">Rs {table.currentBill.toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-400">current bill</p>
                    </>
                  ) : table.status === 'Available' ? (
                    <p className="text-xs font-medium text-[#16a34a]">Open</p>
                  ) : (
                    <p className="text-xs font-medium text-zinc-500">{table.status}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
