import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { useApp } from '../context/AppContext';
import { DEMO_USERS } from '../constants/demoData';
import { colors, spacing, radius, typography } from '../theme';
import { useResponsive } from '../hooks/useResponsive';
import { PressableScale } from '../components/ui';

export default function LoginScreen() {
  const { login } = useApp();
  const { horizontalPadding, maxContentWidth, isTablet } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const raw = (email || '').toLowerCase().trim();
    const key = raw.replace(/@.*$/, '') || raw;
    const cred = DEMO_USERS[raw] ?? DEMO_USERS[key];
    if (!cred || cred.password !== password) {
      Alert.alert('Login failed', 'Invalid email or password');
      return;
    }
    setLoading(true);
    try {
      await login(cred.user, 'demo-token-' + cred.user.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.bgGradient} />
      <View style={styles.accentOrb} />
      <View style={styles.accentOrbSmall} />
      <ScrollView
        contentContainerStyle={[styles.contentScroll, { paddingHorizontal: horizontalPadding, paddingBottom: 48 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, isTablet && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
        <Animated.View entering={FadeInDown.delay(60).duration(500).springify().damping(14)} style={styles.logoCard}>
          <View style={styles.logoIconWrap}>
            <Icon name="shopping-bag" size={40} color={colors.primaryContrast} />
          </View>
          <Text style={styles.title}>nResto</Text>
          <Text style={styles.subtitle}>BOLT Fusion Tech</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(480).springify()} style={styles.formCard}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formHint}>Sign in to continue</Text>
          <View style={styles.inputWrap}>
            <Icon name="mail" size={20} color={colors.textSubtle} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textSubtle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>
          <View style={styles.inputWrap}>
            <Icon name="lock" size={20} color={colors.textSubtle} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSubtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>
          <PressableScale
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeScale={0.98}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryContrast} size="small" />
            ) : (
              <>
                <Text style={styles.buttonText}>Sign In</Text>
                <Icon name="arrow-right" size={20} color={colors.primaryContrast} />
              </>
            )}
          </PressableScale>
        </Animated.View>

        </View>
        <Animated.View entering={FadeInUp.delay(380).duration(400)} style={styles.footer}>
          <Text style={styles.footerText}>© 2026 BOLT Fusion Tech</Text>
          <Text style={styles.footerLink}>boltfusiontech.com</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.dark,
    opacity: 1,
  },
  accentOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primaryMuted,
    top: -80,
    right: -80,
  },
  accentOrbSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryMuted,
    bottom: 120,
    left: -40,
  },
  contentScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  content: {
    paddingVertical: 24,
  },
  logoCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSubtle,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  formCard: {
    backgroundColor: colors.darkCard,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  formTitle: {
    ...typography.h1,
    color: '#fff',
    marginBottom: spacing.xxs,
  },
  formHint: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSubtle,
    marginBottom: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: '#fff',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: colors.primaryContrast,
    ...typography.bodySemibold,
    fontSize: 16,
  },
  footer: {
    marginTop: 24,
    marginBottom: 28,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footerLink: {
    fontSize: 12,
    color: colors.primaryLight,
    marginTop: 2,
    fontWeight: '600',
  },
});
