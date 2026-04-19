import React, { memo, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { AppText, AppView, Button, Header, Screen } from '../../../components';
import { Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';
import { useFoodDetail, useToggleFavourite, useLogMeal } from '../hooks/useNutrition';
import { DIET_TYPE_META, MEAL_META } from '../types/nutrition.types';
import type { HealthStackParamList } from '../../../types/navigation.types';
import { HealthRoutes } from '../../../navigation/routes';
import type { MealType } from '../types/nutrition.types';
import MacroRow from '../components/nutrition/MacroRow';
import MealPicker from '../components/nutrition/MealPicker';

type DetailRoute = RouteProp<HealthStackParamList, typeof HealthRoutes.FOOD_DETAIL>;

const FoodDetailScreen = memo(() => {
  const { colors } = useTheme();
  const route = useRoute<DetailRoute>();
  const { foodId } = route.params;

  const { data: food, isLoading } = useFoodDetail(foodId);
  const { mutate: toggleFav, isPending: togglingFav } = useToggleFavourite();
  const { mutate: logMeal, isPending: isLogging } = useLogMeal();

  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  const [loggedSuccess, setLoggedSuccess] = useState(false);

  const handleFav = useCallback(() => { if (food) toggleFav(food._id); }, [food, toggleFav]);

  const handleLog = useCallback(() => {
    if (!food) return;
    logMeal(
      { mealType: selectedMeal, name: food.name, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, quantity: food.servingSize, unit: food.servingUnit as any },
      { onSuccess: () => { setLoggedSuccess(true); setTimeout(() => setLoggedSuccess(false), 2500); } },
    );
  }, [food, logMeal, selectedMeal]);

  if (isLoading || !food) {
    return (
      <Screen padded={false} safeArea={false}>
        <Header title="Food Detail" showBack backLabel="" />
        <AppView style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></AppView>
      </Screen>
    );
  }

  const dietMeta = DIET_TYPE_META[food.dietType];
  const totalMacroKcal = food.protein * 4 + food.carbs * 4 + food.fat * 9;
  const pPct = totalMacroKcal > 0 ? (food.protein * 4 / totalMacroKcal) * 100 : 0;
  const cPct = totalMacroKcal > 0 ? (food.carbs * 4 / totalMacroKcal) * 100 : 0;
  const fPct = totalMacroKcal > 0 ? (food.fat * 9 / totalMacroKcal) * 100 : 0;

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          title={food.name}
          showBack
          backLabel=""
          rightAction={
            <TouchableOpacity onPress={handleFav} style={styles.favBtn}>
              {togglingFav
                ? <ActivityIndicator size={16} color={colors.primary} />
                : <Icon name="Heart" size={22} color={food.isFavourite ? '#E63946' : withOpacity(colors.foreground, 0.3)} filled={food.isFavourite} />}
            </TouchableOpacity>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Hero card */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.heroCard, { backgroundColor: dietMeta.bg, borderColor: withOpacity(dietMeta.color, 0.2) }]}
          >
            {food.imageUrl
              ? <Image source={{ uri: food.imageUrl }} style={styles.heroImage} resizeMode="cover" />
              : <AppText style={styles.heroEmoji}>{dietMeta.emoji}</AppText>}
            <AppText variant="title2" weight="bold" color={dietMeta.color} align="center">{food.name}</AppText>
            <AppText variant="caption1" align="center" color={dietMeta.color} style={{ opacity: 0.7 }}>
              Per {food.servingSize} {food.servingUnit} serving
            </AppText>
            <View style={[styles.typeBadge, { backgroundColor: withOpacity(dietMeta.color, 0.12) }]}>
              <AppText variant="caption1" weight="semiBold" color={dietMeta.color}>{dietMeta.emoji} {dietMeta.label}</AppText>
            </View>
            <AppView style={styles.calHero}>
              <AppText variant="largeTitle" weight="bold" color={dietMeta.color}>{food.calories}</AppText>
              <AppText variant="subhead" color={dietMeta.color} style={{ opacity: 0.7 }}> kcal</AppText>
            </AppView>
          </Animated.View>

          {/* Nutrition breakdown */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <AppText variant="headline" style={styles.sectionTitle}>Nutrition Breakdown</AppText>
            <View style={[styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MacroRow label="Protein" value={food.protein} unit="g" color="#1A6B4A" percent={pPct} />
              <View style={styles.macroDivider} />
              <MacroRow label="Carbohydrates" value={food.carbs} unit="g" color="#2C5FA3" percent={cPct} />
              <View style={styles.macroDivider} />
              <MacroRow label="Fat" value={food.fat} unit="g" color="#B04C78" percent={fPct} />
              {food.fiber !== undefined && (
                <><View style={styles.macroDivider} /><MacroRow label="Fiber" value={food.fiber} unit="g" color="#7B3FA8" percent={(food.fiber / 30) * 100} /></>
              )}
              {food.sugar !== undefined && (
                <><View style={styles.macroDivider} /><MacroRow label="Sugar" value={food.sugar} unit="g" color="#C0652B" percent={(food.sugar / 50) * 100} /></>
              )}
            </View>
          </Animated.View>

          {/* Add to Log */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <AppText variant="headline" style={{ marginBottom: 4 }}>Add to Log</AppText>
            <AppText variant="caption1" style={{ marginBottom: 12 }}>Select a meal to add this food to your daily log.</AppText>
            <MealPicker selected={selectedMeal} onSelect={setSelectedMeal} />
            <Button
              label={isLogging ? 'Logging…' : loggedSuccess ? '✓ Added to Log!' : `Add to ${MEAL_META.find(m => m.type === selectedMeal)?.label}`}
              onPress={handleLog}
              disabled={isLogging}
              style={loggedSuccess ? { backgroundColor: '#1A6B4A' } : undefined}
            />
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </AppView>
    </Screen>
  );
});

FoodDetailScreen.displayName = 'FoodDetailScreen';
export default FoodDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 16 },
  heroCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', padding: 24, alignItems: 'center', gap: 8 },
  heroImage: { width: 120, height: 120, borderRadius: 16, marginBottom: 4 },
  heroEmoji: { fontSize: 56, lineHeight: 64 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  calHero: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  favBtn: { padding: 4 },
  sectionTitle: { marginBottom: 10 },
  macroCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: 16, gap: 12 },
  macroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.07)', marginHorizontal: -16 },
  logCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
});
