// ─── ScheduleModal.tsx ────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { makeStyles } from '../../../../hooks/makeStyles';

const { height: SCREEN_H } = Dimensions.get('window');

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

interface Props {
  visible: boolean;
  onClose: () => void;
}

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  backdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_H * 0.85,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingHorizontal: spacing[5],
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing[4],
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: spacing[0.5],
    alignSelf: 'center' as const,
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  sheetHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    marginBottom: spacing[2],
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  permBanner: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: radius.lg,
    padding: spacing[2.5],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  permText: {
    color: '#fbbf24',
    fontSize: fontSize.sm,
  },
  errorText: {
    fontSize: fontSize.sm,
    marginBottom: spacing[2],
  },
  activeCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    marginBottom: spacing[3],
  },
  scrollContent: {
    paddingTop: spacing[1],
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: spacing[2],
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3.5 as any] ?? 14,
    borderRadius: radius.lg,
    marginBottom: spacing[2],
  },
  timeInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2.5],
  },
  time12h: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
  },
  time24h: {
    fontSize: fontSize.sm,
  },
  customRow: {
    flexDirection: 'row' as const,
    gap: spacing[2.5],
    marginBottom: spacing[1],
  },
  customInput: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    borderWidth: 1,
  },
  customError: {
    fontSize: fontSize.sm,
    marginBottom: spacing[1],
  },
  customHint: {
    fontSize: 11,
    marginBottom: spacing[4],
  },
  clearBtn: {
    marginTop: spacing[3],
  },
}));

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
  const styles = useStyles();

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
    [scheduledTimes, toggleAlarm, styles, colors],
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
      <Pressable style={styles.backdrop} onPress={onClose} />

      <AppView style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <AppView style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

        <AppView row spaceBetween align="center" style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <AppText style={[styles.sheetTitle, { color: colors.foreground }]}>💧 Reminder Schedule</AppText>
          <Button label="✕" onPress={onClose} variant="ghost" size="sm" />
        </AppView>

        {!permissionGranted && (
          <AppView style={styles.permBanner}>
            <AppText style={styles.permText}>
              ⚠ Notification permission not granted. Alarms won't fire.
            </AppText>
          </AppView>
        )}

        {!!error && <AppText style={[styles.errorText, { color: colors.destructive }]}>⚠ {error}</AppText>}

        <AppText style={[styles.activeCount, { color: colors.primary }]}>
          {scheduledTimes.length === 0
            ? 'No reminders set'
            : `${scheduledTimes.length} reminder${scheduledTimes.length > 1 ? 's' : ''} active`}
        </AppText>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <AppText style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRESET TIMES</AppText>
          {PRESET_TIMES.map(renderPreset)}

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
                  <Button label="Remove" onPress={() => removeAlarm(t)} variant="destructive" size="sm" />
                </AppView>
              ))}
            </>
          )}

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
            <Button label="Add" onPress={handleAddCustom} variant="primary" size="md" />
          </AppView>
          {!!customError && (
            <AppText style={[styles.customError, { color: colors.destructive }]}>{customError}</AppText>
          )}
          <AppText style={[styles.customHint, { color: colors.mutedForeground }]}>Format: HH:MM (24-hour)</AppText>

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
