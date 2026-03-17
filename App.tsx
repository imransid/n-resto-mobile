/**
 * nResto Mobile — BOLT Fusion Tech
 * React Native POS: Login + Point of Sale (WatermelonDB, no Redux)
 */

import React, { useState, useCallback } from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import { SplashScreen } from './src/components/SplashScreen';

export default function App() {
  const [showApp, setShowApp] = useState(false);
  const onSplashFinish = useCallback(() => setShowApp(true), []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      {!showApp ? (
        <SplashScreen onFinish={onSplashFinish} />
      ) : (
        <AppProvider>
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </AppProvider>
      )}
    </View>
  );
}
