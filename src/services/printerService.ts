/**
 * Thermal printer service — calls native bridge to print ESC/POS receipts.
 * High-performance: invoice payload is built in JS once, formatting/ESC/POS in native.
 */

import { NativeModules, Platform } from 'react-native';
import type { OrderType } from '../types/pos';

/** Single line item for receipt (Gentle Park style: Item, Qty, Price, VAT%, Dis%, Total Price) */
export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
  /** Product/code shown in Item column (e.g. "010595344"); falls back to name */
  itemCode?: string;
  /** Unit price (defaults from price if not set) */
  unitPrice?: number;
  /** VAT % for this line (e.g. 10) */
  vatPercent?: number;
  /** Discount % for this line (e.g. 0) */
  disPercent?: number;
  /** Line total (defaults to price * qty) */
  lineTotal?: number;
}

/** Payload sent to native bridge — SplitAbility-style receipt (Powered By top, simple items). */
export interface InvoicePayload {
  invoiceNumber: string;
  date: string;
  storeName: string;
  /** Multi-line address (newline-separated) */
  storeAddress?: string;
  storePhone?: string;
  storeWebsite?: string;
  /** e.g. "BIN 001567671-0101" — optional */
  binTax?: string;
  /** "Served by: Admin" */
  servedBy?: string;
  /** Numeric table when purely numeric (legacy / native fallback). */
  tableNumber?: number | null;
  /**
   * Human-readable table for receipt (e.g. "12", "A1", "Terrace 3").
   * When set, receipt shows a dedicated "Table: …" line after order type.
   */
  tableDisplay?: string | null;
  /** e.g. "Dine In", "Pick Up", "Delivery" */
  orderTypeLabel?: string;
  /** Time only for service line e.g. "13:48:23" */
  orderTime?: string;
  sp?: string;
  cardNo?: string;
  customerName?: string;
  orderNotes?: string;
  items: InvoiceItem[];
  subtotal: number;
  /** Service charge (flat amount, e.g. 2). */
  serviceChargeAmount?: number;
  /** VAT/Tax amount — pass from API when available. */
  vatAmount?: number;
  discountAmount?: number;
  amountDue: number;
  paidAmount?: number;
  cashAmount?: number;
  cardAmount?: number;
  changeAmount?: number;
  paymentMethod?: string;
  returnPolicy?: string;
  vatDisclaimer?: string;
  /** Brand name shown under "Powered By" at top of receipt (e.g. "BOLT Fusion Tech"). */
  poweredByName?: string;
  poweredBy?: string;
  tax?: number;
  total?: number;
  qrPayload?: string;
  printerAddress?: string;
  printerHost?: string;
  printerPort?: number;
}

/** Result from native print */
export interface PrintResult {
  success: boolean;
  message?: string;
}

const ThermalPrinterModule =
  NativeModules.ThermalPrinter ??
  (() => {
    if (__DEV__) {
      console.warn('ThermalPrinter native module not found. Printing will no-op or use fallback.');
    }
    return null;
  })();

/**
 * Print invoice via native thermal printer (Bluetooth / TCP).
 * Returns a promise that resolves when print job is sent (or rejects on error).
 */
export function printInvoice(invoice: InvoicePayload): Promise<PrintResult> {
  if (!ThermalPrinterModule?.printInvoice) {
    return Promise.resolve({
      success: false,
      message: Platform.OS === 'ios' ? 'Printer module not linked (run pod install)' : 'Printer module not linked',
    });
  }
  return ThermalPrinterModule.printInvoice(normalizeInvoice(invoice));
}

/**
 * Optional: set printer connection (device address or TCP host).
 * Call before printInvoice when using a specific device.
 */
export function setPrinterTarget(config: { type: 'bluetooth'; address: string } | { type: 'tcp'; host: string; port: number }): Promise<void> {
  if (!ThermalPrinterModule?.setPrinterTarget) return Promise.resolve();
  return ThermalPrinterModule.setPrinterTarget(config);
}

/**
 * Optional: get list of paired Bluetooth devices (Android) or available printers (iOS).
 */
export function getAvailablePrinters(): Promise<{ name: string; address: string }[]> {
  if (!ThermalPrinterModule?.getAvailablePrinters) return Promise.resolve([]);
  return ThermalPrinterModule.getAvailablePrinters();
}

