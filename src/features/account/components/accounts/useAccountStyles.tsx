import { StyleSheet } from 'react-native';
import { withOpacity } from '../../../../utils/withOpacity';
import { ThemeColors } from '../../../../constants/colors';
import { SCREEN_WIDTH } from '../../../../utils/measure';
import { Spacing } from '../../../../constants/spacing';
import { Radius } from '../../../../constants/spacing';
import { FontSize, FontWeight } from '../../../../constants/typography';

export const useAccountStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    listContent: {
      paddingTop: Spacing[3.5] ?? 14,
    },

    profileCard: {
      backgroundColor: colors.card,
    },

    profileTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },

    topRight: {
      flexDirection: 'row',
      gap: Spacing[2.5],
      alignItems: 'center',
    },

    iconPill: {
      width: 38,
      height: 38,
      borderRadius: Radius.full,
      backgroundColor: withOpacity(colors.foreground, 0.04),
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    dot: {
      position: 'absolute',
      top: Spacing[2.5],
      right: 11,
      width: 6,
      height: 6,
      borderRadius: Radius.full,
      backgroundColor: colors.destructive,
    },

    avatarWrap: {
      width: 76,
      height: 76,
      borderRadius: Radius['3xl'],
      overflow: 'hidden',
      backgroundColor: withOpacity(colors.foreground, 0.06),
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarPlaceholder: {
      flex: 1,
      backgroundColor: withOpacity(colors.foreground, 0.08),
    },

    nameBlock: { marginTop: Spacing[3], gap: Spacing[1.5] },

    name: {
      fontSize: FontSize['5xl'],
      fontWeight: FontWeight.bold,
      letterSpacing: 0.3,
      color: colors.foreground,
    },

    premium: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semiBold,
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color: colors.primary,
    },

    statsRow: {
      marginTop: Spacing[4],
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing[3],
      justifyContent: 'space-between',
    },

    statPill: {
      width: SCREEN_WIDTH / 2 - (32 + 10),
      borderRadius: Radius['2xl'],
      paddingVertical: Spacing[3],
      paddingHorizontal: Spacing[3.5] ?? 14,
      backgroundColor: withOpacity(colors.foreground, 0.03),
      gap: Spacing[2],
    },

    statTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing[2],
    },

    statLabel: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: withOpacity(colors.foreground, 0.45),
    },

    statValue: {
      fontSize: FontSize.md,
      fontWeight: FontWeight.bold,
      letterSpacing: 0.2,
      color: colors.foreground,
    },

    tierCard: {
      marginTop: Spacing[18] ?? 72,
      borderRadius: Radius['3xl'],
      padding: Spacing[18] ?? 72,
      backgroundColor: colors.tierBackground,
      overflow: 'hidden',
    },

    tierWatermark: {
      position: 'absolute',
      right: -Spacing[4],
      bottom: -Spacing[18] ?? -72,
      opacity: 1,
    },

    tierTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing[3.5] ?? 14,
    },

    tierLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing[2.5],
    },

    tierLabel: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.bold,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: colors.tierForeground,
    },

    tierXp: {
      fontSize: FontSize.sm,
      color: withOpacity(colors.tierForeground, 0.55),
    },

    progressTrack: {
      height: Spacing[2],
      borderRadius: Radius.full,
      backgroundColor: withOpacity(colors.tierForeground, 0.12),
      overflow: 'hidden',
    },

    progressFill: {
      height: Spacing[2],
      borderRadius: Radius.full,
      backgroundColor: colors.tierProgress,
    },

    tierHint: {
      marginTop: Spacing[3],
      fontSize: FontSize.xs,
      letterSpacing: 0.8,
      color: withOpacity(colors.tierForeground, 0.55),
      textTransform: 'uppercase',
      lineHeight: Spacing[4],
    },

    sectionTitle: {
      marginTop: Spacing[5.5] ?? 22,
      marginBottom: Spacing[2.5],
      paddingHorizontal: Spacing[1],
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: withOpacity(colors.foreground, 0.35),
    },

    listCard: {
      position: 'absolute',
      left: Spacing[4],
      right: Spacing[4],
      top: 14 + 76 + 18 + 22 + 10 + 18 + 140,
    },

    rowPress: {
      backgroundColor: colors.card,
      borderRadius: 0,
    },

    row: {
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing[4],
      borderRadius: 0,
    },

    rowIconWrap: {
      width: 44,
      height: 44,
      borderRadius: Radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing[3.5] ?? 14,
    },

    rowTitle: {
      flex: 1,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semiBold,
      textTransform: 'uppercase',
      color: colors.foreground,
    },

    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing[2.5],
    },

    badge: {
      minWidth: 26,
      height: 26,
      paddingHorizontal: Spacing[2],
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withOpacity(colors.foreground, 0.06),
    },

    badgeText: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.bold,
      color: withOpacity(colors.foreground, 0.55),
    },

    sep: {
      height: 1,
      marginLeft: Spacing[4] + 44 + Spacing[3.5] ?? 14,
      backgroundColor: withOpacity(colors.foreground, 0.06),
    },
  });
};
