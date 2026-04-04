import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Upload, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { productsApi } from '../../api/products';
import type { Product, Category, Modifier } from '../../types';

// ─── CSV Parser ───────────────────────────────────────────────────────────────
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

type ParsedRow = {
  name: string;
  description: string;
  price: string;
  cost_price: string;
  category: string;
  kds_station: string;
  image_url: string;
  send_to_kds: string;
  is_active: string;
  is_available: string;
  tax_rate: string;
  low_stock_alert: string;
  _valid: boolean;
  _error: string;
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ''])) as Record<string, string>;
    const name = (row.name ?? row.product_name ?? row.item ?? '').trim();
    const price = (row.price ?? row.rate ?? '').replace(/[₹$,]/g, '').trim();
    const cost_price = (row.cost_price ?? row.cost ?? '').replace(/[₹$,]/g, '').trim();
    const category = (row.category ?? row.category_name ?? row.type ?? '').trim();
    const description = (row.description ?? row.desc ?? row.details ?? '').trim();
    const image_url = (row.image_url ?? row.image ?? row.img ?? row.photo ?? '').trim();
    const kds_station = (row.kds_station ?? row.station ?? '').trim().toUpperCase();
    const send_to_kds = (row.send_to_kds ?? 'true').trim();
    const is_active = (row.is_active ?? 'true').trim();
    const is_available = (row.is_available ?? 'true').trim();
    const tax_rate = (row.tax_rate ?? '').replace(/[%]/g, '').trim();
    const low_stock_alert = (row.low_stock_alert ?? '').trim();

    let _error = '';
    if (!name) _error = 'Name is required';
    else if (!price || isNaN(parseFloat(price))) _error = 'Invalid price';
    else if (parseFloat(price) < 0) _error = 'Price must be positive';

    return { name, description, price, cost_price, category, kds_station, image_url, send_to_kds, is_active, is_available, tax_rate, low_stock_alert, _valid: !_error, _error };
  }).filter((r) => r.name || r.price); // skip fully empty rows
}

type ProductForm = { name: string; price: string; costPrice: string; taxRate: string; categoryId: string; description: string };
const emptyForm: ProductForm = { name: '', price: '', costPrice: '', taxRate: '5', categoryId: '', description: '' };

