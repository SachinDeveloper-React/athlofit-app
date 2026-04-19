import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Heart, Droplets, MapPin, Zap } from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { HealthAnalyticsResponse, Timeframe } from '../../types/analytics';

type Props = {
  data: HealthAnalyticsResponse;
  timeframe: Timeframe;
};

const SummaryRow = memo(({ data, timeframe }: Props) => {
  const { colors } = useTheme();
  const { metrics } = data;

  const items = [
    {
      label: 'Avg Heart Rate',
      value: metrics.heartRate.value > 0 ? `${metrics.heartRate.value} bpm` : '—',
      icon: Heart,
      color: '#EF4444',
    },
    {
      label: 'Blood Pressure',
      value: metrics.bloodPressure.value !== '—' ? metrics.bloodPressure.value : '—',
      icon: Droplets,
      color: '#8B5CF6',
    },
    {
      label: 'Total Distance',
      value: `${metrics.distance.value} km`,
      icon: MapPin,
      color: '#10B981',
    },
  ];

  return (
    <Animated.View
      entering={FadeInRight.delay(150).duration(400)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.titleRow}>
        <Zap size={16} color={colors.primary} />
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          {timeframe} Summary
        </AppText>
      </View>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={[
            styles.item,
            i < items.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: withOpacity(item.color, 0.12) }]}>
            <item.icon size={14} color={item.color} />
          </View>
          <AppText variant="subhead" style={{ flex: 1, marginLeft: 10, color: colors.mutedForeground }}>
            {item.label}
          </AppText>
          <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
            {item.value}
          </AppText>
        </View>
      ))}
    </Animated.View>
  );
});

SummaryRow.displayName = 'SummaryRow';
export default SummaryRow;

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
