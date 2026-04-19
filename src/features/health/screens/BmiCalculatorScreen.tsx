import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';

import { AppText, AppView, Button, Header, Screen } from '../../../components';
import { Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useBmiHistory, useSaveBmi } from '../hooks/useBmi';
import { useHealthMetrics } from '../hooks/useHealthMetrics';
import { useAuthStore } from '../../auth/store/authStore';
import GaugeSection from '../components/bmi/GaugeSection';
import BmiHistoryChart from '../components/bmi/BmiHistoryChart';
import BmiHistoryList from '../components/bmi/BmiHistoryList';
import { calcBmi, getCategory, idealWeightRange, CATEGORY_META } from '../components/bmi/bmiHelpers';

const BmiCalculatorScreen = memo(() => {
  const { colors } = useTheme();

  const { weight: sdkWeight, height: sdkHeight, isLoading: sdkLoading, permissionDenied, error: sdkError, refresh: refreshSdk } = useHealthMetrics();

  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(1.70);

  useEffect(() => {
    if (sdkWeight) setWeight(parseFloat(sdkWeight.toFixed(1)));
    if (sdkHeight) setHeight(parseFloat(sdkHeight.toFixed(2)));
  }, [sdkWeight, sdkHeight]);

  const bmi      = useMemo(() => calcBmi(weight, height), [weight, height]);
  const category = useMemo(() => getCategory(bmi), [bmi]);
  const ideal    = useMemo(() => idealWeightRange(height), [height]);

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

  const historyBmiValues = useMemo(() => [...history].reverse().map(r => r.bmi), [history]);

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="BMI Calculator" showBack backLabel="" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── Health SDK panel ── */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.sdkCard, { backgroundColor: colors.card, borderColor: colors.border }]}
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
                {sdkLoading
                  ? <ActivityIndicator size={16} color={colors.primary} />
                  : <Icon name="RefreshCw" size={16} color={colors.primary} />}
              </TouchableOpacity>
            </AppView>
          </Animated.View>

          {/* ── Manual sliders ── */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(400)}
            style={[styles.sliderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <AppText variant="headline" style={{ marginBottom: 16 }}>Adjust Measurements</AppText>

            <AppView style={styles.sliderRow}>
              <View style={styles.sliderLabelWrap}>
                <AppText variant="subhead" weight="semiBold">📏 Height</AppText>
                <AppText variant="title3" weight="bold" color={colors.primary}>{(height * 100).toFixed(0)} cm</AppText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1.0} maximumValue={2.5} step={0.01} value={height}
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

            <AppView style={styles.sliderRow}>
              <View style={styles.sliderLabelWrap}>
                <AppText variant="subhead" weight="semiBold">⚖️ Weight</AppText>
                <AppText variant="title3" weight="bold" color={colors.primary}>{weight.toFixed(1)} kg</AppText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={20} maximumValue={200} step={0.5} value={weight}
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

          {bmi > 0 && <GaugeSection bmi={bmi} category={category} />}

          {/* ── Ideal weight ── */}
          {bmi > 0 && (
            <Animated.View
              entering={FadeInUp.delay(150).duration(400)}
              style={[styles.idealCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <AppView style={styles.idealRow}>
                <AppView style={{ flex: 1 }}>
                  <AppText variant="subhead" style={{ opacity: 0.6 }}>Ideal weight range</AppText>
                  <AppText variant="title3" weight="bold" style={{ marginTop: 4 }}>{ideal.min} – {ideal.max} kg</AppText>
                  <AppText variant="caption2" style={{ marginTop: 3, opacity: 0.5 }}>Based on BMI 18.5 – 24.9 for your height</AppText>
                </AppView>
                <AppView style={[styles.idealIcon, { backgroundColor: withOpacity(CATEGORY_META[category].color, 0.12) }]}>
                  <Icon name="Target" size={22} color={CATEGORY_META[category].color} />
                </AppView>
              </AppView>
            </Animated.View>
          )}

          {bmi > 0 && (
            <Animated.View entering={FadeInUp.delay(200).duration(400)}>
              <Button
                label={isSaving ? 'Saving…' : saved ? '✓ BMI Saved!' : 'Save BMI'}
                onPress={handleSave}
                disabled={isSaving}
                style={saved ? { backgroundColor: '#22C55E' } : undefined}
              />
            </Animated.View>
          )}

          <BmiHistoryChart data={historyBmiValues} />
          <BmiHistoryList history={history as any} />

          <View style={{ height: 40 }} />
        </ScrollView>
      </AppView>
    </Screen>
  );
});

BmiCalculatorScreen.displayName = 'BmiCalculatorScreen';
export default BmiCalculatorScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  sdkCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  sdkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sliderCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  sliderRow: { gap: 6 },
  sliderLabelWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  slider: { width: '100%', height: 36 },
  sliderRange: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  idealCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  idealRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  idealIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
