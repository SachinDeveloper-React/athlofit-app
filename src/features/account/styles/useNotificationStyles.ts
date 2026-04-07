import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../constants/colors';
import { withOpacity } from '../../../utils/withOpacity';


const ITEM_H = 92;

export const useNotificationStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
    },

    listContent: {
      paddingTop: 10,
      paddingBottom: 120,
    },

    sectionHeader: {
      paddingTop: 10,
      paddingBottom: 8,
      paddingHorizontal: 4,
    },

    sectionTitle: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
      color: withOpacity(colors.foreground, 0.35),
      textTransform: 'uppercase',
    },

    rowCard: {
      height: ITEM_H,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
    },

    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
      paddingRight: 12,
    },

    iconBubble: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },

    textCol: {
      flex: 1,
      gap: 6,
    },

    title: {
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.foreground,
    },

    message: {
      fontSize: 11.5,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: withOpacity(colors.foreground, 0.55),
      lineHeight: 16,
    },

    time: {
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: withOpacity(colors.foreground, 0.28),
      textTransform: 'uppercase',
      marginLeft: 10,
    },

    enableCard: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 16,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: withOpacity(colors.primary, 0.06),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    enableLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
      paddingRight: 12,
    },

    enableIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },

    enableText: {
      flex: 1,
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 1.0,
      color: withOpacity(colors.foreground, 0.55),
      textTransform: 'uppercase',
      lineHeight: 14,
    },

    enableCta: {
      fontSize: 12.5,
      fontWeight: '900',
      letterSpacing: 1.2,
      color: colors.primary,
      textTransform: 'uppercase',
    },
  });
