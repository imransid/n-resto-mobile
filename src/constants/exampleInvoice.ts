/**
 * Example invoice payload for thermal printing (testing / demo).
 * Use with: import { exampleInvoice } from '../constants/exampleInvoice'; printInvoice(exampleInvoice);
 */

import type { InvoicePayload } from '../services/printerService';

export const exampleInvoice: InvoicePayload = {
  invoiceNumber: 'INV-1001',
  date: '2026-03-17 14:30',
  storeName: 'MY STORE',
  items: [
    { name: 'Burger', qty: 2, price: 5 },
    { name: 'Pizza', qty: 1, price: 8 },
  ],
  subtotal: 18,
  tax: 2,
  total: 20,
  amountDue: 20,
};
