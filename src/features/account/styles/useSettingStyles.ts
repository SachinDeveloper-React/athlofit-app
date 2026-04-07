import {  StyleSheet } from 'react-native';
import { withOpacity } from '../../../utils/withOpacity';
import { Theme } from '../../../hooks/useTheme';


export const ICON_WRAP = 44;
export const ROW_H = 58;
export const RADIUS = 18;

export const useSettingStyles = (colors: Theme['colors']) => {
  const divider = withOpacity(colors.foreground, 0.06);

  return StyleSheet.create({
    page: {
      paddingTop: 8,
      paddingBottom: 22,
      gap: 18,
    },

    section: {
      gap: 10,
    },

    sectionTitle: {
      letterSpacing: 1.2,
      fontWeight: '800',
      color: withOpacity(colors.foreground, 0.35),
    },

    row: {
      height: ROW_H,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
    },

    rowPressed: {
      backgroundColor: withOpacity(colors.ring, 0.06),
    },

    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: divider,
    },

    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    iconWrap: {
      width: ICON_WRAP,
      height: ICON_WRAP,
      borderRadius: ICON_WRAP / 2,
      backgroundColor: withOpacity(colors.foreground, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.foreground, 0.06),
    },

    main_title: {
      gap: 8,
    },
    title: {
      fontSize: 13,
      letterSpacing: 1.4,
      fontWeight: '800',
      color: withOpacity(colors.foreground, 0.8),
    },

    right: {
      // flex: 1,
      flexShrink: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
      marginLeft: 10,
    },

    navRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    valueText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.0,
      color: withOpacity(colors.foreground, 0.35),
    },
  });
};
