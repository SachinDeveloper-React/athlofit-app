import React, { memo, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
  type ViewStyle,
} from 'react-native';
import { SCREEN_WIDTH } from '../../../../utils/measure';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { AppText, AppView, Button, Card } from '../../../../components';
import { WaterCircleProgress } from './WaterCircleProgress';
import { navigate } from '../../../../navigation/navigationRef';
import { useHydration } from '../../hooks/useHydration';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  value?: number;
  max?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = SCREEN_WIDTH * 0.3;

// ─── Component ────────────────────────────────────────────────────────────────

export const HydrationCard = memo(({ value = 1220, max = 2500 }: Props) => {
  const { consumed, addWater } = useHydration();

  const { colors } = useTheme();

  const muted = useMemo(
    () => withOpacity(colors.foreground, 0.4),
    [colors.foreground],
  );

  const mutedStyle = useMemo<ViewStyle>(
    () => ({ color: muted } as any),
    [muted],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleNavigate = useCallback(() => {
    navigate('HealthStack', {
      screen: 'HydrationScreen',
    });
  }, []);

  const handleAdd250 = useCallback(() => {
    addWater?.(200);
  }, [addWater]);
  const handleAdd500 = useCallback(() => {
    addWater?.(500);
  }, [addWater]);

  // ── Press style ────────────────────────────────────────────────────────────

  const pressStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): ViewStyle => ({
      transform: [{ scale: pressed ? 0.99 : 1 }],
      opacity: pressed ? 0.88 : 1,
    }),
    [],
  );

  return (
    // Fragment removed — AppSectionHeader + AppCard can be wrapped in AppView
    // without adding layout (flex column is the default), which avoids the
    // unnecessary React element wrapper Fragment creates.
    <AppView>
      <Pressable style={pressStyle} onPress={handleNavigate}>
        <Card style={styles.card}>
          {/* Circle progress */}
          <WaterCircleProgress size={CIRCLE_SIZE} value={value} max={max} />

          {/* Right content */}
          <AppView style={styles.right}>
            <AppView style={styles.textBlock}>
              <AppText variant="title3">
                {value}{' '}
                <AppText variant="caption2" style={mutedStyle}>
                  / {max}ml
                </AppText>
              </AppText>

              <AppText
                variant="caption2"
                style={[styles.dailyIntake, mutedStyle]}
              >
                Daily intake
              </AppText>
            </AppView>

            <AppView style={styles.actions}>
              <Button
                size="sm"
                variant="outline"
                label="+200 ml"
                onPress={handleAdd250}
              />
              <Button size="sm" label="+500 ml" onPress={handleAdd500} />
            </AppView>
          </AppView>
        </Card>
      </Pressable>
    </AppView>
  );
});

HydrationCard.displayName = 'HydrationCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  right: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginLeft: 16,
  },
  textBlock: {
    flexDirection: 'column',
    gap: 4,
  },
  dailyIntake: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
});
