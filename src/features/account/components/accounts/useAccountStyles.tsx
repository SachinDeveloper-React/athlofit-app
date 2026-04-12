import { StyleSheet } from 'react-native';
import { withOpacity } from '../../../../utils/withOpacity';
import { ThemeColors } from '../../../../constants/colors';
import { SCREEN_WIDTH } from '../../../../utils/measure';

export const useAccountStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    listContent: {
      paddingTop: 14,
      // paddingBottom: verticalScale(20),
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
      gap: 10,
      alignItems: 'center',
    },

    iconPill: {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.foreground, 0.04),
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    dot: {
      position: 'absolute',
      top: 10,
      right: 11,
      width: 6,
      height: 6,
      borderRadius: 99,
      backgroundColor: colors.destructive,
    },

    avatarWrap: {
      width: 76,
      height: 76,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: withOpacity(colors.foreground, 0.06),
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarPlaceholder: {
      flex: 1,
      backgroundColor: withOpacity(colors.foreground, 0.08),
    },

    nameBlock: { marginTop: 12, gap: 6 },

    name: {
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 0.3,
      color: colors.foreground,
    },

    premium: {
      fontSize: 8,
      fontWeight: '600',
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color: colors.primary,
    },

    statsRow: {
      marginTop: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },

    statPill: {
      width: SCREEN_WIDTH / 2 - (32 + 10),
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: withOpacity(colors.foreground, 0.03),
      gap: 8,
    },

    statTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    statLabel: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: withOpacity(colors.foreground, 0.45),
    },

    statValue: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.2,
      color: colors.foreground,
    },

    tierCard: {
      marginTop: 18,
      borderRadius: 22,
      padding: 18,
      backgroundColor: '#0B1220', // matches dark tier panel
      overflow: 'hidden',
    },

    tierWatermark: {
      position: 'absolute',
      right: -16,
      bottom: -18,
      opacity: 1,
    },

    tierTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },

    tierLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    tierLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: '#FFFFFF',
    },

    tierXp: {
      fontSize: 12,
      color: withOpacity('#FFFFFF', 0.55),
    },

    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: withOpacity('#FFFFFF', 0.12),
      overflow: 'hidden',
    },

    progressFill: {
      height: 8,
      borderRadius: 999,
      backgroundColor: '#FFB000', // warm fill like design
    },

    tierHint: {
      marginTop: 12,
      fontSize: 8,
      letterSpacing: 0.8,
      color: withOpacity('#FFFFFF', 0.55),
      textTransform: 'uppercase',
      lineHeight: 16,
    },

    sectionTitle: {
      marginTop: 22,
      marginBottom: 10,
      paddingHorizontal: 4,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: withOpacity(colors.foreground, 0.35),
    },

    // this is just a "background" card to match the large rounded container
    listCard: {
      position: 'absolute',
      left: 16,
      right: 16,
      top: 14 + 76 + 18 + 22 + 10 + 18 + 140, // ignored visually; rows sit below anyway
    },

    rowPress: {
      backgroundColor: colors.card,
      borderRadius: 0,
    },

    row: {
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 0,
    },

    rowIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    rowTitle: {
      flex: 1,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      color: colors.foreground,
    },

    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    badge: {
      minWidth: 26,
      height: 26,
      paddingHorizontal: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withOpacity(colors.foreground, 0.06),
    },

    badgeText: {
      fontSize: 11,
      fontWeight: '900',
      color: withOpacity(colors.foreground, 0.55),
    },

    sep: {
      height: 1,
      marginLeft: 16 + 44 + 14, // align to start after icon
      backgroundColor: withOpacity(colors.foreground, 0.06),
    },
  });
};
