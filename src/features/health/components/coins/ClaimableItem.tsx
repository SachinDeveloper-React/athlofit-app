import React from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import AppText from '../../../../components/AppText';
import { useClaimReward } from '../../hooks/useGamification';
import { ClaimableReward } from '../../types/gamification.type';
import { withOpacity } from '../../../../utils/withOpacity';

interface Props {
  item: ClaimableReward;
}

const ClaimableItem = ({ item }: Props) => {
  const { colors, spacing, radius } = useTheme();
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
        marginBottom: spacing[4] 
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
              borderRadius: radius.full
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
                borderRadius: radius.full 
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

const styles = StyleSheet.create({
  claimCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  claimButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
  },
  progressBarBase: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
});

export default ClaimableItem;
