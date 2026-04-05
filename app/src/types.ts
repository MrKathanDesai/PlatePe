// ─── Auth ────────────────────────────────────────────────────────────────────
export type UserRole = 'Admin' | 'Manager' | 'Server' | 'Cashier' | 'Barista' | 'Chef';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export interface Terminal {
  id: string;
  name: string;
  location: string | null;
  isLocked: boolean;
  lockedByUserId: string | null;
  lockedByUserName?: string | null;
  activeSession?: TerminalSessionSnapshot | null;
  lastOpenedSession?: TerminalSessionSnapshot | null;
  lastClosedSession?: TerminalClosedSessionSnapshot | null;
  createdAt: string;
}

export interface TerminalSessionSnapshot {
  id: string;
  userId: string;
  userName: string | null;
  status: 'ACTIVE' | 'CLOSED';
  openedAt: string;
  openingBalance: number;
}

export interface TerminalClosedSessionSnapshot extends TerminalSessionSnapshot {
  closedAt: string | null;
  closingBalance: number | null;
  discrepancy: number | null;
  salesTotal: number;
  orderCount: number;
}

export interface Session {
  id: string;
  terminalId: string;
  userId: string;
  terminal?: Terminal;
  openingBalance: number;
  closingBalance: number | null;
  discrepancy: number | null;
  status: 'ACTIVE' | 'CLOSED';
  startTime: string;
  endTime: string | null;
}

export interface Floor {
  id: string;
  name: string;
  sortOrder: number;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Tables ───────────────────────────────────────────────────────────────────
export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Needs Attention' | 'Unpaid';
export type TableAttentionType = 'PAYMENT_CASH' | 'PAYMENT_CARD';

export interface Table {
  id: string;
  number: string;
  seats: number;
  floorId: string | null;
  floor?: Floor | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  shape: string | null;
  rotation: number;
  status: TableStatus;
  currentBill: number | null;
  attentionType: TableAttentionType | null;
  attentionRequestedAt: string | null;
  occupiedSince: string | null;
  currentOrderId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Reservations ────────────────────────────────────────────────────────────
export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ReservationChannel = 'PHONE' | 'WALK_IN' | 'ONLINE';

export interface ReservationTableAssignment {
  id: string;
  reservationId: string;
  tableId: string;
  table?: Table;
  isPrimary: boolean;
  createdAt: string;
}

export interface Reservation {
  id: string;
  guestName: string;
  phone: string | null;
  email: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  notes: string | null;
  channel: ReservationChannel;
  createdByUserId: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  assignments: ReservationTableAssignment[];
  createdAt: string;
  updatedAt: string;
}

// ─── Products ─────────────────────────────────────────────────────────────────
export type KDSStation = 'KITCHEN' | 'BREWBAR';

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  station: KDSStation;
  isActive: boolean;
  createdAt: string;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  costPrice: number;
  taxRate: number;
  categoryId: string;
  category?: Category;
  image: string | null;
  is86d: boolean;
  isActive: boolean;
  sendToKitchen: boolean;
  stockQty: number;
  lowStockThreshold: number;
  modifiers?: Modifier[];
  createdAt: string;
  updatedAt: string;
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export type OrderStatus = 'Open' | 'Sent' | 'Paid' | 'Voided';
export type LineItemStatus = 'Pending' | 'Sent' | 'Done' | 'Voided';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  modifiers: { id: string; name: string; price: number }[];
  note: string | null;
  status: LineItemStatus;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  sessionId: string;
  tableId: string | null;
  source: 'POS' | 'SELF' | 'TOKEN';
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export type PaymentMethod = 'CASH' | 'DIGITAL' | 'UPI';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tip: number;
  status: PaymentStatus;
  reference: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

// ─── KDS ──────────────────────────────────────────────────────────────────────
export type TicketStage = 'TO_COOK' | 'PREPARING' | 'DONE';
export type TicketType = 'NEW' | 'ADDON' | 'VOID';

export interface KDSTicketItem {
  itemId: string;
  name: string;
  quantity: number;
  modifiers: { name: string; price: number }[];
  note: string | null;
  is86d?: boolean;
}

export interface KDSTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  station: KDSStation;
  type: TicketType;
  stage: TicketStage;
  items: KDSTicketItem[];
  receivedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// ─── Discounts ─────────────────────────────────────────────────────────────────
export type DiscountType = 'Percentage' | 'Fixed';

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  approvalThreshold: number | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Inventory ─────────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export type InventoryTransactionType =
  | 'MANUAL_ADJUSTMENT'
  | 'IMPORT'
  | 'ORDER_CONSUMPTION'
  | 'ORDER_REPLENISHMENT';

export interface InventoryTransaction {
  id: string;
  ingredientId: string;
  type: InventoryTransactionType;
  quantityDelta: number;
  balanceAfter: number | null;
  referenceType: string | null;
  referenceId: string | null;
  actorId: string | null;
  reason: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  ingredient?: {
    id: string;
    code: string;
    name: string;
    baseUnit: string;
  };
}

// ─── Reports ──────────────────────────────────────────────────────────────────
/** One row per day returned by GET /reports/daily */
export interface DailyReport {
  date: string;
  orderCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
}

export interface ProductReport {
  productId: string;
  name: string;       // backend: AS name
  totalQty: number;   // backend: AS totalQty
  revenue: number;
}

export interface HourlyHeatmap {
  dayOfWeek: number;  // 0=Sun … 6=Sat
  slot: number;       // 30-min slot index 0–47
  orderCount: number;
  revenue: number;
}

export interface TableTurnoverReport {
  tableId: string;
  tableName: string;
  turnovers: number;
  avgMinutes: number;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metaBefore: Record<string, unknown> | null;
  metaAfter: Record<string, unknown> | null;
  timestamp: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
export type Screen =
  | 'Login'
  | 'Dashboard'
  | 'FloorPlan'
  | 'Reservations'
  | 'Order'
  | 'Payment'
  | 'KDS'
  | 'Brewbar'
  | 'CashierQueue'
  | 'Reporting'
  | 'Settings';
