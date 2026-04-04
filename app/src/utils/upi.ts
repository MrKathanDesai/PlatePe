import * as QRCode from 'qrcode';

export interface UpiConfig {
  vpa: string | null;
  payeeName: string | null;
  notePrefix: string;
}

export interface UpiIntentInput {
  amount: number;
  orderNumber: string;
  tableNumber?: string | null;
}

function readEnvString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getUpiConfig(): UpiConfig {
  return {
    vpa: readEnvString(import.meta.env.VITE_UPI_VPA),
    payeeName: readEnvString(import.meta.env.VITE_UPI_PAYEE_NAME),
    notePrefix: readEnvString(import.meta.env.VITE_UPI_NOTE_PREFIX) ?? 'PlatePe POS',
  };
}

export function buildUpiIntentUrl(input: UpiIntentInput, config = getUpiConfig()): string | null {
  if (!config.vpa || !config.payeeName || !Number.isFinite(input.amount) || input.amount <= 0) {
    return null;
  }

  const noteParts = [config.notePrefix, `Order ${input.orderNumber}`];
  noteParts.push(input.tableNumber ? `Table ${input.tableNumber}` : 'Takeaway');

  const params = new URLSearchParams({
    pa: config.vpa,
    pn: config.payeeName,
    am: input.amount.toFixed(2),
    cu: 'INR',
    tn: noteParts.join(' · '),
  });

  return `upi://pay?${params.toString()}`;
}

export async function generateUpiQrDataUrl(intentUrl: string): Promise<string> {
  return QRCode.toDataURL(intentUrl, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1C1814',
      light: '#FFFFFFFF',
    },
  });
}
