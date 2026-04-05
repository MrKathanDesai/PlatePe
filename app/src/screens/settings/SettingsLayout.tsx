import { useState } from 'react';
import ProductsTab from './ProductsTab';
import FloorsTab from './FloorsTab';
import TablesTab from './TablesTab';
import StaffTab from './StaffTab';
import DiscountsTab from './DiscountsTab';
import InventoryTab from './InventoryTab';
import TerminalsTab from './TerminalsTab';

type SettingsTab = 'Products' | 'Floors' | 'Tables' | 'Terminals' | 'Staff' | 'Discounts' | 'Inventory';
const TABS: SettingsTab[] = ['Products', 'Floors', 'Tables', 'Terminals', 'Staff', 'Discounts', 'Inventory'];

export default function SettingsLayout() {
  const [tab, setTab] = useState<SettingsTab>('Products');

  return (
    <div style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 22px', letterSpacing: '-0.04em' }}>
        Settings
      </h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 13 }} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'Products'   && <ProductsTab />}
        {tab === 'Floors'     && <FloorsTab />}
        {tab === 'Tables'     && <TablesTab />}
        {tab === 'Terminals'  && <TerminalsTab />}
        {tab === 'Staff'      && <StaffTab />}
        {tab === 'Discounts'  && <DiscountsTab />}
        {tab === 'Inventory'  && <InventoryTab />}
      </div>
    </div>
  );
}
