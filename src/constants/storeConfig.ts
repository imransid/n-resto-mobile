import type { PaymentMethod } from '../types/pos';

/**
 * Store/company config for receipts and invoices.
 * Replace with API when ready (e.g. GET /settings/payment-methods).
 */
export interface StoreConfig {
  /** Company name shown below date on invoice; default "ABC Restaurant". */
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeWebsite?: string;
  binTax?: string;
  /** Brand name under "Powered By" at top of receipt. */
  poweredByName?: string;
  poweredBy?: string;
  /** Default service charge amount (flat). Used when order does not provide it. */
  defaultServiceChargeAmount?: number;
  /** Payment methods enabled for selection; others are disabled. Set from API when available. */
  enabledPaymentMethods?: PaymentMethod[];
  /** API base URL for fetching tables (e.g. 'https://api.example.com'). When set, getTables() uses GET {tablesApiBase}/tables */
  tablesApiBase?: string;
  /** API base URL for fetching customers. When set, getCustomers() uses GET {customersApiBase}/customers */
  customersApiBase?: string;
  /** GraphQL API URL for getMasterData (e.g. 'https://api.example.com/graphql'). When set, app loads master data on init. */
  graphqlApiBase?: string;
  /** Base URL for image assets (e.g. 'https://api.example.com'). Used when item_image is a path like /uploads/... */
  assetsBaseUrl?: string;
}

/** Defaults; can be overwritten by API. */
export const storeConfig: StoreConfig = {
  storeName: 'ABC Restaurant',
  storeAddress: '',
  storePhone: '',
  storeWebsite: '',
  binTax: '',
  poweredByName: 'BOLT Fusion Tech',
  poweredBy: 'Powered by: BOLT Fusion Tech [boltfusiontech.com]',
  defaultServiceChargeAmount: 2,
  enabledPaymentMethods: ['CASH'],
  tablesApiBase: '',
  customersApiBase: '',
  graphqlApiBase: 'http://localhost:3399/graphql',
  assetsBaseUrl: '',
};
