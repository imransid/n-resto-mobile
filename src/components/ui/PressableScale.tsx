/**
 * Touchable with subtle scale feedback — no logic change.
 */
import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const springConfig = { damping: 18, stiffness: 260 };

export function PressableScale({
  children,
  style,
  activeScale = 0.98,
  ...props
}: PressableProps & { activeScale?: number }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={() => {
        scale.value = withSpring(activeScale, springConfig);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springConfig);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
