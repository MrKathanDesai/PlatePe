export type UserRole = 'Admin' | 'Manager' | 'Server' | 'Cashier' | 'Barista' | 'Chef';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  image: string;
  stockQty?: number;
  is86d?: boolean;
  modifiers?: Modifier[];
}

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Needs Attention' | 'Unpaid';

export interface Table {
  id: string;
  number: string;
  seats: number;
  status: TableStatus;
  currentBill?: number;
  occupiedTime?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: Modifier[];
  note?: string;
  status: 'Pending' | 'Sent' | 'Done' | 'Voided';
}

export interface Order {
  id: string;
  orderNumber: string;
  tableId?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  status: 'Open' | 'Sent' | 'Paid' | 'Voided';
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  openingBalance: number;
  closingBalance?: number;
  status: 'Active' | 'Closed';
}

export type View = 'Login' | 'Dashboard' | 'FloorPlan' | 'Orders' | 'KDS' | 'Reporting' | 'Settings';
