// ─── ScheduleModal.tsx ────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import { AppText, AppView, Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import {
  PRESET_TIMES,
  useHydrationScheduleStore,
} from '../../store/hydrationScheduleStore';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Time formatter ───────────────────────────────────────────────────────────
const to12h = (timeStr: string): string => {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
};

const isValidTime = (val: string): boolean =>
  /^([01]?\d|2[0-3]):([0-5]\d)$/.test(val.trim());

const normaliseTime = (val: string): string => {
  const [h, m] = val.trim().split(':').map(Number);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ScheduleModal: React.FC<Props> = ({ visible, onClose }) => {
  const {
    scheduledTimes,
    error,
    permissionGranted,
    initSchedule,
    toggleAlarm,
    addCustomAlarm,
    removeAlarm,
    clearAllAlarms,
  } = useHydrationScheduleStore();

  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');

  const { colors } = useTheme();

  useEffect(() => {
    if (visible) initSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleAddCustom = useCallback(async () => {
    setCustomError('');
    if (!isValidTime(customInput)) {
      setCustomError('Enter a valid time like 14:30');
      return;
    }
    const normalised = normaliseTime(customInput);
    await addCustomAlarm(normalised);
    setCustomInput('');
  }, [customInput, addCustomAlarm]);

  const renderPreset = useCallback(
    (item: string) => {
      const isOn = scheduledTimes.includes(item);
      return (
        <AppView key={item} style={[styles.timeRow, { backgroundColor: colors.secondary }]}>
          <AppView style={styles.timeInfo}>
            <AppText style={[styles.time12h, { color: colors.foreground }]}>{to12h(item)}</AppText>
            <AppText style={[styles.time24h, { color: colors.mutedForeground }]}>{item}</AppText>
          </AppView>
          <Switch
            value={isOn}
            onValueChange={() => toggleAlarm(item)}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={isOn ? colors.primaryForeground : colors.mutedForeground}
            ios_backgroundColor={colors.muted}
          />
        </AppView>
      );
    },
    [scheduledTimes, toggleAlarm],
  );

  const customTimes = scheduledTimes.filter(t => !PRESET_TIMES.includes(t));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <AppView style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Handle */}
        <AppView style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

        {/* Header */}
        <AppView row spaceBetween align="center" style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <AppText style={[styles.sheetTitle, { color: colors.foreground }]}>💧 Reminder Schedule</AppText>
          <Button
            label="✕"
            onPress={onClose}
            variant="ghost"
            size="sm"
          />
        </AppView>

        {/* Permission warning */}
        {!permissionGranted && (
          <AppView style={styles.permBanner}>
            <AppText style={styles.permText}>
              ⚠ Notification permission not granted. Alarms won't fire.
            </AppText>
          </AppView>
        )}

        {/* Error */}
        {!!error && <AppText style={[styles.errorText, { color: colors.destructive }]}>⚠ {error}</AppText>}

        {/* Active count */}
        <AppText style={[styles.activeCount, { color: colors.primary }]}>
          {scheduledTimes.length === 0
            ? 'No reminders set'
            : `${scheduledTimes.length} reminder${
                scheduledTimes.length > 1 ? 's' : ''
              } active`}
        </AppText>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Preset times */}
          <AppText style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRESET TIMES</AppText>
          {PRESET_TIMES.map(renderPreset)}

          {/* Custom times */}
          {customTimes.length > 0 && (
            <>
              <AppText style={[styles.sectionLabel, { marginTop: 20, color: colors.mutedForeground }]}>
                CUSTOM TIMES
              </AppText>
              {customTimes.map(t => (
                <AppView key={t} row spaceBetween align="center" style={[styles.timeRow, { backgroundColor: colors.secondary }]}>
                  <AppView style={styles.timeInfo}>
                    <AppText style={[styles.time12h, { color: colors.foreground }]}>{to12h(t)}</AppText>
                    <AppText style={[styles.time24h, { color: colors.mutedForeground }]}>{t}</AppText>
                  </AppView>
                  <Button
                    label="Remove"
                    onPress={() => removeAlarm(t)}
                    variant="destructive"
                    size="sm"
                  />
                </AppView>
              ))}
            </>
          )}

          {/* Add custom time */}
          <AppText style={[styles.sectionLabel, { marginTop: 20, color: colors.mutedForeground }]}>
            ADD CUSTOM TIME
          </AppText>
          <AppView style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. 14:30"
              placeholderTextColor={colors.mutedForeground}
              value={customInput}
              onChangeText={v => {
                setCustomInput(v);
                setCustomError('');
              }}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={handleAddCustom}
              maxLength={5}
            />
            <Button
              label="Add"
              onPress={handleAddCustom}
              variant="primary"
              size="md"
            />
          </AppView>
          {!!customError && (
            <AppText style={[styles.customError, { color: colors.destructive }]}>{customError}</AppText>
          )}
          <AppText style={[styles.customHint, { color: colors.mutedForeground }]}>Format: HH:MM (24-hour)</AppText>

          {/* Clear all */}
          {scheduledTimes.length > 0 && (
            <Button
              label="Clear All Reminders"
              onPress={clearAllAlarms}
              variant="destructive"
              size="md"
              fullWidth
              style={styles.clearBtn}
            />
          )}

          <AppView style={{ height: 32 }} />
        </ScrollView>
      </AppView>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_H * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '600',
  },
  permBanner: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  permText: {
    color: '#fbbf24',
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
  },
  activeCount: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  scrollContent: {
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  time12h: {
    fontSize: 16,
    fontWeight: '600',
  },
  time24h: {
    fontSize: 12,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  customInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  addBtn: {
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  customError: {
    fontSize: 12,
    marginBottom: 4,
  },
  customHint: {
    fontSize: 11,
    marginBottom: 16,
  },
  clearBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  clearBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
