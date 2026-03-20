declare module '@env' {
  /** Full POST URL for order batch sync. Empty / unset = sync disabled. */
  export const ORDERS_SYNC_URL: string | undefined;
  /** Optional `Authorization` header for order sync only. */
  export const ORDERS_SYNC_AUTHORIZATION: string | undefined;
  /** GraphQL endpoint (Food Service). Falls back in storeConfig when unset. */
  export const GRAPHQL_API_BASE: string | undefined;
  export const GRAPHQL_AUTHORIZATION: string | undefined;
  export const TABLES_API_BASE: string | undefined;
  export const CUSTOMERS_API_BASE: string | undefined;
  export const ASSETS_BASE_URL: string | undefined;
  export const MASTER_DATA_COMPANY_ID: string | undefined;
}
