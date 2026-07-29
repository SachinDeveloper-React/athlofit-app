// src/components/BatteryOptimizationPrompt.tsx
// Shows a bottom sheet prompting the user to disable battery optimization.
// This ensures the step counter service runs reliably in the background
// on aggressive OEM devices (Xiaomi, Samsung, Realme, Oppo, Vivo).

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import BottomSheet from './BottomSheet';
import Button from './Button';
import AppText from './AppText';
import { useBatteryOptimization } from '../hooks/useBatteryOptimization';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import { BatteryWarning } from 'lucide-react-native';

const BatteryOptimizationPrompt: React.FC = () => {
  const { shouldPrompt, requestDisable, dismiss } = useBatteryOptimization();
  const { colors } = useTheme();

  if (Platform.OS !== 'android') return null;

  return (
    <BottomSheet
      visible={shouldPrompt}
      onClose={dismiss}
      title="Background Activity"
      // snapHeight="45%"
      closeOnBackdrop={false}
    >
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
          <BatteryWarning size={32} color={colors.primary} />
        </View>

        <AppText variant="body" align="center" style={styles.message}>
          Your phone may stop Athlofit from counting steps in the background.
        </AppText>

        <AppText variant="footnote" secondary align="center" style={styles.subtext}>
          Allow unrestricted background access so your steps, notifications, and daily reset work correctly — even when the app is closed.
        </AppText>

        <View style={styles.buttons}>
          <Button
            label="Allow Background Access"
            onPress={requestDisable}
            variant="primary"
            size="lg"
            fullWidth
          />
          <Button
            label="Maybe Later"
            onPress={dismiss}
            variant="ghost"
            size="md"
            fullWidth
          />
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingTop: Spacing[2],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
  },
  message: {
    marginBottom: Spacing[2],
    paddingHorizontal: Spacing[2],
  },
  subtext: {
    marginBottom: Spacing[6],
    paddingHorizontal: Spacing[2],
  },
  buttons: {
    width: '100%',
    gap: Spacing[2],
  },
});

export default BatteryOptimizationPrompt;
