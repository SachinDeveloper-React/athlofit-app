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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
        <View key={item} style={styles.timeRow}>
          <View style={styles.timeInfo}>
            <Text style={styles.time12h}>{to12h(item)}</Text>
            <Text style={styles.time24h}>{item}</Text>
          </View>
          <Switch
            value={isOn}
            onValueChange={() => toggleAlarm(item)}
            trackColor={{ false: '#1e293b', true: '#0ea5e9' }}
            thumbColor={isOn ? '#fff' : '#475569'}
            ios_backgroundColor="#1e293b"
          />
        </View>
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
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>💧 Reminder Schedule</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Permission warning */}
        {!permissionGranted && (
          <View style={styles.permBanner}>
            <Text style={styles.permText}>
              ⚠ Notification permission not granted. Alarms won't fire.
            </Text>
          </View>
        )}

        {/* Error */}
        {!!error && <Text style={styles.errorText}>⚠ {error}</Text>}

        {/* Active count */}
        <Text style={styles.activeCount}>
          {scheduledTimes.length === 0
            ? 'No reminders set'
            : `${scheduledTimes.length} reminder${
                scheduledTimes.length > 1 ? 's' : ''
              } active`}
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Preset times */}
          <Text style={styles.sectionLabel}>PRESET TIMES</Text>
          {PRESET_TIMES.map(renderPreset)}

          {/* Custom times */}
          {customTimes.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                CUSTOM TIMES
              </Text>
              {customTimes.map(t => (
                <View key={t} style={styles.timeRow}>
                  <View style={styles.timeInfo}>
                    <Text style={styles.time12h}>{to12h(t)}</Text>
                    <Text style={styles.time24h}>{t}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeAlarm(t)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* Add custom time */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
            ADD CUSTOM TIME
          </Text>
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              placeholder="e.g. 14:30"
              placeholderTextColor="#475569"
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
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddCustom}
              activeOpacity={0.75}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {!!customError && (
            <Text style={styles.customError}>{customError}</Text>
          )}
          <Text style={styles.customHint}>Format: HH:MM (24-hour)</Text>

          {/* Clear all */}
          {scheduledTimes.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clearAllAlarms}
              activeOpacity={0.75}
            >
              <Text style={styles.clearBtnText}>Clear All Reminders</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
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
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
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
    borderBottomColor: '#1e293b',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.3,
  },
  closeBtn: {
    color: '#475569',
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
    color: '#f87171',
    fontSize: 12,
    marginBottom: 8,
  },
  activeCount: {
    color: '#38bdf8',
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
    color: '#475569',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#1e293b',
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
    color: '#f1f5f9',
  },
  time24h: {
    fontSize: 12,
    color: '#475569',
  },
  removeBtn: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  removeBtnText: {
    color: '#f87171',
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
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  customError: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 4,
  },
  customHint: {
    color: '#475569',
    fontSize: 11,
    marginBottom: 16,
  },
  clearBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.07)',
  },
  clearBtnText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 14,
  },
});
