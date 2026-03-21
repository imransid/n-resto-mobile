/**
 * @format
 */

import './src/fcmBackgroundHandler';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('OrderSyncHeadless', () =>
  require('./src/orderSyncHeadlessTask').default
);
