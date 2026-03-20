module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        allowUndefined: true,
        allowlist: [
          'ORDERS_SYNC_URL',
          'ORDERS_SYNC_AUTHORIZATION',
          'GRAPHQL_API_BASE',
          'GRAPHQL_AUTHORIZATION',
          'TABLES_API_BASE',
          'CUSTOMERS_API_BASE',
          'ASSETS_BASE_URL',
          'MASTER_DATA_COMPANY_ID',
        ],
      },
    ],
    'react-native-reanimated/plugin', // must be last
  ],
};
