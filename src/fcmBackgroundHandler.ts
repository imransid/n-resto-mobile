/**
 * Registered from `index.js` before the app component loads (RN Firebase requirement).
 * Keep imports minimal — this runs in a headless JS context on Android.
 */
import messaging from '@react-native-firebase/messaging';
import { displayFcmBackgroundDataOnly } from './services/fcmDisplay';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await displayFcmBackgroundDataOnly(remoteMessage);
});
