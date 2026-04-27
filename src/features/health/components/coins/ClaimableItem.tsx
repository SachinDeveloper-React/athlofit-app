import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import AppText from '../../../../components/AppText';
import { useClaimReward } from '../../hooks/useGamification';
import { ClaimableReward } from '../../types/gamification.type';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';

interface Props {
  item: ClaimableReward;
}

const useStyles = makeStyles(({ colors, spacing, radius, shadow }) => ({
  claimCard: {
    ...shadow.xs,
  },
  claimHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[4],
  },
  claimButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minWidth: 80,
    alignItems: 'center' as const,
  },
  progressContainer: {
    width: '100%' as const,
  },
  progressBarBase: {
    height: 6,
    width: '100%' as const,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%' as const,
  },
}));

const ClaimableItem = ({ item }: Props) => {
  const { colors, spacing, radius } = useTheme();
  const styles = useStyles();
  const { mutate: claim, isPending } = useClaimReward();

  const progress = Math.min(item.currentValue / item.threshold, 1);
  const isReady = progress >= 1 && !item.isClaimed;

  const handleClaim = () => {
    if (isReady && !isPending) {
      claim(item.id);
    }
  };

  return (
    <View style={[
      styles.claimCard,
      {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing[4],
        marginBottom: spacing[4],
      }
    ]}>
      <View style={styles.claimHeader}>
        <View>
          <AppText variant="label">{item.title}</AppText>
          <AppText variant="caption2" secondary>Reward: {item.reward} Coins</AppText>
        </View>
        <Pressable
          onPress={handleClaim}
          disabled={!isReady || isPending || item.isClaimed}
          style={({ pressed }) => [
            styles.claimButton,
            {
              backgroundColor: item.isClaimed ? withOpacity(colors.success, 0.2) : isReady ? '#F5C518' : colors.border,
              opacity: pressed ? 0.8 : 1,
              borderRadius: radius.full,
            }
          ]}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <AppText
              variant="overline"
              color={isReady ? '#000' : colors.mutedForeground}
            >
              {item.isClaimed ? 'Claimed' : 'Claim'}
            </AppText>
          )}
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <View style={[styles.progressBarBase, { backgroundColor: colors.border, borderRadius: radius.full }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isReady ? '#F5C518' : colors.primary,
                borderRadius: radius.full,
              }
            ]}
          />
        </View>
        <AppText variant="caption2" secondary style={{ marginTop: spacing[1] }}>
          {item.currentValue} / {item.threshold}
        </AppText>
      </View>
    </View>
  );
};

export default ClaimableItem;
