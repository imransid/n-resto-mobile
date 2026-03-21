import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import MainTabs from './MainTabs';
import AdminHubScreen from '../screens/admin/AdminHubScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import { isAdminRole } from '../utils/userRole';
import type { AuthenticatedStackParamList } from './types';

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator<AuthenticatedStackParamList>();

export default function RootNavigator() {
  const { auth, authHydrated } = useAuth();
  const isAuthenticated = auth.isAuthenticated;
  const admin = isAdminRole(auth.user?.role);

  const initialAppRoute = useMemo((): keyof AuthenticatedStackParamList => {
    return admin ? 'AdminHub' : 'Main';
  }, [admin]);

  if (!authHydrated) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      ) : (
        <AppStack.Navigator
          initialRouteName={initialAppRoute}
          screenOptions={{
            headerStyle: styles.header,
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <AppStack.Screen name="AdminHub" component={AdminHubScreen} options={{ headerShown: false }} />
          <AppStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <AppStack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{ title: 'Dashboard', headerBackTitle: 'Hub' }}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark,
  },
  header: {
    backgroundColor: colors.dark,
  },
});
