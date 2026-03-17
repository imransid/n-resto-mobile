import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import POSScreen from '../screens/POS/POSScreen';
import OrdersScreen from '../screens/OrdersScreen';
import LogoutButton from './LogoutButton';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ routeName, color, size }: { routeName: string; color: string; size: number }) {
  const name = routeName === 'POS' ? 'shopping-bag' : 'list';
  return <Icon name={name} size={size} color={color} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => <TabIcon routeName={route.name} color={color} size={size} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 12 },
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        headerStyle: styles.header,
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerRight: () => <LogoutButton />,
      })}
    >
      <Tab.Screen name="POS" component={POSScreen} options={{ title: 'Point of Sale' }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Orders' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { auth } = useApp();
  const isAuthenticated = auth.isAuthenticated;

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: styles.header,
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.dark,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
    }),
  },
  tabBarItem: {
    paddingVertical: 4,
  },
});
