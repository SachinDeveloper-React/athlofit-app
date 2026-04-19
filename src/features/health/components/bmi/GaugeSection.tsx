import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

type Props = {
  bmi: number;
  category: BmiCategory;
};

const GaugeSection = memo(({ bmi, category }: Props) => {
  const { colors } = useTheme();
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

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', gap: 12 },
  barWrap: { width: '100%', height: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', position: 'relative' },
  zone: { height: '100%' },
  needle: { position: 'absolute', top: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 3, marginLeft: -10 },
  numWrap: { alignItems: 'center', marginTop: 4 },
  num: { fontSize: 64, fontWeight: '800', lineHeight: 68 },
  badge: { paddingHorizontal: 20, paddingVertical: 7, borderRadius: 20 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: -4 },
});
