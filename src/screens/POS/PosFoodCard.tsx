/**
 * Menu tile — clean ordering-app style: full-bleed image, title, price row + circular add (Fummo-like).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import type { FoodItem } from '../../constants/demoData';
import { colors as themeColors } from '../../theme';
import { FOOD_CARD_ENTER_STAGGER_CAP } from './posConstants';

const POS = themeColors.posAccent;
const POS_DARK = themeColors.posAccentDark;

function monogram(name: string): string {
  const word = name.trim().split(/\s+/)[0];
  return word ? word.charAt(0).toUpperCase() : '?';
}

export const PosFoodCard = React.memo(function PosFoodCard({
  food,
  priceLabel,
  rangeLabel,
  defaultVariantSummary,
  onQuickAdd,
  onOpenOptions,
  index = 0,
}: {
  food: FoodItem;
  priceLabel: string;
  rangeLabel?: string;
  defaultVariantSummary?: string;
  onQuickAdd: (f: FoodItem) => void;
  onOpenOptions?: (f: FoodItem) => void;
  index?: number;
}) {
  const [imageError, setImageError] = useState(false);
  const hasImage = Boolean(food.item_image_local?.trim()) && !imageError;
  const imageUri = hasImage
    ? food.item_image_local!.startsWith('file')
      ? food.item_image_local!
      : `file://${food.item_image_local!}`
    : null;
  const letter = monogram(food.item_name);
  const showImage = Boolean(imageUri);
  const hasVariants = (food.variantGroups?.length ?? 0) > 0;
  const desc = (food.description ?? '').trim();

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, FOOD_CARD_ENTER_STAGGER_CAP) * 14)
        .duration(200)
        .springify()
        .damping(20)}
      style={styles.outer}
    >
      <View style={styles.card}>
        <View style={styles.imageWrap}>
          {showImage ? (
            <Image
              source={{ uri: imageUri! }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              fadeDuration={Platform.OS === 'android' ? 0 : undefined}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderLetter} allowFontScaling={false}>
                {letter}
              </Text>
            </View>
          )}
          {hasVariants ? (
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>Custom</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {food.item_name}
          </Text>
          {desc.length > 0 ? (
            <Text style={styles.desc} numberOfLines={2}>
              {desc}
            </Text>
          ) : null}

          <View style={styles.footerRow}>
            <View style={styles.priceCol}>
              <Text style={styles.price}>{priceLabel}</Text>
              {rangeLabel ? (
                <Text style={styles.range} numberOfLines={1}>
                  {rangeLabel}
                </Text>
              ) : null}
              {hasVariants && defaultVariantSummary ? (
                <Text style={styles.quickHint} numberOfLines={1}>
                  Default · {defaultVariantSummary}
                </Text>
              ) : null}
            </View>
            <Pressable
              style={({ pressed }) => [styles.addCircle, pressed && styles.addCirclePressed]}
              onPress={() => onQuickAdd(food)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${food.item_name}, ${priceLabel}`}
              accessibilityHint={
                hasVariants ? 'Adds default options. Use customize for other choices.' : undefined
              }
              hitSlop={8}
              android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true }}
            >
              <Icon name="plus" size={22} color="#fff" />
            </Pressable>
          </View>

          {hasVariants && onOpenOptions ? (
            <Pressable
              style={({ pressed }) => [styles.customizeLink, pressed && styles.customizeLinkPressed]}
              onPress={() => onOpenOptions(food)}
              accessibilityRole="button"
              accessibilityLabel={`Customize ${food.item_name}`}
            >
              <Icon name="sliders" size={14} color={POS_DARK} />
              <Text style={styles.customizeLinkText}>Customize options</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: themeColors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.05,
    backgroundColor: themeColors.surfaceTertiary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.surfaceSecondary,
  },
  placeholderLetter: {
    fontSize: 40,
    fontWeight: '600',
    color: themeColors.textSubtle,
  },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(234, 88, 12, 0.35)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: POS_DARK,
    letterSpacing: 0.2,
  },
  body: {
    padding: 14,
    paddingTop: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: themeColors.text,
    lineHeight: 20,
    letterSpacing: -0.25,
  },
  desc: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 16,
    color: themeColors.textMuted,
    fontWeight: '500',
  },
  footerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceCol: {
    flex: 1,
    minWidth: 0,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: POS,
    letterSpacing: -0.45,
  },
  range: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textSubtle,
  },
  quickHint: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: themeColors.textMuted,
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: POS,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: POS,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  addCirclePressed: {
    opacity: 0.88,
  },
  customizeLink: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  customizeLinkPressed: {
    opacity: 0.7,
  },
  customizeLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: POS_DARK,
  },
});
