import React, { memo, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SCREEN_WIDTH } from '../../../../utils/measure';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { AppText, AppView, Button, Card } from '../../../../components';
import { WaterCircleProgress } from './WaterCircleProgress';
import { navigate } from '../../../../navigation/navigationRef';
import { useHydration } from '../../hooks/useHydration';
import { useCoinData, useClaimReward } from '../../hooks/useGamification';
import { useToast } from '../../../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  value?: number;
  onUpdate?: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = SCREEN_WIDTH * 0.3;

// ─── Component ────────────────────────────────────────────────────────────────

export const HydrationCard = memo(({ value = 0, onUpdate }: Props) => {
  const { consumed, dailyGoal, addWater } = useHydration();
  const max = dailyGoal;
  // Store's consumed is the source of truth (reflects resets & optimistic adds).
  const displayValue = consumed;
  
  const { data: coinData } = useCoinData();
  const { mutate: claimReward, isPending: claimPending, isError, error } = useClaimReward();
  const toast = useToast();

  // Show toast when claim fails (e.g. coin blocked)
  useEffect(() => {
    if (isError && error) {
      const message = (error as any)?.message || 'Failed to claim reward.';
      toast.error(message);
    }
  }, [isError, error]);

  const hydrationReward = coinData?.claimable?.find(c => c.id === 'hydration_daily');
  const isGoalMet = displayValue >= max;
  const isClaimed = hydrationReward?.isClaimed;

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

  const handleAdd250 = useCallback(async () => {
    await addWater?.(200);
    onUpdate?.();
  }, [addWater, onUpdate]);
  const handleAdd500 = useCallback(async () => {
    await addWater?.(500);
    onUpdate?.();
  }, [addWater, onUpdate]);

  const handleClaim = useCallback(() => {
    claimReward('hydration_daily');
  }, [claimReward]);

  // ── Press style is handled by Card's onPress ──────────────────────────

  return (
    <AppView>
      <Card style={styles.card} onPress={handleNavigate}>
          {/* Circle progress */}
          <WaterCircleProgress size={CIRCLE_SIZE} value={displayValue} max={max} />

          {/* Right content */}
          <AppView style={styles.right}>
            <AppView style={styles.textBlock}>
              <AppText variant="title3">
                {displayValue}{' '}
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
              {isGoalMet && !isClaimed ? (
                <Button 
                  size="sm" 
                  variant="tinted" 
                  label={claimPending ? "Claiming..." : "🪙 Claim 20 Coins"} 
                  onPress={handleClaim} 
                  disabled={claimPending} 
                  style={{ backgroundColor: withOpacity('#F5C518', 0.15) }}
                  labelStyle={{ color: '#F5C518' }}
                />
              ) : isClaimed ? (
                <View style={{ paddingVertical: 8 }}>
                  <AppText variant="caption1" style={{ color: colors.primary, fontWeight: '600' }}>✓ Coins claimed today!</AppText>
                </View>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    label="+200 ml"
                    onPress={handleAdd250}
                  />
                  <Button size="sm" label="+500 ml" onPress={handleAdd500} />
                </>
              )}
            </AppView>
          </AppView>
      </Card>
    </AppView>
  );
});

HydrationCard.displayName = 'HydrationCard';

import { View } from 'react-native';

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
