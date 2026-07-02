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

// ─── Macro Ring Component ─────────────────────────────────────────────────────

const MacroCircle = memo(
  ({ label, value, unit, color, pct }: {
    label: string; value: number; unit: string; color: string; pct: number;
  }) => (
    <View style={macroStyles.item}>
      <View style={[macroStyles.ring, { borderColor: withOpacity(color, 0.15) }]}>
        <View style={[macroStyles.ringProgress, { borderColor: color, borderTopColor: 'transparent', transform: [{ rotate: `${Math.min(360, pct * 3.6)}deg` }] }]} />
        <AppText variant="subhead" weight="bold" style={{ color }}>
          {Math.round(value)}
        </AppText>
      </View>
      <AppText variant="caption2" weight="semiBold" style={{ marginTop: 6 }}>{label}</AppText>
      <AppText variant="caption2" color={withOpacity(color, 0.7)}>{Math.round(pct)}%</AppText>
    </View>
  ),
);
MacroCircle.displayName = 'MacroCircle';

const macroStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center' },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringProgress: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

// ─── Nutrient Bar Row ─────────────────────────────────────────────────────────

const NutrientBar = memo(
  ({ label, value, unit, color, pct }: {
    label: string; value: number | undefined | null; unit: string; color: string; pct: number;
  }) => {
    if (value == null || value <= 0) return null;
    return (
      <View style={nutrientStyles.row}>
        <View style={[nutrientStyles.dot, { backgroundColor: color }]} />
        <AppText variant="subhead" style={{ flex: 1 }}>{label}</AppText>
        <AppText variant="subhead" weight="semiBold" style={{ marginRight: 12 }}>
          {Math.round(value)}{unit}
        </AppText>
        <View style={nutrientStyles.barWrap}>
          <View style={[nutrientStyles.barTrack, { backgroundColor: withOpacity(color, 0.12) }]}>
            <View style={[nutrientStyles.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
          </View>
        </View>
      </View>
    );
  },
);
NutrientBar.displayName = 'NutrientBar';

const nutrientStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  barWrap: { width: 60 },
  barTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const FoodDetailScreen = memo(() => {
  const { colors, isDark, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<DetailRoute>();
  const { foodId } = route.params;

  const { data: food, isLoading } = useFoodDetail(foodId);
  const { mutate: toggleFav, isPending: togglingFav } = useToggleFavourite();
  const { mutate: logMeal, isPending: isLogging } = useLogMeal();

  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  const [loggedSuccess, setLoggedSuccess] = useState(false);
  const [localFav, setLocalFav] = useState<boolean | null>(null);

  const heartScale = useSharedValue(1);
  const heartAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const handleFav = useCallback(() => {
    if (!food || togglingFav) return;
    heartScale.value = withSpring(1.4, { damping: 4 }, () => {
      heartScale.value = withSpring(1);
    });
    setLocalFav(prev => !(prev !== null ? prev : food.isFavourite));
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
      { onSuccess: () => { setLoggedSuccess(true); setTimeout(() => setLoggedSuccess(false), 2500); } },
    );
  }, [food, logMeal, selectedMeal]);

  if (isLoading || !food) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dietMeta = DIET_TYPE_META[food.dietType];
  const totalKcal = food.protein * 4 + food.carbs * 4 + food.fat * 9;
  const pPct = totalKcal > 0 ? (food.protein * 4 / totalKcal) * 100 : 0;
  const cPct = totalKcal > 0 ? (food.carbs * 4 / totalKcal) * 100 : 0;
  const fPct = totalKcal > 0 ? (food.fat * 9 / totalKcal) * 100 : 0;
  const isFav = localFav !== null ? localFav : food.isFavourite;
  const categories = Array.isArray(food.category) ? food.category : [food.category];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <View style={[styles.hero, { backgroundColor: dietMeta.color }]}>
        {food.imageUrl ? (
          <Image source={{ uri: food.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Animated.Text entering={FadeIn.duration(400)} style={styles.heroEmoji}>
            {dietMeta.emoji}
          </Animated.Text>
        )}
        <View style={styles.heroGradient} />

        {/* Nav buttons */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.navBtn, { top: insets.top + 10, left: 16 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="ChevronLeft" size={22} color="#fff" />
        </TouchableOpacity>

        <Animated.View style={[styles.navBtn, { top: insets.top + 10, right: 16 }, heartAnimStyle]}>
          <TouchableOpacity onPress={handleFav} disabled={togglingFav}>
            {togglingFav ? (
              <ActivityIndicator size={18} color="#fff" />
            ) : (
              <Icon name="Heart" size={20} color={isFav ? '#FF4D6D' : 'rgba(255,255,255,0.8)'} filled={isFav} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Hero info */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroContent}>
          <View style={[styles.dietPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <AppText variant="caption2" weight="bold" color="#fff">
              {dietMeta.emoji} {dietMeta.label}
            </AppText>
          </View>
          <AppText variant="title1" weight="bold" style={styles.heroTitle} numberOfLines={2}>
            {food.name}
          </AppText>
          <AppText variant="caption1" style={styles.heroSub}>
            Per {food.servingSize} {food.servingUnit} serving
          </AppText>
        </Animated.View>
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Description card */}
        {!!food.description && (
          <Animated.View entering={FadeInUp.delay(60).duration(350)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <Icon name="FileText" size={15} color={colors.primary} />
              <AppText variant="caption1" weight="bold" color={colors.primary} style={{ marginLeft: 6 }}>
                About
              </AppText>
            </View>
            <AppText variant="subhead" style={{ color: colors.foreground, lineHeight: 22, marginTop: 8 }}>
              {food.description}
            </AppText>
          </Animated.View>
        )}

        {/* Suitable for meals */}
        {categories.length > 0 && (
          <Animated.View entering={FadeInUp.delay(100).duration(350)} style={styles.badgeRow}>
            {categories.map((cat: string) => {
              const meta = MEAL_META.find(m => m.type === cat);
              if (!meta) return null;
              return (
                <View key={cat} style={[styles.mealBadge, { backgroundColor: withOpacity(meta.color, 0.1), borderColor: withOpacity(meta.color, 0.2) }]}>
                  <AppText style={{ fontSize: 14 }}>{meta.emoji}</AppText>
                  <AppText variant="caption2" weight="bold" color={meta.color}>{meta.label}</AppText>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* Calorie highlight */}
        <Animated.View entering={FadeInUp.delay(140).duration(350)} style={[styles.calorieCard, { backgroundColor: withOpacity(dietMeta.color, isDark ? 0.1 : 0.06), borderColor: withOpacity(dietMeta.color, 0.2) }]}>
          <View style={{ alignItems: 'center' }}>
            <AppText variant="caption2" color={withOpacity(dietMeta.color, 0.7)}>Calories</AppText>
            <AppText style={[styles.calorieNumber, { color: dietMeta.color }]}>
              {food.calories}
            </AppText>
            <AppText variant="caption2" color={withOpacity(dietMeta.color, 0.6)}>kcal / serving</AppText>
          </View>
          <View style={[styles.calDivider, { backgroundColor: withOpacity(dietMeta.color, 0.15) }]} />
          <View style={styles.macroRow}>
            <MacroCircle label="Protein" value={food.protein} unit="g" color="#1A6B4A" pct={pPct} />
            <MacroCircle label="Carbs" value={food.carbs} unit="g" color="#2C5FA3" pct={cPct} />
            <MacroCircle label="Fat" value={food.fat} unit="g" color="#B04C78" pct={fPct} />
          </View>
        </Animated.View>

        {/* Full Nutrition breakdown */}
        <Animated.View entering={FadeInUp.delay(200).duration(350)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Icon name="BarChart2" size={15} color={colors.primary} />
            <AppText variant="caption1" weight="bold" color={colors.primary} style={{ marginLeft: 6 }}>
              Nutrition Breakdown
            </AppText>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <NutrientBar label="Protein" value={food.protein} unit="g" color="#1A6B4A" pct={pPct} />
          <NutrientBar label="Carbohydrates" value={food.carbs} unit="g" color="#2C5FA3" pct={cPct} />
          <NutrientBar label="Fat" value={food.fat} unit="g" color="#B04C78" pct={fPct} />
          <NutrientBar label="Fiber" value={food.fiber} unit="g" color="#7B3FA8" pct={food.fiber ? (food.fiber / 30) * 100 : 0} />
          <NutrientBar label="Sugar" value={food.sugar} unit="g" color="#C0652B" pct={food.sugar ? (food.sugar / 50) * 100 : 0} />
        </Animated.View>

        {/* Quick Info pills */}
        <Animated.View entering={FadeInUp.delay(240).duration(350)} style={styles.infoRow}>
          <View style={[styles.infoPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="Scale" size={14} color={colors.mutedForeground} />
            <AppText variant="caption2" weight="medium" style={{ marginLeft: 5 }}>
              {food.servingSize} {food.servingUnit}
            </AppText>
          </View>
          <View style={[styles.infoPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="Flame" size={14} color="#E07B39" />
            <AppText variant="caption2" weight="medium" style={{ marginLeft: 5 }}>
              {food.calories} kcal
            </AppText>
          </View>
          <View style={[styles.infoPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.dietDot, { backgroundColor: dietMeta.color }]} />
            <AppText variant="caption2" weight="medium" style={{ marginLeft: 5 }}>
              {dietMeta.label}
            </AppText>
          </View>
        </Animated.View>

        {/* Add to Log */}
        <Animated.View entering={FadeInUp.delay(280).duration(350)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardRow}>
            <Icon name="PlusCircle" size={15} color={colors.primary} />
            <AppText variant="caption1" weight="bold" color={colors.primary} style={{ marginLeft: 6 }}>
              Add to Meal Log
            </AppText>
          </View>
          <AppText variant="caption2" color={colors.mutedForeground} style={{ marginTop: 4, marginBottom: 12 }}>
            Select a meal to log this food for today.
          </AppText>
          <MealPicker selected={selectedMeal} onSelect={setSelectedMeal} />
          <Button
            label={
              isLogging ? 'Logging…'
                : loggedSuccess ? '✓ Added!'
                : `Add to ${MEAL_META.find(m => m.type === selectedMeal)?.label}`
            }
            onPress={handleLog}
            disabled={isLogging}
            style={[styles.logBtn, loggedSuccess && { backgroundColor: '#1A6B4A' }]}
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
  root: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroEmoji: { fontSize: 72, lineHeight: 88 },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  navBtn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    gap: 6,
  },
  dietPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroTitle: {
    color: '#fff',
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSub: { color: 'rgba(255,255,255,0.7)' },

  // Content
  content: { padding: 16, gap: 14 },

  // Cards
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 10, marginHorizontal: -16 },

  // Calorie card
  calorieCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 16,
  },
  calorieNumber: {
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 48,
  },
  calDivider: {
    width: '80%',
    height: 1,
  },
  macroRow: {
    flexDirection: 'row',
    width: '100%',
  },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },

  // Info pills
  infoRow: { flexDirection: 'row', gap: 8 },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dietDot: { width: 8, height: 8, borderRadius: 4 },

  // Log button
  logBtn: { marginTop: 12 },
});
