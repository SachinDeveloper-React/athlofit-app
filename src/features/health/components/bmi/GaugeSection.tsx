import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { CATEGORY_META, BmiCategory, BMI_MIN, BMI_MAX } from './bmiHelpers';
import { makeStyles } from '../../../../hooks/makeStyles';

type Props = {
  bmi: number;
  category: BmiCategory;
};

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  card: { borderRadius: radius['2xl'], borderWidth: 1, padding: spacing[5], alignItems: 'center' as const, gap: spacing[3] },
  barWrap: { width: '100%' as const, height: 12, flexDirection: 'row' as const, borderRadius: radius.sm, overflow: 'hidden' as const, position: 'relative' as const },
  zone: { height: '100%' as const },
  needle: { position: 'absolute' as const, top: -4, width: spacing[5], height: spacing[5], borderRadius: radius.full, borderWidth: 3, marginLeft: -spacing[2.5] },
  numWrap: { alignItems: 'center' as const, marginTop: spacing[1] },
  num: { fontSize: 64, fontWeight: fontWeight.bold, lineHeight: 68 },
  badge: { paddingHorizontal: spacing[5], paddingVertical: spacing[1.75 as any] ?? 7, borderRadius: radius['2xl'] },
  labels: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, width: '100%' as const, marginTop: -4 },
}));

const GaugeSection = memo(({ bmi, category }: Props) => {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = CATEGORY_META[category];
  const pct = Math.min(1, Math.max(0, (bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)));

  const scaleAnim = useSharedValue(0.8);
  useEffect(() => {
    scaleAnim.value = withSpring(1, { damping: 12, stiffness: 120 });
  }, [bmi]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[styles.card, { backgroundColor: meta.bg, borderColor: withOpacity(meta.color, 0.25) }]}
    >
      {/* Gauge bar */}
      <AppView style={styles.barWrap}>
        <View style={[styles.zone, { flex: 18, backgroundColor: CATEGORY_META.underweight.color, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
        <View style={[styles.zone, { flex: 6,  backgroundColor: CATEGORY_META.normal.color }]} />
        <View style={[styles.zone, { flex: 5,  backgroundColor: CATEGORY_META.overweight.color }]} />
        <View style={[styles.zone, { flex: 11, backgroundColor: CATEGORY_META.obese.color, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
        <View
          style={[
            styles.needle,
            { left: `${Math.round(pct * 100)}%` as any, borderColor: meta.color, backgroundColor: colors.background },
          ]}
        />
      </AppView>

      {/* BMI number */}
      <Animated.View style={[styles.numWrap, animStyle]}>
        <AppText style={[styles.num, { color: meta.color }]}>{bmi.toFixed(1)}</AppText>
        <AppText variant="caption1" color={meta.color} style={{ opacity: 0.7 }}>BMI</AppText>
      </Animated.View>

      {/* Category badge */}
      <View style={[styles.badge, { backgroundColor: withOpacity(meta.color, 0.15) }]}>
        <AppText variant="subhead" weight="semiBold" color={meta.color}>{meta.label}</AppText>
      </View>

      {/* Range labels */}
      <AppView style={styles.labels}>
        <AppText variant="caption2" style={{ color: CATEGORY_META.underweight.color }}>Underweight</AppText>
        <AppText variant="caption2" style={{ color: CATEGORY_META.normal.color }}>Normal</AppText>
        <AppText variant="caption2" style={{ color: CATEGORY_META.overweight.color }}>Over</AppText>
        <AppText variant="caption2" style={{ color: CATEGORY_META.obese.color }}>Obese</AppText>
      </AppView>
    </Animated.View>
  );
});

GaugeSection.displayName = 'GaugeSection';
export default GaugeSection;
