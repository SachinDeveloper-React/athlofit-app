// src/components/Loader.tsx

import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import AppView from './AppView';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';

type Props = {
  message?: string;
  size?: 'small' | 'large';
  fullscreen?: boolean;
};

const Loader = memo(({ message, size = 'large', fullscreen = false }: Props) => {
  const { colors } = useTheme();

  return (
    <AppView
      style={[styles.container, fullscreen && styles.fullscreen,{
        backgroundColor: colors.background
      }]}
      center
    >
      <ActivityIndicator size={size} color={colors.primary} />
      {!!message && (
        <AppText variant="footnote" secondary style={styles.text}>
          {message}
        </AppText>
      )}
    </AppView>
  );
});

Loader.displayName = 'Loader';

export default Loader;

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 12,
  },
  fullscreen: {
    flex: 1,
  },
  text: {
    textAlign: 'center',
  },
});
