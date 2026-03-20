import type { PaymentMethod } from '../types/pos';
import {
  ASSETS_BASE_URL,
  CUSTOMERS_API_BASE,
  GRAPHQL_API_BASE,
  GRAPHQL_AUTHORIZATION,
  MASTER_DATA_COMPANY_ID,
  ORDERS_SYNC_AUTHORIZATION,
  ORDERS_SYNC_URL,
  TABLES_API_BASE,
} from '@env';

function envTrim(v: string | undefined): string {
  return (v ?? '').trim();
}

/**
 * Store/company config for receipts and invoices.
 * API URLs / tokens can be set via `.env` (see `.env.example`); values here are defaults when unset.
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
  /**
   * Food Service GraphQL URL (getMasterData + food operations).
   * Local/Docker: `http://localhost:3399/graphql` (Android emulator: use 10.0.2.2 or machine IP).
   */
  graphqlApiBase?: string;
  /** Optional company id for MasterData upsert when deviceId + userId are sent (Food Service resolver default if omitted). */
  masterDataCompanyId?: string;
  /** Optional `Authorization` header for GraphQL (e.g. `Bearer <token>`). */
  graphqlAuthorization?: string;
  /** Base URL for image assets (e.g. 'https://api.example.com'). Used when item_image is a path like /uploads/... */
  assetsBaseUrl?: string;
  /**
   * Full URL for POST batch order sync (e.g. `https://api.example.com/pos/orders/sync`).
   * When empty, background upload is disabled. Expects JSON body `{ deviceId, orders: [...] }`, responds 2xx on success.
   * Local dev examples: iOS sim `http://localhost:4899/orders/sync`; Android emulator `http://10.0.2.2:4899/orders/sync`.
   */
  ordersSyncUrl?: string;
  /** Optional override for order sync `Authorization` header; defaults to `graphqlAuthorization` when unset. */
  ordersSyncAuthorization?: string;
}

/** Defaults; merged with `.env` via react-native-dotenv. */
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
  tablesApiBase: envTrim(TABLES_API_BASE),
  customersApiBase: envTrim(CUSTOMERS_API_BASE),
  graphqlApiBase: envTrim(GRAPHQL_API_BASE) || 'http://localhost:3399/graphql',
  masterDataCompanyId: envTrim(MASTER_DATA_COMPANY_ID),
  graphqlAuthorization: envTrim(GRAPHQL_AUTHORIZATION),
  assetsBaseUrl: envTrim(ASSETS_BASE_URL),
  ordersSyncUrl: envTrim(ORDERS_SYNC_URL) || 'http://10.0.2.2:4899/orders/sync',
  ordersSyncAuthorization: envTrim(ORDERS_SYNC_AUTHORIZATION),
};
