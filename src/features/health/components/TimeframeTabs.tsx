import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { Timeframe } from '../types/analytics';

interface Props {
  activeTab: Timeframe;
  onTabChange: (tab: Timeframe) => void;
}

const TABS: Timeframe[] = ['Day', 'Week', 'Month', 'Year'];

export const TimeframeTabs: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginVertical: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
});
