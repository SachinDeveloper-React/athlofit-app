// ─── MealLogBottomSheet.tsx ───────────────────────────────────────────────────
// Bottom sheet with two tabs:
//   • Search  — live search against the food catalog DB, tap to log instantly
//   • Custom  — manual entry form (name, calories, macros)

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet from '../../../../components/BottomSheet';
import { AppText, AppView, Button, Input } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useFoodCatalog } from '../../hooks/useNutrition';
import { useSearchLog } from '../../hooks/useSearchLog';
import { DIET_TYPE_META } from '../../types/nutrition.types';
import type { FoodItem, LogMealRequest, MealMeta, MealUnit } from '../../types/nutrition.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  meal: MealMeta;
  onClose: () => void;
  onSubmit: (entry: LogMealRequest) => void;
  isSubmitting?: boolean;
}

type TabId = 'search' | 'custom';

const UNITS: MealUnit[] = ['g', 'ml', 'serving', 'piece'];

// ─── Food Search Row ──────────────────────────────────────────────────────────

interface FoodRowProps {
  item: FoodItem;
  accentColor: string;
  onSelect: (item: FoodItem) => void;
}

const FoodRow = memo(({ item, accentColor, onSelect }: FoodRowProps) => {
  const { colors } = useTheme();
  const meta = DIET_TYPE_META[item.dietType];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onSelect(item)}
      style={[styles.foodRow, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      {/* Emoji / image thumbnail */}
      <View style={[styles.foodThumb, { backgroundColor: meta.bg }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.foodThumbImg} resizeMode="cover" />
        ) : (
          <AppText style={styles.foodThumbEmoji}>{meta.emoji}</AppText>
        )}
      </View>

      {/* Info */}
      <AppView style={styles.foodInfo}>
        <AppText variant="subhead" weight="semiBold" numberOfLines={1}>
          {item.name}
        </AppText>
        <AppView style={styles.foodMeta}>
          <AppText variant="caption2" style={{ color: meta.color }}>
            {meta.label}
          </AppText>
          <AppText variant="caption2" style={{ color: colors.mutedForeground }}>
            {' · '}{item.servingSize}{item.servingUnit}
          </AppText>
        </AppView>
        {/* Macro pills */}
        <AppView style={styles.macroPills}>
          <AppText style={[styles.macroPill, { backgroundColor: withOpacity('#1A6B4A', 0.1), color: '#1A6B4A' }]}>
            P {item.protein}g
          </AppText>
          <AppText style={[styles.macroPill, { backgroundColor: withOpacity('#2C5FA3', 0.1), color: '#2C5FA3' }]}>
            C {item.carbs}g
          </AppText>
          <AppText style={[styles.macroPill, { backgroundColor: withOpacity('#B04C78', 0.1), color: '#B04C78' }]}>
            F {item.fat}g
          </AppText>
        </AppView>
      </AppView>

      {/* Calories + add icon */}
      <AppView style={styles.foodRight}>
        <AppText variant="subhead" weight="bold" color={accentColor}>
          {item.calories}
        </AppText>
        <AppText variant="caption2" style={{ color: colors.mutedForeground }}>kcal</AppText>
        <View style={[styles.addCircle, { backgroundColor: accentColor }]}>
          <Icon name="Plus" size={12} color="#fff" />
        </View>
      </AppView>
    </TouchableOpacity>
  );
});

FoodRow.displayName = 'FoodRow';

// ─── Search Tab ───────────────────────────────────────────────────────────────

interface SearchTabProps {
  meal: MealMeta;
  onSelect: (item: FoodItem, index: number) => void;
}

