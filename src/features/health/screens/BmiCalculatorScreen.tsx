// src/features/health/screens/BmiCalculatorScreen.tsx
// ─── Premium BMI Calculator ────────────────────────────────────────────────────
// Auto-reads weight & height from Health Connect (Android) / HealthKit (iOS).
// Falls back to manual sliders. Shows animated gauge, ideal weight range,
// category badge, and a trend sparkline of past readings.

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { LineChart } from 'react-native-chart-kit';
import { AppText, AppView, Button, Header, Screen } from '../../../components';
import { Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useBmiHistory, useSaveBmi } from '../hooks/useBmi';
import { useHealthMetrics } from '../hooks/useHealthMetrics';
import { useAuthStore } from '../../../features/auth/store/authStore';

// ─── BMI helpers ─────────────────────────────────────────────────────────────

const CATEGORY_META = {
  underweight: { label: 'Underweight', color: '#3B82F6', bg: '#EFF6FF', min: 0,    max: 18.4 },
  normal:      { label: 'Normal',      color: '#22C55E', bg: '#F0FDF4', min: 18.5,  max: 24.9 },
  overweight:  { label: 'Overweight',  color: '#F59E0B', bg: '#FFFBEB', min: 25.0,  max: 29.9 },
  obese:       { label: 'Obese',       color: '#EF4444', bg: '#FEF2F2', min: 30.0,  max: 40.0 },
} as const;

type BmiCategory = keyof typeof CATEGORY_META;

function calcBmi(weightKg: number, heightM: number): number {
  if (!weightKg || !heightM) return 0;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

function getCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25.0) return 'normal';
  if (bmi < 30.0) return 'overweight';
  return 'obese';
}

/** Gender-neutral ideal weight range using BMI 18.5–24.9 */
function idealWeightRange(heightM: number) {
  return {
    min: parseFloat((18.5 * heightM * heightM).toFixed(1)),
    max: parseFloat((24.9 * heightM * heightM).toFixed(1)),
  };
}

// ─── BMI Gauge ────────────────────────────────────────────────────────────────

const BMI_MIN = 10;
const BMI_MAX = 40;