function normalizeInvoice(invoice: InvoicePayload): InvoicePayload {
  const items = Array.isArray(invoice.items)
    ? invoice.items.map((i) => {
        const qty = Number(i.qty) || 0;
        const price = Number(i.price) ?? 0;
        const unitPrice = i.unitPrice ?? price;
        const lineTotal = i.lineTotal ?? price * qty;
        return {
          name: String(i.name ?? ''),
          itemCode: i.itemCode != null ? String(i.itemCode) : undefined,
          qty,
          price,
          unitPrice,
          vatPercent: Number(i.vatPercent) ?? 0,
          disPercent: Number(i.disPercent) ?? 0,
          lineTotal,
        };
      })
    : [];
  const subtotal = Number(invoice.subtotal) ?? 0;
  const serviceChargeAmount = Number(invoice.serviceChargeAmount) ?? 0;
  const vatAmount = Number(invoice.vatAmount ?? invoice.tax) ?? 0;
  const discountAmount = Number(invoice.discountAmount) ?? 0;
  const amountDue = Number(invoice.amountDue ?? invoice.total) ?? 0;
  const paidAmount = Number(invoice.paidAmount ?? amountDue) ?? 0;
  const isCash = String(invoice.paymentMethod ?? 'Cash').toLowerCase() === 'cash';
  const cashAmount = Number(invoice.cashAmount) ?? (isCash ? amountDue : 0);
  const cardAmount = Number(invoice.cardAmount) ?? (isCash ? 0 : amountDue);
  const changeAmount = Number(invoice.changeAmount) ?? Math.max(0, paidAmount - amountDue);
  return {
    invoiceNumber: String(invoice.invoiceNumber ?? ''),
    date: String(invoice.date ?? ''),
    storeName: String(invoice.storeName ?? ''),
    storeAddress: invoice.storeAddress,
    storePhone: invoice.storePhone,
    storeWebsite: invoice.storeWebsite,
    binTax: invoice.binTax,
    servedBy: invoice.servedBy,
    tableNumber: invoice.tableNumber,
    tableDisplay: invoice.tableDisplay != null && String(invoice.tableDisplay).trim() !== '' ? String(invoice.tableDisplay).trim() : undefined,
    orderTypeLabel: invoice.orderTypeLabel,
    orderTime: invoice.orderTime,
    sp: invoice.sp,
    cardNo: invoice.cardNo,
    customerName: invoice.customerName,
    orderNotes: invoice.orderNotes,
    items,
    subtotal,
    serviceChargeAmount,
    vatAmount,
    discountAmount,
    amountDue,
    paidAmount,
    cashAmount,
    cardAmount,
    changeAmount,
    paymentMethod: invoice.paymentMethod ?? 'Cash',
    returnPolicy: invoice.returnPolicy,
    vatDisclaimer: invoice.vatDisclaimer,
    poweredByName: invoice.poweredByName,
    poweredBy: invoice.poweredBy,
    tax: invoice.tax,
    total: invoice.total ?? amountDue,
    qrPayload: invoice.qrPayload,
    printerAddress: invoice.printerAddress,
    printerHost: invoice.printerHost,
    printerPort: invoice.printerPort,
  };
}

const DEFAULT_RETURN_POLICY =
  'No money refund on sold products. Discount product not changeable. Regular product chargeable within 7 days with invoice (For One Time Only). Discount not applicable on changeable products.';
const DEFAULT_VAT_DISCLAIMER =
  '*Amended VAT Law Notification SRO. No-19 (22 Jan 25) VAT is charged as per Government.*';
const DEFAULT_POWERED_BY = 'Powered by: BOLT Fusion Tech [boltfusiontech.com]';

/** Table + numeric hint for thermal receipt (preview + native). */
export function invoiceTableFieldsForOrder(order: { orderType: OrderType; tableNumber: string }): {
  tableNumber: number | null;
  tableDisplay: string | undefined;
} {
  const raw = (order.tableNumber ?? '').trim();
  if (order.orderType !== 'DINE_IN' || raw === '') {
    return { tableNumber: null, tableDisplay: undefined };
  }
  const n = parseInt(raw, 10);
  const purePositiveInt = /^\d+$/.test(raw) && !Number.isNaN(n) && n > 0;
  return {
    tableNumber: purePositiveInt ? n : null,
    tableDisplay: raw,
  };
}

/**
 * Build InvoicePayload from app's CompletedOrder — SplitAbility-style receipt.
 * Store fields come from params (e.g. store config or API). VAT from params.vatAmount when sent from API.
 */
