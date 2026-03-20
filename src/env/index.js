/**
 * Metro resolver target for `import … from '@env'`.
 * `react-native-dotenv` inlines real values in each importing file at compile time; this stub
 * exists so Metro can resolve the module. Keep keys in sync with `src/types/env.d.ts` and
 * the Babel allowlist in `babel.config.js`.
 */
module.exports = {
  ORDERS_SYNC_URL: undefined,
  ORDERS_SYNC_AUTHORIZATION: undefined,
  GRAPHQL_API_BASE: undefined,
  GRAPHQL_AUTHORIZATION: undefined,
  TABLES_API_BASE: undefined,
  CUSTOMERS_API_BASE: undefined,
  ASSETS_BASE_URL: undefined,
  MASTER_DATA_COMPANY_ID: undefined,
};
