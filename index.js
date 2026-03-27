/**
 * @format
 * Performance: FCM handler uses dynamic import so Notifee/FCM display logic
 * loads only when a background message arrives — reduces cold start time.
 */

import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import messaging from '@react-native-firebase/messaging';

enableScreens(true);

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const { displayFcmBackgroundDataOnly } = await import('./src/services/fcmDisplay');
  await displayFcmBackgroundDataOnly(remoteMessage);
});

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('OrderSyncHeadless', () =>
  require('./src/orderSyncHeadlessTask').default
);
