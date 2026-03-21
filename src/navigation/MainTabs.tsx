import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import POSScreen from '../screens/POS/POSScreen';
import OrdersScreen from '../screens/OrdersScreen';
import LogoutButton from './LogoutButton';
import { colors } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { isAdminRole } from '../utils/userRole';
import type { AuthenticatedStackParamList } from './types';

const Tab = createBottomTabNavigator();

function TabIcon({ routeName, color, size }: { routeName: string; color: string; size: number }) {
  const name = routeName === 'POS' ? 'shopping-bag' : 'list';
  return <Icon name={name} size={size} color={color} />;
}

function AdminHubHeaderButton() {
  const rootNav = useNavigation<NativeStackNavigationProp<AuthenticatedStackParamList>>();
  return (
    <TouchableOpacity
      onPress={() => rootNav.navigate('AdminHub')}
      style={styles.hubBtn}
      hitSlop={12}
      activeOpacity={0.78}
    >
      <Icon name="grid" size={20} color={colors.primaryContrast} />
      <Text style={styles.hubBtnText}>Hub</Text>
    </TouchableOpacity>
  );
}

function TabsHeaderRight() {
  return (
    <View style={styles.headerRightWrap}>
      <LogoutButton />
    </View>
  );
}

export default function MainTabs() {
  const { auth } = useAuth();
  const showHub = isAdminRole(auth.user?.role);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        lazy: true,
        /* react-navigation expects render callbacks; stable child components are defined above. */
        /* eslint-disable react/no-unstable-nested-components */
        tabBarIcon: ({ color, size }) => <TabIcon routeName={route.name} color={color} size={size} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 12 },
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        headerStyle: styles.header,
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerLeft: showHub ? () => <AdminHubHeaderButton /> : undefined,
        headerRight: () => <TabsHeaderRight />,
        /* eslint-enable react/no-unstable-nested-components */
      })}
    >
      <Tab.Screen name="POS" component={POSScreen} options={{ title: 'Point of Sale' }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Orders' }} />
    </Tab.Navigator>
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
  hubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  hubBtnText: {
    color: colors.primaryContrast,
    fontWeight: '700',
    fontSize: 15,
  },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
