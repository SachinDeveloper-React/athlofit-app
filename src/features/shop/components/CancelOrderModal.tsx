import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import KeyboardAvoidingView from '../../../components/KeyboardAvoidingView';

// ─── Common cancellation reasons ──────────────────────────────────────────────
const CANCEL_REASONS = [
  { id: 'changed_mind', label: 'Changed my mind', icon: 'RefreshCw' },
  { id: 'found_better', label: 'Found a better deal elsewhere', icon: 'Search' },
  { id: 'ordered_wrong', label: 'Ordered wrong item/size', icon: 'XCircle' },
  { id: 'too_expensive', label: 'Too expensive', icon: 'Wallet' },
  { id: 'delivery_too_long', label: 'Delivery time is too long', icon: 'Clock' },
  { id: 'duplicate_order', label: 'Duplicate order', icon: 'Copy' },
  { id: 'other', label: 'Other reason', icon: 'PenLine' },
] as const;

interface CancelOrderModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
  isLoading?: boolean;
  orderCoins?: number; // show refund info if coin purchase
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
  orderCoins,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedReason(null);
      setCustomNote('');
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedReason) return;
    Keyboard.dismiss();
    const reasonLabel = CANCEL_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
    onConfirm(reasonLabel, customNote.trim());
  }, [selectedReason, customNote, onConfirm]);

  const handleReasonSelect = useCallback((id: string) => {
    setSelectedReason(id);
    // Scroll to bottom when selecting a reason to show the text input
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 350);
  }, []);

  const isOther = selectedReason === 'other';
  const canSubmit = selectedReason && (!isOther || customNote.trim().length > 0);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop — dismisses keyboard + closes modal */}
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <View style={styles.backdropFill} />
        </Pressable>

        {/* Bottom Sheet */}
        <Pressable onPress={Keyboard.dismiss}>
          <Animated.View
            entering={SlideInDown.duration(350).damping(20).stiffness(120)}
            exiting={SlideOutDown.duration(250)}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              },
            ]}
          >
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: withOpacity('#DC2626', 0.1) }]}>
              <Icon name="XCircle" size={24} color="#DC2626" />
            </View>
            <AppText variant="title3" weight="bold" style={{ marginTop: 12 }}>
              Cancel Order?
            </AppText>
            <AppText variant="body" secondary align="center" style={{ marginTop: 6, paddingHorizontal: 20 }}>
              Please tell us why you want to cancel this order
            </AppText>
          </View>

          {/* Refund info */}
          {orderCoins != null && orderCoins > 0 && (
            <View style={[styles.refundBanner, { backgroundColor: withOpacity('#059669', 0.08), borderColor: withOpacity('#059669', 0.2) }]}>
              <Icon name="Coins" size={14} color="#059669" />
              <AppText variant="caption1" weight="semiBold" color="#059669" style={{ marginLeft: 6 }}>
                {orderCoins.toLocaleString()} coins will be refunded
              </AppText>
            </View>
          )}

          {/* Reason options */}
          <ScrollView
            ref={scrollRef}
            style={styles.reasonList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {CANCEL_REASONS.map((reason, i) => {
              const isSelected = selectedReason === reason.id;
              return (
                <Pressable
                  key={reason.id}
                  onPress={() => handleReasonSelect(reason.id)}
                  style={[
                    styles.reasonItem,
                    {
                      backgroundColor: isSelected ? withOpacity(colors.primary, 0.08) : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: 14,
                    },
                  ]}
                >
                  <View style={[styles.reasonIcon, { backgroundColor: isSelected ? withOpacity(colors.primary, 0.12) : withOpacity(colors.foreground, 0.06) }]}>
                    <Icon name={reason.icon as any} size={16} color={isSelected ? colors.primary : colors.mutedForeground} />
                  </View>
                  <AppText
                    variant="subhead"
                    weight={isSelected ? 'semiBold' : 'regular'}
                    color={isSelected ? colors.primary : colors.foreground}
                    style={{ flex: 1, marginLeft: 12 }}
                  >
                    {reason.label}
                  </AppText>
                  <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                  </View>
                </Pressable>
              );
            })}

            {/* Custom note input (shows for "Other" or optionally for any) */}
            {selectedReason && (
              <View style={{ marginTop: 12 }}>
                <AppText variant="caption1" weight="semiBold" secondary style={{ marginBottom: 6, marginLeft: 4 }}>
                  {isOther ? 'Please describe your reason *' : 'Additional notes (optional)'}
                </AppText>
                <TextInput
                  value={customNote}
                  onChangeText={setCustomNote}
                  placeholder={isOther ? 'Tell us why you want to cancel...' : 'Any additional details...'}
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={300}
                  onFocus={() => {
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                  }}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                      borderRadius: 12,
                    },
                  ]}
                />
                <AppText variant="caption2" secondary style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                  {customNote.length}/300
                </AppText>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={handleClose}
              style={[styles.actionBtn, styles.keepBtn, { borderColor: colors.border, borderRadius: 14 }]}
            >
              <AppText variant="body" weight="semiBold">Keep Order</AppText>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!canSubmit || isLoading}
              style={[
                styles.actionBtn,
                styles.confirmCancelBtn,
                {
                  backgroundColor: canSubmit ? '#DC2626' : withOpacity('#DC2626', 0.4),
                  borderRadius: 14,
                  opacity: isLoading ? 0.6 : 1,
                },
              ]}
            >
              <Icon name="XCircle" size={16} color="#fff" />
              <AppText variant="body" weight="bold" color="#fff" style={{ marginLeft: 6 }}>
                {isLoading ? 'Cancelling...' : 'Cancel Order'}
              </AppText>
            </Pressable>
          </View>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CancelOrderModal;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    paddingTop: 12,
    maxHeight: '100%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  reasonList: {
    paddingHorizontal: 16,
    maxHeight: 320,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  reasonIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  keepBtn: {
    borderWidth: 1.5,
  },
  confirmCancelBtn: {},
});
