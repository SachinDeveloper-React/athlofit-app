import React from 'react';
import { TouchableOpacity } from 'react-native';
import { AppText, AppView } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { Timeframe } from '../types/analytics';
import { makeStyles } from '../../../hooks/makeStyles';

interface Props {
  activeTab: Timeframe;
  onTabChange: (tab: Timeframe) => void;
}

const TABS: Timeframe[] = ['Day', 'Week', 'Month', 'Year'];

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  container: {
    flexDirection: 'row' as const,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[1],
    marginVertical: spacing[4],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center' as const,
    borderRadius: radius.md,
  },
}));

export const TimeframeTabs: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <AppView style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && { backgroundColor: colors.primary }]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
          >
            <AppText
              variant="subhead"
              color={isActive ? colors.background : colors.mutedForeground}
              weight={isActive ? 'semiBold' : 'medium'}
            >
              {tab}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </AppView>
  );
};
