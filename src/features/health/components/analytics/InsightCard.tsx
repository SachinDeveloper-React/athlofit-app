import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Activity,
  Heart,
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  Wind,
  Zap,
} from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { HealthAnalyticsResponse } from '../../types/analytics';

type Props = { data: HealthAnalyticsResponse };

const InsightCard = memo(({ data }: Props) => {
  const { colors } = useTheme();
  const { metrics, rings } = data;

  const insights = useMemo(() => {
    const list: { text: string; color: string; icon: any }[] = [];

    if (metrics.steps.trend > 10)
      list.push({ text: `Steps up ${metrics.steps.trend}% vs last period — great momentum!`, color: '#10B981', icon: TrendingUp });
    else if (metrics.steps.trend < -10)
      list.push({ text: `Steps down ${Math.abs(metrics.steps.trend)}% — try to move more today.`, color: '#EF4444', icon: TrendingDown });

    if (rings.stepsGoalPercent >= 1)
      list.push({ text: "Step goal achieved! You're crushing it.", color: '#0099FF', icon: Target });

    if (metrics.heartRate.value > 0 && metrics.heartRate.value > 100)
      list.push({ text: 'Elevated avg heart rate — consider rest or light activity.', color: '#F97316', icon: Wind });
    else if (metrics.heartRate.value > 0 && metrics.heartRate.value < 60)
      list.push({ text: 'Low resting heart rate — excellent cardiovascular fitness!', color: '#10B981', icon: Heart });

    if (rings.caloriesGoalPercent >= 0.9)
      list.push({ text: 'Calorie burn on track — keep it up!', color: '#F97316', icon: Flame });

    if (list.length === 0)
      list.push({ text: 'Sync your health data to see personalized insights.', color: colors.mutedForeground, icon: Activity });

    return list.slice(0, 3);
  }, [metrics, rings, colors]);

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(400)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.titleRow}>
        <Zap size={16} color="#F59E0B" />
        <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
          Insights
        </AppText>
      </View>
      {insights.map((ins, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: withOpacity(ins.color, 0.15) }]}>
            <ins.icon size={12} color={ins.color} />
          </View>
          <AppText variant="subhead" style={{ flex: 1, marginLeft: 10, color: colors.foreground, lineHeight: 20 }}>
            {ins.text}
          </AppText>
        </View>
      ))}
    </Animated.View>
  );
});

InsightCard.displayName = 'InsightCard';
export default InsightCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
