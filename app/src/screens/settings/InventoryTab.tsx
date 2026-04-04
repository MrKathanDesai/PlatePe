import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { useApp } from '../../store/app-store-context';
import type { InventoryItem, InventoryTransaction } from '../../types';

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
  code: string;
  name: string;
  category: string;
  base_unit: string;
  on_hand_qty: string;
  reorder_level: string;
  par_level: string;
  cost_per_unit: string;
  is_active: string;
  _valid: boolean;
  _error: string;
};

type RecipeImportRow = {
  product_code: string;
  ingredient_code: string;
  qty: string;
  unit: string;
  waste_pct: string;
  _valid: boolean;
  _error: string;
};

function parseIngredientCSV(text: string): IngredientImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''),
  );

  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as Record<string, string>;
    const parsed: IngredientImportRow = {
      code: row.code?.trim() ?? '',
      name: row.name?.trim() ?? '',
      category: row.category?.trim() ?? '',
      base_unit: row.base_unit?.trim() ?? '',
      on_hand_qty: row.on_hand_qty?.trim() ?? '',
      reorder_level: row.reorder_level?.trim() ?? '',
      par_level: row.par_level?.trim() ?? '',
      cost_per_unit: row.cost_per_unit?.trim() ?? '',
      is_active: row.is_active?.trim() ?? '',
      _valid: true,
      _error: '',
    };

    if (!parsed.code) parsed._error = 'Code is required';
    else if (!parsed.name) parsed._error = 'Name is required';
    else if (!parsed.base_unit) parsed._error = 'Base unit is required';
    else if (parsed.on_hand_qty && Number.isNaN(parseFloat(parsed.on_hand_qty))) parsed._error = 'Invalid on hand qty';
    else if (parsed.reorder_level && Number.isNaN(parseFloat(parsed.reorder_level))) parsed._error = 'Invalid reorder level';
    else if (parsed.par_level && Number.isNaN(parseFloat(parsed.par_level))) parsed._error = 'Invalid par level';
    else if (parsed.cost_per_unit && Number.isNaN(parseFloat(parsed.cost_per_unit))) parsed._error = 'Invalid cost per unit';

    parsed._valid = !parsed._error;
    return parsed;
  }).filter((row) => row.code || row.name);
}

function parseRecipeCSV(text: string): RecipeImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''),
  );

  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as Record<string, string>;
    const parsed: RecipeImportRow = {
      product_code: row.product_code?.trim() ?? '',
      ingredient_code: row.ingredient_code?.trim() ?? '',
      qty: row.qty?.trim() ?? '',
      unit: row.unit?.trim() ?? '',
      waste_pct: row.waste_pct?.trim() ?? '',
      _valid: true,
      _error: '',
    };

    if (!parsed.product_code) parsed._error = 'Product code is required';
    else if (!parsed.ingredient_code) parsed._error = 'Ingredient code is required';
    else if (!parsed.qty || Number.isNaN(parseFloat(parsed.qty))) parsed._error = 'Invalid qty';
    parsed._valid = !parsed._error;
    return parsed;
  }).filter((row) => row.product_code || row.ingredient_code);
}

type ImportMode = 'ingredients' | 'recipes';

