/**
 * In-app splash screen — animated logo, tagline, and creative loading state.
 * Waits for minimum display time + optional masterDataPromise, then fades out.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SPLASH_MIN_MS = 1100;
const FADE_OUT_DURATION_MS = 320;

type Props = {
  onFinish: () => void;
  /** When provided, splash waits for this promise before allowing finish (after min time). */
  masterDataPromise?: Promise<void>;
};

export function SplashScreen({ onFinish, masterDataPromise }: Props) {
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0.4);
  const overallOpacity = useSharedValue(1);
  const loadingOpacity = useSharedValue(0);
  const loadingBarWidth = useSharedValue(0);
  const dot0 = useSharedValue(0.4);
  const dot1 = useSharedValue(0.4);
  const dot2 = useSharedValue(0.4);

  const [readyToFinish, setReadyToFinish] = useState(false);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSequence(
      withTiming(1.08, { duration: 600, easing: Easing.out(Easing.back(1.2)) }),
      withTiming(1, { duration: 200 })
    );
    ringScale.value = withDelay(
      200,
      withTiming(1.35, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
    ringOpacity.value = withDelay(
      200,
      withSequence(
        withTiming(0.35, { duration: 400 }),
        withTiming(0.2, { duration: 600 })
      )
    );
    taglineOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    loadingOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));

    // Indeterminate progress bar: shimmer / expanding line
    loadingBarWidth.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Three dots pulse
    const pulse = (v: Animated.SharedValue<number>, d: number) =>
      withDelay(
        d,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
            withTiming(0.4, { duration: 400, easing: Easing.in(Easing.cubic) })
          ),
          -1,
          true
        )
      );
    dot0.value = pulse(dot0, 0);
    dot1.value = pulse(dot1, 150);
    dot2.value = pulse(dot2, 300);
  }, []);

  useEffect(() => {
    const promise = masterDataPromise ?? Promise.resolve();
    const minDelay = new Promise<void>((r) => setTimeout(r, SPLASH_MIN_MS));
    Promise.all([promise, minDelay]).then(() => {
      setReadyToFinish(true);
    });
  }, [masterDataPromise]);

  useEffect(() => {
    if (!readyToFinish) return;
    overallOpacity.value = withTiming(
      0,
      { duration: FADE_OUT_DURATION_MS },
      (finished) => {
        if (finished) runOnJS(onFinish)();
      }
    );
  }, [readyToFinish, onFinish]);

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

  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
  }));

  const barTrackWidth = width * 0.5;
  const loadingBarStyle = useAnimatedStyle(() => ({
    width: interpolate(loadingBarWidth.value, [0, 1], [barTrackWidth * 0.2, barTrackWidth]),
  }));

  const dotStyle0 = useAnimatedStyle(() => ({ opacity: dot0.value }));
  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dot2.value }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
      <View style={styles.gradient}>
        <View style={styles.center}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <View style={styles.logoInner}>
              <Text style={styles.logoText} allowFontScaling={false}>
                nResto
              </Text>
            </View>
          </Animated.View>
          <Animated.Text style={[styles.tagline, taglineStyle]} allowFontScaling={false}>
            BOLT Fusion Tech
          </Animated.Text>

          <Animated.View style={[styles.loadingWrap, loadingContainerStyle]}>
            <Text style={styles.loadingLabel}>Loading menu</Text>
            <View style={styles.dotsRow}>
              <Animated.View style={[styles.dot, dotStyle0]} />
              <Animated.View style={[styles.dot, dotStyle1]} />
              <Animated.View style={[styles.dot, dotStyle2]} />
            </View>
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, loadingBarStyle]} />
            </View>
          </Animated.View>
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
  loadingWrap: {
    marginTop: 36,
    alignItems: 'center',
  },
  loadingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(13, 148, 136, 0.9)',
  },
  barTrack: {
    width: width * 0.5,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(13, 148, 136, 0.85)',
  },
});
