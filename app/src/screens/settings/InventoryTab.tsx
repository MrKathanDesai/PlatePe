import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { useApp } from '../../store/app-store-context';
import type { InventoryItem, InventoryTransaction } from '../../types';

// ─── CSV parsers (unchanged) ──────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

type IngredientImportRow = {
  code: string; name: string; category: string; base_unit: string;
  on_hand_qty: string; reorder_level: string; par_level: string;
  cost_per_unit: string; is_active: string; _valid: boolean; _error: string;
};
type RecipeImportRow = {
  product_code: string; ingredient_code: string; qty: string;
  unit: string; waste_pct: string; _valid: boolean; _error: string;
};

function parseIngredientCSV(text: string): IngredientImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as Record<string, string>;
    const parsed: IngredientImportRow = {
      code: row.code?.trim() ?? '', name: row.name?.trim() ?? '',
      category: row.category?.trim() ?? '', base_unit: row.base_unit?.trim() ?? '',
      on_hand_qty: row.on_hand_qty?.trim() ?? '', reorder_level: row.reorder_level?.trim() ?? '',
      par_level: row.par_level?.trim() ?? '', cost_per_unit: row.cost_per_unit?.trim() ?? '',
      is_active: row.is_active?.trim() ?? '', _valid: true, _error: '',
    };
    if (!parsed.code) parsed._error = 'Code is required';
    else if (!parsed.name) parsed._error = 'Name is required';
    else if (!parsed.base_unit) parsed._error = 'Base unit is required';
    else if (parsed.on_hand_qty && Number.isNaN(parseFloat(parsed.on_hand_qty))) parsed._error = 'Invalid qty';
    parsed._valid = !parsed._error;
    return parsed;
  }).filter((r) => r.code || r.name);
}

function parseRecipeCSV(text: string): RecipeImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as Record<string, string>;
    const parsed: RecipeImportRow = {
      product_code: row.product_code?.trim() ?? '', ingredient_code: row.ingredient_code?.trim() ?? '',
      qty: row.qty?.trim() ?? '', unit: row.unit?.trim() ?? '', waste_pct: row.waste_pct?.trim() ?? '',
      _valid: true, _error: '',
    };
    if (!parsed.product_code) parsed._error = 'Product code required';
    else if (!parsed.ingredient_code) parsed._error = 'Ingredient code required';
    else if (!parsed.qty || Number.isNaN(parseFloat(parsed.qty))) parsed._error = 'Invalid qty';
    parsed._valid = !parsed._error;
    return parsed;
  }).filter((r) => r.product_code || r.ingredient_code);
}

type ImportMode = 'ingredients' | 'recipes';

