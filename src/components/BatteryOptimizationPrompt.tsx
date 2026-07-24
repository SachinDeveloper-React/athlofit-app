// src/components/BatteryOptimizationPrompt.tsx
// Shows a modal prompting the user to disable battery optimization.
// This ensures the step counter service runs reliably at midnight for
// accurate daily resets on aggressive OEM devices (Xiaomi, Samsung, etc.)

import React from 'react';
import AppModal from './AppModal';
import { useBatteryOptimization } from '../hooks/useBatteryOptimization';

const BatteryOptimizationPrompt: React.FC = () => {
  const { shouldPrompt, requestDisable, dismiss } = useBatteryOptimization();

  if (!shouldPrompt) return null;

  return (
    <AppModal
      visible={shouldPrompt}
      onClose={dismiss}
      title="Enable Unrestricted Background"
      message={
        'Your phone may stop Athlofit from tracking steps and resetting daily stats at midnight.\n\n' +
        'To ensure accurate step counting, please allow Athlofit to run without battery restrictions.'
      }
      actions={[
        {
          label: 'Allow',
          onPress: requestDisable,
          variant: 'primary',
        },
        {
          label: 'Later',
          onPress: dismiss,
          variant: 'ghost',
        },
      ]}
      closeOnBackdrop={false}
    />
  );
};

export default BatteryOptimizationPrompt;
