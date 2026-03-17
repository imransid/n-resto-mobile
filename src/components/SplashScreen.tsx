/**
 * In-app splash screen — animated logo and tagline, then fade out.
 * Shown on top of the app until minimum display time + fade complete.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SPLASH_DURATION_MS = 2200;
const FADE_OUT_DURATION_MS = 400;

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0.4);
  const overallOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSequence(
      withTiming(1.08, { duration: 600, easing: Easing.out(Easing.back(1.2)) }),
      withTiming(1, { duration: 200 })
    );
    ringScale.value = withDelay(200, withTiming(1.35, { duration: 800, easing: Easing.out(Easing.cubic) }));
    ringOpacity.value = withDelay(200, withSequence(
      withTiming(0.35, { duration: 400 }),
      withTiming(0.2, { duration: 600 })
    ));
    taglineOpacity.value = withDelay(500, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));

    const t = setTimeout(() => {
      overallOpacity.value = withTiming(0, { duration: FADE_OUT_DURATION_MS }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, SPLASH_DURATION_MS - FADE_OUT_DURATION_MS);

    return () => clearTimeout(t);
  }, [onFinish]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: overallOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <View style={styles.gradient}>
        <View style={styles.center}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <View style={styles.logoInner}>
              <Text style={styles.logoText} allowFontScaling={false}>nResto</Text>
            </View>
          </Animated.View>
          <Animated.Text style={[styles.tagline, taglineStyle]} allowFontScaling={false}>
            BOLT Fusion Tech
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  gradient: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    borderWidth: 2,
    borderColor: 'rgba(13, 148, 136, 0.6)',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.2,
  },
  tagline: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(13, 148, 136, 0.95)',
    letterSpacing: 2.5,
  },
});