// ─── Import modal (unchanged logic, updated styles) ───────────────────────────
function InventoryImportModal({ mode, onImported, onClose }: {
  mode: ImportMode; onImported: () => Promise<void>; onClose: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [ingredientRows, setIngredientRows] = useState<IngredientImportRow[]>([]);
  const [recipeRows, setRecipeRows] = useState<RecipeImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState(0);
  const [failureMessage, setFailureMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = mode === 'ingredients' ? ingredientRows : recipeRows;
  const validRows = rows.filter((r) => r._valid);

  const handleText = (text: string) => {
    if (mode === 'ingredients') setIngredientRows(parseIngredientCSV(text));
    else setRecipeRows(parseRecipeCSV(text));
    setStep('preview');
  };
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => handleText((e.target?.result as string) ?? '');
    reader.readAsText(file);
  };

  const runImport = async () => {
    setStep('importing'); setFailureMessage(''); setProgress(20);
    try {
      if (mode === 'ingredients') {
        const payload = ingredientRows.filter((r) => r._valid).map((r) => ({
          code: r.code, name: r.name, category: r.category || null, baseUnit: r.base_unit,
          onHandQty: r.on_hand_qty ? parseFloat(r.on_hand_qty) : 0,
          lowStockThreshold: r.reorder_level ? parseFloat(r.reorder_level) : 0,
          parLevel: r.par_level ? parseFloat(r.par_level) : 0,
          costPerUnit: r.cost_per_unit ? parseFloat(r.cost_per_unit) : 0,
          isActive: r.is_active ? !['false', '0', 'no'].includes(r.is_active.toLowerCase()) : true,
        }));
        setProgress(60);
        const res = await inventoryApi.importIngredients(payload);
        setImported(res.data.created + res.data.updated);
      } else {
        const payload = recipeRows.filter((r) => r._valid).map((r) => ({
          productCode: r.product_code, ingredientCode: r.ingredient_code,
          quantity: parseFloat(r.qty), unit: r.unit || undefined,
          wastePct: r.waste_pct ? parseFloat(r.waste_pct) : 0,
        }));
        setProgress(60);
        const res = await inventoryApi.importRecipes(payload, false);
        setImported(res.data.created + res.data.updated);
      }
      setProgress(100);
      setErrors(rows.filter((r) => !r._valid).length);
      setStep('done');
      await onImported();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setImported(0); setErrors(validRows.length);
      setFailureMessage(e?.response?.data?.message ?? 'Import failed');
      setStep('done');
    }
  };

  const title = mode === 'ingredients' ? 'Import Ingredients' : 'Import Recipes';
  const hint = mode === 'ingredients'
    ? 'CSV columns: code, name, category, base_unit, on_hand_qty, reorder_level, par_level, cost_per_unit, is_active'
    : 'CSV columns: product_code, ingredient_code, qty, unit, waste_pct';

  return (
    <div className="modal-overlay">
      <div className="card" style={{ width: 680, maxHeight: '80vh', padding: 28, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>{title}</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', margin: '0 0 20px' }}>{hint}</p>

        {step === 'upload' && (
          <div>
            <div
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed var(--border-mid)', borderRadius: 'var(--radius-md)', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}
            >
              <Upload size={28} color="var(--text-3)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Drop CSV here or click to browse</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>.csv or .txt</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0 }}>
              <span className="badge badge-green"><CheckCircle2 size={11} /> {validRows.length} valid</span>
              {rows.filter((r) => !r._valid).length > 0 && <span className="badge badge-red"><AlertCircle size={11} /> {rows.filter((r) => !r._valid).length} invalid</span>}
              <span className="badge badge-muted">{rows.length} total</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <table className="data-table">
                <thead>
                  {mode === 'ingredients'
                    ? <tr><th></th><th>Code</th><th>Name</th><th>Unit</th><th>On Hand</th></tr>
                    : <tr><th></th><th>Product</th><th>Ingredient</th><th>Qty</th><th>Unit</th></tr>}
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ opacity: row._valid ? 1 : 0.5 }}>
                      <td>{row._valid ? <CheckCircle2 size={13} color="var(--green)" /> : <AlertCircle size={13} color="var(--red)" />}</td>
                      {mode === 'ingredients' ? (
                        <><td>{(row as IngredientImportRow).code}</td><td>{(row as IngredientImportRow).name}</td><td>{(row as IngredientImportRow).base_unit}</td><td>{(row as IngredientImportRow).on_hand_qty || '0'}</td></>
                      ) : (
                        <><td>{(row as RecipeImportRow).product_code}</td><td>{(row as RecipeImportRow).ingredient_code}</td><td>{(row as RecipeImportRow).qty}</td><td>{(row as RecipeImportRow).unit || '—'}</td></>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setStep('upload'); setIngredientRows([]); setRecipeRows([]); }}>← Change file</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={runImport} disabled={validRows.length === 0}><Upload size={14} /> Import {validRows.length} rows</button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Importing… {progress}%</div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%`, transition: 'width 200ms' }} />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <CheckCircle2 size={44} color="var(--green)" style={{ margin: '0 auto 14px', display: 'block' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Import complete</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
              {imported} imported{errors > 0 ? `, ${errors} failed` : ' successfully'}
            </div>
            {failureMessage && (
              <div style={{ background: 'var(--red-bg)', border: '1.5px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 20, textAlign: 'left' }}>
                {failureMessage}
              </div>
            )}
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Adjust widget ─────────────────────────────────────────────────────
function AdjustWidget({ item, onAdjust, adjusting }: {
  item: InventoryItem;
  onAdjust: (item: InventoryItem, delta: number) => void;
  adjusting: boolean;
}) {
  const [val, setVal] = useState('');
  const delta = parseFloat(val);
  const valid = !isNaN(delta) && val.trim() !== '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Quick buttons */}
      {[-10, -5, -1].map((n) => (
        <button key={n} className="btn btn-ghost" disabled={adjusting}
          onClick={() => onAdjust(item, n)}
          style={{ padding: '3px 6px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red)', borderColor: 'var(--red)', minWidth: 32 }}>
          {n}
        </button>
      ))}
      <input
        type="number"
        placeholder="±"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && valid) { onAdjust(item, delta); setVal(''); } }}
        style={{
          width: 60, padding: '4px 7px', fontFamily: 'var(--font-mono)', fontSize: 12,
          border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
          background: 'var(--surface)', color: 'var(--text)', outline: 'none',
          textAlign: 'center',
        }}
      />
      {[1, 5, 10].map((n) => (
        <button key={n} className="btn btn-ghost" disabled={adjusting}
          onClick={() => onAdjust(item, n)}
          style={{ padding: '3px 6px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)', borderColor: 'var(--green)', minWidth: 32 }}>
          +{n}
        </button>
      ))}
      {valid && (
        <button className="btn btn-primary" disabled={adjusting}
          onClick={() => { onAdjust(item, delta); setVal(''); }}
          style={{ padding: '3px 10px', fontSize: 11 }}>
          {adjusting ? '…' : 'Apply'}
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InventoryTab() {
  const { showToast } = useApp();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [search, setSearch] = useState('');

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [inventoryRes, transactionRes] = await Promise.all([
        inventoryApi.getAll(),
        inventoryApi.getTransactions(),
      ]);
      setItems(inventoryRes.data);
      setTransactions(transactionRes.data);
      setLastLoadedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      if (!silent) showToast('Failed to refresh inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(true);
    const onFocus = () => { void load(true); };
    const onVis = () => { if (document.visibilityState === 'visible') void load(true); };
    const interval = window.setInterval(() => { void load(true); }, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const handleAdjust = async (item: InventoryItem, delta: number) => {
    if (isNaN(delta)) { showToast('Enter a valid number'); return; }
    setAdjusting(item.id);
    try {
      await inventoryApi.adjust({ productId: item.productId, adjustment: delta });
      await load(true);
      showToast(`${delta > 0 ? '+' : ''}${delta} ${item.unit} recorded`);
    } catch { showToast('Failed to adjust'); }
    finally { setAdjusting(null); }
  };

  const formatQty = (v: number) => Number.isInteger(v) ? v.toString() : v.toFixed(3).replace(/\.?0+$/, '');

  const formatTxLabel = (tx: InventoryTransaction) => ({
    ORDER_CONSUMPTION: 'Order fired',
    ORDER_REPLENISHMENT: 'Order reversal',
    MANUAL_ADJUSTMENT: 'Manual adjustment',
    IMPORT: 'Import',
  }[tx.type] ?? tx.type);

  if (loading) {
    return (
      <div style={{ padding: 32, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        Loading inventory…
      </div>
    );
  }

  const lowItems = items.filter((i) => i.quantity <= i.lowStockThreshold);
  const sortedItems = [...items].sort((a, b) => {
    const aLow = a.quantity <= a.lowStockThreshold;
    const bLow = b.quantity <= b.lowStockThreshold;
    if (aLow !== bLow) return aLow ? -1 : 1;
    // Sort low items by urgency (lower ratio = more urgent)
    if (aLow && bLow) {
      const aRatio = a.lowStockThreshold > 0 ? a.quantity / a.lowStockThreshold : 1;
      const bRatio = b.lowStockThreshold > 0 ? b.quantity / b.lowStockThreshold : 1;
      return aRatio - bRatio;
    }
    return a.productName.localeCompare(b.productName);
  });

  const filteredItems = sortedItems.filter((i) =>
    !search || i.productName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1000 }}>

      {/* ── Low Stock Banner ─────────────────────────────────────────────────── */}
      {lowItems.length > 0 && (
        <div style={{
          marginBottom: 20,
          border: '1.5px solid var(--amber)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-hard)',
        }}>
          {/* Banner header */}
          <div style={{
            background: 'var(--amber-bg)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            borderBottom: '1.5px solid var(--amber)',
          }}>
            <AlertTriangle size={16} color="var(--amber)" />
            <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 14, letterSpacing: '-0.02em' }}>
              {lowItems.length} item{lowItems.length !== 1 ? 's' : ''} below threshold
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)', opacity: 0.7 }}>
              — adjust stock or reorder
            </span>
          </div>

          {/* Low stock items */}
          {lowItems.map((item, idx) => {
            const pct = item.lowStockThreshold > 0 ? Math.min(100, (item.quantity / item.lowStockThreshold) * 100) : 100;
            return (
              <div key={item.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 18px',
                background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                borderBottom: idx < lowItems.length - 1 ? '1px solid var(--border)' : 'none',
                flexWrap: 'wrap',
              }}>
                {/* Name + bar */}
                <div style={{ minWidth: 180, flex: '0 0 auto' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                    {item.productName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', minWidth: 80 }}>
                      <div style={{ height: '100%', background: pct < 25 ? 'var(--red)' : 'var(--amber)', width: `${pct}%`, borderRadius: 2, transition: 'width 300ms' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', fontWeight: 600, flexShrink: 0 }}>
                      {formatQty(item.quantity)} / {formatQty(item.lowStockThreshold)} {item.unit}
                    </span>
                  </div>
                </div>

                {/* Adjust widget */}
                <div style={{ flex: 1 }}>
                  <AdjustWidget item={item} onAdjust={handleAdjust} adjusting={adjusting === item.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Ingredient Stock
          </h2>
          {lastLoadedAt && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.04em' }}>
              updated {lastLoadedAt}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search ingredient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180, padding: '5px 10px', fontSize: 12 }}
          />
          <button className="btn btn-ghost" onClick={() => load()} disabled={refreshing} style={{ fontSize: 12 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 800ms linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-ghost" onClick={() => setImportMode('ingredients')} style={{ fontSize: 12 }}>
            <FileText size={12} /> Ingredients CSV
          </button>
          <button className="btn btn-ghost" onClick={() => setImportMode('recipes')} style={{ fontSize: 12 }}>
            <FileText size={12} /> Recipes CSV
          </button>
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Total Items', value: items.length, color: 'var(--text)' },
          { label: 'Low Stock', value: lowItems.length, color: lowItems.length > 0 ? 'var(--amber)' : 'var(--green)' },
          { label: 'OK', value: items.length - lowItems.length, color: 'var(--green)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 14px', boxShadow: 'var(--shadow-hard-sm)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Inventory Table ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Threshold</th>
              <th>Adjust</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const low = item.quantity <= item.lowStockThreshold;
              return (
                <tr key={item.id} style={{ background: low ? 'var(--amber-bg)' : 'transparent' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {low && <AlertTriangle size={12} color="var(--amber)" />}
                      <span style={{ fontWeight: low ? 700 : 400, color: low ? 'var(--text)' : 'var(--text)' }}>
                        {item.productName}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: item.quantity === 0 ? 'var(--red)' : low ? 'var(--amber)' : 'var(--green)',
                    }}>
                      {formatQty(item.quantity)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.unit}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {formatQty(item.lowStockThreshold)}
                  </td>
                  <td>
                    <AdjustWidget item={item} onAdjust={handleAdjust} adjusting={adjusting === item.id} />
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {search ? `No items matching "${search}"` : 'No inventory items. Import ingredients CSV first.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Recent Activity (collapsible) ─────────────────────────────────────── */}
      <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-hard-sm)' }}>
        <button
          onClick={() => setShowActivity((v) => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
            color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showActivity ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Recent Inventory Activity
            <span className="badge badge-muted" style={{ fontSize: 10 }}>{transactions.length} entries</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
            {showActivity ? 'collapse' : 'expand to verify'}
          </span>
        </button>

        {showActivity && (
          <table className="data-table">
            <thead><tr><th>Time</th><th>Ingredient</th><th>Activity</th><th style={{ textAlign: 'right' }}>Delta</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>
              {transactions.slice(0, 20).map((tx) => {
                const neg = Number(tx.quantityDelta) < 0;
                return (
                  <tr key={tx.id}>
                    <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {new Date(tx.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{tx.ingredient?.name ?? 'Ingredient'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{tx.ingredient?.code ?? '—'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{formatTxLabel(tx)}</div>
                      {tx.reason && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{tx.reason}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: neg ? 'var(--red)' : 'var(--green)' }}>
                      {Number(tx.quantityDelta) > 0 ? '+' : ''}{formatQty(Number(tx.quantityDelta))}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                      {tx.balanceAfter == null ? '—' : formatQty(Number(tx.balanceAfter))}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  No activity yet. Fire an order to see consumption entries.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {importMode && (
        <InventoryImportModal mode={importMode} onImported={async () => { await load(); }} onClose={() => setImportMode(null)} />
      )}
    </div>
  );
}