function InventoryImportModal({
  mode,
  onImported,
  onClose,
}: {
  mode: ImportMode;
  onImported: () => Promise<void>;
  onClose: () => void;
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
  const validRows = rows.filter((row) => row._valid);

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
    setStep('importing');
    setFailureMessage('');
    setProgress(20);
    try {
      if (mode === 'ingredients') {
        const payload = ingredientRows
          .filter((row) => row._valid)
          .map((row) => ({
            code: row.code,
            name: row.name,
            category: row.category || null,
            baseUnit: row.base_unit,
            onHandQty: row.on_hand_qty ? parseFloat(row.on_hand_qty) : 0,
            lowStockThreshold: row.reorder_level ? parseFloat(row.reorder_level) : 0,
            parLevel: row.par_level ? parseFloat(row.par_level) : 0,
            costPerUnit: row.cost_per_unit ? parseFloat(row.cost_per_unit) : 0,
            isActive: row.is_active ? !['false', '0', 'no'].includes(row.is_active.toLowerCase()) : true,
          }));
        setProgress(60);
        const res = await inventoryApi.importIngredients(payload);
        setImported(res.data.created + res.data.updated);
      } else {
        const payload = recipeRows
          .filter((row) => row._valid)
          .map((row) => ({
            productCode: row.product_code,
            ingredientCode: row.ingredient_code,
            quantity: parseFloat(row.qty),
            unit: row.unit || undefined,
            wastePct: row.waste_pct ? parseFloat(row.waste_pct) : 0,
          }));
        setProgress(60);
        const res = await inventoryApi.importRecipes(payload, false);
        setImported(res.data.created + res.data.updated);
      }
      setProgress(100);
      setErrors(rows.filter((row) => !row._valid).length);
      setStep('done');
      await onImported();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setImported(0);
      setErrors(validRows.length);
      setFailureMessage(e?.response?.data?.message ?? 'Import failed');
      setStep('done');
    }
  };

  const title = mode === 'ingredients' ? 'Import Ingredients' : 'Import Recipes';
  const hint = mode === 'ingredients'
    ? 'Upload ingredients.csv with code, name, category, base_unit, on_hand_qty, reorder_level, par_level, cost_per_unit, is_active.'
    : 'Upload recipes.csv with product_code, ingredient_code, qty, unit, waste_pct.';

  return (
    <div className="modal-overlay">
      <div className="card" style={{ width: 680, maxHeight: '80vh', padding: 28, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
          <X size={18} />
        </button>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>{hint}</p>

        {step === 'upload' && (
          <div>
            <div
              onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border-mid)',
                borderRadius: 12,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--surface-2)',
              }}
            >
              <Upload size={32} color="var(--text-3)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Drop your CSV here or click to browse
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Supports .csv and .txt files</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
            />
          </div>
        )}

        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexShrink: 0 }}>
              <span className="badge badge-green"><CheckCircle2 size={11} /> {validRows.length} valid</span>
              {rows.filter((row) => !row._valid).length > 0 && (
                <span className="badge badge-red"><AlertCircle size={11} /> {rows.filter((row) => !row._valid).length} invalid</span>
              )}
              <span className="badge badge-muted">{rows.length} total rows</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <table className="data-table">
                <thead>
                  {mode === 'ingredients'
                    ? <tr><th></th><th>Code</th><th>Name</th><th>Unit</th><th>On Hand</th></tr>
                    : <tr><th></th><th>Product</th><th>Ingredient</th><th>Qty</th><th>Unit</th></tr>}
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, index) => (
                    <tr key={index} style={{ opacity: row._valid ? 1 : 0.5 }}>
                      <td>{row._valid ? <CheckCircle2 size={13} color="var(--green)" /> : <AlertCircle size={13} color="var(--red)" />}</td>
                      {mode === 'ingredients' ? (
                        <>
                          <td>{(row as IngredientImportRow).code}</td>
                          <td>{(row as IngredientImportRow).name}</td>
                          <td>{(row as IngredientImportRow).base_unit}</td>
                          <td>{(row as IngredientImportRow).on_hand_qty || '0'}</td>
                        </>
                      ) : (
                        <>
                          <td>{(row as RecipeImportRow).product_code}</td>
                          <td>{(row as RecipeImportRow).ingredient_code}</td>
                          <td>{(row as RecipeImportRow).qty}</td>
                          <td>{(row as RecipeImportRow).unit || '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setStep('upload'); setIngredientRows([]); setRecipeRows([]); }}>
                ← Change file
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={runImport} disabled={validRows.length === 0}>
                <Upload size={14} /> Import {validRows.length} rows
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              Importing… {progress}%
            </div>
            <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 3, width: `${progress}%`, transition: 'width 200ms' }} />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <CheckCircle2 size={48} color="var(--green)" style={{ margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>
              Import complete
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>
              {imported} imported{errors > 0 ? `, ${errors} failed` : ' successfully'}
            </div>
            {failureMessage && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid rgba(184,50,50,0.18)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--red)',
                marginBottom: 20,
                textAlign: 'left',
              }}>
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

export default function InventoryTab() {
  const { showToast } = useApp();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [inventoryRes, transactionRes] = await Promise.all([
        inventoryApi.getAll(),
        inventoryApi.getTransactions(),
      ]);
      setItems(inventoryRes.data);
      setTransactions(transactionRes.data);
      setLastLoadedAt(new Date().toLocaleTimeString());
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
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const interval = window.setInterval(() => { void load(true); }, 15000);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const formatQuantity = (value: number) =>
    Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/\.?0+$/, '');

  const formatTransactionLabel = (tx: InventoryTransaction) => {
    switch (tx.type) {
      case 'ORDER_CONSUMPTION':
        return 'Order fired';
      case 'ORDER_REPLENISHMENT':
        return 'Order reversal';
      case 'MANUAL_ADJUSTMENT':
        return 'Manual adjustment';
      case 'IMPORT':
        return 'Import';
      default:
        return tx.type;
    }
  };

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
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Ingredient Inventory</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Orders deduct ingredient stock when they are fired to kitchen or brewbar, not when items are only added to the cart.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => load()} disabled={refreshing}>
            <RefreshCw size={13} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-ghost" onClick={() => setImportMode('ingredients')}>
            <FileText size={13} /> Import Ingredients
          </button>
          <button className="btn btn-ghost" onClick={() => setImportMode('recipes')}>
            <FileText size={13} /> Import Recipes
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
        {lastLoadedAt ? `Last refreshed at ${lastLoadedAt}` : 'Loading latest inventory…'}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Ingredient</th><th>Stock</th><th>Unit</th><th>Threshold</th><th>Adjust</th><th></th></tr></thead>
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
                  <td style={{ fontWeight: 700, color: low ? 'var(--red)' : 'var(--green)' }}>{formatQuantity(item.quantity)}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.unit}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{formatQuantity(item.lowStockThreshold)}</td>
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
                No inventory items yet. Import ingredients first.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 18 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Recent Inventory Activity</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            Use this to verify that fired orders are writing inventory transactions.
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>Time</th><th>Ingredient</th><th>Activity</th><th>Delta</th><th>Balance</th></tr></thead>
          <tbody>
            {transactions.slice(0, 12).map((tx) => {
              const isConsumption = Number(tx.quantityDelta) < 0;
              return (
                <tr key={tx.id}>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.ingredient?.name ?? 'Ingredient'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tx.ingredient?.code ?? '—'}</div>
                  </td>
                  <td>
                    <div>{formatTransactionLabel(tx)}</div>
                    {tx.reason && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tx.reason}</div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: isConsumption ? 'var(--red)' : 'var(--green)' }}>
                    {Number(tx.quantityDelta) > 0 ? '+' : ''}{formatQuantity(Number(tx.quantityDelta))}
                  </td>
                  <td>{tx.balanceAfter == null ? '—' : formatQuantity(Number(tx.balanceAfter))}</td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>
                No inventory activity yet. Fire an order to see consumption entries here.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {importMode && (
        <InventoryImportModal
          mode={importMode}
          onImported={async () => { await load(); }}
          onClose={() => setImportMode(null)}
        />
      )}
    </div>
  );
}