export function buildInvoiceFromOrder(params: {
  orderId: string;
  createdAt: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeWebsite?: string;
  binTax?: string;
  servedBy?: string;
  tableNumber?: number | null;
  /** Shown as "Table: …" on its own line after order type */
  tableDisplay?: string | null;
  orderTypeLabel?: string;
  items: { name: string; price: number; qty: number }[];
  total: number;
  /** Service charge (flat amount). Default 2. */
  serviceChargeAmount?: number;
  /** VAT/Tax amount — set from API when available; otherwise derived from total - subtotal - serviceCharge. */
  vatAmount?: number;
  tax?: number;
  paidAmount?: number;
  paymentMethod?: string;
  customerName?: string;
  orderNotes?: string;
  qrPayload?: string;
  returnPolicy?: string;
  vatDisclaimer?: string;
  /** Brand under "Powered By" at top (default "BOLT Fusion Tech"). */
  poweredByName?: string;
  poweredBy?: string;
}): InvoicePayload {
  const subtotal = params.items.reduce((s, i) => s + i.price * i.qty, 0);
  const subtotalRounded = Math.round(subtotal * 100) / 100;
  const serviceChargeAmount = params.serviceChargeAmount ?? 2;
  const serviceChargeRounded = Math.round(serviceChargeAmount * 100) / 100;
  /** VAT: use API value when provided; else derive so total = subtotal + serviceCharge + vatAmount. */
  const vatAmount =
    params.vatAmount ?? params.tax ?? Math.max(0, params.total - subtotalRounded - serviceChargeRounded);
  const vatAmountRounded = Math.round(vatAmount * 100) / 100;
  const discountAmount = 0;
  const amountDue = params.total;
  const paidAmount = params.paidAmount ?? params.total;
  const changeAmount = Math.max(0, Math.round((paidAmount - amountDue) * 100) / 100);
  const isCash = String(params.paymentMethod ?? 'Cash').toLowerCase() === 'cash';
  const d = new Date(params.createdAt);
  const date = formatInvoiceDateSplitAbility(params.createdAt);
  const orderTime = formatInvoiceTimeOnly(d);
  const invoiceNumber = params.orderId.startsWith('ORD')
    ? params.orderId
    : params.orderId.replace(/\D/g, '').slice(-9) || Date.now().toString(36).toUpperCase();
  const sp = params.orderId.startsWith('ORD') ? params.orderId.slice(-4) : params.orderId.slice(-4) || invoiceNumber.slice(0, 4);

  return {
    invoiceNumber,
    date,
    orderTime,
    storeName: params.storeName,
    storeAddress: params.storeAddress,
    storePhone: params.storePhone,
    storeWebsite: params.storeWebsite,
    binTax: params.binTax,
    servedBy: params.servedBy ?? 'Admin',
    tableNumber: params.tableNumber ?? null,
    tableDisplay:
      params.tableDisplay != null && String(params.tableDisplay).trim() !== ''
        ? String(params.tableDisplay).trim()
        : undefined,
    orderTypeLabel: params.orderTypeLabel ?? 'Dine In',
    sp,
    cardNo: '',
    customerName: params.customerName ?? '',
    orderNotes: params.orderNotes ?? '',
    items: params.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: i.price,
      unitPrice: i.price,
      vatPercent: 0,
      disPercent: 0,
      lineTotal: Math.round(i.price * i.qty * 100) / 100,
    })),
    subtotal: subtotalRounded,
    serviceChargeAmount: serviceChargeRounded,
    vatAmount: vatAmountRounded,
    discountAmount,
    amountDue,
    paidAmount,
    cashAmount: isCash ? amountDue : 0,
    cardAmount: isCash ? 0 : amountDue,
    changeAmount,
    paymentMethod: params.paymentMethod ?? 'Cash',
    returnPolicy: params.returnPolicy ?? DEFAULT_RETURN_POLICY,
    vatDisclaimer: params.vatDisclaimer ?? DEFAULT_VAT_DISCLAIMER,
    poweredByName: params.poweredByName ?? 'BOLT Fusion Tech',
    poweredBy: params.poweredBy ?? DEFAULT_POWERED_BY,
    total: params.total,
    qrPayload: params.qrPayload,
  };
}

/** Format: 2026.03.17 03:36:14 (SplitAbility style) */
function formatInvoiceDateSplitAbility(isoOrStr: string): string {
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return isoOrStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}:${s}`;
}

function formatInvoiceTimeOnly(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}
