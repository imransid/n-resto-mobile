/**
 * Carbon copy of the thermal receipt — SplitAbility POS style.
 * Shows exactly what will be printed: Powered By top, store info, Served by, items (name + qty x price), Tax/Total, payment, Thank You!
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import type { InvoicePayload } from '../services/printerService';
import { colors, spacing, radius } from '../theme';

const WIDTH_CHARS = 32;
const SEP = '-'.repeat(WIDTH_CHARS);
const SEP_EQ = '='.repeat(WIDTH_CHARS);

function formatNum(n: number): string {
  return n.toFixed(2);
}

export interface ReceiptPreviewProps {
  payload: InvoicePayload;
}

export function ReceiptPreview({ payload }: ReceiptPreviewProps) {
  const p = payload;
  const lines: string[] = [];
  const lineMeta: { bold?: boolean; centered?: boolean; small?: boolean }[] = [];

  // ----- Header (centered): Powered By + BOLT Fusion Tech -----
  lines.push('Powered By');
  lineMeta.push({ centered: true, small: true });
  lines.push(p.poweredByName ?? 'BOLT Fusion Tech');
  lineMeta.push({ bold: true, centered: true });
  lines.push('');
  lineMeta.push({});

  // ----- Date, company name, address, served by, order # (left) -----
  lines.push(p.date);
  lineMeta.push({});
  lines.push(p.storeName);
  lineMeta.push({});
  if (p.storeAddress) {
    p.storeAddress.split('\n').forEach((l) => {
      if (l.trim()) {
        lines.push(l.trim());
        lineMeta.push({});
      }
    });
  }
  if (p.storePhone) {
    lines.push(`Phone ${p.storePhone}`);
    lineMeta.push({});
  }
  lines.push(`Served by: ${p.servedBy ?? 'Admin'}`);
  lineMeta.push({});
  lines.push(`Order #: ${p.invoiceNumber}`);
  lineMeta.push({});
  if (p.customerName != null && p.customerName.trim() !== '') {
    lines.push(`Customer: ${p.customerName.trim()}`);
    lineMeta.push({});
  }
  if (p.orderNotes != null && p.orderNotes.trim() !== '') {
    lines.push(`Note: ${p.orderNotes.trim()}`);
    lineMeta.push({});
  }

  // ----- Order type + time (always), then table on its own line when set -----
  const orderTypeLine = `${p.orderTypeLabel ?? 'Order'}${p.orderTime ? `  ${p.orderTime}` : ''}`;
  lines.push(orderTypeLine);
  lineMeta.push({});
  const tableText = (p.tableDisplay ?? '').trim();
  const hasNumericTable = p.tableNumber != null && p.tableNumber > 0;
  if (tableText !== '') {
    lines.push(`Table: ${tableText}`);
    lineMeta.push({});
  } else if (hasNumericTable) {
    lines.push(`Table: ${p.tableNumber}`);
    lineMeta.push({});
  }
  lines.push('');
  lineMeta.push({});

  // ----- Items (name left, qty x price right) -----
  p.items.forEach((i) => {
    const price = (i.unitPrice ?? i.price);
    const total = (i.lineTotal ?? price * i.qty);
    const priceStr = formatNum(price);
    const totalStr = formatNum(total);
    const qty = i.qty;
    const name = i.name;
    let right: string;
    if (qty > 1) {
      right = `${qty} x ${priceStr}`;
    } else {
      right = totalStr;
    }
    const pad = Math.max(1, WIDTH_CHARS - name.length - right.length);
    lines.push(name + ' '.repeat(pad) + right);
    lineMeta.push({});
  });
  lines.push('');
  lineMeta.push({});

  // ----- Summary -----
  const subtotal = p.subtotal ?? 0;
  const serviceCharge = p.serviceChargeAmount ?? 0;
  const taxAmount = p.vatAmount ?? p.tax ?? 0;
  const totalAmount = p.amountDue ?? p.total ?? 0;
  lines.push(`Subtotal${' '.repeat(Math.max(1, WIDTH_CHARS - 8 - formatNum(subtotal).length))}${formatNum(subtotal)}`);
  lineMeta.push({});
  if (serviceCharge > 0) {
    lines.push(`Service charge${' '.repeat(Math.max(1, WIDTH_CHARS - 14 - formatNum(serviceCharge).length))}${formatNum(serviceCharge)}`);
    lineMeta.push({});
  }
  lines.push(`Tax${' '.repeat(Math.max(1, WIDTH_CHARS - 3 - formatNum(taxAmount).length))}${formatNum(taxAmount)}`);
  lineMeta.push({});
  lines.push(`Total:${' '.repeat(Math.max(1, WIDTH_CHARS - 6 - formatNum(totalAmount).length))}${formatNum(totalAmount)}`);
  lineMeta.push({ bold: true });
  lines.push(SEP_EQ);
  lineMeta.push({});
  lines.push('');
  lineMeta.push({});

  // ----- Payment -----
  const isCash = String(p.paymentMethod ?? 'Cash').toLowerCase() === 'cash';
  const payLabel = isCash ? 'Cash:' : 'Other:';
  const payAmount = p.amountDue ?? p.total ?? 0;
  const changeAmount = p.changeAmount ?? 0;
  lines.push(`${payLabel}${' '.repeat(Math.max(1, WIDTH_CHARS - payLabel.length - formatNum(payAmount).length))}${formatNum(payAmount)}`);
  lineMeta.push({});
  lines.push(`Change:${' '.repeat(Math.max(1, WIDTH_CHARS - 7 - formatNum(changeAmount).length))}${formatNum(changeAmount)}`);
  lineMeta.push({});
  lines.push(SEP);
  lineMeta.push({});
  lines.push('');
  lineMeta.push({});

  // ----- Footer -----
  if (p.poweredBy) {
    lines.push(p.poweredBy);
    lineMeta.push({ small: true });
  }
  lines.push('');
  lineMeta.push({});
  lines.push('Thank You!');
  lineMeta.push({ bold: true, centered: true });
  lines.push('');
  lineMeta.push({});

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.receipt}>
        {lines.map((line, i) => {
          const meta = lineMeta[i] ?? {};
          return (
            <Text
              key={i}
              style={[
                styles.line,
                meta.small && styles.lineSmall,
                meta.bold && styles.lineBold,
                meta.centered && styles.lineCenter,
              ]}
              allowFontScaling={false}
            >
              {line || ' '}
            </Text>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  receipt: {
    width: '100%',
    maxWidth: 302,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  line: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#000',
    lineHeight: 18,
    letterSpacing: 0.5,
  },
  lineSmall: {
    fontSize: 11,
  },
  lineBold: {
    fontWeight: '700',
  },
  lineCenter: {
    textAlign: 'center',
  },
});