function ProductModal({ product, categories, onSave, onClose }: {
  product: Product | null;
  categories: Category[];
  onSave: (form: ProductForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductForm>(
    product
      ? {
          name: product.name,
          price: String(product.price),
          costPrice: product.costPrice ? String(product.costPrice) : '',
          taxRate: product.taxRate != null ? String(product.taxRate) : '5',
          categoryId: product.categoryId ?? '',
          description: product.description ?? '',
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const handle = async () => { setSaving(true); try { await onSave(form); } finally { setSaving(false); } };
  return (
    <div className="modal-overlay">
      <div className="card" style={{ width: 420, padding: 28, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 20px', letterSpacing: '-0.02em' }}>
          {product ? 'Edit Product' : 'Add Product'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Name', key: 'name', type: 'text', placeholder: 'Espresso' },
            { label: 'Description', key: 'description', type: 'text', placeholder: 'Optional' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
              <input className="input" type={type} placeholder={placeholder}
                value={form[key as keyof ProductForm]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Price (₹)', key: 'price', placeholder: '120' },
              { label: 'Cost Price (₹)', key: 'costPrice', placeholder: '60' },
              { label: 'Tax Rate (%)', key: 'taxRate', placeholder: '5' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                <input className="input" type="number" min="0" placeholder={placeholder}
                  value={form[key as keyof ProductForm]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Category</label>
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handle} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CSVImportModal({ categories, onImported, onClose }: {
  categories: Category[]; onImported: () => void; onClose: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const validRows = rows.filter((r) => r._valid);

  // Track dynamically created categories so we don't double-create within a single import run
  const createdCats = useRef<Record<string, string>>({});

  const runImport = async () => {
    createdCats.current = {};
    setStep('importing');
    let ok = 0, fail = 0;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
      try {
        // Find or create category
        let categoryId: string | undefined;
        if (row.category) {
          const key = row.category.toLowerCase();
          const existing = categories.find((c) => c.name.toLowerCase() === key);
          if (existing) {
            categoryId = existing.id;
          } else if (createdCats.current[key]) {
            categoryId = createdCats.current[key];
          } else {
            try {
              const station = (row.kds_station === 'BREWBAR' || row.kds_station === 'KITCHEN')
                ? (row.kds_station as 'BREWBAR' | 'KITCHEN')
                : undefined;
              const catRes = await productsApi.createCategory({ name: row.category, station });
              categoryId = catRes.data.id;
              createdCats.current[key] = catRes.data.id;
            } catch { /* ignore — category may have been created by a parallel row */ }
          }
        }

        const isFalsy = (v: string) => v === 'false' || v === '0' || v === 'no';

        await productsApi.create({
          name: row.name,
          price: parseFloat(row.price),
          description: row.description || null,
          categoryId,
          image: row.image_url || null,
          costPrice: row.cost_price ? parseFloat(row.cost_price) : undefined,
          taxRate: row.tax_rate ? parseFloat(row.tax_rate) : undefined,
          sendToKitchen: row.send_to_kds ? !isFalsy(row.send_to_kds) : undefined,
          isActive: row.is_active ? !isFalsy(row.is_active) : undefined,
          is86d: row.is_available ? isFalsy(row.is_available) : undefined,
          lowStockThreshold: row.low_stock_alert ? parseInt(row.low_stock_alert, 10) : undefined,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setImported(ok);
    setErrors(fail);
    setStep('done');
    onImported();
  };

  return (
    <div className="modal-overlay">
      <div className="card" style={{ width: 680, maxHeight: '80vh', padding: 28, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
          <X size={18} />
        </button>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Import Products
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 20px' }}>
          Upload a CSV file with columns: <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>name, description, price, cost_price, category, kds_station, image_url, send_to_kds, is_active, is_available, tax_rate, low_stock_alert</code>
        </p>

        {step === 'upload' && (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border-mid)',
                borderRadius: 12,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--surface-2)',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-mid)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
            >
              <Upload size={32} color="var(--text-3)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Drop your CSV here or click to browse
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Supports .csv and .txt files</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {/* Template download hint */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>Expected format:</div>
              <code style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', lineHeight: 1.8 }}>
                name,description,price,cost_price,category,kds_station,image_url<br />
                Espresso,Single shot espresso,80,40,Coffee,BREWBAR,<br />
                Croissant,Butter croissant,120,60,Food,KITCHEN,https://...
              </code>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexShrink: 0 }}>
              <span className="badge badge-green"><CheckCircle2 size={11} /> {validRows.length} valid</span>
              {rows.filter((r) => !r._valid).length > 0 && (
                <span className="badge badge-red"><AlertCircle size={11} /> {rows.filter((r) => !r._valid).length} invalid (will be skipped)</span>
              )}
              <span className="badge badge-muted">{rows.length} total rows</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <table className="data-table">
                <thead>
                  <tr><th></th><th>Name</th><th>Price</th><th>Category</th><th>Station</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ opacity: row._valid ? 1 : 0.5 }}>
                      <td>
                        {row._valid
                          ? <CheckCircle2 size={13} color="var(--green)" />
                          : <span title={row._error}><AlertCircle size={13} color="var(--red)" /></span>
                        }
                      </td>
                      <td style={{ fontWeight: row._valid ? 500 : 400, color: row._valid ? 'var(--text)' : 'var(--red)' }}>{row.name || '—'}</td>
                      <td>{row.price ? `₹${row.price}` : <span style={{ color: 'var(--red)' }}>missing</span>}</td>
                      <td style={{ color: 'var(--text-3)' }}>{row.category || '—'}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 11 }}>{row.kds_station || '—'}</td>
                      <td style={{ color: 'var(--text-3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.description || '—'}
                      </td>
                    </tr>
                  ))}
                  {rows.length > 50 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 12, fontSize: 12 }}>
                      …and {rows.length - 50} more rows
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setStep('upload'); setRows([]); }}>
                ← Change file
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={runImport} disabled={validRows.length === 0}>
                <Upload size={14} /> Import {validRows.length} products
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              Importing products… {progress}%
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
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsTab() {
  const { products, categories, refreshProducts, showToast } = useApp();
  const [editProduct, setEditProduct] = useState<Product | null | 'new'>(null);
  const [filterCat, setFilterCat] = useState<string | 'all'>('all');
  const [showImport, setShowImport] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatStation, setNewCatStation] = useState<'KITCHEN' | 'BREWBAR'>('KITCHEN');
  const [addingCat, setAddingCat] = useState(false);
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [newModName, setNewModName] = useState('');
  const [newModPrice, setNewModPrice] = useState('');
  const [addingMod, setAddingMod] = useState(false);

  useEffect(() => {
    productsApi.getModifiers().then((r) => setModifiers(r.data)).catch(() => {});
  }, []);

  const addModifier = async () => {
    if (!newModName.trim()) return;
    setAddingMod(true);
    try {
      await productsApi.createModifier({ name: newModName.trim(), price: newModPrice ? parseFloat(newModPrice) : 0 });
      const r = await productsApi.getModifiers();
      setModifiers(r.data);
      setNewModName(''); setNewModPrice('');
      showToast('Modifier added');
    } catch { showToast('Failed to add modifier'); }
    finally { setAddingMod(false); }
  };

  const filteredProducts = products
    .filter((p) => p.isActive)
    .filter((p) => filterCat === 'all' || p.categoryId === filterCat);

  const categoryProductCount = new Map<string, number>();
  products.filter((product) => product.isActive).forEach((product) => {
    if (!product.categoryId) return;
    categoryProductCount.set(product.categoryId, (categoryProductCount.get(product.categoryId) ?? 0) + 1);
  });

  const handleSave = async (form: ProductForm) => {
    if (!form.name || !form.price) { showToast('Name and price are required'); return; }
    const payload = {
      name: form.name,
      price: parseFloat(form.price),
      categoryId: form.categoryId || undefined,
      description: form.description || null,
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      taxRate: form.taxRate ? parseFloat(form.taxRate) : undefined,
    };
    try {
      if (editProduct === 'new') {
        await productsApi.create(payload);
      } else if (editProduct) {
        await productsApi.update(editProduct.id, payload);
      }
      await refreshProducts();
      setEditProduct(null);
      showToast(editProduct === 'new' ? 'Product added' : 'Updated');
    } catch { showToast('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    try { await productsApi.delete(id); await refreshProducts(); showToast('Deleted'); }
    catch { showToast('Failed to delete'); }
  };

  const toggle86 = async (product: Product) => {
    try { await productsApi.toggle86(product.id); await refreshProducts(); }
    catch { showToast('Failed to update'); }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await productsApi.createCategory({ name: newCatName.trim(), station: newCatStation });
      await refreshProducts();
      setNewCatName('');
      showToast('Category added');
    } catch { showToast('Failed to add category'); }
    finally { setAddingCat(false); }
  };

  const updateCategoryStation = async (category: Category, station: 'KITCHEN' | 'BREWBAR') => {
    if (category.station === station) return;
    setUpdatingCategoryId(category.id);
    try {
      await productsApi.updateCategory(category.id, { station });
      await refreshProducts();
      showToast(`${category.name} now routes to ${station === 'BREWBAR' ? 'Brewbar' : 'Kitchen'}`);
    } catch {
      showToast('Failed to update category station');
    } finally {
      setUpdatingCategoryId(null);
    }
  };

  return (
    <div style={{ maxWidth: 920 }}>
      {/* Categories */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Categories</h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
          Beverage categories should route to Brewbar KDS. Food categories should route to Kitchen KDS.
        </p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {categories.filter((c) => c.isActive).map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface-2)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <span>{c.station === 'BREWBAR' ? '☕' : '🍳'}</span>
                  <span>{c.name}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {categoryProductCount.get(c.id) ?? 0} active {(categoryProductCount.get(c.id) ?? 0) === 1 ? 'product' : 'products'}
                </div>
              </div>
              <select
                className="input"
                value={c.station}
                onChange={(e) => updateCategoryStation(c, e.target.value as 'KITCHEN' | 'BREWBAR')}
                disabled={updatingCategoryId === c.id}
                style={{ maxWidth: 160 }}
              >
                <option value="KITCHEN">Kitchen KDS</option>
                <option value="BREWBAR">Brewbar KDS</option>
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Category name…" value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            style={{ maxWidth: 200 }}
          />
          <select className="input" value={newCatStation}
            onChange={(e) => setNewCatStation(e.target.value as 'KITCHEN' | 'BREWBAR')}
            style={{ maxWidth: 140 }}>
            <option value="KITCHEN">Kitchen KDS</option>
            <option value="BREWBAR">Brewbar KDS</option>
          </select>
          <button className="btn btn-ghost" onClick={addCategory} disabled={addingCat}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Modifiers */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>Modifiers</h2>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
          {modifiers.map((m) => (
            <span key={m.id} className="badge badge-muted" style={{ fontSize: 12, padding: '4px 10px' }}>
              {m.name}{Number(m.price) > 0 ? ` +₹${Number(m.price).toFixed(0)}` : ''}
            </span>
          ))}
          {modifiers.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No modifiers yet</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Modifier name…" value={newModName}
            onChange={(e) => setNewModName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addModifier()}
            style={{ maxWidth: 180 }} />
          <input className="input" type="number" min="0" placeholder="Price (₹)"
            value={newModPrice} onChange={(e) => setNewModPrice(e.target.value)}
            style={{ maxWidth: 100 }} />
          <button className="btn btn-ghost" onClick={addModifier} disabled={addingMod}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`btn ${filterCat === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12 }} onClick={() => setFilterCat('all')}>All</button>
          {categories.filter((c) => c.isActive).map((c) => (
            <button key={c.id} className={`btn ${filterCat === c.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12 }} onClick={() => setFilterCat(c.id)}>{c.name}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowImport(true)}>
            <FileText size={13} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setEditProduct('new')}>
            <Plus size={13} /> Add Product
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Price</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const cat = categories.find((c) => c.id === product.categoryId);
              return (
                <tr key={product.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{product.name}</div>
                    {product.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{product.description}</div>}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{cat?.name ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>₹{Number(product.price).toFixed(0)}</td>
                  <td>
                    <button onClick={() => toggle86(product)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <span className={`badge ${product.is86d ? 'badge-red' : 'badge-green'}`}>
                        {product.is86d ? '86\'d' : 'Available'}
                      </span>
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setEditProduct(product)}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(product.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                No products yet.{' '}
                <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setEditProduct('new')}>Add one</button>{' '}or{' '}
                <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setShowImport(true)}>import from CSV</button>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editProduct !== null && (
        <ProductModal product={editProduct === 'new' ? null : editProduct}
          categories={categories.filter((c) => c.isActive)}
          onSave={handleSave} onClose={() => setEditProduct(null)} />
      )}
      {showImport && (
        <CSVImportModal categories={categories}
          onImported={async () => { await refreshProducts(); }}
          onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
