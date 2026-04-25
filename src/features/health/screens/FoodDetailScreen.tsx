import React, { memo, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, AppView, Button } from '../../../components';
import { Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useFoodDetail, useToggleFavourite, useLogMeal } from '../hooks/useNutrition';
import { DIET_TYPE_META, MEAL_META } from '../types/nutrition.types';
import type { HealthStackParamList } from '../../../types/navigation.types';
import { HealthRoutes } from '../../../navigation/routes';
import type { MealType } from '../types/nutrition.types';
import MealPicker from '../components/nutrition/MealPicker';

type DetailRoute = RouteProp<HealthStackParamList, typeof HealthRoutes.FOOD_DETAIL>;

// ─── Macro Ring ───────────────────────────────────────────────────────────────

const MACROS = [
  { key: 'protein', label: 'Protein', unit: 'g', color: '#1A6B4A', kcalPer: 4 },
  { key: 'carbs',   label: 'Carbs',   unit: 'g', color: '#2C5FA3', kcalPer: 4 },
  { key: 'fat',     label: 'Fat',     unit: 'g', color: '#B04C78', kcalPer: 9 },
] as const;

const MacroTile = memo(
  ({ label, value, unit, color, pct }: {
    label: string; value: number; unit: string; color: string; pct: number;
  }) => (
    <View style={[macroStyles.tile, { borderColor: withOpacity(color, 0.18) }]}>
      {/* Arc bar */}
      <View style={[macroStyles.arcTrack, { backgroundColor: withOpacity(color, 0.1) }]}>
        <View style={[macroStyles.arcFill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: color }]} />
      </View>
      <AppText variant="title3" weight="bold" style={{ color }}>
        {Math.round(value)}<AppText variant="caption2" style={{ color }}>{unit}</AppText>
      </AppText>
      <AppText variant="caption2" style={{ color: withOpacity(color, 0.7), marginTop: 2 }}>
        {label}
      </AppText>
      <AppText variant="caption2" style={{ color: withOpacity(color, 0.5), marginTop: 1 }}>
        {Math.round(pct)}%
      </AppText>
    </View>
  ),
);
MacroTile.displayName = 'MacroTile';

const macroStyles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 2,
  },
  arcTrack: {
    width: '80%',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  arcFill: { height: 5, borderRadius: 3 },
});

// ─── Nutrient Row ─────────────────────────────────────────────────────────────

const NutrientRow = memo(
  ({ label, value, unit, color, pct }: {
    label: string; value: number | undefined; unit: string; color: string; pct: number;
  }) => {
    if (value === undefined || value === null) return null;
    return (
      <View style={nutrientStyles.row}>
        <View style={[nutrientStyles.dot, { backgroundColor: color }]} />
        <AppText variant="subhead" style={nutrientStyles.label}>{label}</AppText>
        <View style={nutrientStyles.barWrap}>
          <View style={[nutrientStyles.barTrack, { backgroundColor: withOpacity(color, 0.1) }]}>
            <View style={[nutrientStyles.barFill, { width: `${Math.min(100, pct)}%` as any, backgroundColor: color }]} />
          </View>
        </View>
        <AppText variant="subhead" weight="semiBold">
          {Math.round(value)}<AppText variant="caption2" style={{ opacity: 0.5 }}>{unit}</AppText>
        </AppText>
      </View>
    );
  },
);
NutrientRow.displayName = 'NutrientRow';

const nutrientStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { width: 120 },
  barWrap: { flex: 1 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const FoodDetailScreen = memo(() => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<DetailRoute>();
  const { foodId } = route.params;

  const { data: food, isLoading } = useFoodDetail(foodId);
  const { mutate: toggleFav, isPending: togglingFav, variables: togglingId } = useToggleFavourite();
  const { mutate: logMeal, isPending: isLogging } = useLogMeal();

  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  const [loggedSuccess, setLoggedSuccess] = useState(false);

  // Heart bounce animation
  const heartScale = useSharedValue(1);
  const heartAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const handleFav = useCallback(() => {
    if (!food || togglingFav) return;
    heartScale.value = withSpring(1.4, { damping: 4 }, () => {
      heartScale.value = withSpring(1);
    });
    toggleFav(food._id);
  }, [food, togglingFav, toggleFav, heartScale]);

  const handleLog = useCallback(() => {
    if (!food) return;
    logMeal(
      {
        mealType: selectedMeal,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        quantity: food.servingSize,
        unit: food.servingUnit as any,
      },
      {
        onSuccess: () => {
          setLoggedSuccess(true);
          setTimeout(() => setLoggedSuccess(false), 2500);
        },
      },
    );
  }, [food, logMeal, selectedMeal]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || !food) {
    return (
      <View style={[styles.loaderScreen, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dietMeta = DIET_TYPE_META[food.dietType];
  const totalMacroKcal = food.protein * 4 + food.carbs * 4 + food.fat * 9;
  const pPct = totalMacroKcal > 0 ? (food.protein * 4 / totalMacroKcal) * 100 : 0;
  const cPct = totalMacroKcal > 0 ? (food.carbs * 4 / totalMacroKcal) * 100 : 0;
  const fPct = totalMacroKcal > 0 ? (food.fat * 9 / totalMacroKcal) * 100 : 0;

  // Optimistic favourite state
  const isFav = togglingId === food._id ? !food.isFavourite : food.isFavourite;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero Image / Colour Banner ── */}
      <View style={[styles.hero, { backgroundColor: dietMeta.color }]}>
        {food.imageUrl ? (
          <Image source={{ uri: food.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Animated.Text entering={FadeIn.duration(400)} style={styles.heroEmoji}>
            {dietMeta.emoji}
          </Animated.Text>
        )}
        {/* Gradient overlay */}
        <View style={styles.heroOverlay} />

        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { top: insets.top + 8 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="ChevronLeft" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Heart button */}
        <Animated.View style={[styles.favBtn, { top: insets.top + 8 }, heartAnimStyle]}>
          <TouchableOpacity
            onPress={handleFav}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={togglingFav}
          >
            {togglingFav ? (
              <ActivityIndicator size={20} color="#fff" />
            ) : (
              <Icon
                name="Heart"
                size={22}
                color={isFav ? '#FF4D6D' : 'rgba(255,255,255,0.7)'}
                filled={isFav}
              />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Food name + badge on hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroInfo, { paddingBottom: insets.bottom > 0 ? 0 : 0 }]}>
          <View style={[styles.dietBadge, { backgroundColor: withOpacity('#fff', 0.2) }]}>
            <AppText variant="caption1" weight="semiBold" style={{ color: '#fff' }}>
              {dietMeta.emoji}  {dietMeta.label}
            </AppText>
          </View>
          <AppText variant="title1" weight="bold" style={styles.heroName} numberOfLines={2}>
            {food.name}
          </AppText>
          <AppText variant="subhead" style={styles.heroServing}>
            Per {food.servingSize}{food.servingUnit} serving
          </AppText>
        </Animated.View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        style={{ backgroundColor: colors.background }}
      >
        {/* ── Calorie + Macro Summary ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(400)} style={styles.section}>
          {/* Calorie pill */}
          <View style={[styles.calPill, { backgroundColor: withOpacity(dietMeta.color, 0.08), borderColor: withOpacity(dietMeta.color, 0.2) }]}>
            <AppText variant="title1" weight="bold" style={{ color: dietMeta.color }}>
              {food.calories}
            </AppText>
            <AppText variant="subhead" style={{ color: withOpacity(dietMeta.color, 0.7) }}>
              {' '}kcal
            </AppText>
            <View style={styles.calDivider} />
            <Icon name="Flame" size={16} color={dietMeta.color} />
            <AppText variant="caption1" style={{ color: withOpacity(dietMeta.color, 0.6), marginLeft: 4 }}>
              per serving
            </AppText>
          </View>

          {/* Macro tiles */}
          <View style={styles.macroRow}>
            <MacroTile label="Protein" value={food.protein} unit="g" color="#1A6B4A" pct={pPct} />
            <MacroTile label="Carbs"   value={food.carbs}   unit="g" color="#2C5FA3" pct={cPct} />
            <MacroTile label="Fat"     value={food.fat}     unit="g" color="#B04C78" pct={fPct} />
          </View>
        </Animated.View>

        {/* ── Full Nutrition ── */}
        <Animated.View entering={FadeInUp.delay(160).duration(400)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Icon name="BarChart2" size={16} color={colors.primary} />
            <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
              Full Nutrition
            </AppText>
          </View>
          <View style={styles.divider} />
          <NutrientRow label="Protein"       value={food.protein} unit="g"   color="#1A6B4A" pct={pPct} />
          <View style={[styles.divider, { opacity: 0.4 }]} />
          <NutrientRow label="Carbohydrates" value={food.carbs}   unit="g"   color="#2C5FA3" pct={cPct} />
          <View style={[styles.divider, { opacity: 0.4 }]} />
          <NutrientRow label="Fat"           value={food.fat}     unit="g"   color="#B04C78" pct={fPct} />
          {food.fiber !== undefined && (
            <>
              <View style={[styles.divider, { opacity: 0.4 }]} />
              <NutrientRow label="Fiber" value={food.fiber} unit="g" color="#7B3FA8" pct={(food.fiber / 30) * 100} />
            </>
          )}
          {food.sugar !== undefined && (
            <>
              <View style={[styles.divider, { opacity: 0.4 }]} />
              <NutrientRow label="Sugar" value={food.sugar} unit="g" color="#C0652B" pct={(food.sugar / 50) * 100} />
            </>
          )}
        </Animated.View>

        {/* ── Add to Log ── */}
        <Animated.View entering={FadeInUp.delay(240).duration(400)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Icon name="PlusCircle" size={16} color={colors.primary} />
            <AppText variant="headline" weight="semiBold" style={{ marginLeft: 8 }}>
              Add to Log
            </AppText>
          </View>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 4, marginBottom: 14 }}>
            Select a meal to log this food for today.
          </AppText>
          <MealPicker selected={selectedMeal} onSelect={setSelectedMeal} />
          <Button
            label={
              isLogging
                ? 'Logging…'
                : loggedSuccess
                ? '✓ Added to Log!'
                : `Add to ${MEAL_META.find(m => m.type === selectedMeal)?.label}`
            }
            onPress={handleLog}
            disabled={isLogging}
            style={[
              styles.logBtn,
              loggedSuccess && { backgroundColor: '#1A6B4A' },
            ]}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
});

FoodDetailScreen.displayName = 'FoodDetailScreen';
export default FoodDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1 },
  loaderScreen:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroEmoji:   { fontSize: 80, lineHeight: 96 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    gap: 6,
  },
  heroName: {
    color: '#fff',
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroServing: { color: 'rgba(255,255,255,0.7)' },
  dietBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  // Nav buttons
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  scroll:   { padding: 16, gap: 14 },
  section:  { gap: 12 },

  // Calorie pill
  calPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 40,
    borderWidth: 1,
    gap: 2,
  },
  calDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginHorizontal: 10,
  },

  // Macro row
  macroRow: { flexDirection: 'row', gap: 10 },

  // Cards
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: -16,
    marginVertical: 2,
  },

  logBtn: { marginTop: 14 },
});
