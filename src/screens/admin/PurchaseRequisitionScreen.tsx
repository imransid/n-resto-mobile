import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { PressableScale } from '../../components/ui';

type Priority = 'LOW' | 'NORMAL' | 'URGENT';

type RequisitionItem = {
  id: string;
  name: string;
  qty: string;
  unit: string;
  priority: Priority;
  note: string;
  requestedAt: string;
};

const QUICK_ITEMS = ['Chicken breast', 'Tomatoes', 'Onion', 'Rice', 'Cooking oil', 'Cheese', 'Flour'];
const UNITS = ['kg', 'L', 'pcs', 'pack', 'box'];

function timeLabel(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function PurchaseRequisitionScreen() {
  const insets = useSafeAreaInsets();
  const { horizontalPadding, maxContentWidth, isTablet } = useResponsive();
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [note, setNote] = useState('');
  const [requests, setRequests] = useState<RequisitionItem[]>([]);

  const contentLayout = useMemo(
    () => (isTablet ? { maxWidth: maxContentWidth, alignSelf: 'center' as const, width: '100%' as const } : null),
    [isTablet, maxContentWidth]
  );

  const pendingCount = requests.length;
  const urgentCount = requests.filter((x) => x.priority === 'URGENT').length;

  const createRequest = () => {
    const cleanName = itemName.trim();
    const cleanQty = quantity.trim();
    if (!cleanName || !cleanQty) return;
    setRequests((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        qty: cleanQty,
        unit,
        priority,
        note: note.trim(),
        requestedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setItemName('');
    setQuantity('');
    setNote('');
    setPriority('NORMAL');
    setUnit('kg');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 },
          contentLayout,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(40).duration(380).springify()} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="shopping-cart" size={30} color={colors.primaryContrast} />
          </View>
          <Text style={styles.heroTitle}>Kitchen purchase requisition</Text>
          <Text style={styles.heroSub}>
            Send chef requests quickly with quantity and priority, then pass to purchasing.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400).springify()} style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending requests</Text>
          </View>
          <View style={[styles.statCard, styles.statCardUrgent]}>
            <Text style={styles.statValue}>{urgentCount}</Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(420).springify()} style={styles.formCard}>
          <Text style={styles.sectionTitle}>New requisition</Text>

          <View style={styles.quickWrap}>
            {QUICK_ITEMS.map((name) => (
              <TouchableOpacity key={name} style={styles.quickChip} onPress={() => setItemName(name)} activeOpacity={0.85}>
                <Text style={styles.quickChipText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={itemName}
            onChangeText={setItemName}
            placeholder="Item name (example: Chicken breast)"
            placeholderTextColor={colors.textSubtle}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.qtyInput]}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="Qty"
              placeholderTextColor={colors.textSubtle}
            />
            <View style={styles.unitRow}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.priorityRow}>
            {(['LOW', 'NORMAL', 'URGENT'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityChip,
                  priority === p && (p === 'URGENT' ? styles.priorityUrgent : styles.priorityActive),
                ]}
                onPress={() => setPriority(p)}
                activeOpacity={0.85}
              >
                <Text style={[styles.priorityChipText, priority === p && styles.priorityChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Chef note (optional) - brand, cut, or quality details"
            placeholderTextColor={colors.textSubtle}
            multiline
          />

          <PressableScale style={styles.submitBtn} activeScale={0.98} onPress={createRequest}>
            <Text style={styles.submitBtnText}>Add requisition</Text>
            <Icon name="plus-circle" size={18} color="#fff" />
          </PressableScale>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(420).springify()} style={styles.listCard}>
          <Text style={styles.sectionTitle}>Pending requisitions</Text>
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="inbox" size={24} color={colors.textSubtle} />
              <Text style={styles.emptyText}>No requisitions yet. Add the first kitchen request.</Text>
            </View>
          ) : (
            requests.map((r) => (
              <View key={r.id} style={styles.reqRow}>
                <View style={styles.reqLeft}>
                  <Text style={styles.reqName}>{r.name}</Text>
                  <Text style={styles.reqMeta}>
                    {r.qty} {r.unit} · {timeLabel(r.requestedAt)}
                  </Text>
                  {r.note ? <Text style={styles.reqNote}>{r.note}</Text> : null}
                </View>
                <View style={[styles.priorityBadge, r.priority === 'URGENT' && styles.priorityBadgeUrgent]}>
                  <Text style={styles.priorityBadgeText}>{r.priority}</Text>
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
  },
  hero: {
    marginBottom: spacing.sm,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    color: '#fff',
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  heroSub: {
    ...typography.body,
    color: colors.textSubtle,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: spacing.md,
    ...Platform.select({
      ios: shadows.sm,
      android: { elevation: 3 },
    }),
  },
  statCardUrgent: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  statValue: {
    ...typography.h2,
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSubtle,
  },
  formCard: {
    backgroundColor: colors.darkCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: spacing.md,
    ...Platform.select({
      ios: shadows.md,
      android: { elevation: 5 },
    }),
  },
  listCard: {
    backgroundColor: colors.darkCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.bodySemibold,
    color: '#fff',
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  quickWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  quickChipText: {
    ...typography.caption,
    color: '#7dd3fc',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.darkBorder,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: '#fff',
    ...typography.body,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  qtyInput: {
    width: 90,
  },
  unitRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: 4,
  },
  unitChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  unitChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  unitChipText: {
    ...typography.caption,
    color: colors.textSubtle,
  },
  unitChipTextActive: {
    color: '#6ee7b7',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.darkBorder,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  priorityActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  priorityUrgent: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  priorityChipText: {
    ...typography.bodyMedium,
    color: colors.textSubtle,
  },
  priorityChipTextActive: {
    color: '#fff',
  },
  noteInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  submitBtnText: {
    ...typography.bodySemibold,
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.darkBorder,
    borderRadius: radius.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  reqRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
  },
  reqLeft: {
    flex: 1,
    minWidth: 0,
  },
  reqName: {
    ...typography.bodySemibold,
    color: '#fff',
    marginBottom: 2,
  },
  reqMeta: {
    ...typography.caption,
    color: colors.textSubtle,
    marginBottom: 2,
  },
  reqNote: {
    ...typography.caption,
    color: '#cbd5e1',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.35)',
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  priorityBadgeUrgent: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  priorityBadgeText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