const GaugeSection = memo(
  ({ bmi, category }: { bmi: number; category: BmiCategory }) => {
    const { colors } = useTheme();
    const meta = CATEGORY_META[category];
    const pct  = Math.min(1, Math.max(0, (bmi - BMI_MIN) / (BMI_MAX - BMI_MIN)));

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
        style={[styles.gaugeCard, { backgroundColor: meta.bg, borderColor: withOpacity(meta.color, 0.25) }]}
      >
        {/* Gauge bar */}
        <AppView style={styles.gaugeBarWrap}>
          {/* Colour zones */}
          <View style={[styles.gaugeZone, { flex: 18, backgroundColor: CATEGORY_META.underweight.color, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
          <View style={[styles.gaugeZone, { flex: 6, backgroundColor: CATEGORY_META.normal.color }]} />
          <View style={[styles.gaugeZone, { flex: 5, backgroundColor: CATEGORY_META.overweight.color }]} />
          <View style={[styles.gaugeZone, { flex: 11, backgroundColor: CATEGORY_META.obese.color, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />

          {/* Thumb needle */}
          <View
            style={[
              styles.gaugeNeedle,
              {
                left: `${Math.round(pct * 100)}%` as any,
                borderColor: meta.color,
                backgroundColor: colors.background,
              },
            ]}
          />
        </AppView>

        {/* BMI number */}
        <Animated.View style={[styles.bmiNumWrap, animStyle]}>
          <AppText style={[styles.bmiNum, { color: meta.color }]}>
            {bmi.toFixed(1)}
          </AppText>
          <AppText variant="caption1" color={meta.color} style={{ opacity: 0.7 }}>
            BMI
          </AppText>
        </Animated.View>

        {/* Category badge */}
        <View style={[styles.catBadge, { backgroundColor: withOpacity(meta.color, 0.15) }]}>
          <AppText variant="subhead" weight="semiBold" color={meta.color}>
            {meta.label}
          </AppText>
        </View>

        {/* Range labels */}
        <AppView style={styles.gaugeLabels}>
          <AppText variant="caption2" style={{ color: CATEGORY_META.underweight.color }}>Underweight</AppText>
          <AppText variant="caption2" style={{ color: CATEGORY_META.normal.color }}>Normal</AppText>
          <AppText variant="caption2" style={{ color: CATEGORY_META.overweight.color }}>Over</AppText>
          <AppText variant="caption2" style={{ color: CATEGORY_META.obese.color }}>Obese</AppText>
        </AppView>
      </Animated.View>
    );
  },
);
GaugeSection.displayName = 'GaugeSection';

// ─── History Mini-chart ───────────────────────────────────────────────────────

const HistoryChart = memo(({ data }: { data: number[] }) => {
  const { colors } = useTheme();
  if (data.length < 2) return null;

  const chartData = {
    labels: data.map((_, i) => `${i + 1}`),
    datasets: [{ data, strokeWidth: 2 }],
  };

  return (
    <Animated.View entering={FadeInUp.delay(250).duration(400)}>
      <AppText variant="headline" style={styles.sectionTitle}>
        BMI History
      </AppText>
      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LineChart
          data={chartData}
          width={320}
          height={140}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: colors.card,
            backgroundGradientTo: colors.card,
            decimalPlaces: 1,
            color: (opacity = 1) => withOpacity('#22C55E', opacity),
            labelColor: () => colors.mutedForeground,
            propsForDots: { r: '4', strokeWidth: '2', stroke: '#22C55E' },
          }}
          bezier
          withShadow={false}
          style={{ borderRadius: 12 }}
        />
      </View>
    </Animated.View>
  );
});
HistoryChart.displayName = 'HistoryChart';

// ─── Main Screen ──────────────────────────────────────────────────────────────

const BmiCalculatorScreen = memo(() => {
  const { colors } = useTheme();

  // Health SDK data
  const {
    weight: sdkWeight,
    height: sdkHeight,
    source,
    isLoading: sdkLoading,
    permissionDenied,
    error: sdkError,
    refresh: refreshSdk,
  } = useHealthMetrics();

  // Manual slider values (init from SDK when available)
  const [weight, setWeight] = useState(70);     // kg
  const [height, setHeight] = useState(1.70);   // m

  // When SDK data arrives, seed the sliders
  useEffect(() => {
    if (sdkWeight) setWeight(parseFloat(sdkWeight.toFixed(1)));
    if (sdkHeight) setHeight(parseFloat(sdkHeight.toFixed(2)));
  }, [sdkWeight, sdkHeight]);

  const bmi      = useMemo(() => calcBmi(weight, height), [weight, height]);
  const category = useMemo(() => getCategory(bmi), [bmi]);
  const ideal    = useMemo(() => idealWeightRange(height), [height]);

  // Data hooks
  const { data: history = [] } = useBmiHistory(10);
  const { mutate: saveBmi, isPending: isSaving } = useSaveBmi();
  const [saved, setSaved] = useState(false);
  const updateUser = useAuthStore(state => state.updateUser);

  const handleSave = useCallback(() => {
    saveBmi(
      { weight, height },
      {
        onSuccess: () => {
          setSaved(true);
          updateUser({ weight: parseFloat(weight.toFixed(1)), height: parseFloat((height * 100).toFixed(0)) });
          setTimeout(() => setSaved(false), 3000);
        },
      },
    );
  }, [saveBmi, weight, height, updateUser]);

  const historyBmiValues = useMemo(
    () => [...history].reverse().map(r => r.bmi),
    [history],
  );

  const sdkBadge = source === 'health_connect'
    ? '🏥 Health Connect'
    : source === 'healthkit'
    ? '🍎 Apple Health'
    : null;

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="BMI Calculator" showBack backLabel="" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── Health SDK auto-fill panel ── */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[
              styles.sdkCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppView style={styles.sdkRow}>
              <AppView style={{ flex: 1 }}>
                <AppText variant="headline">
                  {Platform.OS === 'ios' ? '🍎 Apple Health' : '🏥 Health Connect'}
                </AppText>
                <AppText variant="caption1" style={{ marginTop: 2, opacity: 0.6 }}>
                  {sdkLoading
                    ? 'Reading health data…'
                    : permissionDenied
                    ? 'Permission denied — use sliders below'
                    : sdkError
                    ? sdkError
                    : sdkWeight && sdkHeight
                    ? `${sdkWeight?.toFixed(1)} kg · ${(sdkHeight! * 100).toFixed(0)} cm auto-filled`
                    : 'No data found — use sliders below'}
                </AppText>
              </AppView>
              <TouchableOpacity
                onPress={refreshSdk}
                style={[styles.refreshBtn, { backgroundColor: withOpacity(colors.primary, 0.1) }]}
                activeOpacity={0.7}
              >
                {sdkLoading ? (
                  <ActivityIndicator size={16} color={colors.primary} />
                ) : (
                  <Icon name="RefreshCw" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            </AppView>
          </Animated.View>

          {/* ── Manual sliders ── */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(400)}
            style={[
              styles.sliderCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppText variant="headline" style={{ marginBottom: 16 }}>
              Adjust Measurements
            </AppText>

            {/* Height */}
            <AppView style={styles.sliderRow}>
              <View style={styles.sliderLabelWrap}>
                <AppText variant="subhead" weight="semiBold">📏 Height</AppText>
                <AppText variant="title3" weight="bold" color={colors.primary}>
                  {(height * 100).toFixed(0)} cm
                </AppText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1.0}
                maximumValue={2.5}
                step={0.01}
                value={height}
                onValueChange={setHeight}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={withOpacity(colors.border, 0.5)}
                thumbTintColor={colors.primary}
              />
              <AppView style={styles.sliderRange}>
                <AppText variant="caption2">100 cm</AppText>
                <AppText variant="caption2">250 cm</AppText>
              </AppView>
            </AppView>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Weight */}
            <AppView style={styles.sliderRow}>
              <View style={styles.sliderLabelWrap}>
                <AppText variant="subhead" weight="semiBold">⚖️ Weight</AppText>
                <AppText variant="title3" weight="bold" color={colors.primary}>
                  {weight.toFixed(1)} kg
                </AppText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={20}
                maximumValue={200}
                step={0.5}
                value={weight}
                onValueChange={setWeight}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={withOpacity(colors.border, 0.5)}
                thumbTintColor={colors.primary}
              />
              <AppView style={styles.sliderRange}>
                <AppText variant="caption2">20 kg</AppText>
                <AppText variant="caption2">200 kg</AppText>
              </AppView>
            </AppView>
          </Animated.View>

          {/* ── BMI Gauge ── */}
          {bmi > 0 && <GaugeSection bmi={bmi} category={category} />}

          {/* ── Ideal weight card ── */}
          {bmi > 0 && (
            <Animated.View
              entering={FadeInUp.delay(150).duration(400)}
              style={[
                styles.idealCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <AppView style={styles.idealRow}>
                <AppView style={{ flex: 1 }}>
                  <AppText variant="subhead" style={{ opacity: 0.6 }}>Ideal weight range</AppText>
                  <AppText variant="title3" weight="bold" style={{ marginTop: 4 }}>
                    {ideal.min} – {ideal.max} kg
                  </AppText>
                  <AppText variant="caption2" style={{ marginTop: 3, opacity: 0.5 }}>
                    Based on BMI 18.5 – 24.9 for your height
                  </AppText>
                </AppView>
                <AppView
                  style={[
                    styles.idealIcon,
                    {
                      backgroundColor: withOpacity(
                        CATEGORY_META[category].color,
                        0.12,
                      ),
                    },
                  ]}
                >
                  <Icon
                    name="Target"
                    size={22}
                    color={CATEGORY_META[category].color}
                  />
                </AppView>
              </AppView>
            </Animated.View>
          )}

          {/* ── Save button ── */}
          {bmi > 0 && (
            <Animated.View entering={FadeInUp.delay(200).duration(400)}>
              <Button
                label={
                  isSaving
                    ? 'Saving…'
                    : saved
                    ? '✓ BMI Saved!'
                    : 'Save BMI'
                }
                onPress={handleSave}
                disabled={isSaving}
                style={[
                  styles.saveBtn,
                  saved && { backgroundColor: '#22C55E' },
                ]}
              />
            </Animated.View>
          )}

          {/* ── Trend chart ── */}
          <HistoryChart data={historyBmiValues} />

          {/* ── Past records ── */}
          {history.length > 0 && (
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <AppText variant="headline" style={styles.sectionTitle}>
                Past Readings
              </AppText>
              {history.slice(0, 5).map(record => {
                const m = CATEGORY_META[record.category as BmiCategory];
                return (
                  <View
                    key={record._id}
                    style={[
                      styles.historyRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <AppView
                      style={[
                        styles.historyDot,
                        { backgroundColor: m.color },
                      ]}
                    />
                    <AppView style={{ flex: 1 }}>
                      <AppText variant="subhead" weight="semiBold">
                        BMI {record.bmi}
                      </AppText>
                      <AppText variant="caption2" style={{ opacity: 0.55, marginTop: 1 }}>
                        {record.weight} kg · {(record.height * 100).toFixed(0)} cm
                      </AppText>
                    </AppView>
                    <View
                      style={[
                        styles.historyBadge,
                        { backgroundColor: withOpacity(m.color, 0.12) },
                      ]}
                    >
                      <AppText variant="caption2" weight="semiBold" color={m.color}>
                        {m.label}
                      </AppText>
                    </View>
                    <AppText variant="caption2" style={{ marginLeft: 8, opacity: 0.4 }}>
                      {record.date}
                    </AppText>
                  </View>
                );
              })}
            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </AppView>
    </Screen>
  );
});

BmiCalculatorScreen.displayName = 'BmiCalculatorScreen';
export default BmiCalculatorScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },

  // SDK card
  sdkCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  sdkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sliders
  sliderCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  sliderRow: { gap: 6 },
  sliderLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  slider: { width: '100%', height: 36 },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },

  // Gauge
  gaugeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  gaugeBarWrap: {
    width: '100%',
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  gaugeZone: { height: '100%' },
  gaugeNeedle: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    marginLeft: -10,
  },
  bmiNumWrap: { alignItems: 'center', marginTop: 4 },
  bmiNum: { fontSize: 64, fontWeight: '800', lineHeight: 68 },
  catBadge: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: -4,
  },

  // Ideal weight
  idealCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  idealRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  idealIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Save
  saveBtn: { marginTop: 0 },

  // Chart
  sectionTitle: { marginBottom: 10 },
  chartCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 12,
  },

  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
});