const SearchTab = memo(({ meal, onSelect }: SearchTabProps) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { logQuery } = useSearchLog({ screen: 'MealLogBottomSheet', mealType: meal.type });

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text);
      if (text.trim().length >= 2) logQuery(text);
    }, 500);
  }, [logQuery]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const params = debouncedQuery.trim().length >= 2
    ? { search: debouncedQuery, limit: 30 }
    : { limit: 30 };

  const { data, isLoading } = useFoodCatalog(params);
  const foods = data?.foods ?? [];

  const renderItem = useCallback(
    ({ item, index }: { item: FoodItem; index: number }) => (
      <FoodRow item={item} accentColor={meal.color} onSelect={f => onSelect(f, index)} />
    ),
    [meal.color, onSelect],
  );

  return (
    <AppView style={styles.searchTab}>
      {/* Search input */}
      <AppView style={[styles.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Icon name="Search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={handleChange}
          placeholder="Search foods, e.g. banana, kela…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          autoFocus={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setDebouncedQuery(''); }}>
            <Icon name="X" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </AppView>

      {/* Results */}
      {isLoading ? (
        <AppView style={styles.loader}>
          <ActivityIndicator color={meal.color} />
        </AppView>
      ) : foods.length === 0 ? (
        <AppView style={styles.emptySearch}>
          <AppText style={{ fontSize: 32 }}>🍽️</AppText>
          <AppText variant="subhead" style={{ marginTop: 8 }}>
            {debouncedQuery.length >= 2 ? 'No results found' : 'Start typing to search'}
          </AppText>
          <AppText variant="caption1" align="center" style={{ marginTop: 4, opacity: 0.6 }}>
            {debouncedQuery.length >= 2
              ? 'Try a different term or add it manually.'
              : 'Or switch to Custom to enter manually.'}
          </AppText>
        </AppView>
      ) : (
        <FlatList
          data={foods}
          keyExtractor={f => f._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.foodList}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </AppView>
  );
});

SearchTab.displayName = 'SearchTab';

// ─── Custom Tab ───────────────────────────────────────────────────────────────

interface CustomTabProps {
  meal: MealMeta;
  onSubmit: (entry: LogMealRequest) => void;
  isSubmitting?: boolean;
  /** Pre-fill from a selected food item */
  prefill?: FoodItem | null;
}

const CustomTab = memo(({ meal, onSubmit, isSubmitting, prefill }: CustomTabProps) => {
  const { colors } = useTheme();

  const [name, setName]         = useState(prefill?.name ?? '');
  const [calories, setCalories] = useState(prefill ? String(prefill.calories) : '');
  const [protein, setProtein]   = useState(prefill ? String(prefill.protein) : '');
  const [carbs, setCarbs]       = useState(prefill ? String(prefill.carbs) : '');
  const [fat, setFat]           = useState(prefill ? String(prefill.fat) : '');
  const [quantity, setQuantity] = useState(prefill ? String(prefill.servingSize) : '1');
  const [unit, setUnit]         = useState<MealUnit>((prefill?.servingUnit as MealUnit) ?? 'serving');
  const [errors, setErrors]     = useState<{ name?: string; calories?: string }>({});

  // Sync prefill when it changes (user picked a food from search)
  useEffect(() => {
    if (!prefill) return;
    setName(prefill.name);
    setCalories(String(prefill.calories));
    setProtein(String(prefill.protein));
    setCarbs(String(prefill.carbs));
    setFat(String(prefill.fat));
    setQuantity(String(prefill.servingSize));
    setUnit((prefill.servingUnit as MealUnit) ?? 'serving');
    setErrors({});
  }, [prefill]);

  const validate = useCallback(() => {
    const err: typeof errors = {};
    if (!name.trim()) err.name = 'Food name is required';
    if (!calories.trim() || isNaN(Number(calories)) || Number(calories) <= 0)
      err.calories = 'Enter a valid calorie amount';
    setErrors(err);
    return Object.keys(err).length === 0;
  }, [name, calories]);

  const handleSubmit = useCallback(() => {
    if (!validate()) return;
    onSubmit({
      mealType: meal.type,
      name: name.trim(),
      calories: Number(calories),
      protein: protein ? Number(protein) : undefined,
      carbs: carbs ? Number(carbs) : undefined,
      fat: fat ? Number(fat) : undefined,
      quantity: quantity ? Number(quantity) : undefined,
      unit,
    });
  }, [validate, meal.type, name, calories, protein, carbs, fat, quantity, unit, onSubmit]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.customScroll}
    >
      {prefill && (
        <AppView style={[styles.prefillBanner, { backgroundColor: withOpacity(meal.color, 0.08), borderColor: withOpacity(meal.color, 0.2) }]}>
          <Icon name="CheckCircle" size={14} color={meal.color} />
          <AppText variant="caption1" color={meal.color} style={{ flex: 1 }}>
            Auto-filled from <AppText variant="caption1" weight="semiBold" color={meal.color}>{prefill.name}</AppText>. Edit if needed.
          </AppText>
        </AppView>
      )}

      <Input label="Food Name *" placeholder="e.g. Grilled Chicken" value={name}
        onChangeText={setName} error={errors.name} autoCapitalize="words" />

      <Input label="Calories (kcal) *" placeholder="e.g. 350" value={calories}
        onChangeText={setCalories} keyboardType="numeric" error={errors.calories} />

      {/* Quantity + Unit */}
      <AppView style={styles.qtyRow}>
        <Input label="Quantity" placeholder="1" value={quantity}
          onChangeText={setQuantity} keyboardType="numeric" containerStyle={styles.qtyInput} />
        <AppView style={styles.unitWrap}>
          <AppText variant="label" style={styles.unitLabel}>Unit</AppText>
          <AppView style={styles.unitChips}>
            {UNITS.map(u => (
              <AppView key={u} style={[styles.unitChip,
                unit === u ? { backgroundColor: meal.color } : { borderColor: colors.border, borderWidth: 1 }]}
                onTouchEnd={() => setUnit(u)}>
                <AppText variant="caption1" weight={unit === u ? 'semiBold' : 'regular'}
                  color={unit === u ? '#fff' : undefined}>{u}</AppText>
              </AppView>
            ))}
          </AppView>
        </AppView>
      </AppView>

      {/* Macros */}
      <AppText variant="label" style={styles.macroHeader}>Macronutrients (optional)</AppText>
      <AppView style={styles.macroRow}>
        <Input label="Protein (g)" placeholder="0" value={protein} onChangeText={setProtein}
          keyboardType="numeric" containerStyle={styles.macroInput} />
        <Input label="Carbs (g)" placeholder="0" value={carbs} onChangeText={setCarbs}
          keyboardType="numeric" containerStyle={styles.macroInput} />
        <Input label="Fat (g)" placeholder="0" value={fat} onChangeText={setFat}
          keyboardType="numeric" containerStyle={styles.macroInput} />
      </AppView>

      <Button label={isSubmitting ? 'Logging…' : 'Log Meal'} onPress={handleSubmit}
        disabled={isSubmitting} style={[styles.submitBtn, { backgroundColor: meal.color }]} />
    </ScrollView>
  );
});

CustomTab.displayName = 'CustomTab';

// ─── Main Bottom Sheet ────────────────────────────────────────────────────────

export const MealLogBottomSheet = memo(
  ({ visible, meal, onClose, onSubmit, isSubmitting }: Props) => {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<TabId>('search');
    const [prefill, setPrefill] = useState<FoodItem | null>(null);
    const { logClick } = useSearchLog({ screen: 'MealLogBottomSheet', mealType: meal.type });

    const handleClose = useCallback(() => {
      setPrefill(null);
      setActiveTab('search');
      onClose();
    }, [onClose]);

    const handleSubmit = useCallback(
      (entry: LogMealRequest) => {
        onSubmit(entry);
        setPrefill(null);
        setActiveTab('search');
      },
      [onSubmit],
    );

    // User tapped a food row in Search tab → log the click, switch to Custom with prefill
    const handleFoodSelect = useCallback(
      (item: FoodItem, index: number) => {
        logClick({ query: '', item, position: index });
        setPrefill(item);
        setActiveTab('custom');
      },
      [logClick],
    );

    const tabs: { id: TabId; label: string; icon: string }[] = [
      { id: 'search', label: 'Search', icon: '🔍' },
      { id: 'custom', label: 'Custom', icon: '✏️' },
    ];

    return (
      <BottomSheet
        visible={visible}
        onClose={handleClose}
        title={`Add to ${meal.label}`}
        snapHeight="92%"
        showCloseButton
        closeOnBackdrop={!isSubmitting}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          {/* Meal badge */}
          <AppView style={[styles.mealBadge, { backgroundColor: withOpacity(meal.color, 0.08) }]}>
            <AppText style={styles.mealEmoji}>{meal.emoji}</AppText>
            <AppView>
              <AppText variant="headline" color={meal.color}>{meal.label}</AppText>
              <AppText variant="caption2">{meal.timeHint}</AppText>
            </AppView>
          </AppView>

          {/* Tab switcher */}
          <AppView style={[styles.tabBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            {tabs.map(t => {
              const isActive = activeTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.tabBtn,
                    isActive && { backgroundColor: meal.color, shadowColor: meal.color, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
                  ]}
                >
                  <AppText style={{ fontSize: 13 }}>{t.icon}</AppText>
                  <AppText
                    variant="caption1"
                    weight={isActive ? 'semiBold' : 'regular'}
                    color={isActive ? '#fff' : colors.mutedForeground}
                  >
                    {t.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </AppView>

          {/* Tab content */}
          {activeTab === 'search' ? (
            <SearchTab meal={meal} onSelect={handleFoodSelect} />
          ) : (
            <CustomTab
              meal={meal}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              prefill={prefill}
            />
          )}
        </KeyboardAvoidingView>
      </BottomSheet>
    );
  },
);

MealLogBottomSheet.displayName = 'MealLogBottomSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: { flex: 1 },

  mealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 10,
  },
  mealEmoji: { fontSize: 26 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },

  // Search tab
  searchTab: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptySearch: { flex: 1, alignItems: 'center', paddingTop: 40, gap: 4 },
  foodList: { paddingBottom: 20 },

  // Food row
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  foodThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  foodThumbImg: { width: '100%', height: '100%' },
  foodThumbEmoji: { fontSize: 26 },
  foodInfo: { flex: 1, gap: 3 },
  foodMeta: { flexDirection: 'row', alignItems: 'center' },
  macroPills: { flexDirection: 'row', gap: 4, marginTop: 2 },
  macroPill: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  foodRight: { alignItems: 'center', gap: 2 },
  addCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Custom tab
  customScroll: { paddingBottom: 24 },
  prefillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
  qtyRow: { flexDirection: 'row', gap: 12 },
  qtyInput: { width: 100 },
  unitWrap: { flex: 1 },
  unitLabel: { marginBottom: 6 },
  unitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  macroHeader: { marginBottom: 8 },
  macroRow: { flexDirection: 'row', gap: 8 },
  macroInput: { flex: 1, marginBottom: 0 },
  submitBtn: { marginTop: 8 },
});
