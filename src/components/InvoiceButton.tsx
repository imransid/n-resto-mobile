/**
 * Invoice button — triggers thermal print via native bridge.
 * Use in the invoice modal after payment; shows success/error feedback.
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {
  printInvoice,
  buildInvoiceFromOrder,
  type InvoicePayload,
} from '../services/printerService';
import { colors, spacing, radius, typography } from '../theme';

export interface InvoiceButtonProps {
  /** Pre-built invoice payload (use this OR orderPayload, not both) */
  invoice?: InvoicePayload;
  /** Build invoice from order (used when showing invoice after payment) */
  orderPayload?: {
    orderId: string;
    createdAt: string;
    storeName: string;
    storeAddress?: string;
    storePhone?: string;
    storeWebsite?: string;
    binTax?: string;
    servedBy?: string;
    tableNumber?: number | null;
    tableDisplay?: string | null;
    orderTypeLabel?: string;
    items: { name: string; price: number; qty: number }[];
    total: number;
    serviceChargeAmount?: number;
    vatAmount?: number;
    tax?: number;
    paymentMethod?: string;
    paidAmount?: number;
    customerName?: string;
    qrPayload?: string;
    returnPolicy?: string;
    vatDisclaimer?: string;
    poweredByName?: string;
    poweredBy?: string;
  };
  /** Button label */
  label?: string;
  /** Optional style overrides */
  style?: object;
  textStyle?: object;
  /** Called after print attempt (success or error) */
  onPrintResult?: (success: boolean, message?: string) => void;
  /** Disabled when no printer / no invoice */
  disabled?: boolean;
}

const STORE_NAME = 'MY STORE';

export function InvoiceButton({
  invoice,
  orderPayload,
  label = 'Print Invoice',
  style,
  textStyle,
  onPrintResult,
  disabled = false,
}: InvoiceButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePress = async () => {
    const payload: InvoicePayload | null =
      invoice ??
      (orderPayload
        ? buildInvoiceFromOrder({
            orderId: orderPayload.orderId,
            createdAt: orderPayload.createdAt,
            storeName: orderPayload.storeName || STORE_NAME,
            storeAddress: orderPayload.storeAddress,
            storePhone: orderPayload.storePhone,
            storeWebsite: orderPayload.storeWebsite,
            binTax: orderPayload.binTax,
            servedBy: orderPayload.servedBy,
            tableNumber: orderPayload.tableNumber,
            tableDisplay: orderPayload.tableDisplay,
            orderTypeLabel: orderPayload.orderTypeLabel,
            items: orderPayload.items,
            total: orderPayload.total,
            serviceChargeAmount: orderPayload.serviceChargeAmount,
            vatAmount: orderPayload.vatAmount,
            tax: orderPayload.tax,
            paymentMethod: orderPayload.paymentMethod,
            paidAmount: orderPayload.paidAmount,
            customerName: orderPayload.customerName,
            qrPayload: orderPayload.qrPayload,
            returnPolicy: orderPayload.returnPolicy,
            vatDisclaimer: orderPayload.vatDisclaimer,
            poweredByName: orderPayload.poweredByName,
            poweredBy: orderPayload.poweredBy,
          })
        : null);

    if (!payload?.items?.length && payload?.amountDue == null && payload?.total == null) {
      onPrintResult?.(false, 'No invoice data');
      return;
    }

    setPrinting(true);
    try {
      const result = await printInvoice(payload);
      onPrintResult?.(result.success, result.message);
      if (result.success) {
        Alert.alert('Printed', 'Receipt sent to printer.');
      } else if (result.message) {
        Alert.alert('Print', result.message);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Print failed';
      onPrintResult?.(false, message);
      Alert.alert('Print Error', message);
    } finally {
      setPrinting(false);
    }
  };

  const hasData = Boolean(invoice ?? orderPayload);
  const isDisabled = disabled || printing || !hasData;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[styles.button, isDisabled && styles.buttonDisabled, style]}
    >
      {printing ? (
        <ActivityIndicator size="small" color={colors.primaryContrast} />
      ) : (
        <>
          <Icon name="printer" size={20} color={colors.primaryContrast} style={styles.icon} />
          <Text style={[styles.label, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    color: colors.primaryContrast,
    ...typography.bodySemibold,
    fontSize: 16,
  },
});
